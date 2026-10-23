"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import type { Machine } from "@/lib/types";

/**
 * Selected machine lives in the URL (?m=<name>) so links like /diagnostics?m=pump-02 work
 * and the browser back button behaves. Falls back to the first machine.
 * Pages using this must be wrapped in <Suspense> (Next.js requirement for useSearchParams).
 */
export function useMachineParam(machines: Machine[]) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const requested = params.get("m");

  const selected = (requested && machines.some((m) => m.machine_name === requested) ? requested : machines[0]?.machine_name) ?? null;

  const select = useCallback(
    (name: string) => router.replace(`${pathname}?m=${encodeURIComponent(name)}`, { scroll: false }),
    [router, pathname],
  );

  return [selected, select] as const;
}
