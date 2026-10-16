"use client";

import { useState } from "react";
import { SERIES, TimeSeriesChart, type SeriesKey } from "@/components/charts/TimeSeriesChart";
import { Button, Card, Dot, KV, Select, cx } from "@/components/ui";
import { LIVE_INTERVALS_MS } from "@/lib/constants";
import type { Reading } from "@/lib/types";

/** Legend swatch colours — same tokens the canvas reads. */
const SWATCH: Record<SeriesKey, string> = {
  temperature_c: "bg-[var(--chart-temp)]",
  vibration_mm_s: "bg-[var(--chart-vib)]",
  power_kw: "bg-[var(--chart-power)]",
  load_factor_pct: "bg-[var(--chart-load)]",
};

interface Props {
  rows: Reading[];
  live: boolean;
  onLiveChange: (live: boolean) => void;
  intervalMs: number;
  onIntervalChange: (ms: number) => void;
  trend: string;
}

export function HistoryGraphCard({ rows, live, onLiveChange, intervalMs, onIntervalChange, trend }: Props) {
  const [enabled, setEnabled] = useState<Record<SeriesKey, boolean>>({ temperature_c: true, vibration_mm_s: true, power_kw: true, load_factor_pct: true });
  const [smooth, setSmooth] = useState(true);

  return (
    <Card
      label="WORKING BEHAVIOUR — HISTORY GRAPH"
      actions={
        <div className="flex items-center gap-2 text-[10px] text-dim">
          <Dot tone={live ? "ok" : "dim"} size="md" blink={live} />
          <span>{live ? "LIVE" : "PAUSED"}</span>
          <Select aria-label="Refresh interval" className="w-auto px-2 py-1 text-[10px]" value={intervalMs} onChange={(e) => onIntervalChange(Number(e.target.value))}>
            {LIVE_INTERVALS_MS.map((ms) => (
              <option key={ms} value={ms}>
                {ms / 1000}s
              </option>
            ))}
          </Select>
          <Button variant="secondary" size="sm" onClick={() => onLiveChange(!live)}>
            {live ? "Pause" : "Resume"}
          </Button>
        </div>
      }
    >
      <TimeSeriesChart rows={rows} enabled={enabled} smooth={smooth} live={live} />
      <div className="mt-2 flex flex-wrap gap-2">
        {SERIES.map((s) => (
          <Button
            key={s.key}
            variant="secondary"
            size="sm"
            aria-pressed={enabled[s.key]}
            className={cx(!enabled[s.key] && "opacity-35")}
            onClick={() => setEnabled((e) => ({ ...e, [s.key]: !e[s.key] }))}
          >
            <span className={cx("mr-1.5 inline-block size-[9px]", SWATCH[s.key])} />
            {s.label}
          </Button>
        ))}
        <Button variant="secondary" size="sm" aria-pressed={smooth} onClick={() => setSmooth((v) => !v)}>
          SMOOTH: {smooth ? "ON" : "OFF"}
        </Button>
      </div>
      <KV k="Trend (oldest → latest)">{trend}</KV>
    </Card>
  );
}
