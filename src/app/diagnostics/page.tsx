import type { Metadata } from "next";
import { Suspense } from "react";
import { DiagnosticsView } from "@/components/diagnostics/DiagnosticsView";
import { EmptyState } from "@/components/ui";

export const metadata: Metadata = { title: "Diagnostics" };

// Machine is chosen with ?m=<machine_name>; useSearchParams needs a Suspense boundary.
export default function DiagnosticsPage() {
  return (
    <Suspense fallback={<EmptyState>Loading diagnostics…</EmptyState>}>
      <DiagnosticsView />
    </Suspense>
  );
}
