/**
 * Predictions "math layer": ordinary least-squares trend of temperature and vibration vs time,
 * projected to the failure thresholds, then fused with the backend (ML) verdict.
 * Runs entirely client-side so the page still forecasts when the ML model is absent.
 */
import { TEMP_FAIL_C, VIB_FAIL_MM_S } from "@/lib/constants";
import type { AnalyzeResponse, Reading, Urgency } from "@/lib/types";
import { maxUrgency, URGENCY_RISK } from "./status";

const HOUR_MS = 36e5;
/** Slopes below this (per hour) count as "flat" — no failure projected. */
const MIN_SLOPE_PER_H = 0.0005;

export interface LinReg {
  slope: number;
  intercept: number;
}

/** OLS over [x, y] points. Fewer than 3 points → flat line at the last value. */
export function linreg(points: Array<[number, number]>): LinReg {
  const n = points.length;
  const lastY = points[n - 1]?.[1] ?? 0;
  if (n < 3) return { slope: 0, intercept: lastY };
  let sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (const [x, y] of points) {
    sx += x; sy += y; sxx += x * x; sxy += x * y;
  }
  const den = n * sxx - sx * sx;
  if (!den) return { slope: 0, intercept: sy / n };
  const slope = (n * sxy - sx * sy) / den;
  return { slope, intercept: (sy - slope * sx) / n };
}

/** Hours until `current` reaches `limit` at `slope`/h. 0 if already past, Infinity if not rising. */
function hoursTo(limit: number, current: number, slope: number): number {
  if (current >= limit) return 0;
  return slope > MIN_SLOPE_PER_H ? (limit - current) / slope : Infinity;
}

export interface MathResult {
  temp: LinReg;
  vib: LinReg;
  current: { temp: number; vib: number };
  hoursTemp: number;
  hoursVib: number;
  /** Remaining useful life in hours (min of both), Infinity when no crossing is projected. */
  hours: number;
  driver: "temperature" | "vibration";
  /** 0–100, from current values vs thresholds. */
  risk: number;
  t0: number; // ms epoch of first point
  spanHours: number;
}

/** `oldest` must be oldest → newest. null when there is not enough data. */
export function computeMath(oldest: Reading[]): MathResult | null {
  if (oldest.length < 3) return null;
  const first = oldest[0];
  const last = oldest[oldest.length - 1];
  if (!first || !last) return null;

  const t0 = new Date(first.timestamp).getTime();
  const x = (r: Reading) => (new Date(r.timestamp).getTime() - t0) / HOUR_MS;
  const temp = linreg(oldest.map((r) => [x(r), r.temperature_c ?? 0]));
  const vib = linreg(oldest.map((r) => [x(r), r.vibration_mm_s ?? 0]));
  const current = { temp: last.temperature_c ?? 0, vib: last.vibration_mm_s ?? 0 };

  const hoursTemp = hoursTo(TEMP_FAIL_C, current.temp, temp.slope);
  const hoursVib = hoursTo(VIB_FAIL_MM_S, current.vib, vib.slope);
  const risk = Math.round(Math.max(0, Math.min(100, 55 * (current.temp / TEMP_FAIL_C) + 45 * (current.vib / VIB_FAIL_MM_S))));

  return {
    temp,
    vib,
    current,
    hoursTemp,
    hoursVib,
    hours: Math.min(hoursTemp, hoursVib),
    driver: hoursTemp <= hoursVib ? "temperature" : "vibration",
    risk,
    t0,
    spanHours: x(last),
  };
}

/** Urgency implied purely by hours left. */
export function urgencyFromHours(h: number): Urgency {
  if (!Number.isFinite(h)) return "none";
  if (h < 48) return "high";
  if (h < 168) return "medium";
  if (h < 720) return "low";
  return "none";
}

export function riskLabel(risk: number): string {
  if (risk >= 80) return "act now";
  if (risk >= 60) return "plan shutdown";
  if (risk >= 30) return "watch closely";
  return "routine watch";
}

/** Rule-based maintenance advice from fault keywords + hours left. */
export function recommendAction(fault: string, topFactors: string[], hours: number, math: MathResult | null): string {
  const text = `${fault} ${topFactors.join(" ")}`.toLowerCase();
  const parts: string[] = [];
  if (/bear/.test(text)) parts.push("Replace DE/NDE bearings + re-lubricate");
  if (/temp|heat|cool|over/.test(text)) parts.push("Clean cooling fins/fan, check airflow + thermistor");
  if (/vib|imbal|align|loosen/.test(text)) parts.push("Re-align shaft, check coupling + mounting bolts");
  if (/elect|winding|insul|current|voltage/.test(text)) parts.push("Megger windings, tighten terminals, check supply balance");
  if (/lub|friction/.test(text)) parts.push("Grease per spec, check seals");
  if (!parts.length) {
    parts.push(
      math && Number.isFinite(math.hours)
        ? `Inspect ${math.driver} path first (trend driver), then full routine check`
        : "Continue routine monitoring",
    );
  }
  const schedule = Number.isFinite(hours)
    ? hours < 48
      ? " — schedule shutdown within 48h"
      : hours < 168
        ? " — plan work this week"
        : " — plan at next window"
    : "";
  return parts.join("; ") + schedule;
}

export interface Verdict {
  hours: number;
  when: Date | null;
  fault: string;
  confidence: string;
  urgency: Urgency;
  risk: number;
  action: string;
}

/**
 * Fuse the backend verdict with the math trend:
 *   hours   = min(math RUL, ML hours_to_maintenance)
 *   urgency = max(backend urgency, urgency implied by hours) — so "10h left" can never show "NONE"
 *   risk    = max(math risk, urgency-implied risk)
 */
export function fuseVerdict(cortex: AnalyzeResponse | null, math: MathResult | null): Verdict {
  const ml = cortex?.ml_prediction ?? null;
  const mathHours = math?.hours ?? Infinity;
  const mlHours = ml?.hours_to_maintenance ?? Infinity;
  const hours = Math.max(0, Math.min(mathHours, mlHours));

  const fault =
    ml?.fault_type ??
    cortex?.primary_fault?.type ??
    (math && Number.isFinite(math.hours) ? `Degradation (${math.driver} rising)` : "Normal");
  const confidence = ml
    ? `${(ml.fault_type_confidence * 100).toFixed(0)}% (cortex)`
    : math && Number.isFinite(math.hours)
      ? "trend-based"
      : "—";

  const urgency = maxUrgency(cortex?.fused_diagnosis.overall_urgency ?? "none", urgencyFromHours(hours));
  const risk = Math.max(math?.risk ?? 10, URGENCY_RISK[urgency]);
  const when = Number.isFinite(hours) ? new Date(Date.now() + hours * HOUR_MS) : null;

  return { hours, when, fault, confidence, urgency, risk, action: recommendAction(fault, ml?.top_factors ?? [], hours, math) };
}
