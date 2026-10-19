import { Zap } from "lucide-react";
import type { Metadata } from "next";

import { BookingEntry } from "@/features/requests/components/booking-entry";

export const metadata: Metadata = { title: "Get Help Now" };

export default function GetHelpNowPage() {
  return (
    <BookingEntry
      eyebrow="Get Help Now"
      photo="electricianAtWork"
      title="Urgent help from a nearby technician"
      description="Burst pipe, power trip or AC breakdown? Tell us what's wrong and where, and available technicians nearby can accept the job."
      options={[
        {
          mode: "urgent",
          icon: Zap,
          title: "Get Help Now",
          description: "For emergencies and jobs that need fixing within a day or two.",
          bestFor: "Breakdowns and leaks",
          cta: "Start an urgent request",
        },
      ]}
      steps={[
        "Describe the problem, add a photo if you can, and confirm your address.",
        "A nearby verified technician accepts and comes as soon as possible.",
        "They inspect and send a quotation. Work starts only when you approve it.",
      ]}
    />
  );
}
