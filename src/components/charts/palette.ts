/**
 * Canvas can't use CSS variables directly, so charts read the --chart-* tokens from
 * globals.css at draw time. Theme switches are picked up on the next frame.
 */
export interface ChartPalette {
  bg: string;
  grid: string;
  text: string;
  muted: string;
  temp: string;
  vib: string;
  power: string;
  load: string;
  sweep: string;
  sweep0: string;
}

export const CHART_FONT = '"JetBrains Mono", Consolas, monospace';

export function readPalette(el: Element): ChartPalette {
  const css = getComputedStyle(el);
  const v = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
  return {
    bg: v("--chart-bg", "#0b0c10"),
    grid: v("--chart-grid", "#24262c"),
    text: v("--chart-text", "#71757f"),
    muted: v("--chart-muted", "#4b4e57"),
    temp: v("--chart-temp", "#ff7a1a"),
    vib: v("--chart-vib", "#ff5252"),
    power: v("--chart-power", "#3ddc84"),
    load: v("--chart-load", "#6aa8ff"),
    sweep: v("--chart-sweep", "rgba(255,122,26,0.2)"),
    sweep0: v("--chart-sweep-0", "rgba(255,122,26,0)"),
  };
}
