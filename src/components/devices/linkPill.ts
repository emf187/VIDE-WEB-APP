import type { LinkStatus } from "@/lib/domain/readings";
import type { Tone } from "@/lib/domain/status";

/** ONLINE < 60s · STALE < 5min · OFFLINE · LOCAL ONLY (no linked readings yet). */
export const LINK_PILL: Record<LinkStatus, { tone: Tone; text: string }> = {
  online: { tone: "ok", text: "ONLINE" },
  stale: { tone: "warn", text: "STALE" },
  offline: { tone: "crit", text: "OFFLINE" },
  local: { tone: "dim", text: "NO DATA" },
};
