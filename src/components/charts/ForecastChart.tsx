"use client";

import { useRef, type RefObject } from "react";
import { SCALE, TEMP_FAIL_C, VIB_FAIL_MM_S } from "@/lib/constants";
import type { MathResult } from "@/lib/domain/forecast";
import { dateOf, dateTimeOf } from "@/lib/format";
import { useTheme } from "@/hooks/useTheme";
import type { Reading } from "@/lib/types";
import { CHART_FONT, readPalette } from "./palette";
import { useCanvas } from "./useCanvas";

const HOUR_MS = 36e5;
/** Forecast horizon as a fraction of the history span shown. */
const FORECAST_FRACTION = 0.35;

interface Props {
  /** Oldest → newest. */
  rows: Reading[];
  math: MathResult | null;
  /** Optional external ref, e.g. so the print report can snapshot the canvas. */
  canvasRef?: RefObject<HTMLCanvasElement | null>;
}

/**
 * Degradation graph: solid history, dashed regression forecast, dashed failure thresholds.
 * The X axis is TIME (not sample index), so the forecast extends a real number of hours
 * (35% of the history span) instead of "N × last sample gap".
 */
export function ForecastChart({ rows, math, canvasRef }: Props) {
  const internalRef = useRef<HTMLCanvasElement>(null);
  const ref = canvasRef ?? internalRef;
  const { theme } = useTheme();

  useCanvas(
    ref,
    (ctx, W, H) => {
      const p = readPalette(ref.current ?? document.documentElement);
      const left = 35, right = W - 10, bottom = H - 20, plotH = H - 55;
      ctx.fillStyle = p.bg;
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = p.grid;
      ctx.lineWidth = 1;
      for (let i = 1; i < 6; i++) {
        const y = Math.round((i * H) / 6) + 0.5;
        ctx.beginPath();
        ctx.moveTo(left, y);
        ctx.lineTo(right, y);
        ctx.stroke();
      }
      ctx.font = `12px ${CHART_FONT}`;
      const first = rows[0];
      const last = rows[rows.length - 1];
      if (!first || !last) {
        ctx.fillStyle = p.text;
        ctx.fillText("No readings — POST /api/readings first", left + 10, H / 2);
        return;
      }

      const t0 = new Date(first.timestamp).getTime();
      const tLast = new Date(last.timestamp).getTime();
      const horizonMs = Math.max((tLast - t0) * FORECAST_FRACTION, 60_000);
      const tEnd = tLast + horizonMs;
      const xAt = (t: number) => left + ((right - left) * (t - t0)) / Math.max(1, tEnd - t0);
      const yAt = (v: number, max: number) => bottom - (plotH * Math.min(Math.max(v, 0), max)) / max;

      const threshold = (value: number, max: number, color: string) => {
        const y = yAt(value, max);
        ctx.strokeStyle = color;
        ctx.setLineDash([5, 4]);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(left, y);
        ctx.lineTo(right, y);
        ctx.stroke();
        ctx.setLineDash([]);
      };
      threshold(TEMP_FAIL_C, SCALE.temperature_c, p.temp);
      threshold(VIB_FAIL_MM_S, SCALE.vibration_mm_s, p.vib);

      const series = (key: "temperature_c" | "vibration_mm_s", color: string, slopePerH: number | null) => {
        const max = SCALE[key];
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        rows.forEach((r, i) => {
          const x = xAt(new Date(r.timestamp).getTime());
          const y = yAt(r[key] ?? 0, max);
          if (i) ctx.lineTo(x, y);
          else ctx.moveTo(x, y);
        });
        ctx.stroke();
        if (slopePerH === null) return;
        const lastV = last[key] ?? 0;
        ctx.setLineDash([6, 5]);
        ctx.beginPath();
        ctx.moveTo(xAt(tLast), yAt(lastV, max));
        ctx.lineTo(xAt(tEnd), yAt(lastV + slopePerH * (horizonMs / HOUR_MS), max));
        ctx.stroke();
        ctx.setLineDash([]);
      };
      series("temperature_c", p.temp, math ? math.temp.slope : null);
      series("vibration_mm_s", p.vib, math ? math.vib.slope : null);

      const dx = xAt(tLast);
      ctx.strokeStyle = p.muted;
      ctx.setLineDash([2, 3]);
      ctx.beginPath();
      ctx.moveTo(dx, 10);
      ctx.lineTo(dx, bottom);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.font = `10px ${CHART_FONT}`;
      ctx.fillStyle = p.temp;
      ctx.fillText(`TEMP ${(last.temperature_c ?? 0).toFixed(1)}°C`, 40, 17);
      ctx.fillStyle = p.vib;
      ctx.fillText(`VIB ${(last.vibration_mm_s ?? 0).toFixed(2)}mm/s`, 150, 17);
      ctx.fillStyle = p.muted;
      ctx.font = `9px ${CHART_FONT}`;
      ctx.fillText(dateOf(first.timestamp), left, H - 6);
      ctx.fillText("FORECAST →", dx + 4, H - 6);
      const endLabel = dateTimeOf(new Date(tEnd).toISOString());
      const endW = ctx.measureText(endLabel).width;
      if (right - endW > dx + 80) ctx.fillText(endLabel, right - endW, H - 6);
    },
    { animate: false, redrawKey: [rows, math, theme] },
  );

  return <canvas ref={ref} className="block h-[280px] w-full border-2 border-line bg-bg" aria-label="Degradation forecast graph" role="img" />;
}
