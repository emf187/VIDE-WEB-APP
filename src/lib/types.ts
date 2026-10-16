/**
 * Domain types shared by the whole app.
 *
 * These describe the shapes the UI works with *after* normalisation (src/lib/api/normalize.ts).
 * Raw backend responses are treated as `unknown` until they pass through a normaliser,
 * so a missing or renamed field can never crash a page.
 */

export type HealthStatus = "healthy" | "watch" | "warning" | "critical";
export type Urgency = "none" | "low" | "medium" | "high" | "critical";
export type NoteFlag = "info" | "warn" | "critical";

/** One sensor sample. Every metric is nullable — firmware sends what it has. */
export interface Reading {
  machine_name: string;
  device_id: string | null;
  timestamp: string; // ISO 8601
  voltage_v: number | null;
  current_amps: number | null;
  power_kw: number | null;
  power_factor: number | null;
  frequency_hz: number | null;
  energy_kwh: number | null;
  temperature_c: number | null;
  vibration_mm_s: number | null;
  acceleration_g: number | null;
  pressure_bar: number | null;
  flow_lpm: number | null;
  load_factor_pct: number | null;
  /** Optional edge-device telemetry. */
  rssi: number | null;
  battery_v: number | null;
  battery_pct: number | null;
}

export interface Machine {
  machine_name: string;
  machine_type: string | null;
  location: string | null;
  rated_load_kw: number | null;
  health_status: HealthStatus;
  /** True when the machine only exists in this browser (created offline). */
  isLocal: boolean;
}

export interface HealthInfo {
  status: string;
  factoryName: string | null;
}

export interface CriticalEvent {
  id: string;
  machine_name: string;
  fault_type: string;
  description: string;
  flagged_at: string | null;
}

export interface Fault {
  type: string;
  severity: string;
  description: string;
}

export interface MlPrediction {
  fault_type: string;
  fault_type_confidence: number; // 0..1
  hours_to_maintenance: number | null;
  top_factors: string[];
  model_version: string | null;
}

export interface FusedDiagnosis {
  overall_urgency: Urgency;
  agreement: string;
  summary: string;
}

export interface AnalyzeRequest {
  machine_name: string;
  machine_type?: string;
  rated_load_kw?: number;
  voltage_v?: number | null;
  current_amps?: number | null;
  power_kw?: number | null;
  power_factor?: number;
  frequency_hz?: number;
  temperature_c?: number | null;
  vibration_mm_s?: number | null;
  load_factor_pct?: number | null;
  /** false = edge only (rules + ML), true = also ask the LLM for a narrative. */
  use_llm: boolean;
  /** true = bypass ML batching and predict immediately. */
  force_ml: boolean;
}

export interface AnalyzeResponse {
  is_anomaly: boolean;
  primary_fault: Fault | null;
  all_faults: Fault[];
  ml_prediction: MlPrediction | null;
  fused_diagnosis: FusedDiagnosis;
  llm_analysis: string | null;
  llm_error: string | null;
}

export interface MaintenanceRecord {
  date: string; // YYYY-MM-DD
  type: string;
  technician: string;
  notes: string;
  machine_name?: string;
}

/** Maintenance row as displayed: knows where it came from so delete targets the right store. */
export interface MaintenanceRow extends MaintenanceRecord {
  source: "backend" | "local";
  /** Index inside the local store (only for source === "local"). */
  localIndex?: number;
}

export interface Device {
  id: string;
  type: string;
  fw: string;
  ip: string;
  notes: string;
  linked: string | null;
  fromBackend: boolean;
}

/* ---------- localStorage shapes (keys documented in src/lib/storage.ts) ---------- */

export interface MachineProfile {
  type: string;
  location: string;
  rated_load_kw: string;
  engineer_name: string;
  engineer_email: string;
  engineer_phone: string;
}

export interface MachineNote {
  id: number;
  ts: string;
  text: string;
  flag: NoteFlag;
  send: boolean;
}

export interface LocalDevice {
  type: string;
  fw: string;
  ip: string;
  notes: string;
  linked: string | null;
}

export interface PredictionLogEntry {
  ts: string;
  fault: string;
  conf: string;
  urg: string;
  hours: number | null;
  risk: number;
  action: string;
  src: string;
}
