import { timeSlotLabels } from "@/features/requests/types";
import { formatDate } from "@/lib/format";

import type { VisitSlot } from "../schemas";

export function formatVisitSlot(slot: VisitSlot): string {
  return `${formatDate(`${slot.date}T12:00:00+05:30`)}, ${timeSlotLabels[slot.timeSlot]}`;
}
