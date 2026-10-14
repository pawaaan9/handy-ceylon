import { ArrowLeft, type LucideIcon } from "lucide-react";
import Link from "next/link";

import { StatusMessage } from "@/components/feedback/status-message";
import { Button } from "@/components/ui/button";

/**
 * Honest placeholder for flows that are not built yet. It must never imitate
 * a working form or pretend a request was submitted.
 */
export function LaunchingSoon({
  icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <StatusMessage icon={icon} title={title} description={description} className="py-24">
      <Button asChild variant="outline" size="xl">
        <Link href="/">
          <ArrowLeft data-icon="inline-start" aria-hidden="true" />
          Back to home
        </Link>
      </Button>
    </StatusMessage>
  );
}
