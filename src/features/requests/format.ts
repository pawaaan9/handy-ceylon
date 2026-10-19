import { formatDate } from "@/lib/format";

import { timeSlotLabels, type PreferredSchedule } from "./types";

export function formatSchedule(schedule: PreferredSchedule): string {
  switch (schedule.kind) {
    case "asap":
      return "As soon as possible";
    case "flexible":
      return "Flexible — any convenient time";
    case "scheduled":
      return `${formatDate(`${schedule.date}T12:00:00+05:30`)}, ${timeSlotLabels[schedule.timeSlot]}`;
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
