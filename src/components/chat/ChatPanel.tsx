"use client";

import { useState } from "react";
import { Button, Check, EmptyState, Input, cx } from "@/components/ui";
import { useApi } from "@/providers/ApiProvider";

interface Message {
  id: number;
  who: "user" | "llm";
  text: string;
  via?: string;
}

interface Props {
  /** Example question shown in the empty log. */
  example: string;
  placeholder: string;
  contextLabel: string;
  /** Builds the context block appended to the question (machine data, verdicts…). */
  getContext: () => string;
  onAnswer?: (text: string) => void;
}

let nextId = 1;

/**
 * LLM chat about one machine. Sends `question + context` to POST /diagnostics/chat
 * (see api.chat in lib/api/endpoints.ts). When the backend LLM is unreachable the reply
 * says so and echoes the local context instead of failing silently.
 */
export function ChatPanel({ example, placeholder, contextLabel, getContext, onAnswer }: Props) {
  const { api } = useApi();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [attach, setAttach] = useState(true);
  const [busy, setBusy] = useState(false);

  const replace = (id: number, patch: Partial<Message>) => setMessages((list) => list.map((m) => (m.id === id ? { ...m, ...patch } : m)));

  const ask = async () => {
    const question = input.trim();
    if (!question || busy) return;
    const context = attach ? getContext() : "";
    const pendingId = nextId++;
    setInput("");
    setBusy(true);
    setMessages((list) => [...list, { id: nextId++, who: "user", text: question }, { id: pendingId, who: "llm", text: "thinking…" }]);

    const res = await api.chat(context ? `${question}\n\n${context}` : question);
    if (res.ok && res.data) {
      replace(pendingId, { text: res.data, via: "/diagnostics/chat" });
      onAnswer?.(res.data);
    } else if (res.ok) {
      replace(pendingId, { text: "Backend answered but no answer text was found — check toChatAnswer() field names.", via: "/diagnostics/chat" });
    } else {
      replace(pendingId, {
        via: "OFFLINE",
        text: `Backend LLM unreachable (${res.error}).${context ? `\nLocal context:\n${context}` : ""}\n\nTip: enable the LLM on the backend (config.yaml llm.enabled + GROQ_API_KEY).`,
      });
    }
    setBusy(false);
  };

  return (
    <div>
      <div className="flex h-[260px] flex-col gap-2.5 overflow-y-auto border-2 border-line bg-bg p-3 text-[11px]" aria-live="polite">
        {messages.length === 0 && <EmptyState>Ask e.g. “{example}”</EmptyState>}
        {messages.map((m) => (
          <div
            key={m.id}
            className={cx(
              "max-w-[90%] border px-2.5 py-2 whitespace-pre-wrap",
              m.who === "user" ? "self-end border-line-lit bg-panel-hi" : "self-start border-cloud-line bg-cloud-bg",
            )}
          >
            <div className="mb-1 text-[9px] tracking-[1.5px] text-dim">{m.who === "user" ? "YOU" : `LLM${m.via ? ` · via ${m.via}` : ""}`}</div>
            {m.text}
          </div>
        ))}
      </div>
      <Check checked={attach} onChange={setAttach}>
        {contextLabel}
      </Check>
      <form
        className="mt-2 flex flex-wrap gap-2.5"
        onSubmit={(e) => {
          e.preventDefault();
          void ask();
        }}
      >
        <Input aria-label="Question for the LLM" className="min-w-[180px] flex-1" value={input} placeholder={placeholder} onChange={(e) => setInput(e.target.value)} />
        <Button type="submit" disabled={busy || !input.trim()}>
          Ask
        </Button>
      </form>
      <div className="mt-2 flex items-center justify-between gap-2.5">
        <Button variant="secondary" size="sm" onClick={() => setMessages([])}>
          Clear chat
        </Button>
        <span className="text-[10px] text-dim2">POST /diagnostics/chat</span>
      </div>
    </div>
  );
}
