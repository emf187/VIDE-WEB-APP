import type { ReactNode } from "react";

/** Page heading + one-line operational description. */
export function PageIntro({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h1 className="mb-1 text-base font-bold tracking-[.5px]">{title}</h1>
      <p className="text-xs text-dim">{children}</p>
    </div>
  );
}
