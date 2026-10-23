"use client";

import type { ReactNode } from "react";
import { ApiProvider } from "./ApiProvider";
import { PageTitleProvider } from "./PageTitleProvider";
import { ToastProvider } from "./ToastProvider";

/** All client-side context in one place, mounted once by the root layout. */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <ApiProvider>
      <ToastProvider>
        <PageTitleProvider>{children}</PageTitleProvider>
      </ToastProvider>
    </ApiProvider>
  );
}
