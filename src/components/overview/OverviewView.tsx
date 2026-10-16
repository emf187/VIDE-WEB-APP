"use client";

import Link from "next/link";
import { useState } from "react";
import { ConnectionPanel } from "@/components/layout/ConnectionPanel";
import { PageIntro } from "@/components/layout/PageIntro";
import { AnalysisSummary } from "@/components/shared/AnalysisSummary";
import { Button, Card, Dot, EmptyState, Select, Tile } from "@/components/ui";
import type { VideApi } from "@/lib/api";
import { POLL_MS } from "@/lib/constants";
import { buildAnalyzeRequest } from "@/lib/domain/analyze";
import { isOnline } from "@/lib/domain/readings";
import { HEALTH_SCORE } from "@/lib/domain/status";
import { fmt, timeOf } from "@/lib/format";
import { STORAGE_KEYS } from "@/lib/storage";
import type { AnalyzeResponse, CriticalEvent, Machine, Reading } from "@/lib/types";
import { useLocalStore } from "@/hooks/useLocalStore";
import { usePoll } from "@/hooks/usePoll";
import { useApi } from "@/providers/ApiProvider";
import { useToast } from "@/providers/ToastProvider";

interface FleetSnapshot {
  api: VideApi;
  machines: Machine[];
  latest: Record<string, Reading | null>;
  events: CriticalEvent[];
  online: number;
  totalPowerKw: number;
  error: string | null;
}

/** One poll tick: machines + latest reading per machine (limit=1) + critical events, batched. */
async function fetchFleet(api: VideApi, prev: FleetSnapshot | null): Promise<FleetSnapshot> {
  const [machinesRes, eventsRes] = await Promise.all([api.listMachines(), api.criticalEvents(5)]);
  const keepPrev = prev?.api === api ? prev : null;
  if (!machinesRes.ok) return keepPrev ? { ...keepPrev, error: machinesRes.error } : emptySnapshot(api, machinesRes.error);

  const machines = machinesRes.data;
  const readings = await Promise.all(machines.map((m) => api.recentReadings(m.machine_name, 1)));
  const latest: Record<string, Reading | null> = {};
  const now = Date.now();
  let online = 0;
  let totalPowerKw = 0;
  machines.forEach((m, i) => {
    const res = readings[i];
    const r = res?.ok ? (res.data[0] ?? null) : (keepPrev?.latest[m.machine_name] ?? null);
    latest[m.machine_name] = r;
    if (r) totalPowerKw += r.power_kw ?? 0;
    if (isOnline(r, now)) online++;
  });

  return {
    api,
    machines,
    latest,
    events: eventsRes.ok ? eventsRes.data : (keepPrev?.events ?? []),
    online,
    totalPowerKw,
    error: eventsRes.ok ? null : eventsRes.error,
  };
}

function emptySnapshot(api: VideApi, error: string | null): FleetSnapshot {
  return { api, machines: [], latest: {}, events: [], online: 0, totalPowerKw: 0, error };
}

export function OverviewView() {
  const { api, status } = useApi();
  const toast = useToast();
  const [profiles] = useLocalStore(STORAGE_KEYS.profiles);
  const [fleet, setFleet] = useState<FleetSnapshot | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [prediction, setPrediction] = useState<{ machine: string; result: AnalyzeResponse } | null>(null);
  const [predicting, setPredicting] = useState(false);

  const refresh = async () => setFleet(await fetchFleet(api, fleet));

  // Poll every POLL_MS while the backend (or mock) answers; the health check re-enables it.
  usePoll(refresh, POLL_MS, { enabled: status === "live", key: api });

  const snapshot = fleet?.api === api ? fleet : null;
  const machines = snapshot?.machines ?? [];
  const current = machines.find((m) => m.machine_name === selected)?.machine_name ?? machines[0]?.machine_name ?? null;
  const reading = current ? (snapshot?.latest[current] ?? null) : null;
  const avgHealth = machines.length ? Math.round(machines.reduce((s, m) => s + HEALTH_SCORE[m.health_status], 0) / machines.length) : null;

  const predict = async () => {
    if (!current) return;
    if (!reading) {
      toast("No reading received yet for this machine — POST /api/readings first.");
      return;
    }
    setPredicting(true);
    const res = await api.analyze(buildAnalyzeRequest(current, reading, profiles[current], { useLlm: false }));
    setPredicting(false);
    if (res.ok) setPrediction({ machine: current, result: res.data });
    else toast(`Prediction failed: ${res.error}`);
  };

  return (
    <div className="flex flex-col gap-3.5">
      <PageIntro title="Operations overview">Connect your backend below to bring this page live.</PageIntro>

      <Card label="DEVICE CONNECTION">
        <ConnectionPanel />
      </Card>

      {!snapshot ? (
        <EmptyState>{status === "offline" ? "Backend unreachable — check the URL above or switch on mock data." : "Waiting for connection…"}</EmptyState>
      ) : machines.length === 0 ? (
        <EmptyState>Connected, but no machines have sent data yet. POST a reading to /api/readings.</EmptyState>
      ) : (
        <>
          {status === "offline" && <EmptyState className="border-crit-line text-crit">BACKEND OFFLINE — showing last known values.</EmptyState>}

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Tile label="FLEET ONLINE" value={snapshot.online} unit={`/ ${machines.length}`} pulseKey={snapshot.online} />
            <Tile label="FLEET HEALTH" value={avgHealth ?? "—"} unit="/ 100" pulseKey={avgHealth} />
            <Tile label="OPEN ANOMALIES" value={snapshot.events.length} pulseKey={snapshot.events.length} />
            <Tile label="FLEET POWER DRAW" value={snapshot.totalPowerKw.toFixed(1)} unit="kW" pulseKey={snapshot.totalPowerKw.toFixed(1)} />
          </div>

          <div className="grid gap-3.5 lg:grid-cols-[1.4fr_1fr]">
            <Card
              label={`SELECTED MACHINE / ${current ?? "—"}`}
              actions={
                <div className="flex items-center gap-2">
                  <Select aria-label="Selected machine" className="w-auto py-1 text-[10px]" value={current ?? ""} onChange={(e) => setSelected(e.target.value)}>
                    {machines.map((m) => (
                      <option key={m.machine_name} value={m.machine_name}>
                        {m.machine_name}
                      </option>
                    ))}
                  </Select>
                  {current && (
                    <Link href={`/diagnostics?m=${encodeURIComponent(current)}`} className="text-[10px] text-accent hover:underline">
                      DIAGNOSTICS →
                    </Link>
                  )}
                </div>
              }
            >
              <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                <Tile label="LOAD" value={fmt.load(reading?.load_factor_pct)} unit="%" pulseKey={reading?.load_factor_pct} />
                <Tile label="POWER" value={fmt.power(reading?.power_kw)} unit="kW" pulseKey={reading?.power_kw} />
                <Tile label="TEMPERATURE" value={fmt.temp(reading?.temperature_c)} unit="°C" pulseKey={reading?.temperature_c} />
                <Tile label="VIBRATION" value={fmt.vib(reading?.vibration_mm_s)} unit="mm/s" pulseKey={reading?.vibration_mm_s} />
              </div>

              <div className="mt-4">
                <div className="mb-2.5 text-[9px] tracking-[2px] text-dim2">LOCAL MODEL — TRAINED PREDICTION</div>
                <Button variant="secondary" onClick={predict} disabled={predicting || !current}>
                  {predicting ? "Running local model…" : "Get instant prediction from local model"}
                </Button>
                {prediction?.machine === current && (
                  <div className="mt-3">
                    <AnalysisSummary result={prediction.result} />
                  </div>
                )}
              </div>
            </Card>

            <Card label="ATTENTION QUEUE">
              {snapshot.events.length === 0 ? (
                <EmptyState>No open critical events.</EmptyState>
              ) : (
                snapshot.events.map((e) => (
                  <div key={e.id} className="flex gap-2.5 border-b border-dashed border-line py-[9px] text-xs last:border-b-0">
                    <span className="mt-1">
                      <Dot tone="crit" size="md" />
                    </span>
                    <div className="min-w-0">
                      <div className="break-words">{e.description}</div>
                      <div className="mt-0.5 text-[10px] text-dim2">
                        {e.machine_name} · {timeOf(e.flagged_at)}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
