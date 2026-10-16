"use client";

import { useState } from "react";
import { Button, Card, EmptyState, Field, Pill, Select, Textarea } from "@/components/ui";
import type { Tone } from "@/lib/domain/status";
import { dateTimeOf } from "@/lib/format";
import type { MachineNote, NoteFlag } from "@/lib/types";

const FLAG_TONE: Record<NoteFlag, Tone> = { info: "ok", warn: "warn", critical: "crit" };

interface Props {
  notes: MachineNote[];
  onChange: (notes: MachineNote[]) => void;
  toast: (msg: string) => void;
}

/** Flagged notes. The checkbox on each note controls whether it goes into the engineer message. */
export function NotesLog({ notes, onChange, toast }: Props) {
  const [flag, setFlag] = useState<NoteFlag>("info");
  const [text, setText] = useState("");

  const add = () => {
    const t = text.trim();
    if (!t) {
      toast("Write a note first");
      return;
    }
    onChange([...notes, { id: Date.now(), ts: new Date().toISOString(), text: t, flag, send: true }]);
    setText("");
    toast("Note logged");
  };

  return (
    <Card label="NOTES LOG">
      <div className="grid gap-x-3.5 sm:grid-cols-2">
        <Field label="Flag level" id="note-flag">
          <Select id="note-flag" value={flag} onChange={(e) => setFlag(e.target.value as NoteFlag)}>
            <option value="info">INFO</option>
            <option value="warn">WARN</option>
            <option value="critical">CRITICAL</option>
          </Select>
        </Field>
        <p className="self-end pb-2 text-[10px] text-dim2">Tick notes below to choose what gets sent to the engineer.</p>
      </div>
      <Field label="New note" id="note-text">
        <Textarea id="note-text" value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. Bearing noise louder on drive end, temp 78C, recommend inspection..." />
      </Field>
      <div className="mt-2.5">
        <Button onClick={add}>Log note</Button>
      </div>

      {notes.length === 0 ? (
        <EmptyState className="mt-2">No notes logged for this machine.</EmptyState>
      ) : (
        [...notes].reverse().map((n) => (
          <div key={n.id} className="mt-2 border border-dashed border-line-lit p-2.5 text-[11px]">
            <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2 text-[10px] text-dim">
              <label className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  className="accent-(--accent)"
                  checked={n.send}
                  aria-label="Include in engineer message"
                  onChange={(e) => onChange(notes.map((x) => (x.id === n.id ? { ...x, send: e.target.checked } : x)))}
                />
                <Pill tone={FLAG_TONE[n.flag]}>{n.flag}</Pill>· {dateTimeOf(n.ts)}
              </label>
              <Button variant="danger" size="sm" onClick={() => onChange(notes.filter((x) => x.id !== n.id))}>
                delete
              </Button>
            </div>
            <div className="whitespace-pre-wrap">{n.text}</div>
          </div>
        ))
      )}
    </Card>
  );
}
