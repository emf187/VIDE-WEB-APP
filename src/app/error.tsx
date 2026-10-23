"use client";

import { useEffect } from "react";
import { Button, Card } from "@/components/ui";

/**
 * Route-level error boundary: if a page throws while rendering, show this card inside the
 * normal layout (sidebar + topbar stay usable) instead of a white screen.
 */
export default function PageError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[page error]", error);
  }, [error]);

  return (
    <Card label="PAGE FAULT">
      <p className="text-xs text-crit">This page hit an unexpected error and was stopped safely.</p>
      <p className="mt-2 text-[11px] break-words text-dim">{error.message || "Unknown error"}</p>
      <div className="mt-3">
        <Button onClick={reset}>Reload page</Button>
      </div>
    </Card>
  );
}
