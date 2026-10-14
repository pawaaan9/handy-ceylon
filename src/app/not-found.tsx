import { ArrowLeft, SearchX } from "lucide-react";
import Link from "next/link";

import { StatusMessage } from "@/components/feedback/status-message";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex flex-1 items-center justify-center">
      <StatusMessage
        icon={SearchX}
        title="Page not found"
        description="The page you're looking for doesn't exist or has moved."
      >
        <Button asChild size="xl">
          <Link href="/">
            <ArrowLeft data-icon="inline-start" aria-hidden="true" />
            Back to home
          </Link>
        </Button>
      </StatusMessage>
    </main>
  );
}
