import type { ServiceRequestStatus } from "@/features/bookings/types";
import { cn } from "@/lib/utils";

import { requestStatusLabels } from "../types";

const tones: Record<ServiceRequestStatus, string> = {
  open: "bg-brand-soft text-primary",
  assigned: "bg-success/10 text-success",
  cancelled: "bg-muted text-muted-foreground",
  expired: "bg-sand text-clay",
};

export function RequestStatusBadge({ status, className }: { status: ServiceRequestStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
        tones[status],
        className,
      )}
    >
      {requestStatusLabels[status]}
    </span>
  );
}
