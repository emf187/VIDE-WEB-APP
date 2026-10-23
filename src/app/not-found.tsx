import Link from "next/link";
import { EmptyState } from "@/components/ui";

export default function NotFound() {
  return (
    <EmptyState>
      NO SUCH PAGE.{" "}
      <Link href="/" className="text-accent underline">
        Back to overview
      </Link>
    </EmptyState>
  );
}
