"use client";

import { useState } from "react";
import { ContactButtons } from "@/components/shared/ContactButtons";
import { Card, Check, Label, Textarea } from "@/components/ui";
import { buildMachineReport } from "@/lib/domain/messages";
import type { Machine, MachineNote, MachineProfile, Reading } from "@/lib/types";

interface Props {
  machine: Machine;
  profile: MachineProfile;
  reading: Reading | null;
  photoCount: number;
  notes: MachineNote[];
  toast: (msg: string) => void;
}

export function SendToEngineer({ machine, profile, reading, photoCount, notes, toast }: Props) {
  const [includeProfile, setIncludeProfile] = useState(true);
  const [includePhotos, setIncludePhotos] = useState(true);

  const message = buildMachineReport({
    machineName: machine.machine_name,
    profile,
    healthStatus: machine.isLocal ? null : machine.health_status,
    lastReading: reading,
    photoCount,
    notes,
    includeProfile,
    includePhotos,
  });

  return (
    <Card label="SEND TO ENGINEER">
      <Check checked={includeProfile} onChange={setIncludeProfile}>
        Include machine profile + last reading
      </Check>
      <Check checked={includePhotos} onChange={setIncludePhotos}>
        Mention attached photos (count)
      </Check>
      <p className="mt-2 text-[10px] text-dim2">Ticked notes above + options are composed into one message.</p>
      <Label htmlFor="report-preview">Preview</Label>
      <Textarea id="report-preview" readOnly value={message} className="min-h-[120px]" />
      <ContactButtons profile={profile} subject={`[VIDE] ${machine.machine_name} — maintenance notes/flags`} message={message} toast={toast} showCopy />
      <p className="mt-2 text-[10px] text-dim2">
        Email uses your mail app (mailto:). SMS uses your phone messaging app (sms:). WhatsApp opens a wa.me chat. Phone/email come from the profile above.
      </p>
    </Card>
  );
}
