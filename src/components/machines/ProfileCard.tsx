"use client";

import { useState, type ChangeEvent } from "react";
import { Button, Card, Field, Input, KV, Pill } from "@/components/ui";
import { HEALTH_TONE } from "@/lib/domain/status";
import { dateTimeOf, fmt } from "@/lib/format";
import type { Machine, MachineProfile, Reading } from "@/lib/types";
import type { LatestState } from "@/hooks/useLatestReading";

interface Props {
  machine: Machine;
  profile: MachineProfile;
  reading: Reading | null;
  readingState: LatestState;
  onSave: (profile: MachineProfile) => void;
  onDelete: () => void;
}

const READING_TEXT: Record<Exclude<LatestState, "ok">, string> = {
  loading: "fetching…",
  none: "no readings yet",
  unavailable: "unavailable offline",
};

/** Profile editor. Mount with key={machine_name} so the form resets when the selection changes. */
export function ProfileCard({ machine, profile, reading, readingState, onSave, onDelete }: Props) {
  const [form, setForm] = useState<MachineProfile>({
    ...profile,
    type: profile.type || machine.machine_type || "",
    location: profile.location || machine.location || "",
    rated_load_kw: profile.rated_load_kw || (machine.rated_load_kw?.toString() ?? ""),
  });
  const set = (key: keyof MachineProfile) => (e: ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const id = (k: string) => `profile-${k}`;

  return (
    <Card label={`MACHINE PROFILE / ${machine.machine_name}`}>
      <KV k="Health (from DB)">
        {machine.isLocal ? <Pill>LOCAL ONLY</Pill> : <Pill tone={HEALTH_TONE[machine.health_status]}>{machine.health_status}</Pill>}
      </KV>
      <KV k="Last reading">
        {readingState === "ok" && reading
          ? `${fmt.temp(reading.temperature_c)}°C · ${fmt.power(reading.power_kw)}kW · ${dateTimeOf(reading.timestamp)}`
          : READING_TEXT[readingState === "ok" ? "none" : readingState]}
      </KV>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave({ ...form, type: form.type.trim(), location: form.location.trim(), rated_load_kw: form.rated_load_kw.trim() });
        }}
      >
        <div className="grid gap-x-3.5 sm:grid-cols-2">
          <Field label="Machine name (ID)" id={id("name")}>
            <Input id={id("name")} value={machine.machine_name} disabled />
          </Field>
          <Field label="Machine type" id={id("type")}>
            <Input id={id("type")} value={form.type} onChange={set("type")} placeholder="e.g. motor / pump / compressor" />
          </Field>
          <Field label="Location / line" id={id("loc")}>
            <Input id={id("loc")} value={form.location} onChange={set("location")} placeholder="e.g. Hall A - Line 2" />
          </Field>
          <Field label="Rated load (kW)" id={id("rated")}>
            <Input id={id("rated")} type="number" step="0.1" min="0" value={form.rated_load_kw} onChange={set("rated_load_kw")} placeholder="10.0" />
          </Field>
          <Field label="Engineer name" id={id("eng")}>
            <Input id={id("eng")} value={form.engineer_name} onChange={set("engineer_name")} placeholder="e.g. A. Engineer" />
          </Field>
          <Field label="Engineer email" id={id("email")}>
            <Input id={id("email")} type="email" value={form.engineer_email} onChange={set("engineer_email")} placeholder="eng@plant.com" />
          </Field>
        </div>
        <Field label="Engineer phone (intl format for SMS/WhatsApp, e.g. +234...)" id={id("phone")}>
          <Input id={id("phone")} type="tel" value={form.engineer_phone} onChange={set("engineer_phone")} placeholder="+234..." />
        </Field>
        <div className="mt-3 flex flex-wrap gap-2.5">
          <Button type="submit">Save profile</Button>
          <Button variant="danger" onClick={onDelete}>
            Delete local copy
          </Button>
        </div>
      </form>
      <p className="mt-2 text-[10px] text-dim2">Profile edits save locally and are pushed to the backend when it supports PATCH /machines/{"{name}"}.</p>
    </Card>
  );
}
