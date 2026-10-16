import { ANALYZE_DEFAULTS } from "@/lib/constants";
import type { AnalyzeRequest, AnalyzeResponse, MachineProfile, Reading, Urgency } from "@/lib/types";
import { faultOf } from "./messages";
import { maxUrgency } from "./status";

export interface EdgeCloudFusion {
  urgency: Urgency;
  edgeFault: string | null;
  cloudFault: string | null;
  /** null until both have run. */
  match: boolean | null;
}

/**
 * Diagnostics "AI verdict": the higher urgency of edge and cloud wins.
 * Note: today both call the same rules + ML on the backend, so faults usually MATCH —
 * the cloud run only adds the LLM narrative.
 */
export function fuseEdgeCloud(edge: AnalyzeResponse | null, cloud: AnalyzeResponse | null): EdgeCloudFusion {
  const edgeFault = faultOf(edge);
  const cloudFault = faultOf(cloud);
  return {
    urgency: maxUrgency(edge?.fused_diagnosis.overall_urgency ?? "none", cloud?.fused_diagnosis.overall_urgency ?? "none"),
    edgeFault,
    cloudFault,
    match: edge && cloud ? edgeFault === cloudFault : null,
  };
}

/**
 * Build the /diagnostics/analyze body from a reading + the machine's profile.
 * ONE builder for every page, so Overview, Diagnostics and Predictions send identical inputs
 * for the same reading (the old Overview omitted temperature/vibration/load and profile values).
 */
export function buildAnalyzeRequest(
  machineName: string,
  reading: Reading | null,
  profile: MachineProfile | undefined,
  mode: { useLlm: boolean },
): AnalyzeRequest {
  const rated = parseFloat(profile?.rated_load_kw ?? "");
  return {
    machine_name: machineName,
    machine_type: profile?.type || ANALYZE_DEFAULTS.machine_type,
    rated_load_kw: Number.isFinite(rated) && rated > 0 ? rated : ANALYZE_DEFAULTS.rated_load_kw,
    voltage_v: reading?.voltage_v ?? ANALYZE_DEFAULTS.voltage_v,
    current_amps: reading?.current_amps ?? 0,
    power_kw: reading?.power_kw ?? 0,
    power_factor: reading?.power_factor ?? ANALYZE_DEFAULTS.power_factor,
    frequency_hz: reading?.frequency_hz ?? ANALYZE_DEFAULTS.frequency_hz,
    temperature_c: reading?.temperature_c ?? null,
    vibration_mm_s: reading?.vibration_mm_s ?? null,
    load_factor_pct: reading?.load_factor_pct ?? null,
    use_llm: mode.useLlm,
    force_ml: true, // without this the ML layer batches (~every 20 readings) and returns nothing
  };
}
