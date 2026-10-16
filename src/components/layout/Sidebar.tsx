"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Dot, cx } from "@/components/ui";
import { NAV_ITEMS } from "@/lib/constants";
import { useApi } from "@/providers/ApiProvider";
import { connectionLabel } from "./connectionLabel";
import { PixelLogo } from "./PixelLogo";

export function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function Sidebar() {
  const pathname = usePathname();
  const { status, useMocks } = useApi();
  const label = connectionLabel(status, useMocks);

  return (
    <aside className="no-print flex w-full shrink-0 flex-col border-b-2 border-line bg-panel py-[18px] md:sticky md:top-0 md:h-screen md:w-[230px] md:border-r-2 md:border-b-0">
      <div className="mb-3.5 flex items-center gap-2.5 border-b-2 border-line px-[18px] pb-4">
        <PixelLogo />
        <div>
          <div className="text-[13px] font-bold tracking-[1px]">COGITEX</div>
          <div className="text-[9px] tracking-[1px] text-dim">VIDE CORTEX</div>
        </div>
      </div>

      <div className="hidden px-[18px] pt-3 pb-1.5 text-[9px] tracking-[2px] text-dim2 md:block">WORKSPACE</div>
      <nav className="flex overflow-x-auto md:flex-col">
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cx(
                "border-l-[3px] px-[18px] py-[9px] text-xs tracking-[.3px] whitespace-nowrap focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent",
                active ? "border-accent bg-panel-hi text-accent" : "border-transparent text-dim hover:bg-panel-hi hover:text-ink",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto hidden items-center gap-1.5 border-t-2 border-line px-[18px] pt-3.5 text-[10px] text-dim2 md:flex">
        <Dot tone={status === "live" ? "ok" : status === "offline" ? "crit" : "dim"} />
        <span>{label.sidebar}</span>
      </div>
    </aside>
  );
}
