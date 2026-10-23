"use client";

import { useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { ForecastChart } from "@/components/charts/ForecastChart";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { PageIntro } from "@/components/layout/PageIntro";
import { Button, Card, ConfirmModal, DataTable, EmptyState, KV, Select, Tag, Tile, cx } from "@/components/ui";
import type { VideApi } from "@/lib/api";
import { TEMP_FAIL_C, VIB_FAIL_MM_S } from "@/lib/constants";
import { buildAnalyzeRequest } from "@/lib/domain/analyze";
import { computeMath, fuseVerdict, riskLabel, type MathResult, type Verdict } from "@/lib/domain/forecast";
import { dailyAggregates, deepContextText } from "@/lib/domain/messages";
import { TONE_BORDER, TONE_TEXT, URGENCY_TONE } from "@/lib/domain/status";
import { dateOf, dateTimeOf, signed } from "@/lib/format";
import { STORAGE_KEYS } from "@/lib/storage";
import type { AnalyzeResponse, PredictionLogEntry } from "@/lib/types";
import { useLocalStore } from "@/hooks/useLocalStore";
import { useMachineParam } from "@/hooks/useMachineParam";
import { useMachines } from "@/hooks/useMachines";
import { useMaintenance } from "@/hooks/useMaintenance";
import { usePoll } from "@/hooks/usePoll";
import { useReadings } from "@/hooks/useReadings";
import { useApi } from "@/providers/ApiProvider";
import { usePageTitle } from "@/providers/PageTitleProvider";
import { useToast } from "@/providers/ToastProvider";
import { PrintReport } from "./PrintReport";

/**
 * History depth. The time span depends on how often devices post — 3000 readings is ≈2 months
 * at one reading per 30 min, but only ≈2.5 h at one per 3 s — so the page shows the real span.
 */
const DEPTHS = [
  { value: 200, label: "last 200 readings" },
  { value: 1000, label: "last 1000 readings" },
  { value: 3000, label: "deep window (3000 readings)" },
] as const;

const LOG_LIMIT = 20;

function spanText(hours: number): string {
  return hours < 48 ? `${hours.toFixed(1)}h` : `${(hours / 24).toFixed(1)} days`;
}

function slopeText(math: MathResult): string {
  return `temp ${signed(math.temp.slope, 3)}°C/h · vib ${signed(math.vib.slope, 4)}mm/s/h`;
}

function mathSummary(math: MathResult | null, rows: number): string {
  if (!math) return rows ? "need ≥3 readings" : "—";
  if (math.hours === 0) return `${math.driver} already past its failure threshold (${slopeText(math)})`;
  return Number.isFinite(math.hours) ? `${math.hours.toFixed(0)}h via ${math.driver} trend (${slopeText(math)})` : "stable — no threshold crossing on current trend";
}

function mlSummary(res: AnalyzeResponse | null, error: string | null): string {
  if (error) return "cortex unreachable";
  if (!res) return "—";
  const ml = res.ml_prediction;
  if (!ml) return "model not loaded";
  return `${ml.fault_type} ${(ml.fault_type_confidence * 100).toFixed(0)}% · ${ml.hours_to_maintenance?.toFixed(0) ?? "—"}h · ${ml.top_factors.slice(0, 2).join("; ")}`;
}

export function PredictionsView() {
  const { api } = useApi();
  const toast = useToast();
  const { machines } = useMachines();
  const [profiles] = useLocalStore(STORAGE_KEYS.profiles);
  const [predLog, updatePredLog] = useLocalStore(STORAGE_KEYS.predictions);
  const [machine, selectMachine] = useMachineParam(machines);
  const [depth, setDepth] = useState(1000);
  const [cortex, setCortex] = useState<{ api: VideApi; machine: string; res: AnalyzeResponse | null; error: string | null } | null>(null);
  const [running, setRunning] = useState(false);
  const [lastLlm, setLastLlm] = useState("");
  const [chartImage, setChartImage] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);
  const chartRef = useRef<HTMLCanvasElement>(null);

  usePageTitle(machine ?? "Cortex forecasts");
  const { oldest, error: historyError, loaded, reload } = useReadings(machine, depth, null);
  const { rows: maintenanceRows } = useMaintenance(machine);

  const math = useMemo(() => computeMath(oldest), [oldest]);
  const daily = useMemo(() => dailyAggregates(oldest), [oldest]);
  const currentCortex = cortex && cortex.api === api && cortex.machine === machine ? cortex : null;
  const verdict: Verdict = useMemo(() => fuseVerdict(currentCortex?.res ?? null, math), [currentCortex, math]);
  const log = useMemo(() => (machine ? (predLog[machine] ?? []).slice(-LOG_LIMIT).reverse() : []), [predLog, machine]);

  const first = oldest[0];
  const last = oldest[oldest.length - 1];
  const windowText = first && last ? `${oldest.length} pts · ${dateOf(first.timestamp)} → ${dateOf(last.timestamp)} · span ${spanText(math?.spanHours ?? 0)}` : "no data — POST /api/readings first";

  /** Append a run to the audit log, skipping exact repeats of the previous entry. */
  const appendLog = (name: string, v: Verdict, fromCortex: boolean) => {
    const entry: PredictionLogEntry = {
      ts: new Date().toISOString(),
      fault: v.fault,
      conf: v.confidence,
      urg: v.urgency,
      hours: Number.isFinite(v.hours) ? Math.round(v.hours) : null,
      risk: v.risk,
      action: v.action,
      src: `${fromCortex ? "cortex+" : ""}math`,
    };
    updatePredLog((all) => {
      const list = all[name] ?? [];
      const prev = list[list.length - 1];
      const repeat = prev && prev.fault === entry.fault && prev.urg === entry.urg && prev.hours === entry.hours && prev.risk === entry.risk;
      return repeat ? all : { ...all, [name]: [...list, entry].slice(-200) };
    });
  };

  /**
   * API: POST /diagnostics/analyze with use_llm:false — the ML verdict for the latest reading.
   * (The old page sent use_llm:true on every load but never showed the narrative; the LLM is
   * used in the chat panel below instead.)
   */
  const runCortex = async () => {
    if (!machine) return;
    setRunning(true);
    const res = await api.analyze(buildAnalyzeRequest(machine, last ?? null, profiles[machine], { useLlm: false }));
    setRunning(false);
    setCortex({ api, machine, res: res.ok ? res.data : null, error: res.ok ? null : res.error });
    appendLog(machine, fuseVerdict(res.ok ? res.data : null, math), res.ok);
    if (!res.ok) toast(`Cortex failed: ${res.error}`);
  };

  // Re-run the verdict whenever a new history window arrives.
  usePoll(runCortex, null, { key: oldest, enabled: loaded && oldest.length > 0 });

  const print = () => {
    flushSync(() => setChartImage(chartRef.current?.toDataURL("image/png") ?? null));
    window.print();
  };

  const tone = URGENCY_TONE[verdict.urgency];
  const hoursText = Number.isFinite(verdict.hours) ? `${verdict.hours.toFixed(0)}h left (${(verdict.hours / 24).toFixed(1)} days)` : "—";

  return (
    <div className="flex flex-col gap-3.5">
      <div className="no-print flex flex-col gap-3.5">
        <PageIntro title="Predictions">Cortex verdict on when machines fail, what to change, math log, deep-history LLM context, printable report.</PageIntro>

        <Card label="TARGET + HISTORY DEPTH">
          <div className="flex flex-wrap gap-2.5">
            <Select aria-label="Machine" className="min-w-[180px] flex-1" value={machine ?? ""} onChange={(e) => selectMachine(e.target.value)}>
              {machines.length === 0 && <option value="">— no machines —</option>}
              {machines.map((m) => (
                <option key={m.machine_name} value={m.machine_name}>
                  {m.machine_name}
                </option>
              ))}
            </Select>
            <Select aria-label="History depth" className="w-auto flex-none" value={depth} onChange={(e) => setDepth(Number(e.target.value))}>
              {DEPTHS.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </Select>
            <Button onClick={() => void reload()}>Load + Predict</Button>
          </div>
          <KV k="Status" valueClassName={historyError ? "text-crit" : undefined}>
            {historyError ? `History fetch failed — ${historyError}` : loaded ? `Connected — ${oldest.length} readings` : machine ? "Loading history…" : "No machines yet"}
          </KV>
          <KV k="History window">{windowText}</KV>
        </Card>

        {!machine ? (
          <EmptyState>No machines yet — POST a reading to /api/readings or add one on the Machines page.</EmptyState>
        ) : (
          <>
            <Card accent="cloud" label={<>CORTEX VERDICT — WHEN IT FAILS · WHAT TO CHANGE <Tag tone="cloud">ML + TREND FUSION</Tag></>}>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Tile size="md" label="PREDICTED FAILURE" value={verdict.when ? dateTimeOf(verdict.when.toISOString()) : "no failure forecast"} sub={hoursText} />
                <Tile size="md" label="FAULT" value={verdict.fault} sub={verdict.confidence} />
                <Tile size="md" label="URGENCY" value={<span className={TONE_TEXT[tone]}>{verdict.urgency.toUpperCase()}</span>} sub={`cortex ${currentCortex?.res ? "✓" : "…"} · math ${math ? "✓" : "…"}`} />
                <Tile label="RISK (0-100)" value={verdict.risk} sub={riskLabel(verdict.risk)} pulseKey={verdict.risk} />
              </div>
              <div className={cx("mt-2.5 border-2 px-3.5 py-3 text-xs", oldest.length ? TONE_BORDER[tone] : "border-line-lit")}>
                {oldest.length ? (
                  <>
                    <b className={TONE_TEXT[tone]}>{verdict.urgency.toUpperCase()}</b> — {verdict.fault}
                    {verdict.when && (
                      <>
                        {" "}
                        · expected <b>{dateOf(verdict.when.toISOString())}</b> ({verdict.hours.toFixed(0)}h)
                      </>
                    )}
                    <div>{verdict.action}</div>
                  </>
                ) : (
                  "Load a machine to compute the fused forecast."
                )}
              </div>
              <KV k="What to change / do">{verdict.action}</KV>
              <KV k="Cortex ML (latest reading)">{mlSummary(currentCortex?.res ?? null, currentCortex?.error ?? null)}</KV>
              <KV k="Math trend (regression)">{mathSummary(math, oldest.length)}</KV>
              <div className="mt-2.5 flex flex-wrap gap-2.5">
                <Button onClick={() => void runCortex()} disabled={running}>
                  {running ? "Querying…" : "Re-run Cortex"}
                </Button>
                <Button variant="secondary" onClick={print}>
                  Print report
                </Button>
              </div>
            </Card>

            <Card label="DEGRADATION GRAPH — HISTORY (SOLID) + FORECAST (DASHED) + FAILURE LINES">
              <ForecastChart rows={oldest} math={math} canvasRef={chartRef} />
              <div className="mt-2 flex flex-wrap gap-3 text-[10px] text-dim">
                <span>
                  <span className="mr-1.5 inline-block size-[9px] bg-[var(--chart-temp)]" />
                  TEMP °C (0–100)
                </span>
                <span>
                  <span className="mr-1.5 inline-block size-[9px] bg-[var(--chart-vib)]" />
                  VIB mm/s (0–10)
                </span>
                <span>- - failure thresholds ({TEMP_FAIL_C}°C / {VIB_FAIL_MM_S}mm/s)</span>
                <span>- - forecast trend</span>
              </div>
              <KV k="Slopes">
                {math
                  ? `${slopeText(math)}${math.hours === 0 ? " · threshold already crossed" : Number.isFinite(math.hours) ? ` · RUL ${math.hours.toFixed(0)}h via ${math.driver}` : " · no upward trend — no math failure in sight"}`
                  : "need ≥3 readings"}
              </KV>
            </Card>

            <Card label="MATH PREDICTIONS LOG — EVERY MODEL RUN, AUDITABLE">
              {log.length === 0 ? (
                <EmptyState>No predictions yet — load a machine.</EmptyState>
              ) : (
                <DataTable
                  rows={log}
                  rowKey={(r) => r.ts}
                  columns={[
                    { header: "TIME", cell: (r) => dateTimeOf(r.ts) },
                    { header: "MODEL", cell: (r) => `${r.src} · ${r.urg}` },
                    { header: "FAULT", cell: (r) => r.fault },
                    { header: "HRS", cell: (r) => r.hours ?? "—" },
                    { header: "CONF", cell: (r) => r.conf },
                    { header: "RISK", cell: (r) => r.risk },
                  ]}
                />
              )}
              <div className="mt-2.5">
                <Button variant="secondary" size="sm" onClick={() => setClearing(true)} disabled={log.length === 0}>
                  Clear log
                </Button>
              </div>
            </Card>

            <Card label={<>LLM — DEEP MACHINE CONTEXT <Tag tone="cloud">DEEP HISTORY</Tag></>}>
              <KV k="Deep context">{oldest.length ? `${windowText} · daily aggregates ready` : "no context — no readings"}</KV>
              <ChatPanel
                key={machine}
                example="Given the vibration + heat history, what is degrading and what should I replace first?"
                placeholder="Ask about this machine's history..."
                contextLabel="Attach deep context (daily aggregates + verdict + math log + maintenance)"
                getContext={() =>
                  deepContextText({ machineName: machine, profile: profiles[machine], daily, maintenance: maintenanceRows, log: [...log].reverse(), verdict })
                }
                onAnswer={setLastLlm}
              />
              <p className="mt-2 text-[10px] text-dim2">Long windows are downsampled to one line per day so the prompt stays small.</p>
            </Card>
          </>
        )}

        <ConfirmModal
          open={clearing}
          title="CLEAR LOG"
          message={`Delete all logged predictions for ${machine ?? ""}?`}
          confirmLabel="Clear"
          onConfirm={() => {
            if (machine) updatePredLog((all) => ({ ...all, [machine]: [] }));
            setClearing(false);
          }}
          onClose={() => setClearing(false)}
        />
      </div>

      {machine && (
        <PrintReport
          machine={machine}
          windowText={windowText}
          verdict={verdict}
          mlText={mlSummary(currentCortex?.res ?? null, currentCortex?.error ?? null)}
          mathText={mathSummary(math, oldest.length)}
          chartImage={chartImage}
          log={log.slice(0, 10)}
          maintenance={maintenanceRows.slice(-10).reverse()}
          llmNote={lastLlm}
        />
      )}
    </div>
  );
}
