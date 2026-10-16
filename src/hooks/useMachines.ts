"use client";

import { useCallback, useMemo, useState } from "react";
import type { VideApi } from "@/lib/api";
import { num } from "@/lib/api/normalize";
import { STORAGE_KEYS } from "@/lib/storage";
import type { Machine, MachineProfile } from "@/lib/types";
import { useApi } from "@/providers/ApiProvider";
import { useLocalStore } from "./useLocalStore";
import { usePoll } from "./usePoll";

/** Backend machines + machines that only exist as local profiles (created offline). */
export function mergeLocalMachines(backend: Machine[], profiles: Record<string, MachineProfile>): Machine[] {
  const known = new Set(backend.map((m) => m.machine_name));
  const localOnly: Machine[] = Object.entries(profiles)
    .filter(([name]) => !known.has(name))
    .map(([name, p]) => ({
      machine_name: name,
      machine_type: p.type || null,
      location: p.location || null,
      rated_load_kw: num(p.rated_load_kw),
      health_status: "healthy",
      isLocal: true,
    }));
  return [...backend, ...localOnly];
}

/**
 * Machine list for the current data source. Keeps the last good list if a refresh fails
 * (operators keep seeing their fleet while the backend blips).
 */
export function useMachines(pollMs: number | null = null) {
  const { api, status } = useApi();
  const [profiles] = useLocalStore(STORAGE_KEYS.profiles);
  // Tag results with the api they came from, so switching source never shows the old fleet.
  const [result, setResult] = useState<{ api: VideApi | null; list: Machine[]; error: string | null }>({ api: null, list: [], error: null });

  const reload = useCallback(async () => {
    const res = await api.listMachines();
    setResult((prev) => ({
      api,
      list: res.ok ? res.data : prev.api === api ? prev.list : [],
      error: res.ok ? null : res.error,
    }));
  }, [api]);

  // Re-fetch when the source changes or the backend comes back online.
  const isLive = status === "live";
  const pollKey = useMemo(() => ({ api, isLive }), [api, isLive]);
  usePoll(reload, pollMs, { key: pollKey });

  const current = result.api === api;
  const backend = current ? result.list : [];
  const machines = useMemo(() => mergeLocalMachines(backend, profiles), [backend, profiles]);

  return {
    machines,
    backendCount: backend.length,
    loaded: current,
    error: current ? result.error : null,
    reload,
  };
}
