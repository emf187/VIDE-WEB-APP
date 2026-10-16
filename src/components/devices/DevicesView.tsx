"use client";

import { useMemo, useState } from "react";
import { PageIntro } from "@/components/layout/PageIntro";
import { Button, Card, ConfirmModal, EmptyState, Input, KV, Pill, PromptModal, Tile, cx } from "@/components/ui";
import type { VideApi } from "@/lib/api";
import { DEVICE_POLL_MS } from "@/lib/constants";
import { firmwarePostUrl } from "@/lib/domain/firmware";
import { feedHealth, linkStatus, type FeedHealth } from "@/lib/domain/readings";
import { STORAGE_KEYS } from "@/lib/storage";
import type { Device, LocalDevice } from "@/lib/types";
import { useLocalStore } from "@/hooks/useLocalStore";
import { useMachines } from "@/hooks/useMachines";
import { usePoll } from "@/hooks/usePoll";
import { useApi } from "@/providers/ApiProvider";
import { usePageTitle } from "@/providers/PageTitleProvider";
import { useToast } from "@/providers/ToastProvider";
import { DeviceDetail } from "./DeviceDetail";
import { LINK_PILL } from "./linkPill";

/** Backend rows first, then local edits layered on top (local wins, same as the old page). */
function mergeDevices(backend: Device[], local: Record<string, LocalDevice>): Device[] {
  const merged = new Map<string, Device>();
  backend.forEach((d) => merged.set(d.id, d));
  Object.entries(local).forEach(([id, d]) => merged.set(id, { ...(merged.get(id) ?? { fromBackend: false }), ...d, id }));
  return [...merged.values()].sort((a, b) => a.id.localeCompare(b.id));
}

const toLocal = (d: Device): LocalDevice => ({ type: d.type, fw: d.fw, ip: d.ip, notes: d.notes, linked: d.linked });

export function DevicesView() {
  const { api, baseUrl, useMocks } = useApi();
  const toast = useToast();
  const { machines } = useMachines();
  const [localDevices, updateLocal] = useLocalStore(STORAGE_KEYS.devices);
  const [backend, setBackend] = useState<{ api: VideApi; list: Device[]; ok: boolean } | null>(null);
  const [health, setHealth] = useState<{ checkedAt: number; byId: Record<string, FeedHealth> }>({ checkedAt: 0, byId: {} });
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const backendCurrent = backend?.api === api ? backend : null;
  const devices = useMemo(() => mergeDevices(backendCurrent?.list ?? [], localDevices), [backendCurrent, localDevices]);
  const machineNames = machines.map((m) => m.machine_name);
  usePageTitle(`${devices.length} devices · ${machines.length} machines`);

  // API: GET /devices — expected to fail until the backend has device routes (local registry only).
  usePoll(
    async () => {
      const res = await api.listDevices();
      setBackend({ api, list: res.ok ? res.data : [], ok: res.ok });
    },
    null,
    { key: api },
  );

  /** One readings request per linked MACHINE (not per device), then per-device health. */
  const checkHealth = async (list: Device[] = devices) => {
    const linkedMachines = [...new Set(list.map((d) => d.linked).filter((m): m is string => !!m))];
    const results = await Promise.all(linkedMachines.map((m) => api.recentReadings(m, 10)));
    const rowsByMachine = new Map(linkedMachines.map((m, i) => [m, results[i]?.ok ? results[i].data : null]));
    const byId: Record<string, FeedHealth> = {};
    for (const d of list) {
      const rows = d.linked ? rowsByMachine.get(d.linked) : null;
      const previous = health.byId[d.id];
      if (rows) byId[d.id] = feedHealth(rows, d.id);
      else if (previous && d.linked) byId[d.id] = previous; // keep last known on a failed fetch
    }
    setHealth({ checkedAt: Date.now(), byId });
  };

  const devicesKey = devices.map((d) => `${d.id}>${d.linked ?? ""}`).join("|");
  const pollKey = useMemo(() => ({ api, devicesKey }), [api, devicesKey]);
  usePoll(() => checkHealth(), DEVICE_POLL_MS, { key: pollKey });

  const statusOf = (d: Device) => linkStatus(health.byId[d.id]?.lastTs ?? null, health.checkedAt);
  const device = devices.find((d) => d.id === selected) ?? null;
  const q = query.toLowerCase();
  const filtered = devices.filter((d) => [d.id, d.type, d.linked, d.ip].join(" ").toLowerCase().includes(q));
  const online = devices.filter((d) => statusOf(d) === "online").length;
  const rates = Object.values(health.byId)
    .map((h) => h.rate)
    .filter((r): r is number => r !== null);

  const persist = (d: Device) => updateLocal((all) => ({ ...all, [d.id]: toLocal(d) }));

  const register = (id: string) => {
    setAdding(false);
    if (devices.some((d) => d.id === id)) {
      toast("Device exists");
      setSelected(id);
      return;
    }
    persist({ id, type: "ESP32-gateway", fw: "v1.0.0", ip: "", notes: "", linked: null, fromBackend: false });
    setSelected(id);
    toast("Device registered locally");
    void api.createDevice(id); // API: POST /devices — best effort until the backend route exists
  };

  const save = async (patch: Pick<Device, "type" | "fw" | "ip" | "notes">) => {
    if (!device) return;
    persist({ ...device, ...patch });
    toast("Device saved locally");
    const res = await api.updateDevice(device.id, { device_type: patch.type, firmware: patch.fw, ip: patch.ip, notes: patch.notes });
    if (res.ok) toast("Synced to backend");
  };

  const link = async (machine: string | null) => {
    if (!device) return;
    const next = { ...device, linked: machine };
    persist(next);
    toast(machine ? `Linked → ${machine}` : "Unlinked");
    void api.updateDevice(device.id, { linked_machine: machine }); // API: PATCH /devices/{id}
    await checkHealth(devices.map((d) => (d.id === next.id ? next : d)));
  };

  const remove = () => {
    if (!device) return;
    updateLocal((all) => {
      const copy = { ...all };
      delete copy[device.id];
      return copy;
    });
    setDeleting(false);
    if (!device.fromBackend) setSelected(null);
    toast("Local copy deleted");
  };

  return (
    <div className="flex flex-col gap-3.5">
      <PageIntro title="Devices">Edge nodes and sensors that feed machines. Machines are assets — devices are the plumbing.</PageIntro>

      <Card label="DEVICE REGISTRY SOURCE">
        <div className="flex flex-wrap gap-2.5">
          <Button
            onClick={async () => {
              const res = await api.listDevices();
              setBackend({ api, list: res.ok ? res.data : [], ok: res.ok });
              await checkHealth();
              toast("Reloaded");
            }}
          >
            Reload
          </Button>
          <Button variant="secondary" onClick={() => setAdding(true)}>
            + Register device
          </Button>
        </div>
        <div className="mt-2">
          <KV k="Status" valueClassName={backendCurrent?.ok ? "text-ok" : undefined}>
            {!backendCurrent
              ? "Loading…"
              : backendCurrent.ok
                ? `Connected — ${backendCurrent.list.length} from backend + ${Object.keys(localDevices).length} local`
                : "Local registry (backend has no /devices route yet)"}
          </KV>
          <KV k="Firmware POST target">{useMocks ? "— (mock mode)" : `POST ${firmwarePostUrl(baseUrl)}`}</KV>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="DEVICES" value={devices.length} sub={`${machines.length} machines known`} />
        <Tile label="ONLINE (<60s)" value={online} unit={`/ ${devices.length}`} sub="by linked-machine readings" pulseKey={online} />
        <Tile label="UNLINKED" value={devices.filter((d) => !d.linked).length} sub="no machine assigned" />
        <Tile
          label="AVG MSG RATE"
          value={rates.length ? (rates.reduce((a, b) => a + b, 0) / rates.length).toFixed(2) : "—"}
          unit={rates.length ? "msg/s" : undefined}
          sub={rates.length ? "avg over linked devices" : "link a device to a machine"}
        />
      </div>

      <div className="grid gap-3.5 lg:grid-cols-[340px_1fr]">
        <Card label={`DEVICE REGISTRY (${filtered.length})`}>
          <Input aria-label="Filter devices" className="mb-2.5" value={query} placeholder="Filter by id / type / machine..." onChange={(e) => setQuery(e.target.value)} />
          <div className="flex max-h-[70vh] flex-col gap-2.5 overflow-y-auto">
            {filtered.length === 0 && <EmptyState>No devices. Register one, or check the backend exposes GET /devices.</EmptyState>}
            {filtered.map((d) => {
              const pill = LINK_PILL[statusOf(d)];
              return (
                <button
                  key={d.id}
                  onClick={() => setSelected(d.id)}
                  aria-pressed={selected === d.id}
                  className={cx(
                    "border-2 bg-panel-hi px-3 py-2.5 text-left focus-visible:outline-2 focus-visible:outline-accent",
                    selected === d.id ? "border-accent" : "border-line hover:border-line-lit",
                  )}
                >
                  <div className="flex items-center justify-between gap-2 text-xs font-bold">
                    <span className="truncate">{d.id}</span>
                    <Pill tone={pill.tone}>{pill.text}</Pill>
                  </div>
                  <div className="mt-1 truncate text-[10px] text-dim">
                    {d.type || "type n/a"} → {d.linked ?? "unlinked"}
                    {d.fw ? ` · ${d.fw}` : ""}
                  </div>
                </button>
              );
            })}
          </div>
        </Card>

        {device ? (
          <DeviceDetail
            key={device.id}
            device={device}
            status={statusOf(device)}
            health={health.byId[device.id]}
            machineNames={machineNames}
            baseUrl={baseUrl}
            useMocks={useMocks}
            onSave={save}
            onLink={link}
            onDelete={() => setDeleting(true)}
            onRecheck={async () => {
              await checkHealth();
              toast("Health re-checked");
            }}
            toast={toast}
          />
        ) : (
          <EmptyState>Select a device to inspect, link, and provision.</EmptyState>
        )}
      </div>

      <PromptModal open={adding} title="REGISTER DEVICE" label="New device ID" placeholder="e.g. edge-01" submitLabel="Register" onSubmit={register} onClose={() => setAdding(false)} />
      <ConfirmModal
        open={deleting}
        title="DELETE LOCAL COPY"
        message={`Delete the local copy of ${device?.id ?? ""}?${device?.fromBackend ? " It will reappear from the backend registry." : ""}`}
        onConfirm={remove}
        onClose={() => setDeleting(false)}
      />
    </div>
  );
}
