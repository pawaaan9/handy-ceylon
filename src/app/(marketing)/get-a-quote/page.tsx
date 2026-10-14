import { FileText } from "lucide-react";
import type { Metadata } from "next";

import { LaunchingSoon } from "@/features/landing/components/launching-soon";

export const metadata: Metadata = { title: "Get a Quote" };

export default function GetAQuotePage() {
  return (
    <LaunchingSoon
      icon={FileText}
      title="Quotations are coming soon"
      description="Soon you'll be able to request technician visits or online quotes and compare prices in LKR right here."
    />
  );
}
