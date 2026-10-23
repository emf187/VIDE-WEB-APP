/**
 * Outbound text for engineers + LLM context blocks.
 * Plain-text formats are kept identical to the original pages — engineers recognise them.
 */
import { dateTimeOf, fmt, signed } from "@/lib/format";
import type { AnalyzeResponse, MachineNote, MachineProfile, MaintenanceRecord, PredictionLogEntry, Reading } from "@/lib/types";
import { average } from "./readings";
import type { Verdict } from "./forecast";

/* ---------- contact links ---------- */

export function mailtoHref(email: string, subject: string, body: string): string {
  return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function smsHref(phone: string, body: string): string {
  return `sms:${encodeURIComponent(phone.replace(/\s/g, ""))}?body=${encodeURIComponent(body)}`;
}

/** WhatsApp needs digits only. null when there is no usable phone. */
export function whatsappHref(phone: string, body: string): string | null {
  const digits = phone.replace(/\D/g, "");
  return digits ? `https://wa.me/${digits}?text=${encodeURIComponent(body)}` : null;
}

/* ---------- Machines page report ---------- */

export interface MachineReportInput {
  machineName: string;
  profile: MachineProfile;
  healthStatus: string | null;
  lastReading: Reading | null;
  photoCount: number;
  notes: MachineNote[];
  includeProfile: boolean;
  includePhotos: boolean;
}

export function buildMachineReport(i: MachineReportInput): string {
  const notes = i.notes.filter((n) => n.send);
  const L: string[] = [];
  L.push("VIDE CORTEX — MACHINE REPORT");
  L.push(`Machine: ${i.machineName} (${i.profile.type || "type n/a"})`);
  if (i.includeProfile) {
    if (i.profile.location) L.push(`Location: ${i.profile.location}`);
    if (i.healthStatus) L.push(`Health (DB): ${i.healthStatus}`);
    const r = i.lastReading;
    if (r) {
      L.push(`Last reading: ${fmt.temp(r.temperature_c)}C, ${fmt.power(r.power_kw)}kW, vib ${fmt.vib(r.vibration_mm_s)}mm/s @ ${dateTimeOf(r.timestamp)}`);
    }
    if (i.profile.rated_load_kw) L.push(`Rated load: ${i.profile.rated_load_kw} kW`);
  }
  if (i.includePhotos && i.photoCount) L.push(`Photos on file: ${i.photoCount} (see registry)`);
  const crit = notes.filter((n) => n.flag === "critical").length;
  const warn = notes.filter((n) => n.flag === "warn").length;
  if (crit || warn) L.push(`FLAGS: ${crit} critical, ${warn} warn, ${notes.length} total notes`);
  L.push("");
  if (notes.length) {
    L.push("NOTES:");
    notes.forEach((n) => L.push(`[${n.flag.toUpperCase()} ${dateTimeOf(n.ts)}] ${n.text}`));
  } else {
    L.push("No notes selected.");
  }
  L.push("");
  L.push("— sent from VIDE CORTEX Machines page");
  return L.join("\n");
}

/* ---------- Diagnostics page ---------- */

export function trendText(t: { dT: number; dV: number; n: number } | null): string {
  return t ? `ΔT ${signed(t.dT, 1)}°C · ΔV ${signed(t.dV, 2)}mm/s over ${t.n} pts` : "no data";
}

export function faultOf(res: AnalyzeResponse | null): string | null {
  return res?.ml_prediction?.fault_type ?? res?.primary_fault?.type ?? null;
}

export interface DiagnosticsMessageInput {
  machineName: string;
  last: Reading | null;
  trend: string;
  edge: AnalyzeResponse | null;
  cloud: AnalyzeResponse | null;
}

export function buildDiagnosticsMessage(i: DiagnosticsMessageInput): string {
  const r = i.last;
  const lines = [
    `VIDE DIAGNOSTICS — ${i.machineName}`,
    r
      ? `Last: ${fmt.temp(r.temperature_c)}C, ${fmt.vib(r.vibration_mm_s)}mm/s, ${fmt.power(r.power_kw)}kW @ ${dateTimeOf(r.timestamp)}`
      : "No readings yet",
    `Trend: ${i.trend}`,
  ];
  if (i.edge) lines.push(`Edge: ${faultOf(i.edge) ?? "normal"} (${i.edge.fused_diagnosis.overall_urgency})`);
  if (i.cloud) lines.push(`Cloud: ${faultOf(i.cloud) ?? "normal"} — ${i.cloud.llm_analysis ?? i.cloud.llm_error ?? "no narrative"}`);
  lines.push("", "Please advise / schedule visit. — via VIDE CORTEX");
  return lines.join("\n");
}

export function diagnosticsContext(i: DiagnosticsMessageInput): string {
  const r = i.last;
  const last = r ? `${fmt.temp(r.temperature_c)}C ${fmt.vib(r.vibration_mm_s)}mm/s ${fmt.power(r.power_kw)}kW @ ${r.timestamp}` : "none";
  const edge = i.edge ? `${faultOf(i.edge) ?? "normal"}/${i.edge.fused_diagnosis.overall_urgency}` : "n/a";
  const cloud = i.cloud ? `${faultOf(i.cloud) ?? "normal"}/${i.cloud.llm_analysis ?? "no narrative"}` : "n/a";
  return `[CONTEXT machine=${i.machineName} last=${last} trend=${i.trend} edge=${edge} cloud=${cloud}]`;
}

/* ---------- Predictions deep context ---------- */

/** One line per day: n, avg/max temp, avg/max vib, avg power. Keeps 2-month prompts small. */
export function dailyAggregates(oldest: Reading[]): string {
  const byDay = new Map<string, Reading[]>();
  for (const r of oldest) {
    const day = r.timestamp.slice(0, 10);
    const list = byDay.get(day);
    if (list) list.push(r);
    else byDay.set(day, [r]);
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, rows]) => {
      const max = (k: "temperature_c" | "vibration_mm_s") => Math.max(...rows.map((x) => x[k] ?? 0));
      return (
        `${day} n=${rows.length} t~${fmt.temp(average(rows, "temperature_c"))}/max${max("temperature_c").toFixed(0)}C ` +
        `v~${fmt.vib(average(rows, "vibration_mm_s"))}/max${max("vibration_mm_s").toFixed(2)} p~${fmt.power(average(rows, "power_kw"))}kW`
      );
    })
    .join("\n");
}

export interface DeepContextInput {
  machineName: string;
  profile: MachineProfile | undefined;
  daily: string;
  maintenance: MaintenanceRecord[];
  log: PredictionLogEntry[];
  verdict: Verdict | null;
}

export function deepContextText(i: DeepContextInput): string {
  const log = i.log
    .slice(-5)
    .map((r) => `${r.ts.slice(0, 10)} ${r.fault} ${r.hours ?? "—"}h`)
    .join(" | ");
  const verdict = i.verdict
    ? JSON.stringify({ fault: i.verdict.fault, urgency: i.verdict.urgency, hours: Math.round(i.verdict.hours), risk: i.verdict.risk })
    : "n/a";
  return [
    `[MACHINE ${i.machineName} profile=${JSON.stringify(i.profile ?? {})}]`,
    "[2-MONTH DAILY]",
    i.daily || "no readings",
    `[MAINT] ${JSON.stringify(i.maintenance.slice(-10))}`,
    `[MATHLOG] ${log || "none"}`,
    `[VERDICT] ${verdict}`,
  ].join("\n");
}
