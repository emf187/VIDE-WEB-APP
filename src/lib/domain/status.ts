/** Status language: health scores, urgency ranking and their colour tones. */
import type { HealthStatus, Urgency } from "@/lib/types";

export type Tone = "ok" | "warn" | "high" | "crit" | "dim" | "cloud";

/** Overview FLEET HEALTH = average of these. */
export const HEALTH_SCORE: Record<HealthStatus, number> = { critical: 20, warning: 50, watch: 75, healthy: 100 };

export const HEALTH_TONE: Record<HealthStatus, Tone> = { healthy: "ok", watch: "warn", warning: "warn", critical: "crit" };

/** When fusing two verdicts, the higher urgency wins. */
export const URGENCY_RANK: Record<Urgency, number> = { none: 0, low: 1, medium: 2, high: 3, critical: 4 };

export const URGENCY_TONE: Record<Urgency, Tone> = { none: "ok", low: "ok", medium: "warn", high: "high", critical: "crit" };

/** Predictions page: urgency → implied risk score. */
export const URGENCY_RISK: Record<Urgency, number> = { critical: 95, high: 80, medium: 60, low: 30, none: 10 };

export function maxUrgency(a: Urgency, b: Urgency): Urgency {
  return URGENCY_RANK[b] > URGENCY_RANK[a] ? b : a;
}

/** Tailwind text colour per tone. Full class names so Tailwind can see them. */
export const TONE_TEXT: Record<Tone, string> = {
  ok: "text-ok",
  warn: "text-warn",
  high: "text-high",
  crit: "text-crit",
  dim: "text-dim",
  cloud: "text-cloud",
};

export const TONE_BORDER: Record<Tone, string> = {
  ok: "border-ok-line",
  warn: "border-warn-line",
  high: "border-high",
  crit: "border-crit",
  dim: "border-line-lit",
  cloud: "border-cloud-line",
};
