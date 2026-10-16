"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

interface PageTitleValue {
  title: string | null;
  setTitle: (t: string | null) => void;
}

const PageTitleContext = createContext<PageTitleValue | null>(null);

/** Lets a page put a dynamic title (e.g. the selected machine) in the shared Topbar. */
export function PageTitleProvider({ children }: { children: ReactNode }) {
  const [title, setTitle] = useState<string | null>(null);
  return <PageTitleContext.Provider value={{ title, setTitle }}>{children}</PageTitleContext.Provider>;
}

export function usePageTitleValue(): string | null {
  return useContext(PageTitleContext)?.title ?? null;
}

/** Call from a page: `usePageTitle(machineName || "Machine registry")`. */
export function usePageTitle(title: string | null) {
  const setTitle = useContext(PageTitleContext)?.setTitle;
  useEffect(() => {
    setTitle?.(title);
    return () => setTitle?.(null);
  }, [title, setTitle]);
}
