import type { ButtonHTMLAttributes } from "react";
import { cx } from "./cx";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger";
  size?: "md" | "sm";
}

const VARIANT = {
  primary: "bg-accent text-on-accent border-accent hover:bg-accent-hi",
  secondary: "bg-transparent text-ink border-line-lit hover:border-accent hover:text-accent",
  danger: "bg-transparent text-crit border-crit-line hover:border-crit",
};

/** Hard-edged button with a 1px "key press" on click. */
export function Button({ variant = "primary", size = "md", className, type = "button", ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={cx(
        "border-2 font-mono font-bold tracking-[.5px] active:translate-x-px active:translate-y-px",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        "disabled:cursor-default disabled:opacity-50",
        size === "md" ? "px-4 py-[9px] text-[11px]" : "px-[9px] py-[5px] text-[10px]",
        VARIANT[variant],
        className,
      )}
      {...rest}
    />
  );
}
