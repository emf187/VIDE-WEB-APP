"use client";

import { useState } from "react";
import { Button, Card, Field, Input, KV, Label, Pill, Select } from "@/components/ui";
import { copyText, firmwarePostUrl, samplePayload } from "@/lib/domain/firmware";
import type { FeedHealth, LinkStatus } from "@/lib/domain/readings";
import { fmt } from "@/lib/format";
import type { Device } from "@/lib/types";
import { LINK_PILL } from "./linkPill";

interface Props {
  device: Device;
  status: LinkStatus;
  health: FeedHealth | undefined;
  machineNames: string[];
  baseUrl: string;
  useMocks: boolean;
  onSave: (patch: Pick<Device, "type" | "fw" | "ip" | "notes">) => void;
  onLink: (machine: string | null) => void;
  onDelete: () => void;
  onRecheck: () => void;
  toast: (msg: string) => void;
}

function signalText(h: FeedHealth | undefined): string {
  const r = h?.latest;
  if (!r) return "—";
  const parts = [r.rssi !== null && `RSSI ${r.rssi}`, r.battery_v !== null && `${r.battery_v}V`, r.battery_pct !== null && `${r.battery_pct}%`].filter(Boolean);
  return parts.length ? parts.join(" · ") : "not reported by firmware";
}

/** Identity, linking, health and provisioning cards. Mount with key={device.id}. */
export function DeviceDetail({ device, status, health, machineNames, baseUrl, useMocks, onSave, onLink, onDelete, onRecheck, toast }: Props) {
  const [form, setForm] = useState({ type: device.type, fw: device.fw, ip: device.ip, notes: device.notes });
  const [linkTarget, setLinkTarget] = useState(device.linked ?? machineNames[0] ?? "");
  const pill = LINK_PILL[status];
  const postUrl = firmwarePostUrl(baseUrl);
  const payload = JSON.stringify(samplePayload(device.id, device.linked), null, 2);
  const latest = health?.latest;

  return (
    <div className="flex min-w-0 flex-col gap-3.5">
      <Card label={`DEVICE IDENTITY / ${device.id}`}>
        <KV k="Status">
          <Pill tone={pill.tone}>{pill.text}</Pill>
        </KV>
        <KV k="Last seen">{health?.lastTs ? new Date(health.lastTs).toLocaleString() : "never (no linked readings)"}</KV>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSave({ type: form.type.trim(), fw: form.fw.trim(), ip: form.ip.trim(), notes: form.notes.trim() });
          }}
        >
          <div className="grid gap-x-3.5 sm:grid-cols-2">
            <Field label="Device ID" id="dev-id">
              <Input id="dev-id" value={device.id} disabled />
            </Field>
            <Field label="Device type" id="dev-type">
              <Input id="dev-type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} placeholder="e.g. ESP32-gateway / vibration-node" />
            </Field>
            <Field label="Firmware version" id="dev-fw">
              <Input id="dev-fw" value={form.fw} onChange={(e) => setForm({ ...form, fw: e.target.value })} placeholder="e.g. v1.4.2" />
            </Field>
            <Field label="IP / location" id="dev-ip">
              <Input id="dev-ip" value={form.ip} onChange={(e) => setForm({ ...form, ip: e.target.value })} placeholder="e.g. 192.168.1.40 / Hall A" />
            </Field>
          </div>
          <Field label="Notes" id="dev-notes">
            <Input id="dev-notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="e.g. CT clamp on phase 2" />
          </Field>
          <div className="mt-3 flex flex-wrap gap-2.5">
            <Button type="submit">Save device</Button>
            <Button variant="danger" onClick={onDelete}>
              Delete local copy
            </Button>
          </div>
        </form>
      </Card>

      <Card label="LINKING — DEVICE → MACHINE">
        <div className="flex flex-wrap gap-2.5">
          <Select aria-label="Machine to link" className="min-w-[180px] flex-1" value={linkTarget} onChange={(e) => setLinkTarget(e.target.value)}>
            {machineNames.length === 0 && <option value="">— no machines —</option>}
            {machineNames.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </Select>
          <Button onClick={() => (linkTarget ? onLink(linkTarget) : toast("No machine to link"))}>Link</Button>
          <Button variant="secondary" onClick={() => onLink(null)}>
            Unlink
          </Button>
        </div>
        <KV k="Currently feeds">{device.linked ?? "— unlinked —"}</KV>
        <p className="mt-1.5 text-[10px] text-dim2">
          Linking tells health checks which machine&apos;s <span className="text-ink">/readings/recent/{"{machine}"}</span> to watch for this device.
        </p>
      </Card>

      <Card label="HEALTH — MESSAGE RATE + GAPS">
        <KV k="Samples (last 10)">{health?.n ?? 0}</KV>
        <KV k="Rate">{health?.rate != null ? `${fmt.rate(health.rate, 3)} (${health.n} pts)` : "— (needs linked machine with readings)"}</KV>
        <KV k="Biggest gap">{health?.maxGapMs ? `${Math.round(health.maxGapMs / 1000)}s` : "—"}</KV>
        <KV k="Signal / battery">{signalText(health)}</KV>
        <KV k="Last payload">{latest ? `${fmt.temp(latest.temperature_c)}°C ${fmt.vib(latest.vibration_mm_s)}mm/s ${fmt.power(latest.power_kw)}kW` : "—"}</KV>
        <div className="mt-2.5">
          <Button variant="secondary" onClick={onRecheck}>
            Re-check health
          </Button>
        </div>
      </Card>

      <Card label="PROVISIONING — FIRMWARE SETUP">
        <KV k="POST target">{useMocks ? "— (mock mode)" : `POST ${postUrl}`}</KV>
        <Label>Sample payload (device_id prefilled — copy to firmware)</Label>
        <pre className="mt-2 overflow-x-auto border-2 border-line bg-bg p-3 text-[11px] break-all whitespace-pre-wrap">{payload}</pre>
        <div className="mt-2.5 flex flex-wrap gap-2.5">
          <Button variant="secondary" onClick={async () => toast((await copyText(payload)) ? "Payload copied" : "Copy failed")}>
            Copy payload
          </Button>
          <Button variant="secondary" onClick={async () => toast((await copyText(postUrl)) ? "POST URL copied" : "Copy failed")}>
            Copy POST URL
          </Button>
        </div>
        <p className="mt-2 text-[10px] text-dim2">
          Firmware must POST JSON with at least <span className="text-ink">machine_name + power_kw / temperature_c / vibration_mm_s</span>. The device→machine link decides which machine_name to use.
        </p>
      </Card>
    </div>
  );
}
