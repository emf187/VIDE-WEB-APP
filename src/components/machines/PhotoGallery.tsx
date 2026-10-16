"use client";

import { useRef, useState } from "react";
import { Button, Card, EmptyState, Input } from "@/components/ui";
import { fileToJpegDataUrl, isSafeImageUrl } from "@/lib/domain/photos";

/** How many photos to keep for a machine when storage is full. */
const KEEP_WHEN_FULL = 5;

interface Props {
  photos: string[];
  /** Persist the new list; returns false when the browser refused (storage full). */
  onChange: (photos: string[]) => boolean;
  toast: (msg: string) => void;
}

export function PhotoGallery({ photos, onChange, toast }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState("");

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    const added: string[] = [];
    for (const file of Array.from(files)) {
      try {
        added.push(await fileToJpegDataUrl(file));
      } catch {
        toast(`Could not read ${file.name}`);
      }
    }
    if (!added.length) return;
    const next = [...photos, ...added];
    if (onChange(next)) toast("Photo(s) added");
    else if (onChange(next.slice(-KEEP_WHEN_FULL))) toast(`Storage full — kept the last ${KEEP_WHEN_FULL} photos`);
    else toast("Storage full — remove some photos first");
  };

  const addUrl = () => {
    const u = url.trim();
    if (!u) return;
    if (!isSafeImageUrl(u)) {
      toast("Use an http(s) image URL");
      return;
    }
    if (onChange([...photos, u])) setUrl("");
    else toast("Storage full");
  };

  return (
    <Card label="PHOTOS">
      <div className="flex flex-wrap gap-2.5">
        <Input
          aria-label="Image URL"
          className="min-w-[200px] flex-1"
          value={url}
          placeholder="...or paste image URL and Add"
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addUrl()}
        />
        <Button variant="secondary" onClick={addUrl}>
          Add URL
        </Button>
        <Button variant="secondary" onClick={() => fileRef.current?.click()}>
          Upload photos
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            void upload(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
      <div className="mt-2.5 grid grid-cols-[repeat(auto-fill,minmax(110px,1fr))] gap-2.5">
        {photos.length === 0 && <EmptyState className="col-span-full">No photos yet — upload or paste a URL.</EmptyState>}
        {photos.map((src, i) => (
          <figure key={`${i}-${src.slice(-24)}`} className="border-2 border-line bg-bg">
            {/* eslint-disable-next-line @next/next/no-img-element -- local data-URL photos */}
            <img src={src} alt={`Machine photo ${i + 1}`} className="block h-[90px] w-full object-cover" />
            <figcaption className="flex items-center justify-between px-1.5 py-1 text-[9px] text-dim">
              <span>#{i + 1}</span>
              <Button variant="secondary" size="sm" className="px-1.5 py-0.5 text-[9px]" onClick={() => onChange(photos.filter((_, j) => j !== i))}>
                remove
              </Button>
            </figcaption>
          </figure>
        ))}
      </div>
    </Card>
  );
}
