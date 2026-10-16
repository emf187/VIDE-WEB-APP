import type { Metadata } from "next";
import { Suspense } from "react";
import { PredictionsView } from "@/components/predictions/PredictionsView";
import { EmptyState } from "@/components/ui";

export const metadata: Metadata = { title: "Predictions" };

// Machine is chosen with ?m=<machine_name>; useSearchParams needs a Suspense boundary.
export default function PredictionsPage() {
  return (
    <Suspense fallback={<EmptyState>Loading predictions…</EmptyState>}>
      <PredictionsView />
    </Suspense>
  );
}
