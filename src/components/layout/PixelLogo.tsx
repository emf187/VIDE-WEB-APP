import { useId } from "react";

/** The 16×16 pixel mascot. Copied exactly from the original pages — do not redraw. */
const PIXELS: Array<[x: number, y: number, w: number, h: number]> = [
  [6, 6, 4, 1], [6, 9, 4, 1], [6, 7, 1, 2], [9, 7, 1, 2],
  [5, 5, 1, 1], [4, 4, 1, 1], [2, 2, 2, 2],
  [3, 7, 3, 1], [1, 6, 2, 2],
  [6, 10, 1, 1], [5, 11, 1, 1], [4, 12, 2, 2],
  [10, 9, 1, 1], [11, 10, 2, 1], [12, 11, 3, 3],
  [11, 4, 2, 2],
];

export function PixelLogo({ size = 30 }: { size?: number }) {
  const gradientId = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" shapeRendering="crispEdges" aria-hidden className="shrink-0 [image-rendering:pixelated]">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="16" y2="16" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="var(--grad1)" />
          <stop offset="1" stopColor="var(--grad2)" />
        </linearGradient>
      </defs>
      {PIXELS.map(([x, y, w, h]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width={w} height={h} fill={`url(#${gradientId})`} />
      ))}
    </svg>
  );
}
