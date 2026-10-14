"use client";

import { RotateCcw, TriangleAlert } from "lucide-react";
import { useEffect } from "react";

import { StatusMessage } from "@/components/feedback/status-message";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex flex-1 items-center justify-center">
      <StatusMessage
        icon={TriangleAlert}
        tone="error"
        title="Something went wrong"
        description="We couldn't load this page. Please try again."
      >
        <Button size="xl" onClick={retry}>
          <RotateCcw data-icon="inline-start" aria-hidden="true" />
          Try again
        </Button>
      </StatusMessage>
    </main>
  );
}
