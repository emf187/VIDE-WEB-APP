"use client";

import { useState } from "react";
import { PageIntro } from "@/components/layout/PageIntro";
import { Button, Card, ConfirmModal, EmptyState, KV, PromptModal } from "@/components/ui";
import { emptyProfile, STORAGE_KEYS } from "@/lib/storage";
import type { MachineProfile } from "@/lib/types";
import { useLatestReading } from "@/hooks/useLatestReading";
import { useLocalStore } from "@/hooks/useLocalStore";
import { useMachines } from "@/hooks/useMachines";
import { useApi } from "@/providers/ApiProvider";
import { usePageTitle } from "@/providers/PageTitleProvider";
import { useToast } from "@/providers/ToastProvider";
import { MachineList } from "./MachineList";
import { NotesLog } from "./NotesLog";
import { PhotoGallery } from "./PhotoGallery";
import { ProfileCard } from "./ProfileCard";
import { SendToEngineer } from "./SendToEngineer";

export function MachinesView() {
  const { api, status } = useApi();
  const toast = useToast();
  const { machines, backendCount, loaded, error, reload } = useMachines();
  const [profiles, updateProfiles] = useLocalStore(STORAGE_KEYS.profiles);
  const [notes, updateNotes] = useLocalStore(STORAGE_KEYS.notes);
  const [photos, updatePhotos] = useLocalStore(STORAGE_KEYS.photos);
  const [selected, setSelected] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const machine = machines.find((m) => m.machine_name === selected) ?? null;
  const name = machine?.machine_name ?? null;
  const { reading, state: readingState } = useLatestReading(name);
  usePageTitle(`${machines.length} machines registered`);

  const profile = (name && profiles[name]) || emptyProfile();
  const localCount = machines.length - backendCount;

  const addMachine = async (newName: string) => {
    setAdding(false);
    if (!machines.some((m) => m.machine_name === newName)) {
      updateProfiles((all) => ({ ...all, [newName]: all[newName] ?? emptyProfile() }));
    }
    setSelected(newName);
    // API: POST /machines (see endpoints.ts). If the backend refuses, the machine stays local.
    const res = await api.createMachine({ machine_name: newName });
    if (res.ok) {
      toast("Machine registered on backend");
      void reload();
    } else {
      toast("Machine added locally (backend did not accept it)");
    }
  };

  const saveProfile = async (next: MachineProfile) => {
    if (!name) return;
    if (!updateProfiles((all) => ({ ...all, [name]: next }))) {
      toast("Could not save — browser storage is full or blocked");
      return;
    }
    toast("Profile saved locally");
    const rated = parseFloat(next.rated_load_kw);
    // API: PATCH /machines/{name} — not on the backend yet, so failure is expected for now.
    const res = await api.updateMachineProfile(name, {
      machine_type: next.type || undefined,
      location: next.location || undefined,
      rated_load_kw: Number.isFinite(rated) ? rated : undefined,
    });
    if (res.ok) toast("Profile synced to backend");
  };

  const deleteLocal = () => {
    if (!name) return;
    const without = <T,>(all: Record<string, T>) => {
      const copy = { ...all };
      delete copy[name];
      return copy;
    };
    updateProfiles(without);
    updateNotes(without);
    updatePhotos(without);
    setDeleting(false);
    if (machine?.isLocal) setSelected(null); // local-only machine is gone from the list now
    toast("Local copy cleared");
  };

  return (
    <div className="flex flex-col gap-3.5">
      <PageIntro title="Machines">All machines registered in the database. Select one to edit profile, photos, notes, and alert the engineer.</PageIntro>

      <Card label="MACHINE REGISTRY">
        <div className="flex flex-wrap gap-2.5">
          <Button onClick={() => void reload()}>Reload machines</Button>
          <Button variant="secondary" onClick={() => setAdding(true)}>
            + Add machine
          </Button>
        </div>
        <div className="mt-2">
          <KV k="Status" valueClassName={error ? "text-crit" : status === "live" ? "text-ok" : undefined}>
            {!loaded ? "Loading…" : error ? `Backend unreachable — showing local copies (${error})` : `Connected — ${backendCount} from database`}
          </KV>
          <KV k="Registry source">{backendCount ? `DB (${backendCount}) + local (${localCount})` : machines.length ? `local only (${machines.length})` : "empty"}</KV>
        </div>
      </Card>

      <div className="grid gap-3.5 lg:grid-cols-[340px_1fr]">
        <MachineList machines={machines} profiles={profiles} photos={photos} selected={name} onSelect={setSelected} />

        {!machine || !name ? (
          <EmptyState>Select a machine to view / edit its profile.</EmptyState>
        ) : (
          <div className="flex min-w-0 flex-col gap-3.5">
            <ProfileCard
              key={name}
              machine={machine}
              profile={profile}
              reading={reading}
              readingState={readingState}
              onSave={saveProfile}
              onDelete={() => setDeleting(true)}
            />
            <PhotoGallery photos={photos[name] ?? []} onChange={(list) => updatePhotos((all) => ({ ...all, [name]: list }))} toast={toast} />
            <NotesLog notes={notes[name] ?? []} onChange={(list) => updateNotes((all) => ({ ...all, [name]: list }))} toast={toast} />
            <SendToEngineer machine={machine} profile={profile} reading={reading} photoCount={photos[name]?.length ?? 0} notes={notes[name] ?? []} toast={toast} />
          </div>
        )}
      </div>

      <PromptModal
        open={adding}
        title="ADD MACHINE"
        label="New machine name / ID"
        placeholder="e.g. press-motor-05"
        onSubmit={addMachine}
        onClose={() => setAdding(false)}
      />
      <ConfirmModal
        open={deleting}
        title="DELETE LOCAL COPY"
        message={`Remove local data (profile, notes, photos) for ${name ?? ""}? Backend data is not touched.`}
        onConfirm={deleteLocal}
        onClose={() => setDeleting(false)}
      />
    </div>
  );
}
