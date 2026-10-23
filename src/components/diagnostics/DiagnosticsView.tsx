"use client";

import { useState } from "react";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { PageIntro } from "@/components/layout/PageIntro";
import { Button, Card, EmptyState, KV, Select, Tag } from "@/components/ui";
import { buildAnalyzeRequest } from "@/lib/domain/analyze";
import { buildDiagnosticsMessage, diagnosticsContext, trendText } from "@/lib/domain/messages";
import { trend } from "@/lib/domain/readings";
import { todayIso } from "@/lib/format";
import { STORAGE_KEYS } from "@/lib/storage";
import type { MaintenanceRecord } from "@/lib/types";
import { useLocalStore } from "@/hooks/useLocalStore";
import { useMachineParam } from "@/hooks/useMachineParam";
import { useMachines } from "@/hooks/useMachines";
import { useMaintenance } from "@/hooks/useMaintenance";
import { useReadings } from "@/hooks/useReadings";
import { useApi } from "@/providers/ApiProvider";
import { usePageTitle } from "@/providers/PageTitleProvider";
import { useToast } from "@/providers/ToastProvider";
import { CloudCard, EdgeCard, IDLE, VerdictCard, verdictText, type RunState } from "./AiCards";
import { EngineerCard } from "./EngineerCard";
import { HistoryGraphCard } from "./HistoryGraphCard";
import { LiveStats } from "./LiveStats";
import { MaintenanceCard } from "./MaintenanceCard";

const RANGES = [30, 60, 120] as const;

export function DiagnosticsView() {
  const { api } = useApi();
  const toast = useToast();
  const { machines } = useMachines();
  const [profiles] = useLocalStore(STORAGE_KEYS.profiles);
  const [machine, selectMachine] = useMachineParam(machines);
  const [range, setRange] = useState<number>(60);
  const [live, setLive] = useState(true);
  const [intervalMs, setIntervalMs] = useState(3000);
  // Edge/cloud results belong to one machine; switching machine clears them.
  const [runs, setRuns] = useState<{ machine: string | null; edge: RunState; cloud: RunState }>({ machine: null, edge: IDLE, cloud: IDLE });

  usePageTitle(machine ?? "Edge + Cloud diagnosis");
  const { oldest, error, reload } = useReadings(machine, range, live ? intervalMs : null);
  const maintenance = useMaintenance(machine);
  const profile = machine ? profiles[machine] : undefined;

  const edge = runs.machine === machine ? runs.edge : IDLE;
  const cloud = runs.machine === machine ? runs.cloud : IDLE;
  const last = oldest[oldest.length - 1] ?? null;
  const trendLine = trendText(trend(oldest));
  const msgInput = { machineName: machine ?? "", last, trend: trendLine, edge: edge.result, cloud: cloud.result };

  const setRun = (kind: "edge" | "cloud", state: RunState) =>
    setRuns((r) => ({ ...(r.machine === machine ? r : { machine, edge: IDLE, cloud: IDLE }), [kind]: state }));

  /** API: POST /diagnostics/analyze — edge = use_llm:false, cloud = use_llm:true (see endpoints.ts). */
  const run = async (kind: "edge" | "cloud") => {
    if (!machine) return;
    const prev = kind === "edge" ? edge : cloud;
    setRun(kind, { ...prev, running: true, error: null });
    const res = await api.analyze(buildAnalyzeRequest(machine, last, profile, { useLlm: kind === "cloud" }));
    if (res.ok) setRun(kind, { result: res.data, ms: res.ms, error: null, running: false });
    else {
      setRun(kind, { ...prev, running: false, error: res.error });
      toast(`${kind === "edge" ? "Edge" : "Cloud"} analysis failed: ${res.error}`);
    }
  };

  const addMaintenance = async (record: MaintenanceRecord) => {
    const where = await maintenance.add(record);
    toast(where === "backend" ? "Saved to backend" : where === "local" ? "Backend unreachable — saved locally" : "Could not save (storage full?)");
  };

  return (
    <div className="flex flex-col gap-3.5">
      <PageIntro title="Diagnostics">Pick a machine to graph its behaviour, compare edge vs cloud AI verdicts, review maintenance, ping the engineer, or ask the LLM.</PageIntro>

      <Card label="TARGET">
        <div className="flex flex-wrap gap-2.5">
          <Select aria-label="Machine" className="min-w-[180px] flex-1" value={machine ?? ""} onChange={(e) => selectMachine(e.target.value)}>
            {machines.length === 0 && <option value="">— no machines —</option>}
            {machines.map((m) => (
              <option key={m.machine_name} value={m.machine_name}>
                {m.machine_name}
              </option>
            ))}
          </Select>
          <Select aria-label="History range" className="w-auto flex-none" value={range} onChange={(e) => setRange(Number(e.target.value))}>
            {RANGES.map((n) => (
              <option key={n} value={n}>
                last {n}
              </option>
            ))}
          </Select>
          <Button onClick={() => void reload()}>Load</Button>
        </div>
        <KV k="Status" valueClassName={error ? "text-crit" : undefined}>
          {error ? `History fetch failed — ${error}` : machine ? `${oldest.length} readings loaded` : "No machines yet"}
        </KV>
      </Card>

      {!machine ? (
        <EmptyState>No machines yet — POST a reading to /api/readings or add one on the Machines page.</EmptyState>
      ) : (
        <>
          <LiveStats machine={machine} rows={oldest} range={range} ratedKw={profile?.rated_load_kw ?? ""} />
          <HistoryGraphCard rows={oldest} live={live} onLiveChange={setLive} intervalMs={intervalMs} onIntervalChange={setIntervalMs} trend={trendLine} />

          <div className="grid gap-3.5 lg:grid-cols-2">
            <EdgeCard state={edge} onRun={() => void run("edge")} />
            <CloudCard state={cloud} onRun={() => void run("cloud")} />
          </div>

          <VerdictCard
            edge={edge}
            cloud={cloud}
            busy={edge.running || cloud.running}
            onRunBoth={async () => {
              await run("edge");
              await run("cloud");
            }}
            onLog={() => void addMaintenance({ date: todayIso(), type: "Diagnosis", technician: "VIDE AI", notes: verdictText(edge, cloud) })}
          />

          <MaintenanceCard rows={maintenance.rows} onAdd={addMaintenance} onRemoveLocal={maintenance.removeLocal} />

          <div className="grid gap-3.5 lg:grid-cols-2">
            <EngineerCard key={machine} machine={machine} profile={profile} autoMessage={buildDiagnosticsMessage(msgInput)} toast={toast} />
            <Card label={<>LLM — ASK ABOUT THIS MACHINE <Tag tone="cloud">DEDICATED SPACE</Tag></>}>
              <ChatPanel
                key={machine}
                example="Why is vibration rising? What should I check first?"
                placeholder="Ask the LLM..."
                contextLabel="Send machine context (last reading + verdicts + trend)"
                getContext={() => diagnosticsContext(msgInput)}
              />
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
