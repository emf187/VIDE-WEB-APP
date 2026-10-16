/**
 * localStorage contract — the local persistence layer.
 *
 * Keys are IDENTICAL to the original HTML pages so operators keep their data after the upgrade.
 * Every read is validated (bad JSON or wrong shape → safe default) and every write is wrapped
 * in try/catch (private mode / quota full → returns false instead of throwing).
 *
 * These maps are the seed of a future backend "profiles" API: each one is keyed by
 * machine_name (or device_id), so the swap to server storage is a straight move.
 */
import type {
  LocalDevice,
  MachineNote,
  MachineProfile,
  MaintenanceRecord,
  NoteFlag,
  PredictionLogEntry,
} from "./types";

export const STORAGE_KEYS = {
  backendUrl: "vide_backend_url", // raw string, e.g. http://127.0.0.1:8000/api
  theme: "vide_theme", // raw string "dark" | "light"
  useMocks: "vide_use_mocks", // raw string "true" | "false" (new — mock mode override)
  profiles: "vide_machine_profiles",
  notes: "vide_machine_notes",
  photos: "vide_machine_photos",
  devices: "vide_devices",
  maintenance: "vide_maintenance_log",
  predictions: "vide_pred_log",
} as const;

/** Shapes of the JSON-encoded keys. */
export interface JsonStores {
  vide_machine_profiles: Record<string, MachineProfile>;
  vide_machine_notes: Record<string, MachineNote[]>;
  vide_machine_photos: Record<string, string[]>;
  vide_devices: Record<string, LocalDevice>;
  vide_maintenance_log: Record<string, MaintenanceRecord[]>;
  vide_pred_log: Record<string, PredictionLogEntry[]>;
}
export type JsonKey = keyof JsonStores;

/* ---------- small guards ---------- */

const str = (v: unknown): string => (typeof v === "string" ? v : v == null ? "" : String(v));
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

function mapValues<T>(raw: unknown, fn: (v: unknown) => T | null): Record<string, T> {
  const out: Record<string, T> = {};
  if (!isObj(raw)) return out;
  for (const [k, v] of Object.entries(raw)) {
    const parsed = fn(v);
    if (parsed !== null) out[k] = parsed;
  }
  return out;
}

function listOf<T>(raw: unknown, fn: (v: unknown) => T | null): T[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(fn).filter((x): x is T => x !== null);
}

const toProfile = (v: unknown): MachineProfile | null =>
  isObj(v)
    ? {
        type: str(v.type),
        location: str(v.location),
        rated_load_kw: str(v.rated_load_kw),
        engineer_name: str(v.engineer_name),
        engineer_email: str(v.engineer_email),
        engineer_phone: str(v.engineer_phone),
      }
    : null;

const FLAGS: NoteFlag[] = ["info", "warn", "critical"];
const toNote = (v: unknown): MachineNote | null =>
  isObj(v) && typeof v.text === "string"
    ? {
        id: typeof v.id === "number" ? v.id : Date.now(),
        ts: str(v.ts),
        text: v.text,
        flag: FLAGS.includes(v.flag as NoteFlag) ? (v.flag as NoteFlag) : "info",
        send: v.send !== false,
      }
    : null;

const toDevice = (v: unknown): LocalDevice | null =>
  isObj(v)
    ? { type: str(v.type), fw: str(v.fw), ip: str(v.ip), notes: str(v.notes), linked: v.linked ? str(v.linked) : null }
    : null;

const toMaint = (v: unknown): MaintenanceRecord | null =>
  isObj(v) ? { date: str(v.date), type: str(v.type), technician: str(v.technician), notes: str(v.notes) } : null;

const toPred = (v: unknown): PredictionLogEntry | null =>
  isObj(v)
    ? {
        ts: str(v.ts),
        fault: str(v.fault),
        conf: str(v.conf),
        urg: str(v.urg),
        hours: typeof v.hours === "number" ? v.hours : null,
        risk: typeof v.risk === "number" ? v.risk : 0,
        action: str(v.action),
        src: str(v.src),
      }
    : null;

const PARSERS: { [K in JsonKey]: (raw: unknown) => JsonStores[K] } = {
  vide_machine_profiles: (raw) => mapValues(raw, toProfile),
  vide_machine_notes: (raw) => mapValues(raw, (v) => listOf(v, toNote)),
  vide_machine_photos: (raw) => mapValues(raw, (v) => listOf(v, (p) => (typeof p === "string" ? p : null))),
  vide_devices: (raw) => mapValues(raw, toDevice),
  vide_maintenance_log: (raw) => mapValues(raw, (v) => listOf(v, toMaint)),
  vide_pred_log: (raw) => mapValues(raw, (v) => listOf(v, toPred)),
};

/* ---------- raw access ---------- */

export const STORAGE_EVENT = "vide-storage";

export function readRaw(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Returns false when the write failed (quota full, storage blocked). */
export function writeRaw(key: string, value: string | null): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
    window.dispatchEvent(new CustomEvent(STORAGE_EVENT, { detail: key }));
    return true;
  } catch {
    return false;
  }
}

/** Parse a JSON store from its raw string. Never throws. */
export function parseStore<K extends JsonKey>(key: K, raw: string | null): JsonStores[K] {
  let data: unknown = null;
  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch {
      data = null;
    }
  }
  return PARSERS[key](data);
}

export function readStore<K extends JsonKey>(key: K): JsonStores[K] {
  return parseStore(key, readRaw(key));
}

export function writeStore<K extends JsonKey>(key: K, value: JsonStores[K]): boolean {
  return writeRaw(key, JSON.stringify(value));
}

/** Read-modify-write helper. Returns false when the write failed. */
export function updateStore<K extends JsonKey>(key: K, fn: (prev: JsonStores[K]) => JsonStores[K]): boolean {
  return writeStore(key, fn(readStore(key)));
}

export const emptyProfile = (): MachineProfile => ({
  type: "",
  location: "",
  rated_load_kw: "",
  engineer_name: "",
  engineer_email: "",
  engineer_phone: "",
});
