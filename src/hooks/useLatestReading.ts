"use client";

import { useMemo, useState } from "react";
import type { VideApi } from "@/lib/api";
import type { Reading } from "@/lib/types";
import { useApi } from "@/providers/ApiProvider";
import { usePoll } from "./usePoll";

export type LatestState = "loading" | "ok" | "none" | "unavailable";

interface Result {
  api: VideApi;
  machine: string;
  reading: Reading | null;
  state: LatestState;
}

/** Latest reading for one machine, fetched when the machine or data source changes (and every `pollMs` if given). */
export function useLatestReading(machine: string | null, pollMs: number | null = null) {
  const { api } = useApi();
  const [result, setResult] = useState<Result | null>(null);
  const pollKey = useMemo(() => ({ api, machine }), [api, machine]);

  usePoll(
    async () => {
      if (!machine) return;
      const res = await api.recentReadings(machine, 1);
      setResult({
        api,
        machine,
        reading: res.ok ? (res.data[0] ?? null) : null,
        state: res.ok ? (res.data.length ? "ok" : "none") : "unavailable",
      });
    },
    pollMs,
    { key: pollKey, enabled: !!machine },
  );

  const current = result && result.api === api && result.machine === machine ? result : null;
  return { reading: current?.reading ?? null, state: current?.state ?? ("loading" as LatestState) };
}
