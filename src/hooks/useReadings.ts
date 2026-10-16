"use client";

import { useCallback, useMemo, useState } from "react";
import type { VideApi } from "@/lib/api";
import { oldestFirst } from "@/lib/domain/readings";
import type { Reading } from "@/lib/types";
import { useApi } from "@/providers/ApiProvider";
import { usePoll } from "./usePoll";

interface Snapshot {
  api: VideApi;
  machine: string;
  limit: number;
  newest: Reading[];
  error: string | null;
  loaded: boolean;
}

/**
 * Recent readings for one machine. `pollMs = null` loads once (and on machine/limit change).
 * Returns `oldest` (oldest → newest, for graphs and regression). A failed poll keeps the
 * previous rows so the graph doesn't blank out on a network blip.
 */
export function useReadings(machine: string | null, limit: number, pollMs: number | null) {
  const { api } = useApi();
  const [snap, setSnap] = useState<Snapshot | null>(null);

  const load = useCallback(async () => {
    if (!machine) return;
    const res = await api.recentReadings(machine, limit);
    setSnap((prev) => {
      const same = prev && prev.api === api && prev.machine === machine && prev.limit === limit;
      if (!res.ok) return { api, machine, limit, newest: same ? prev.newest : [], error: res.error, loaded: true };
      // Skip the re-render if nothing new arrived (same newest timestamp and count).
      if (same && prev.newest[0]?.timestamp === res.data[0]?.timestamp && prev.newest.length === res.data.length && !prev.error) return prev;
      return { api, machine, limit, newest: res.data, error: null, loaded: true };
    });
  }, [api, machine, limit]);

  const pollKey = useMemo(() => ({ api, machine, limit }), [api, machine, limit]);
  usePoll(load, pollMs, { key: pollKey, enabled: !!machine });

  const current = snap && snap.api === api && snap.machine === machine && snap.limit === limit ? snap : null;
  const oldest = useMemo(() => oldestFirst(current?.newest ?? []), [current]);

  return { oldest, error: current?.error ?? null, loaded: !!current?.loaded, reload: load };
}
