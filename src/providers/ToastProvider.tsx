"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

const TOAST_MS = 2400;

type ToastFn = (message: string) => void;
const ToastContext = createContext<ToastFn | null>(null);

/** Bottom-centre status line. One message at a time; a new one replaces the old. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const toast = useCallback<ToastFn>((msg) => {
    setMessage(msg);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMessage(null), TOAST_MS);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div aria-live="polite" className="no-print">
        {message && (
          <div className="fixed bottom-[18px] left-1/2 z-50 max-w-[90vw] -translate-x-1/2 border-2 border-line-lit bg-panel-hi px-3.5 py-[9px] text-[11px] text-ink">
            {message}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastFn {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}
