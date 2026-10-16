import type { ConnectionStatus } from "@/providers/ApiProvider";

/** Shared status wording for sidebar, topbar badge and footer. */
export function connectionLabel(status: ConnectionStatus, useMocks: boolean) {
  if (status === "live") {
    return useMocks
      ? { badge: "MOCK DATA", sidebar: "MOCK DATA", footer: "MOCK DATA — NO BACKEND", tone: "warn" as const }
      : { badge: "LIVE", sidebar: "LIVE", footer: "LIVE DATA", tone: "ok" as const };
  }
  if (status === "checking") return { badge: "CONNECTING", sidebar: "CONNECTING…", footer: "CONNECTING…", tone: "dim" as const };
  return { badge: "OFFLINE", sidebar: "NO SOURCE CONNECTED", footer: "NO DATA SOURCE CONNECTED", tone: "crit" as const };
}
