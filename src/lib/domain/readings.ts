/** Pure helpers over Reading[] (input is newest-first, as returned by the API layer). */
import { ONLINE_MS, STALE_MS } from "@/lib/constants";
import { ageMs, isNum } from "@/lib/format";
import type { Reading } from "@/lib/types";

type NumericKey = {
  [K in keyof Reading]: Reading[K] extends number | null ? K : never;
}[keyof Reading];

/** Copy reversed to oldest → newest, for plotting and regression. */
export function oldestFirst(newestFirst: Reading[]): Reading[] {
  return [...newestFirst].reverse();
}

/** Average of a metric, ignoring missing values. null when nothing to average. */
export function average(rows: Reading[], key: NumericKey): number | null {
  const vals = rows.map((r) => r[key]).filter(isNum);
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}

export function isOnline(latest: Reading | null | undefined, now = Date.now()): boolean {
  return !!latest && ageMs(latest.timestamp, now) < ONLINE_MS;
}

export type LinkStatus = "online" | "stale" | "offline" | "local";

export function linkStatus(lastTs: number | null, now = Date.now()): LinkStatus {
  if (lastTs === null) return "local";
  const age = now - lastTs;
  if (age < ONLINE_MS) return "online";
  if (age < STALE_MS) return "stale";
  return "offline";
}

/** Δ of temperature and vibration between the first and last point of an oldest-first series. */
export function trend(oldest: Reading[]): { dT: number; dV: number; n: number } | null {
  const first = oldest[0];
  const last = oldest[oldest.length - 1];
  if (!first || !last || oldest.length < 2) return null;
  return {
    dT: (last.temperature_c ?? 0) - (first.temperature_c ?? 0),
    dV: (last.vibration_mm_s ?? 0) - (first.vibration_mm_s ?? 0),
    n: oldest.length,
  };
}

export interface FeedHealth {
  n: number;
  lastTs: number | null;
  /** messages per second across the sample span */
  rate: number | null;
  maxGapMs: number;
  latest: Reading | null;
}

/**
 * Health of one device's feed from its linked machine's recent readings.
 * If readings carry device_id, only this device's samples count (two devices can feed one machine).
 * If none carry device_id (current backend may not store it), all samples count.
 */
export function feedHealth(newestFirst: Reading[], deviceId: string): FeedHealth {
  const tagged = newestFirst.some((r) => r.device_id);
  const rows = tagged ? newestFirst.filter((r) => r.device_id === deviceId) : newestFirst;
  if (!rows.length) return { n: 0, lastTs: null, rate: null, maxGapMs: 0, latest: null };

  const ts = rows.map((r) => new Date(r.timestamp).getTime()).sort((a, b) => a - b);
  let maxGapMs = 0;
  for (let i = 1; i < ts.length; i++) maxGapMs = Math.max(maxGapMs, (ts[i] ?? 0) - (ts[i - 1] ?? 0));
  const spanS = ((ts[ts.length - 1] ?? 0) - (ts[0] ?? 0)) / 1000;

  return {
    n: rows.length,
    lastTs: ts[ts.length - 1] ?? null,
    rate: spanS > 0 ? (rows.length - 1) / spanS : null,
    maxGapMs,
    latest: rows[0] ?? null, // newest-first → index 0 is the latest payload
  };
}
