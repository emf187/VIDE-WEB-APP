"use client";

import { useState, type ReactNode } from "react";
import { DASH } from "@/lib/format";
import { cx } from "./cx";

interface TileProps {
  label: string;
  value: ReactNode;
  unit?: string;
  sub?: ReactNode;
  /** Border tint for threshold breaches. */
  state?: "warn" | "crit";
  size?: "lg" | "md";
  /** When this changes the value flashes orange (steppy "machined" pulse). */
  pulseKey?: unknown;
}

/** Big-number stat box. */
export function Tile({ label, value, unit, sub, state, size = "lg", pulseKey }: TileProps) {
  // "Adjust state while rendering" pattern: bump `tick` when pulseKey changes, remounting the
  // value span so the CSS animation replays. No flash on first render.
  const [prevKey, setPrevKey] = useState(pulseKey);
  const [tick, setTick] = useState(0);
  if (pulseKey !== prevKey) {
    setPrevKey(pulseKey);
    setTick((t) => t + 1);
  }

  return (
    <div
      className={cx(
        "min-w-0 border-2 bg-panel p-3.5",
        state === "crit" ? "border-crit-line" : state === "warn" ? "border-warn-line" : "border-line",
      )}
    >
      <div className="mb-2 text-[9px] tracking-[1.5px] text-dim2 uppercase">{label}</div>
      <div className={cx("font-bold break-words", size === "lg" ? "text-[22px]" : "text-base")}>
        <span key={tick} className={cx("inline-block", tick > 0 && "animate-tick")}>
          {value}
        </span>
        {unit && value !== DASH && <span className="ml-1 text-[11px] font-normal text-dim">{unit}</span>}
      </div>
      {sub !== undefined && <div className="mt-1 text-[10px] text-dim2">{sub}</div>}
    </div>
  );
}
