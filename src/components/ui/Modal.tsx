"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "./Button";
import { Eyebrow } from "./Card";
import { Input, Label } from "./Field";

/** Themed dialog — replaces the old prompt() / confirm() popups. Esc or backdrop click cancels. */
export function Modal({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="no-print fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div role="dialog" aria-modal="true" aria-label={title} className="notch w-full max-w-md border-2 border-line-lit bg-panel px-[18px] py-4">
        <Eyebrow>{title}</Eyebrow>
        {children}
      </div>
    </div>
  );
}

interface PromptModalProps {
  open: boolean;
  title: string;
  label: string;
  placeholder?: string;
  submitLabel?: string;
  onSubmit: (value: string) => void;
  onClose: () => void;
}

/** Asks for one line of text. */
export function PromptModal({ open, title, onClose, ...form }: PromptModalProps) {
  return (
    <Modal open={open} title={title} onClose={onClose}>
      {/* Mounted only while open, so the field starts empty every time. */}
      {open && <PromptForm {...form} onClose={onClose} />}
    </Modal>
  );
}

function PromptForm({ label, placeholder, submitLabel = "Add", onSubmit, onClose }: Omit<PromptModalProps, "open" | "title">) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => inputRef.current?.focus(), []);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const v = value.trim();
        if (v) onSubmit(v);
      }}
    >
      <Label htmlFor="prompt-input">{label}</Label>
      <Input id="prompt-input" ref={inputRef} value={value} placeholder={placeholder} onChange={(e) => setValue(e.target.value)} />
      <div className="mt-3 flex gap-2.5">
        <Button type="submit" disabled={!value.trim()}>
          {submitLabel}
        </Button>
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

/** Yes / no confirmation for destructive actions. */
export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = "Delete",
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal open={open} title={title} onClose={onClose}>
      <p className="text-xs text-ink">{message}</p>
      <div className="mt-3 flex gap-2.5">
        <Button variant="danger" onClick={onConfirm} autoFocus>
          {confirmLabel}
        </Button>
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </Modal>
  );
}
