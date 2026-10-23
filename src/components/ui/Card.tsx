import type { ReactNode } from "react";
import { cx } from "./cx";

/** Tiny uppercase spaced-out label that sits above every card's content. */
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  // Not text-transformed: labels are written in caps, but embedded machine names keep their case.
  return <div className={cx("mb-2.5 text-[9px] tracking-[2px] text-dim2", className)}>{children}</div>;
}

/** Small bordered tag inside an eyebrow, e.g. "ON-PREM / LOW LATENCY". */
export function Tag({ children, tone = "dim" }: { children: ReactNode; tone?: "dim" | "edge" | "cloud" }) {
  const toneCls = { dim: "border-line-lit", edge: "border-ok-line text-edge", cloud: "border-cloud-line text-cloud" }[tone];
  return <span className={cx("ml-2 border px-2 py-0.5 tracking-[1px]", toneCls)}>{children}</span>;
}

interface CardProps {
  label?: ReactNode;
  /** Right side of the header row (buttons, live controls). */
  actions?: ReactNode;
  /** Thick coloured left border: green = edge, blue = cloud / cortex. */
  accent?: "edge" | "cloud";
  className?: string;
  children: ReactNode;
}

/** Panel with 2px hard border and the corner notch. */
export function Card({ label, actions, accent, className, children }: CardProps) {
  return (
    <section
      className={cx(
        "notch min-w-0 border-2 border-line bg-panel px-[18px] py-4",
        accent === "edge" && "border-l-4 border-l-edge",
        accent === "cloud" && "border-l-4 border-l-cloud",
        className,
      )}
    >
      {(label || actions) && (
        <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2.5">
          {label && <Eyebrow className="mb-0">{label}</Eyebrow>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}
