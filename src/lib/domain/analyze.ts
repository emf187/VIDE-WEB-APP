import { ANALYZE_DEFAULTS } from "@/lib/constants";
import type { AnalyzeRequest, MachineProfile, Reading } from "@/lib/types";

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
