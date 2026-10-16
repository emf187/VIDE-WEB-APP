import type { ReactNode } from "react";
import { TONE_BORDER, TONE_TEXT, type Tone } from "@/lib/domain/status";
import { cx } from "./cx";

/** Topbar-style status badge with a tinted background. */
export function Badge({ tone = "dim", children }: { tone?: "ok" | "crit" | "warn" | "dim"; children: ReactNode }) {
  const toneCls = {
    ok: "bg-ok-bg text-ok border-ok-line",
    crit: "bg-crit-bg text-crit border-crit-line",
    warn: "bg-warn-bg text-warn border-warn-line",
    dim: "bg-line text-dim border-line-lit",
  }[tone];
  return <span className={cx("border px-2.5 py-[5px] text-[9px] tracking-[1px] whitespace-nowrap uppercase", toneCls)}>{children}</span>;
}

/** Small outlined status label (health, device link state, note flag). */
export function Pill({ tone = "dim", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cx(
        "inline-block border px-2 py-[3px] text-[9px] tracking-[1px] whitespace-nowrap uppercase",
        TONE_TEXT[tone],
        TONE_BORDER[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Square status dot (sidebar footer, attention queue). */
export function Dot({ tone = "dim", blink = false, size = "sm" }: { tone?: "ok" | "crit" | "dim"; blink?: boolean; size?: "sm" | "md" }) {
  const toneCls = { ok: "bg-ok", crit: "bg-crit", dim: "bg-dim2" }[tone];
  return <span aria-hidden className={cx("inline-block shrink-0", size === "sm" ? "size-[7px]" : "size-[9px]", toneCls, blink && "animate-blink")} />;
}
