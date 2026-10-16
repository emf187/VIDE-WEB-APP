import type { Metadata } from "next";
import { MachinesView } from "@/components/machines/MachinesView";

export const metadata: Metadata = { title: "Machines" };

export default function MachinesPage() {
  return <MachinesView />;
}
