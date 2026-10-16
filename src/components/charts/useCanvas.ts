"use client";

import { useEffect, useEffectEvent, type RefObject } from "react";

/** Animation frame budget (~30fps) — enough for the glow + sweep, light on kiosk hardware. */
const FRAME_MS = 33;

/**
 * Sizes a <canvas> to its CSS box × devicePixelRatio (crisp on any screen), redraws on resize
 * (ResizeObserver) and when `redrawKey` changes, and optionally runs an animation loop.
 * `draw` receives a context already scaled to CSS pixels.
 * requestAnimationFrame pauses automatically in hidden tabs.
 */
export function useCanvas(
  ref: RefObject<HTMLCanvasElement | null>,
  draw: (ctx: CanvasRenderingContext2D, width: number, height: number) => void,
  { animate, redrawKey }: { animate: boolean; redrawKey: unknown },
) {
  const paint = useEffectEvent(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return;
    const pw = Math.round(w * dpr);
    const ph = Math.round(h * dpr);
    if (canvas.width !== pw || canvas.height !== ph) {
      canvas.width = pw; // only reallocate the buffer when the size actually changed
      canvas.height = ph;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw(ctx, w, h);
  });

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const observer = new ResizeObserver(() => paint());
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [ref]);

  useEffect(() => {
    paint();
    if (!animate) return;
    let frame = 0;
    let last = 0;
    const loop = (now: number) => {
      if (now - last >= FRAME_MS) {
        last = now;
        paint();
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [animate, redrawKey]);
}
