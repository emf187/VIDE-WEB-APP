"use client";

import { useState } from "react";
import { ContactButtons } from "@/components/shared/ContactButtons";
import { Button, Card, KV, Label, Textarea } from "@/components/ui";
import type { MachineProfile } from "@/lib/types";

/**
 * Message to the maintenance engineer, auto-filled from the latest reading + verdicts.
 * Once the operator edits it, live updates stop overwriting their text ("Reset" restores auto).
 * Mount with key={machine} so the draft resets when the machine changes.
 */
export function EngineerCard({ machine, profile, autoMessage, toast }: { machine: string; profile: MachineProfile | undefined; autoMessage: string; toast: (m: string) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const message = draft ?? autoMessage;

  return (
    <Card label="REACH MAINTENANCE ENGINEER">
      <KV k="Engineer">{profile?.engineer_name || "— (set on Machines page)"}</KV>
      <KV k="Email / Phone">{[profile?.engineer_email, profile?.engineer_phone].filter(Boolean).join(" · ") || "—"}</KV>
      <Label htmlFor="eng-msg">Message (auto-filled with verdict)</Label>
      <Textarea id="eng-msg" className="min-h-[110px]" value={message} onChange={(e) => setDraft(e.target.value)} />
      {draft !== null && (
        <Button variant="secondary" size="sm" className="mt-1.5" onClick={() => setDraft(null)}>
          Reset to auto message
        </Button>
      )}
      <ContactButtons profile={profile} subject={`[VIDE] Diagnostics — ${machine}`} message={message} toast={toast} />
      <p className="mt-2 text-[10px] text-dim2">Contacts come from the Machines page profile. Edit them there.</p>
    </Card>
  );
}
