"use client";

import { useEffect, useEffectEvent } from "react";

/**
 * Run `task` now and then every `ms` milliseconds.
 *  - `ms = null` runs once (and again whenever `key` changes).
 *  - Always runs once on start; after that skips ticks while the tab is hidden and runs
 *    immediately when it becomes visible again.
 *  - Waits for the previous run to finish before scheduling the next (no request pile-up
 *    on the single-worker SQLite backend).
 *  - Changing `key` (e.g. the selected machine) restarts the loop.
 */
export function usePoll(task: () => Promise<unknown> | void, ms: number | null, opts: { enabled?: boolean; key?: unknown } = {}) {
  const { enabled = true, key } = opts;
  const run = useEffectEvent(task);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    let first = true;
    const tick = async () => {
      if (cancelled) return;
      // The first run always happens (a page opened in a background tab must still load);
      // repeat ticks are skipped while hidden.
      if (first || !document.hidden) {
        first = false;
        try {
          await run();
        } catch (err) {
          console.error("[usePoll] task failed", err); // never let a poll error kill the loop
        }
      }
      if (!cancelled && ms !== null) timer = setTimeout(tick, ms);
    };

    const onVisible = () => {
      if (!document.hidden && ms !== null) {
        clearTimeout(timer);
        void tick();
      }
    };

    void tick();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [ms, enabled, key]);
}
