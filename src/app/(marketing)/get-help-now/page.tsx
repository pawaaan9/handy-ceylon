import { Zap } from "lucide-react";
import type { Metadata } from "next";

import { LaunchingSoon } from "@/features/landing/components/launching-soon";

export const metadata: Metadata = { title: "Get Help Now" };

export default function GetHelpNowPage() {
  return (
    <LaunchingSoon
      icon={Zap}
      title="Urgent requests are coming soon"
      description="We're onboarding verified technicians before opening Get Help Now. Booking will be available here once it's live."
    />
  );
}
