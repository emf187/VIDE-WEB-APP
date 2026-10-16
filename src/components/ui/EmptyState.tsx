import type { ReactNode } from "react";
import { cx } from "./cx";

/** Dashed placeholder box — used for every empty / waiting / offline state. */
export function EmptyState({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("border-2 border-dashed border-line p-6 text-center text-xs text-dim2", className)}>{children}</div>;
}
