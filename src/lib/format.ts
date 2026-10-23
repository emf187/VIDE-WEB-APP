/**
 * Number + date formatting. Every helper accepts null/undefined/NaN and returns "—"
 * so a missing sensor value never renders as "NaN" or throws on .toFixed().
 */

export const DASH = "—";

export function isNum(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

/** Fixed decimals, or "—" for missing values. */
export function fixed(v: number | null | undefined, digits: number): string {
  return isNum(v) ? v.toFixed(digits) : DASH;
}

/** Display conventions from the original UI. */
export const fmt = {
  temp: (v: number | null | undefined) => fixed(v, 1),
  vib: (v: number | null | undefined) => fixed(v, 2),
  power: (v: number | null | undefined) => fixed(v, 1),
  load: (v: number | null | undefined) => fixed(v, 1),
  hours: (v: number | null | undefined) => (isNum(v) ? `${v.toFixed(0)}h` : DASH),
  /** Confidence arrives as 0..1. */
  pct01: (v: number | null | undefined) => (isNum(v) ? `${(v * 100).toFixed(0)}%` : DASH),
  rate: (v: number | null | undefined, digits = 2) => (isNum(v) ? `${v.toFixed(digits)} msg/s` : DASH),
};

/** Signed value, e.g. "+2.3". */
export function signed(v: number, digits: number): string {
  return `${v >= 0 ? "+" : ""}${v.toFixed(digits)}`;
}

function toDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function timeOf(iso: string | null | undefined): string {
  return toDate(iso)?.toLocaleTimeString() ?? DASH;
}

export function dateOf(iso: string | null | undefined): string {
  return toDate(iso)?.toLocaleDateString() ?? DASH;
}

export function dateTimeOf(iso: string | null | undefined): string {
  return toDate(iso)?.toLocaleString() ?? DASH;
}

/** Milliseconds since an ISO timestamp, or Infinity when unknown. */
export function ageMs(iso: string | null | undefined, now = Date.now()): number {
  const d = toDate(iso);
  return d ? now - d.getTime() : Infinity;
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
