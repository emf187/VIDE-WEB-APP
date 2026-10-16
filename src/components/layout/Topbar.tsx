"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import { Badge, Button, Modal } from "@/components/ui";
import { NAV_ITEMS } from "@/lib/constants";
import { useTheme } from "@/hooks/useTheme";
import { useApi } from "@/providers/ApiProvider";
import { usePageTitleValue } from "@/providers/PageTitleProvider";
import { ConnectionPanel } from "./ConnectionPanel";
import { connectionLabel } from "./connectionLabel";
import { isActive } from "./Sidebar";

export function useSection(): string {
  const pathname = usePathname();
  return NAV_ITEMS.find((n) => isActive(pathname, n.href))?.section ?? "CONSOLE";
}

export function Topbar() {
  const section = useSection();
  const pageTitle = usePageTitleValue();
  const { status, useMocks, factoryName } = useApi();
  const { theme, toggle } = useTheme();
  const [sourceOpen, setSourceOpen] = useState(false);
  const label = connectionLabel(status, useMocks);

  return (
    <header className="no-print flex flex-wrap items-center justify-between gap-2.5 border-b-2 border-line px-4 py-4 md:px-[26px]">
      <div className="min-w-0">
        <div className="text-[10px] tracking-[1.5px] text-dim2">CONTROL ROOM / {section}</div>
        <div className="mt-[3px] truncate text-sm font-bold">{pageTitle ?? factoryName ?? "No workspace connected"}</div>
      </div>
      <div className="flex items-center gap-2.5">
        <Button variant="secondary" size="sm" onClick={() => setSourceOpen(true)} title="Backend URL / mock data">
          SOURCE
        </Button>
        <Button variant="secondary" size="sm" onClick={toggle} title="Toggle light / dark mode">
          {theme === "light" ? "DARK" : "LIGHT"}
        </Button>
        <Badge tone={label.tone}>{label.badge}</Badge>
      </div>

      <Modal open={sourceOpen} title="DATA SOURCE" onClose={() => setSourceOpen(false)}>
        <ConnectionPanel />
        <div className="mt-3">
          <Button variant="secondary" size="sm" onClick={() => setSourceOpen(false)}>
            Close
          </Button>
        </div>
      </Modal>
    </header>
  );
}
