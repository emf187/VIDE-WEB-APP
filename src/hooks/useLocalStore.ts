"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { parseStore, readRaw, STORAGE_EVENT, writeStore, type JsonKey, type JsonStores } from "@/lib/storage";

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange); // other tabs
  window.addEventListener(STORAGE_EVENT, onChange); // this tab
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(STORAGE_EVENT, onChange);
  };
}

/** Reactive raw localStorage value (string). Server render sees null. */
export function useRawStore(key: string): string | null {
  return useSyncExternalStore(
    subscribe,
    () => readRaw(key),
    () => null,
  );
}

/**
 * Reactive, validated JSON store. Every component using the same key re-renders when
 * any of them writes. The setter returns false if the browser refused the write.
 */
export function useLocalStore<K extends JsonKey>(key: K) {
  const raw = useRawStore(key);
  const value = useMemo(() => parseStore(key, raw), [key, raw]);

  const update = useCallback(
    (fn: (prev: JsonStores[K]) => JsonStores[K]) => writeStore(key, fn(parseStore(key, readRaw(key)))),
    [key],
  );

  return [value, update] as const;
}
