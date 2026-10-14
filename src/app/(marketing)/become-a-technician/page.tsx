import { HardHat } from "lucide-react";
import type { Metadata } from "next";

import { LaunchingSoon } from "@/features/landing/components/launching-soon";

export const metadata: Metadata = { title: "Become a technician" };

export default function BecomeATechnicianPage() {
  return (
    <LaunchingSoon
      icon={HardHat}
      title="Technician applications open soon"
      description="You'll be able to apply, upload your verification documents and choose your service areas here."
    />
  );
}
