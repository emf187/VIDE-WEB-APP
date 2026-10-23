import type { Verdict } from "@/lib/domain/forecast";
import { dateTimeOf } from "@/lib/format";
import type { MaintenanceRecord, PredictionLogEntry } from "@/lib/types";

interface Props {
  machine: string;
  windowText: string;
  verdict: Verdict;
  mlText: string;
  mathText: string;
  chartImage: string | null;
  log: PredictionLogEntry[];
  maintenance: MaintenanceRecord[];
  llmNote: string;
}

const cell = "border border-black px-[7px] py-[5px] text-left";

/** Hidden on screen; the only thing visible when printing (see .print-only in globals.css). White paper, black borders. */
export function PrintReport({ machine, windowText, verdict, mlText, mathText, chartImage, log, maintenance, llmNote }: Props) {
  const h2 = "mt-3 mb-1.5 text-lg font-bold";
  return (
    <div className="print-only text-[11px] text-black">
      <h2 className={h2}>VIDE CORTEX — Failure forecast report</h2>
      <p>
        Machine: <b>{machine}</b> · Generated: {new Date().toLocaleString()} · Window: {windowText}
      </p>

      <h2 className={h2}>1. Cortex verdict</h2>
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className={cell}>Failure</th>
            <th className={cell}>Fault</th>
            <th className={cell}>Urgency</th>
            <th className={cell}>Risk</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className={cell}>
              {verdict.when ? verdict.when.toLocaleString() : "no failure forecast"} ({Number.isFinite(verdict.hours) ? `${verdict.hours.toFixed(0)}h` : "—"})
            </td>
            <td className={cell}>{verdict.fault}</td>
            <td className={cell}>{verdict.urgency.toUpperCase()}</td>
            <td className={cell}>{verdict.risk}</td>
          </tr>
        </tbody>
      </table>
      <p className="mt-1">Action: {verdict.action}</p>
      <p>Cortex: {mlText}</p>
      <p>Math: {mathText}</p>

      <h2 className={h2}>2. Degradation graph</h2>
      {/* eslint-disable-next-line @next/next/no-img-element -- canvas snapshot data URL */}
      {chartImage ? <img src={chartImage} alt="Degradation graph" className="w-full border border-black" /> : <p>—</p>}

      <h2 className={h2}>3. Math predictions log</h2>
      <table className="w-full border-collapse">
        <thead>
          <tr>
            {["Time", "Fault", "Hrs", "Urg", "Risk"].map((h) => (
              <th key={h} className={cell}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {log.length === 0 && (
            <tr>
              <td className={cell} colSpan={5}>
                —
              </td>
            </tr>
          )}
          {log.map((r) => (
            <tr key={r.ts}>
              <td className={cell}>{dateTimeOf(r.ts)}</td>
              <td className={cell}>{r.fault}</td>
              <td className={cell}>{r.hours ?? "—"}</td>
              <td className={cell}>{r.urg}</td>
              <td className={cell}>{r.risk}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 className={h2}>4. Maintenance</h2>
      <table className="w-full border-collapse">
        <thead>
          <tr>
            {["Date", "Type", "Tech", "Notes"].map((h) => (
              <th key={h} className={cell}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {maintenance.length === 0 && (
            <tr>
              <td className={cell} colSpan={4}>
                —
              </td>
            </tr>
          )}
          {maintenance.map((m, i) => (
            <tr key={`${m.date}-${i}`}>
              <td className={cell}>{m.date}</td>
              <td className={cell}>{m.type}</td>
              <td className={cell}>{m.technician}</td>
              <td className={cell}>{m.notes}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 className={h2}>5. LLM note</h2>
      <p className="whitespace-pre-wrap">{llmNote || "No LLM answer this session."}</p>
    </div>
  );
}
