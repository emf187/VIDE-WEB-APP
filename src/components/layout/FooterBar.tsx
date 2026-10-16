"use client";

import { useApi } from "@/providers/ApiProvider";
import { connectionLabel } from "./connectionLabel";
import { useSection } from "./Topbar";

export function FooterBar() {
  const section = useSection();
  const { status, useMocks } = useApi();

  return (
    <footer className="no-print flex justify-between gap-2.5 border-t-2 border-line px-4 py-2.5 text-[10px] tracking-[.5px] text-dim2 md:px-[26px]">
      <span>VIDE CORTEX / {section}</span>
      <span>{connectionLabel(status, useMocks).footer}</span>
    </footer>
  );
}
