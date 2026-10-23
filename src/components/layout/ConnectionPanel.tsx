"use client";

import { useState } from "react";
import { Button, Check, Input, KV } from "@/components/ui";
import { firmwarePostUrl } from "@/lib/domain/firmware";
import { useApi } from "@/providers/ApiProvider";

/**
 * Backend URL + mock switch. The URL is GLOBAL (one setting for every page, saved as
 * localStorage "vide_backend_url") — it often points at a LAN box like http://10.50.2.191:8000/api.
 */
export function ConnectionPanel() {
  const { baseUrl, setBaseUrl, useMocks, setUseMocks, status, factoryName, lastError, checkNow } = useApi();
  // null = "not edited yet" → show the saved URL (which only becomes known after hydration).
  const [draft, setDraft] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const value = draft ?? baseUrl;

  const test = async () => {
    setTesting(true);
    if (value.trim() !== baseUrl) setBaseUrl(value); // provider re-checks automatically on change
    else await checkNow();
    setDraft(null);
    setTesting(false);
  };

  const statusText =
    status === "checking"
      ? "Testing…"
      : status === "live"
        ? `Connected — ${factoryName ?? "backend reachable"}`
        : `Unreachable — ${lastError ?? "no response"}`;

  return (
    <div>
      <form
        className="flex flex-wrap gap-2.5"
        onSubmit={(e) => {
          e.preventDefault();
          void test();
        }}
      >
        <Input
          aria-label="Backend API base URL"
          className="min-w-[220px] flex-1"
          value={value}
          disabled={useMocks}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="http://127.0.0.1:8000/api"
        />
        <Button type="submit" disabled={testing}>
          Test connection
        </Button>
      </form>
      <Check checked={useMocks} onChange={setUseMocks}>
        Use mock data (no backend needed — fake fleet for building and demos)
      </Check>
      <div className="mt-2">
        <KV k="Status" valueClassName={status === "live" ? "text-ok" : status === "offline" ? "text-crit" : undefined}>
          {statusText}
        </KV>
        <KV k="Firmware POST target">{useMocks ? "— (mock mode)" : `POST ${firmwarePostUrl(baseUrl)}`}</KV>
      </div>
    </div>
  );
}
