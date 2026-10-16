/**
 * Mock implementation of VideApi — used when mock mode is on (NEXT_PUBLIC_USE_MOCKS=true or
 * the SOURCE panel toggle). It behaves like the backend is EXPECTED to behave once the
 * TODO(backend) items in endpoints.ts are done (e.g. PATCH /machines and /devices work).
 *
 * State (maintenance records, devices, created machines) lives in memory and resets on reload.
 */
import { VIB_FAIL_MM_S, TEMP_FAIL_C } from "@/lib/constants";
import type { AnalyzeRequest, AnalyzeResponse, Device, Fault, MaintenanceRecord, Urgency } from "@/lib/types";
import type { ApiResult } from "../client";
import type { VideApi } from "../endpoints";
import { MOCK_FLEET, mockReadings, type MockMachine } from "./fleet";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const jitter = (min: number, max: number) => min + Math.random() * (max - min);

async function ok<T>(data: T, minMs = 30, maxMs = 120): Promise<ApiResult<T>> {
  const ms = Math.round(jitter(minMs, maxMs));
  await wait(ms);
  return { ok: true, data, status: 200, ms };
}

const fleet: MockMachine[] = [...MOCK_FLEET];
const findMachine = (name: string) => fleet.find((m) => m.name === name);

const maintenance: Record<string, MaintenanceRecord[]> = {
  "air-compressor-03": [
    { date: "2026-08-02", type: "Lubrication", technician: "O. Adeyemi", notes: "Re-greased bearings, checked belt tension." },
    { date: "2026-09-14", type: "Inspection", technician: "O. Adeyemi", notes: "Vibration 3.1mm/s, intake filter cleaned." },
  ],
  "conveyor-drive-04": [{ date: "2026-07-21", type: "Alignment", technician: "K. Mensah", notes: "Shaft re-aligned after coupling wear." }],
};

const devices: Device[] = [
  ...MOCK_FLEET.filter((m) => m.deviceId).map((m) => ({
    id: m.deviceId as string,
    type: "ESP32-gateway",
    fw: "v1.4.2",
    ip: `192.168.1.${40 + MOCK_FLEET.indexOf(m)}`,
    notes: "",
    linked: m.name,
    fromBackend: true,
  })),
  { id: "edge-spare", type: "vibration-node", fw: "v1.3.0", ip: "", notes: "Spare node, not installed", linked: null, fromBackend: true },
];

/* ---------- fake analysis ---------- */

function urgencyFromHours(h: number): Urgency {
  if (h < 48) return "critical";
  if (h < 168) return "high";
  if (h < 720) return "medium";
  if (h < 1500) return "low";
  return "none";
}

function analyzeMock(body: AnalyzeRequest): AnalyzeResponse {
  const t = body.temperature_c ?? 0;
  const v = body.vibration_mm_s ?? 0;
  const pf = body.power_factor ?? 1;

  const faults: Fault[] = [];
  if (t > 85) faults.push({ type: "overheating", severity: "high", description: `Temperature ${t.toFixed(1)}°C above 85°C` });
  if (v > 7) faults.push({ type: "vibration_degradation", severity: "high", description: `Vibration ${v.toFixed(2)}mm/s above 7mm/s` });
  else if (v > 4) faults.push({ type: "bearing_wear", severity: "medium", description: `Vibration ${v.toFixed(2)}mm/s above 4mm/s` });
  if (pf < 0.8) faults.push({ type: "low_power_factor", severity: "low", description: `Power factor ${pf.toFixed(2)}` });

  const tRatio = t / TEMP_FAIL_C;
  const vRatio = v / VIB_FAIL_MM_S;
  const worst = Math.max(tRatio, vRatio);
  const mlFault = worst < 0.55 ? "normal" : vRatio > tRatio ? "bearing_wear" : "overheating";
  const hours = Math.max(4, Math.round((1 - Math.min(worst, 0.995)) * 2400));
  const urgency = mlFault === "normal" ? "none" : urgencyFromHours(hours);
  const primary = faults[0] ?? null;
  const agree = primary ? (primary.type.includes(mlFault.split("_")[0] ?? "") ? "rules and ML agree" : "rules and ML differ") : mlFault === "normal" ? "both normal" : "ML only";

  const llm = body.use_llm
    ? `Mock LLM: ${body.machine_name} runs at ${t.toFixed(1)}°C and ${v.toFixed(2)}mm/s. ` +
      (mlFault === "normal"
        ? "Signals are inside normal bands; keep routine monitoring."
        : `The pattern is consistent with ${mlFault.replace("_", " ")}. Inspect ${vRatio > tRatio ? "drive-end bearings and coupling alignment" : "cooling fan, fins and airflow"} first; estimated ${hours}h before maintenance is due.`)
    : null;

  return {
    is_anomaly: faults.length > 0,
    primary_fault: primary,
    all_faults: faults,
    ml_prediction: {
      fault_type: mlFault,
      fault_type_confidence: Math.min(0.97, 0.55 + worst * 0.4),
      hours_to_maintenance: hours,
      top_factors: [
        `vibration ${v.toFixed(2)}mm/s (${Math.round(vRatio * 100)}% of limit)`,
        `temperature ${t.toFixed(1)}°C (${Math.round(tRatio * 100)}% of limit)`,
      ],
      model_version: "mock-1",
    },
    fused_diagnosis: { overall_urgency: urgency, agreement: agree, summary: primary?.description ?? "No rule triggered" },
    llm_analysis: llm,
    llm_error: null,
  };
}

/* ---------- the mock api ---------- */

export function createMockApi(): VideApi {
  return {
    health: () => ok({ status: "ok (mock)", factoryName: "Demo Plant (mock data)" }),

    listMachines: () =>
      ok(
        fleet.map((m) => ({
          machine_name: m.name,
          machine_type: m.type,
          location: m.location,
          rated_load_kw: m.ratedKw,
          health_status: m.health,
          isLocal: false,
        })),
      ),

    async createMachine(machine) {
      if (!findMachine(machine.machine_name)) {
        fleet.push({
          name: machine.machine_name,
          type: machine.machine_type || "motor",
          location: machine.location || "",
          ratedKw: machine.rated_load_kw ?? 10,
          health: "healthy",
          deviceId: null,
          temp: { base: 45, perDay: 0.02, noise: 1 },
          vib: { base: 1, perDay: 0.002, noise: 0.1 },
          powerKw: 4,
          loadPct: 50,
        });
      }
      return ok({ created: true });
    },

    updateMachineProfile: () => ok({ updated: true }),

    recentReadings(machine, limit) {
      const m = findMachine(machine);
      return ok(m ? mockReadings(m, limit) : []);
    },

    criticalEvents(limit) {
      const events = fleet
        .filter((m) => m.health === "critical" || m.health === "warning")
        .map((m, i) => ({
          id: `mock-${m.name}`,
          machine_name: m.name,
          fault_type: m.health === "critical" ? "vibration_degradation" : "bearing_wear",
          description: m.health === "critical" ? "Vibration trending past 7mm/s" : "Bearing wear signature detected",
          flagged_at: new Date(Date.now() - (i + 1) * 17 * 60_000).toISOString(),
        }));
      return ok(events.slice(0, limit));
    },

    analyze(body) {
      return body.use_llm ? ok(analyzeMock(body), 600, 1400) : ok(analyzeMock(body), 25, 90);
    },

    chat(message) {
      const question = message.split("\n")[0] ?? message;
      return ok(
        `Mock LLM answer to: "${question}"\n\n` +
          "1. Check the trend first: a steady rise in vibration with temperature usually points to bearing wear or misalignment.\n" +
          "2. Compare against the last maintenance entry — if lubrication was > 6 weeks ago, re-grease and re-measure.\n" +
          "3. If vibration stays above 4.5mm/s after that, plan a bearing inspection at the next window.",
        700,
        1500,
      );
    },

    maintenanceHistory: (machine) => ok([...(maintenance[machine] ?? [])]),

    addMaintenance(record) {
      (maintenance[record.machine_name] ??= []).push(record);
      return ok({ saved: true });
    },

    listDevices: () => ok(devices.map((d) => ({ ...d }))),

    createDevice(deviceId) {
      if (!devices.some((d) => d.id === deviceId)) {
        devices.push({ id: deviceId, type: "", fw: "", ip: "", notes: "", linked: null, fromBackend: true });
      }
      return ok({ created: true });
    },

    updateDevice(deviceId, patch) {
      const d = devices.find((x) => x.id === deviceId);
      if (d) {
        if (patch.device_type !== undefined) d.type = patch.device_type;
        if (patch.firmware !== undefined) d.fw = patch.firmware;
        if (patch.ip !== undefined) d.ip = patch.ip;
        if (patch.notes !== undefined) d.notes = patch.notes;
        if (patch.linked_machine !== undefined) d.linked = patch.linked_machine;
      }
      return ok({ updated: true });
    },
  };
}
