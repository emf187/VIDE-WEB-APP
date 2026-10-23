import type { ComponentProps, LabelHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cx } from "./cx";

const CONTROL =
  "w-full min-w-0 border-2 border-line bg-bg px-2.5 py-[9px] font-mono text-xs text-ink placeholder:text-dim2 focus:border-accent focus:outline-none disabled:opacity-60";

export function Label({ className, ...rest }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cx("mt-2.5 mb-1 block text-[10px] tracking-[1px] text-dim", className)} {...rest} />;
}

export function Input({ className, ...rest }: ComponentProps<"input">) {
  return <input className={cx(CONTROL, className)} {...rest} />;
}

export function Select({ className, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cx(CONTROL, className)} {...rest} />;
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cx(CONTROL, "min-h-[70px] resize-y", className)} {...rest} />;
}

/** Labelled form control. `id` links the label to the control for keyboard / screen-reader use. */
export function Field({ label, id, children, className }: { label: ReactNode; id: string; children: ReactNode; className?: string }) {
  return (
    <div className={cx("min-w-0", className)}>
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

/** Checkbox with an inline label. */
export function Check({
  checked,
  onChange,
  children,
  className,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cx("mt-2 flex items-start gap-2 text-[11px] text-dim", className)}>
      <input type="checkbox" className="mt-[3px] accent-(--accent)" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{children}</span>
    </label>
  );
}
