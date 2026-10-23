"use client";

import { useState } from "react";
import { Button, Card, DataTable, EmptyState, Field, Input, Pill, Select, Textarea } from "@/components/ui";
import { MAINTENANCE_TYPES } from "@/lib/constants";
import { todayIso } from "@/lib/format";
import type { MaintenanceRecord, MaintenanceRow } from "@/lib/types";

interface Props {
  rows: MaintenanceRow[];
  onAdd: (record: MaintenanceRecord) => Promise<void>;
  onRemoveLocal: (localIndex: number) => void;
}

export function MaintenanceCard({ rows, onAdd, onRemoveLocal }: Props) {
  const [date, setDate] = useState("");
  const [type, setType] = useState<string>(MAINTENANCE_TYPES[0]);
  const [tech, setTech] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    await onAdd({ date: date || todayIso(), type, technician: tech.trim(), notes: notes.trim() });
    setSaving(false);
    setNotes("");
  };

  return (
    <Card label="PRIOR MAINTENANCE DONE">
      {rows.length === 0 ? (
        <EmptyState>No prior maintenance on record. Add the first entry below.</EmptyState>
      ) : (
        <DataTable
          rows={rows}
          rowKey={(r, i) => `${r.source}-${r.localIndex ?? i}-${r.date}`}
          columns={[
            { header: "DATE", cell: (r) => r.date || "—" },
            { header: "TYPE", cell: (r) => r.type || "—" },
            { header: "TECH", cell: (r) => r.technician || "—" },
            { header: "NOTES", cell: (r) => r.notes },
            {
              header: "SOURCE",
              cell: (r) =>
                r.source === "local" ? (
                  <span className="flex items-center gap-1.5">
                    <Pill tone="warn">LOCAL</Pill>
                    <Button variant="secondary" size="sm" onClick={() => r.localIndex !== undefined && onRemoveLocal(r.localIndex)}>
                      del
                    </Button>
                  </span>
                ) : (
                  <Pill tone="ok">DB</Pill>
                ),
            },
          ]}
        />
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (notes.trim()) void submit();
        }}
      >
        <div className="mt-2.5 grid gap-x-3.5 sm:grid-cols-3">
          <Field label="Date" id="m-date">
            <Input id="m-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Type" id="m-type">
            <Select id="m-type" value={type} onChange={(e) => setType(e.target.value)}>
              {MAINTENANCE_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </Select>
          </Field>
          <Field label="Technician" id="m-tech">
            <Input id="m-tech" value={tech} placeholder="Name" onChange={(e) => setTech(e.target.value)} />
          </Field>
        </div>
        <Field label="Work done / notes" id="m-notes">
          <Textarea id="m-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Replaced DE bearing, re-greased, vibration back to 1.2mm/s" />
        </Field>
        <div className="mt-2.5">
          <Button type="submit" disabled={saving || !notes.trim()}>
            {saving ? "Saving…" : "Add maintenance record"}
          </Button>
        </div>
      </form>
      <p className="mt-2 text-[10px] text-dim2">Saved to the backend (POST /maintenance/record); kept locally only if the backend is unreachable.</p>
    </Card>
  );
}
