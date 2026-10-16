"use client";

/**
 * Global backend connection.
 *
 * Holds the base URL (shared by every page, persisted in localStorage "vide_backend_url"),
 * the mock-mode switch, the `api` client, and ONE connection status derived from a periodic
 * GET /health/detailed. Every LIVE / OFFLINE badge in the app reads this status, so if the
 * backend dies all pages flip to OFFLINE within HEALTH_POLL_MS.
 */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { createApi, type VideApi } from "@/lib/api";
import { DEFAULT_API_URL, HEALTH_POLL_MS, MOCKS_BY_DEFAULT } from "@/lib/constants";
import { STORAGE_KEYS, writeRaw } from "@/lib/storage";
import { useRawStore } from "@/hooks/useLocalStore";
import { usePoll } from "@/hooks/usePoll";

export type ConnectionStatus = "checking" | "live" | "offline";

interface ApiContextValue {
  api: VideApi;
  baseUrl: string;
  setBaseUrl: (url: string) => void;
  useMocks: boolean;
  setUseMocks: (on: boolean) => void;
  status: ConnectionStatus;
  factoryName: string | null;
  lastError: string | null;
  /** Re-run the health check now; resolves true when the backend answered. */
  checkNow: () => Promise<boolean>;
}

const ApiContext = createContext<ApiContextValue | null>(null);

export function ApiProvider({ children }: { children: ReactNode }) {
  const savedUrl = useRawStore(STORAGE_KEYS.backendUrl);
  const savedMocks = useRawStore(STORAGE_KEYS.useMocks);

  const baseUrl = (savedUrl || DEFAULT_API_URL).replace(/\/+$/, "");
  const useMocks = savedMocks === null ? MOCKS_BY_DEFAULT : savedMocks === "true";
  const api = useMemo(() => createApi(baseUrl, useMocks), [baseUrl, useMocks]);

  const [status, setStatus] = useState<ConnectionStatus>("checking");
  const [factoryName, setFactoryName] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  const checkNow = useCallback(async () => {
    const res = await api.health();
    setStatus(res.ok ? "live" : "offline");
    setFactoryName(res.ok ? res.data.factoryName : null);
    setLastError(res.ok ? null : res.error);
    return res.ok;
  }, [api]);

  // Restart the health loop whenever the target (URL or mock mode) changes.
  usePoll(checkNow, HEALTH_POLL_MS, { key: api });

  const setBaseUrl = useCallback((url: string) => {
    setStatus("checking");
    writeRaw(STORAGE_KEYS.backendUrl, url.trim().replace(/\/+$/, "") || null);
  }, []);

  const setUseMocks = useCallback((on: boolean) => {
    setStatus("checking");
    writeRaw(STORAGE_KEYS.useMocks, on ? "true" : "false");
  }, []);

  const value = useMemo(
    () => ({ api, baseUrl, setBaseUrl, useMocks, setUseMocks, status, factoryName, lastError, checkNow }),
    [api, baseUrl, setBaseUrl, useMocks, setUseMocks, status, factoryName, lastError, checkNow],
  );

  return <ApiContext.Provider value={value}>{children}</ApiContext.Provider>;
}

export function useApi(): ApiContextValue {
  const ctx = useContext(ApiContext);
  if (!ctx) throw new Error("useApi must be used inside <ApiProvider>");
  return ctx;
}
