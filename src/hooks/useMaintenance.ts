"use client";

import { useCallback, useMemo, useState } from "react";
import type { VideApi } from "@/lib/api";
import { STORAGE_KEYS } from "@/lib/storage";
import type { MaintenanceRecord, MaintenanceRow } from "@/lib/types";
import { useApi } from "@/providers/ApiProvider";
import { useLocalStore } from "./useLocalStore";
import { usePoll } from "./usePoll";

/**
 * Maintenance history = backend records + records saved locally while the backend was down.
 * Each row knows its source, so "delete" only ever touches local rows (fixes the old page,
 * which displayed backend rows but deleted local ones by index).
 *
 * Adding tries the backend first and falls back to local storage — never both, so no duplicates.
 */
export function useMaintenance(machine: string | null) {
  const { api } = useApi();
  const [localLog, updateLocalLog] = useLocalStore(STORAGE_KEYS.maintenance);
  const [backend, setBackend] = useState<{ api: VideApi; machine: string; rows: MaintenanceRecord[]; error: string | null } | null>(null);

  const refresh = useCallback(async () => {
    if (!machine) return;
    const res = await api.maintenanceHistory(machine);
    setBackend({ api, machine, rows: res.ok ? res.data : [], error: res.ok ? null : res.error });
  }, [api, machine]);

  const pollKey = useMemo(() => ({ api, machine }), [api, machine]);
  usePoll(refresh, null, { key: pollKey, enabled: !!machine });

  const current = backend && backend.api === api && backend.machine === machine ? backend : null;
  const localRows = useMemo(() => (machine ? (localLog[machine] ?? []) : []), [localLog, machine]);

  const rows: MaintenanceRow[] = useMemo(
    () => [
      ...(current?.rows ?? []).map((r) => ({ ...r, source: "backend" as const })),
      ...localRows.map((r, i) => ({ ...r, source: "local" as const, localIndex: i })),
    ],
    [current, localRows],
  );

  /** Returns where the record ended up. */
  const add = useCallback(
    async (record: MaintenanceRecord): Promise<"backend" | "local" | "failed"> => {
      if (!machine) return "failed";
      const res = await api.addMaintenance({ ...record, machine_name: machine });
      if (res.ok) {
        await refresh();
        return "backend";
      }
      const saved = updateLocalLog((all) => ({ ...all, [machine]: [...(all[machine] ?? []), record] }));
      return saved ? "local" : "failed";
    },
    [api, machine, refresh, updateLocalLog],
  );

  const removeLocal = useCallback(
    (localIndex: number) => {
      if (!machine) return;
      updateLocalLog((all) => ({ ...all, [machine]: (all[machine] ?? []).filter((_, i) => i !== localIndex) }));
    },
    [machine, updateLocalLog],
  );

  return { rows, backendError: current?.error ?? null, add, removeLocal };
}
