/**
 * Response guards. Every backend payload is `unknown` until it passes through one of these.
 *
 * Rules:
 *  - Never throw. Wrong type → null / [] / sensible default.
 *  - Accept both a bare array and a wrapped object ({ machines: [...] }, { records: [...] } …),
 *    because the backend is still changing.
 *  - Keep field-name fallbacks HERE (one place) instead of scattering `a || b || c` through pages.
 */
import type {
  AnalyzeResponse,
  CriticalEvent,
  Device,
  Fault,
  FusedDiagnosis,
  HealthInfo,
  HealthStatus,
  Machine,
  MaintenanceRecord,
  MlPrediction,
  Reading,
  Urgency,
} from "@/lib/types";

type Obj = Record<string, unknown>;

export const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);

/** Finite number or null. Numeric strings ("12.5") are accepted. */
export function num(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function str(v: unknown, fallback = ""): string {
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return fallback;
}

/** First non-empty string among several candidate fields. */
function firstStr(o: Obj, keys: string[], fallback = ""): string {
  for (const k of keys) {
    const s = str(o[k]);
    if (s) return s;
  }
  return fallback;
}

/** Bare array, or the first array found under one of `wrapperKeys`. Anything else → []. */
export function toArray(raw: unknown, wrapperKeys: string[] = []): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (isObj(raw)) {
    for (const k of wrapperKeys) {
      const v = raw[k];
      if (Array.isArray(v)) return v;
    }
  }
  return [];
}

function strList(v: unknown): string[] {
  return Array.isArray(v) ? v.map((x) => str(x)).filter(Boolean) : [];
}

/* ---------- enums ---------- */

const HEALTH: HealthStatus[] = ["healthy", "watch", "warning", "critical"];
export function toHealthStatus(v: unknown): HealthStatus {
  const s = str(v).toLowerCase();
  return (HEALTH as string[]).includes(s) ? (s as HealthStatus) : "healthy";
}

const URGENCY: Urgency[] = ["none", "low", "medium", "high", "critical"];
export function toUrgency(v: unknown): Urgency {
  const s = str(v).toLowerCase();
  return (URGENCY as string[]).includes(s) ? (s as Urgency) : "none";
}

/* ---------- entities ---------- */

export function toHealthInfo(raw: unknown): HealthInfo {
  if (!isObj(raw)) return { status: "ok", factoryName: null };
  const factory = isObj(raw.factory) ? raw.factory : {};
  return { status: str(raw.status, "ok"), factoryName: str(factory.name) || null };
}

export function toMachine(raw: unknown): Machine | null {
  if (!isObj(raw)) return null;
  const name = firstStr(raw, ["machine_name", "name", "id"]);
  if (!name) return null;
  return {
    machine_name: name,
    machine_type: str(raw.machine_type) || null,
    location: str(raw.location) || null,
    rated_load_kw: num(raw.rated_load_kw),
    health_status: toHealthStatus(raw.health_status),
    isLocal: false,
  };
}

export function toMachines(raw: unknown): Machine[] {
  return toArray(raw, ["machines", "items", "data"])
    .map(toMachine)
    .filter((m): m is Machine => m !== null);
}

export function toReading(raw: unknown, machineFallback = ""): Reading | null {
  if (!isObj(raw)) return null;
  const timestamp = str(raw.timestamp);
  if (!timestamp || Number.isNaN(new Date(timestamp).getTime())) return null; // unusable without a time
  return {
    machine_name: str(raw.machine_name, machineFallback),
    device_id: str(raw.device_id) || null,
    timestamp,
    voltage_v: num(raw.voltage_v),
    current_amps: num(raw.current_amps),
    power_kw: num(raw.power_kw),
    power_factor: num(raw.power_factor),
    frequency_hz: num(raw.frequency_hz),
    energy_kwh: num(raw.energy_kwh),
    temperature_c: num(raw.temperature_c),
    vibration_mm_s: num(raw.vibration_mm_s),
    acceleration_g: num(raw.acceleration_g),
    pressure_bar: num(raw.pressure_bar),
    flow_lpm: num(raw.flow_lpm),
    load_factor_pct: num(raw.load_factor_pct),
    rssi: num(raw.rssi),
    battery_v: num(raw.battery_v),
    battery_pct: num(raw.battery_pct),
  };
}

/**
 * Readings, ALWAYS sorted newest-first (the API's documented order) regardless of what arrived.
 * Pages that plot use `oldestFirst()` from lib/domain/readings.ts.
 */
export function toReadings(raw: unknown, machineFallback = ""): Reading[] {
  return toArray(raw, ["readings", "items", "data"])
    .map((r) => toReading(r, machineFallback))
    .filter((r): r is Reading => r !== null)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

export function toCriticalEvents(raw: unknown): CriticalEvent[] {
  return toArray(raw, ["events", "items", "data"])
    .filter(isObj)
    .map((e, i) => ({
      id: str(e.id) || `${str(e.machine_name)}-${str(e.flagged_at)}-${i}`,
      machine_name: str(e.machine_name, "unknown machine"),
      fault_type: str(e.fault_type, "fault"),
      description: firstStr(e, ["description", "fault_type"], "Critical event"),
      flagged_at: str(e.flagged_at) || str(e.timestamp) || null,
    }));
}

function toFault(raw: unknown): Fault | null {
  if (!isObj(raw)) return null;
  const type = firstStr(raw, ["type", "fault_type", "name"]);
  if (!type) return null;
  return { type, severity: str(raw.severity), description: str(raw.description) };
}

function toMlPrediction(raw: unknown): MlPrediction | null {
  if (!isObj(raw)) return null;
  const fault = str(raw.fault_type);
  if (!fault) return null;
  return {
    fault_type: fault,
    fault_type_confidence: num(raw.fault_type_confidence) ?? 0,
    hours_to_maintenance: num(raw.hours_to_maintenance),
    top_factors: strList(raw.top_factors),
    model_version: str(raw.model_version) || null,
  };
}

function toFused(raw: unknown): FusedDiagnosis {
  const o = isObj(raw) ? raw : {};
  return { overall_urgency: toUrgency(o.overall_urgency), agreement: str(o.agreement), summary: str(o.summary) };
}

export function toAnalyzeResponse(raw: unknown): AnalyzeResponse {
  const o = isObj(raw) ? raw : {};
  return {
    is_anomaly: o.is_anomaly === true,
    primary_fault: toFault(o.primary_fault),
    all_faults: toArray(o.all_faults).map(toFault).filter((f): f is Fault => f !== null),
    ml_prediction: toMlPrediction(o.ml_prediction),
    fused_diagnosis: toFused(o.fused_diagnosis),
    // Documented field is `llm_analysis`; older builds used the others.
    llm_analysis: firstStr(o, ["llm_analysis", "llm_narrative", "narrative", "explanation"]) || null,
    llm_error: str(o.llm_error) || null,
  };
}

export function toMaintenanceRecords(raw: unknown): MaintenanceRecord[] {
  return toArray(raw, ["records", "history", "maintenance", "items"])
    .filter(isObj)
    .map((m) => ({
      date: firstStr(m, ["date", "performed_at", "created_at"]).slice(0, 10),
      type: firstStr(m, ["type", "maintenance_type", "kind"], "—"),
      technician: firstStr(m, ["technician", "tech", "performed_by"]),
      notes: firstStr(m, ["notes", "description"]),
      machine_name: str(m.machine_name) || undefined,
    }));
}

export function toDevices(raw: unknown): Device[] {
  return toArray(raw, ["devices", "edge_nodes", "items"])
    .filter(isObj)
    .map((r) => ({
      id: firstStr(r, ["device_id", "id", "name"]),
      type: firstStr(r, ["device_type", "type"]),
      fw: firstStr(r, ["firmware", "fw_version", "firmware_version"]),
      ip: firstStr(r, ["ip", "ip_address", "location"]),
      notes: str(r.notes),
      linked: firstStr(r, ["linked_machine", "machine_name", "machine"]) || null,
      fromBackend: true,
    }))
    .filter((d) => d.id !== "");
}

/** LLM chat answer text, from whichever field the backend uses. */
export function toChatAnswer(raw: unknown): string {
  if (typeof raw === "string") return raw;
  if (!isObj(raw)) return "";
  return firstStr(raw, ["answer", "response", "reply", "message", "llm_analysis", "text"]);
}
