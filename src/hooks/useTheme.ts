"use client";

import { useCallback, useEffect } from "react";
import { STORAGE_KEYS, writeRaw } from "@/lib/storage";
import { useRawStore } from "./useLocalStore";

export type Theme = "dark" | "light";

/**
 * Current theme ("vide_theme" in localStorage, dark by default).
 * The inline script in app/layout.tsx applies it before first paint (no flash);
 * this hook keeps <html data-theme> in sync afterwards.
 */
export function useTheme() {
  const raw = useRawStore(STORAGE_KEYS.theme);
  const theme: Theme = raw === "light" ? "light" : "dark";

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const toggle = useCallback(() => {
    writeRaw(STORAGE_KEYS.theme, theme === "light" ? "dark" : "light");
  }, [theme]);

  return { theme, toggle };
}
