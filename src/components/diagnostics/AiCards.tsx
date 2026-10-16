"use client";

import { AnalysisSummary } from "@/components/shared/AnalysisSummary";
import { Button, Card, KV, Tag, cx } from "@/components/ui";
import { fuseEdgeCloud } from "@/lib/domain/analyze";
import { TONE_BORDER, TONE_TEXT, URGENCY_TONE } from "@/lib/domain/status";
import { fmt } from "@/lib/format";
import type { AnalyzeResponse } from "@/lib/types";

export interface RunState {
  result: AnalyzeResponse | null;
  ms: number | null;
  error: string | null;
  running: boolean;
}

export const IDLE: RunState = { result: null, ms: null, error: null, running: false };

function statusText(s: RunState, verb: string): string {
  if (s.running) return `${verb}…`;
  if (s.error) return `failed: ${s.error}`;
  if (s.result) return `ok (${s.ms} ms)`;
  return "not run";
}

/** LLM text, or why there is none. */
export function narrativeOf(res: AnalyzeResponse): string {
  if (res.llm_analysis) return res.llm_analysis;
  if (res.llm_error) return `LLM unavailable — ${res.llm_error}`;
  return "No narrative returned (LLM disabled on backend?)";
}

export function EdgeCard({ state, onRun }: { state: RunState; onRun: () => void }) {
  return (
    <Card accent="edge" label={<>LOCAL EDGE COMPUTE NODE <Tag tone="edge">ON-PREM / LOW LATENCY</Tag></>}>
      <KV k="Endpoint">POST /diagnostics/analyze (use_llm:false, force_ml:true)</KV>
      <KV k="Node status">{statusText(state, "running")}</KV>
      <div className="mt-2.5">
        <Button onClick={onRun} disabled={state.running}>
          {state.running ? "Running…" : "Run edge analysis"}
        </Button>
      </div>
      {state.result && (
        <div className="mt-2">
          <AnalysisSummary result={state.result} latencyMs={state.ms ?? undefined} />
        </div>
      )}
    </Card>
  );
}

export function CloudCard({ state, onRun }: { state: RunState; onRun: () => void }) {
  const res = state.result;
  const ml = res?.ml_prediction;
  const urgency = res?.fused_diagnosis.overall_urgency;
  return (
    <Card accent="cloud" label={<>CLOUD MODEL CORTEX <Tag tone="cloud">CLOUD / DEEP MODEL</Tag></>}>
      <KV k="Endpoint">POST /diagnostics/analyze (use_llm:true)</KV>
      <KV k="Cortex status">{statusText(state, "querying")}</KV>
      <p className="mt-1 text-[10px] text-dim2">Same rules + ML as edge, plus the LLM narrative.</p>
      <div className="mt-2.5">
        <Button onClick={onRun} disabled={state.running}>
          {state.running ? "Querying…" : "Run cloud analysis"}
        </Button>
      </div>
      {res && (
        <div className="mt-2">
          <KV k="Cloud verdict">{ml?.fault_type ?? res.primary_fault?.type ?? "Normal"}</KV>
          <KV k="Confidence">{fmt.pct01(ml?.fault_type_confidence)}</KV>
          <KV k="Hours to maintenance">{fmt.hours(ml?.hours_to_maintenance)}</KV>
          <KV k="Urgency" valueClassName={urgency ? TONE_TEXT[URGENCY_TONE[urgency]] : undefined}>
            {urgency ?? "—"}
          </KV>
          <KV k="Narrative" valueClassName={cx("font-normal whitespace-pre-wrap", !res.llm_analysis && "text-dim")}>
            {narrativeOf(res)}
          </KV>
          <KV k="Latency">{state.ms} ms</KV>
        </div>
      )}
    </Card>
  );
}

export function VerdictCard({ edge, cloud, onRunBoth, onLog, busy }: { edge: RunState; cloud: RunState; onRunBoth: () => void; onLog: () => void; busy: boolean }) {
  const fused = fuseEdgeCloud(edge.result, cloud.result);
  const ran = !!(edge.result || cloud.result);
  const tone = URGENCY_TONE[fused.urgency];
  const edgeMl = edge.result?.ml_prediction;

  return (
    <Card label="AI VERDICT — WHAT THE MODELS THINK IS WRONG">
      <div className={cx("mt-2.5 border-2 px-3.5 py-3 text-xs", ran ? TONE_BORDER[tone] : "border-line-lit")}>
        {!ran ? (
          "Run edge and/or cloud analysis above to get a verdict."
        ) : !fused.edgeFault && !fused.cloudFault ? (
          <>
            Both models report <b>NORMAL</b> — no fault detected.
          </>
        ) : (
          <>
            <b className={TONE_TEXT[tone]}>{fused.urgency.toUpperCase()}</b>
            {fused.edgeFault && (
              <div>
                EDGE: {fused.edgeFault} ({fmt.pct01(edgeMl?.fault_type_confidence)}, {fmt.hours(edgeMl?.hours_to_maintenance)} left)
              </div>
            )}
            {fused.cloudFault && cloud.result && (
              <div>
                CLOUD: {fused.cloudFault} — {narrativeOf(cloud.result)}
              </div>
            )}
            {fused.match !== null && (
              <div className="mt-1 text-dim">
                Agreement: {edge.result?.fused_diagnosis.agreement || "—"} · edge vs cloud {fused.match ? "MATCH" : "DIFFER — trust higher urgency"}
              </div>
            )}
          </>
        )}
      </div>
      <div className="mt-2.5 flex flex-wrap gap-2.5">
        <Button variant="secondary" onClick={onRunBoth} disabled={busy}>
          Run both + fuse
        </Button>
        <Button variant="secondary" onClick={onLog} disabled={!ran}>
          Log verdict to maintenance
        </Button>
      </div>
    </Card>
  );
}

/** Plain-text verdict for the maintenance log. */
export function verdictText(edge: RunState, cloud: RunState): string {
  const f = fuseEdgeCloud(edge.result, cloud.result);
  const parts = [f.urgency.toUpperCase()];
  if (f.edgeFault) parts.push(`EDGE: ${f.edgeFault}`);
  if (f.cloudFault && cloud.result) parts.push(`CLOUD: ${f.cloudFault} — ${narrativeOf(cloud.result)}`);
  if (!f.edgeFault && !f.cloudFault) parts.push("Both models report NORMAL");
  return parts.join(" · ").slice(0, 300);
}
