import { KV } from "@/components/ui";
import { TONE_TEXT, URGENCY_TONE } from "@/lib/domain/status";
import { fmt } from "@/lib/format";
import type { AnalyzeResponse } from "@/lib/types";

/** Rule engine + ML + fused result rows. Used by Overview (instant prediction) and Diagnostics (edge). */
export function AnalysisSummary({ result, latencyMs }: { result: AnalyzeResponse; latencyMs?: number }) {
  const ml = result.ml_prediction;
  const urgency = result.fused_diagnosis.overall_urgency;
  return (
    <div>
      <KV k="Rule engine says">{result.primary_fault ? result.primary_fault.type : "Normal — no fault"}</KV>
      <KV k="ML predicts">{ml ? ml.fault_type : "Model not loaded"}</KV>
      <KV k="Confidence">{fmt.pct01(ml?.fault_type_confidence)}</KV>
      <KV k="Hours to maintenance">{fmt.hours(ml?.hours_to_maintenance)}</KV>
      <KV k="Overall urgency" valueClassName={TONE_TEXT[URGENCY_TONE[urgency]]}>
        {urgency}
      </KV>
      <KV k="Rules/ML agreement">{result.fused_diagnosis.agreement || "—"}</KV>
      <KV k="Top factors">{ml?.top_factors.slice(0, 2).join("; ") || "—"}</KV>
      {latencyMs !== undefined && <KV k="Latency">{latencyMs} ms</KV>}
    </div>
  );
}
