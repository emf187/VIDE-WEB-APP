/**
 * Load-bearing constants. Several are part of the product's status language —
 * change them deliberately, not casually.
 */

/** Overview fleet refresh. */
export const POLL_MS = 3000;
/** Global backend health check (drives the LIVE / OFFLINE badges on every page). */
export const HEALTH_POLL_MS = 15000;
/** Devices page health re-check. */
export const DEVICE_POLL_MS = 15000;
/** Diagnostics live-graph interval choices. */
export const LIVE_INTERVALS_MS = [2000, 3000, 5000, 10000] as const;
/** Abort any single backend request after this long. */
export const REQUEST_TIMEOUT_MS = 10000;
/** LLM calls are slower. */
export const LLM_TIMEOUT_MS = 60000;

/** A machine/device is ONLINE when its latest reading is younger than this. */
export const ONLINE_MS = 60_000;
/** …and STALE (Devices) when younger than this. */
export const STALE_MS = 5 * 60_000;

/** Failure thresholds used by the Predictions math layer. */
export const TEMP_FAIL_C = 90;
export const VIB_FAIL_MM_S = 7.1;

/** Diagnostics tile colouring. */
export const TEMP_WARN_C = 70;
export const TEMP_CRIT_C = 85;
export const VIB_WARN_MM_S = 4;
export const VIB_CRIT_MM_S = 7;

/**
 * Fixed chart scales — deliberate. Auto-scaling made sensor noise look like disasters.
 */
export const SCALE = {
  temperature_c: 100,
  vibration_mm_s: 10,
  power_kw: 15,
  load_factor_pct: 100,
} as const;

/** Defaults sent to /diagnostics/analyze when the reading or profile lacks a value. */
export const ANALYZE_DEFAULTS = {
  machine_type: "motor",
  rated_load_kw: 10,
  voltage_v: 230,
  power_factor: 0.9,
  frequency_hz: 50,
} as const;

export const DEFAULT_API_URL = process.env.NEXT_PUBLIC_DEFAULT_API_URL || "http://127.0.0.1:8000/api";
export const MOCKS_BY_DEFAULT = process.env.NEXT_PUBLIC_USE_MOCKS === "true";

export const MAINTENANCE_TYPES = [
  "Inspection",
  "Bearing replacement",
  "Lubrication",
  "Rewind",
  "Alignment",
  "Cleaning",
  "Other",
] as const;

export const NAV_ITEMS = [
  { href: "/", label: "Overview", section: "FLEET OVERVIEW" },
  { href: "/machines", label: "Machines", section: "MACHINES" },
  { href: "/devices", label: "Devices", section: "DEVICES" },
  { href: "/diagnostics", label: "Diagnostics", section: "DIAGNOSTICS" },
  { href: "/predictions", label: "Predictions", section: "PREDICTIONS" },
] as const;
