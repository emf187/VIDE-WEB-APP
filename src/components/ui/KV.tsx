import type { ReactNode } from "react";
import { cx } from "./cx";

/** Key/value row with a dashed divider: dim label left, bold value right. */
export function KV({ k, children, valueClassName }: { k: ReactNode; children: ReactNode; valueClassName?: string }) {
  return (
    <div className="flex justify-between gap-2.5 border-b border-dashed border-line py-[7px] text-[11px] last:border-b-0">
      <span className="shrink-0 text-dim">{k}</span>
      <span className={cx("min-w-0 text-right font-bold break-words", valueClassName)}>{children}</span>
    </div>
  );
}
