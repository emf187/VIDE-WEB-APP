/**
 * Fake fleet for mock mode. Readings are a pure function of time, so polling looks "live"
 * and every page sees consistent numbers without any shared state.
 *
 * Each machine degrades linearly from MOCK_START (60 days ago) plus deterministic noise,
 * which gives the Predictions regression a real upward trend to find.
 */
import type { HealthStatus, Reading } from "@/lib/types";

interface Signal {
  base: number;
  perDay: number; // linear drift
  noise: number; // amplitude
}

export interface MockMachine {
  name: string;
  type: string;
  location: string;
  ratedKw: number;
  health: HealthStatus;
  deviceId: string | null;
  temp: Signal;
  vib: Signal;
  powerKw: number;
  loadPct: number;
}

export const MOCK_FLEET: MockMachine[] = [
  {
    name: "press-motor-01",
    type: "motor",
    location: "Hall A - Line 1",
    ratedKw: 11,
    health: "healthy",
    deviceId: "edge-01",
    temp: { base: 50, perDay: 0.04, noise: 1.2 },
    vib: { base: 1.3, perDay: 0.004, noise: 0.15 },
    powerKw: 6.4,
    loadPct: 58,
  },
  {
    name: "coolant-pump-02",
    type: "pump",
    location: "Hall A - Line 2",
    ratedKw: 7.5,
    health: "watch",
    deviceId: "edge-02",
    temp: { base: 55, perDay: 0.15, noise: 1.5 },
    vib: { base: 2.0, perDay: 0.02, noise: 0.25 },
    powerKw: 5.1,
    loadPct: 71,
  },
  {
    name: "air-compressor-03",
    type: "compressor",
    location: "Utility room",
    ratedKw: 15,
    health: "warning",
    deviceId: "edge-03",
    temp: { base: 60, perDay: 0.22, noise: 2 },
    vib: { base: 2.6, perDay: 0.035, noise: 0.3 },
    powerKw: 12.2,
    loadPct: 81,
  },
  {
    name: "conveyor-drive-04",
    type: "conveyor",
    location: "Packing",
    ratedKw: 5.5,
    health: "critical",
    deviceId: null,
    temp: { base: 68, perDay: 0.27, noise: 2 },
    vib: { base: 3.6, perDay: 0.055, noise: 0.35 },
    powerKw: 4.9,
    loadPct: 92,
  },
];

const DAY_MS = 86_400_000;
export const MOCK_START = Date.now() - 60 * DAY_MS;

/** Short windows tick every 3s (live graphs); long windows every 30min (≈2 months for 3000 points). */
export function stepFor(limit: number): number {
  return limit > 300 ? 30 * 60_000 : 3000;
}

function seedOf(name: string): number {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 9973;
  return h;
}

function wave(t: number, seed: number): number {
  return Math.sin(t / 7000 + seed) * 0.6 + Math.sin(t / 47000 + seed * 2) * 0.3 + Math.sin(t / 3.7e6 + seed * 3) * 0.4;
}

function signal(s: Signal, t: number, seed: number): number {
  const days = Math.max(0, (t - MOCK_START) / DAY_MS);
  return s.base + s.perDay * days + s.noise * wave(t, seed);
}

const round = (v: number, d: number) => Math.round(v * 10 ** d) / 10 ** d;

export function mockReading(m: MockMachine, t: number): Reading {
  const seed = seedOf(m.name);
  const load = Math.min(100, Math.max(0, m.loadPct + 6 * wave(t, seed + 5)));
  const power = Math.max(0, m.powerKw * (load / m.loadPct));
  const voltage = 230 + 3 * wave(t, seed + 9);
  const pf = 0.86 + 0.04 * wave(t, seed + 11);
  return {
    machine_name: m.name,
    device_id: m.deviceId,
    timestamp: new Date(t).toISOString(),
    voltage_v: round(voltage, 1),
    current_amps: round((power * 1000) / (voltage * pf), 2),
    power_kw: round(power, 2),
    power_factor: round(pf, 3),
    frequency_hz: round(50 + 0.05 * wave(t, seed + 13), 2),
    energy_kwh: null,
    temperature_c: round(signal(m.temp, t, seed), 2),
    vibration_mm_s: round(Math.max(0, signal(m.vib, t, seed + 1)), 3),
    acceleration_g: null,
    pressure_bar: null,
    flow_lpm: null,
    load_factor_pct: round(load, 1),
    rssi: m.deviceId ? Math.round(-58 + 6 * wave(t, seed + 17)) : null,
    battery_v: null,
    battery_pct: null,
  };
}

/** Newest-first, like the real endpoint. */
export function mockReadings(m: MockMachine, limit: number, now = Date.now()): Reading[] {
  const step = stepFor(limit);
  const latest = Math.floor(now / step) * step;
  return Array.from({ length: limit }, (_, i) => mockReading(m, latest - i * step));
}
