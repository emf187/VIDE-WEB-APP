"use client";

import { useRef } from "react";
import { SCALE } from "@/lib/constants";
import { dateTimeOf } from "@/lib/format";
import { useTheme } from "@/hooks/useTheme";
import type { Reading } from "@/lib/types";
import { CHART_FONT, readPalette, type ChartPalette } from "./palette";
import { useCanvas } from "./useCanvas";

export type SeriesKey = "temperature_c" | "vibration_mm_s" | "power_kw" | "load_factor_pct";

export const SERIES: Array<{ key: SeriesKey; label: string; color: keyof ChartPalette; digits: number }> = [
  { key: "temperature_c", label: "TEMP °C", color: "temp", digits: 1 },
  { key: "vibration_mm_s", label: "VIB mm/s", color: "vib", digits: 2 },
  { key: "power_kw", label: "POWER kW", color: "power", digits: 1 },
  { key: "load_factor_pct", label: "LOAD %", color: "load", digits: 1 },
];

/** 5-point centred moving average. */
function smooth5(values: number[]): number[] {
  if (values.length < 3) return values;
  return values.map((_, i) => {
    const s = Math.max(0, i - 2);
    const e = Math.min(values.length, i + 3);
    let sum = 0;
    for (let j = s; j < e; j++) sum += values[j] ?? 0;
    return sum / (e - s);
  });
}

interface Props {
  /** Oldest → newest. */
  rows: Reading[];
  enabled: Record<SeriesKey, boolean>;
  smooth: boolean;
  /** Live mode: pulsing dot on the newest point + scan sweep. */
  live: boolean;
}

/**
 * Diagnostics history graph. Hand-rolled canvas (no chart library) to keep the pixel-CRT look.
 * Fixed scales per series (see SCALE) so noise is never stretched into fake swings.
 */
export function TimeSeriesChart({ rows, enabled, smooth, live }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const { theme } = useTheme();

  useCanvas(
    ref,
    (ctx, W, H) => {
      const p = readPalette(ref.current ?? document.documentElement);
      const left = 30, right = W - 10, bottom = H - 15, plotH = H - 40;
      ctx.fillStyle = p.bg;
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = p.grid;
      ctx.lineWidth = 1;
      for (let i = 1; i < 5; i++) {
        const y = Math.round((i * H) / 5) + 0.5;
        ctx.beginPath();
        ctx.moveTo(left, y);
        ctx.lineTo(right, y);
        ctx.stroke();
      }
      ctx.font = `12px ${CHART_FONT}`;
      if (!rows.length) {
        ctx.fillStyle = p.text;
        ctx.fillText("No readings — POST /api/readings first", left + 10, H / 2);
        return;
      }

      const n = rows.length;
      const xAt = (i: number) => left + ((right - left) * i) / Math.max(1, n - 1);
      const now = Date.now();

      SERIES.forEach((s, si) => {
        if (!enabled[s.key]) return;
        const raw = rows.map((r) => r[s.key] ?? 0);
        const vals = smooth ? smooth5(raw) : raw;
        const max = SCALE[s.key];
        const yAt = (v: number) => bottom - (plotH * Math.min(Math.max(v, 0), max)) / max;
        const color = p[s.color];

        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        vals.forEach((v, i) => (i ? ctx.lineTo(xAt(i), yAt(v)) : ctx.moveTo(xAt(i), yAt(v))));
        ctx.stroke();

        const newest = vals[n - 1] ?? 0;
        if (live) {
          const nx = xAt(n - 1), ny = yAt(newest);
          ctx.fillStyle = color;
          ctx.globalAlpha = 0.3;
          ctx.beginPath();
          ctx.arc(nx, ny, 5 + 4 * Math.abs(Math.sin(now / 350)), 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
          ctx.beginPath();
          ctx.arc(nx, ny, 3, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.fillStyle = color;
        ctx.font = `10px ${CHART_FONT}`;
        ctx.fillText(
          `${s.label} ${newest.toFixed(s.digits)} (min ${Math.min(...raw).toFixed(1)} / max ${Math.max(...raw).toFixed(1)})`,
          35,
          15 + si * 14,
        );
      });

      if (live) {
        const sx = left + (right - left) * ((now % 3000) / 3000);
        const g = ctx.createLinearGradient(sx - 30, 0, sx, 0);
        g.addColorStop(0, p.sweep0);
        g.addColorStop(1, p.sweep);
        ctx.fillStyle = g;
        ctx.fillRect(Math.max(left, sx - 30), 0, Math.min(30, sx - left), H);
        ctx.fillStyle = p.temp;
        ctx.fillRect(sx, 0, 1.5, H);
      }

      ctx.fillStyle = p.muted;
      ctx.font = `9px ${CHART_FONT}`;
      const first = rows[0], last = rows[n - 1];
      ctx.fillText(dateTimeOf(first?.timestamp), left, H - 4);
      const lt = dateTimeOf(last?.timestamp);
      ctx.fillText(lt, right - ctx.measureText(lt).width, H - 4);
    },
    { animate: live, redrawKey: [rows, enabled, smooth, theme] },
  );

  return <canvas ref={ref} className="block h-[260px] w-full border-2 border-line bg-bg" aria-label="Machine history graph" role="img" />;
}
