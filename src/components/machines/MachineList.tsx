"use client";

import { useState } from "react";
import { Card, EmptyState, Input, Pill, cx } from "@/components/ui";
import { HEALTH_TONE } from "@/lib/domain/status";
import type { Machine, MachineProfile } from "@/lib/types";

interface Props {
  machines: Machine[];
  profiles: Record<string, MachineProfile>;
  photos: Record<string, string[]>;
  selected: string | null;
  onSelect: (name: string) => void;
}

export function MachineList({ machines, profiles, photos, selected, onSelect }: Props) {
  const [query, setQuery] = useState("");
  const q = query.toLowerCase();
  const filtered = machines.filter((m) => {
    const p = profiles[m.machine_name];
    return [m.machine_name, m.machine_type, p?.type, p?.location, m.location].join(" ").toLowerCase().includes(q);
  });

  return (
    <Card label={`REGISTERED MACHINES (${filtered.length})`}>
      <Input aria-label="Filter machines" className="mb-2.5" value={query} placeholder="Filter by name / type / location..." onChange={(e) => setQuery(e.target.value)} />
      <div className="flex max-h-[70vh] flex-col gap-2.5 overflow-y-auto">
        {filtered.length === 0 && <EmptyState>No machines match. Check the backend has data (POST /api/readings) or add a machine.</EmptyState>}
        {filtered.map((m) => {
          const p = profiles[m.machine_name];
          const type = p?.type || m.machine_type || "—";
          const location = p?.location || m.location;
          const thumb = photos[m.machine_name]?.[0];
          return (
            <button
              key={m.machine_name}
              onClick={() => onSelect(m.machine_name)}
              aria-pressed={selected === m.machine_name}
              className={cx(
                "flex items-center gap-2.5 border-2 bg-panel-hi p-2.5 text-left focus-visible:outline-2 focus-visible:outline-accent",
                selected === m.machine_name ? "border-accent" : "border-line hover:border-line-lit",
              )}
            >
              {thumb ? (
                // eslint-disable-next-line @next/next/no-img-element -- local data-URL photos; next/image can't optimise them
                <img src={thumb} alt="" className="size-[52px] shrink-0 border-2 border-line bg-bg object-cover" />
              ) : (
                <div className="flex size-[52px] shrink-0 items-center justify-center border-2 border-line bg-bg text-lg text-dim2">▦</div>
              )}
              <div className="min-w-0">
                <div className="truncate text-xs font-bold">{m.machine_name}</div>
                <div className="mt-0.5 truncate text-[10px] text-dim">
                  {type}
                  {location ? ` · ${location}` : ""}
                </div>
                {m.isLocal ? (
                  <Pill className="mt-1.5">LOCAL ONLY</Pill>
                ) : (
                  <Pill tone={HEALTH_TONE[m.health_status]} className="mt-1.5">
                    {m.health_status}
                  </Pill>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </Card>
  );
}
