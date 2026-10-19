import { Camera, HardHat } from "lucide-react";
import type { Metadata } from "next";

import { BookingEntry } from "@/features/requests/components/booking-entry";

export const metadata: Metadata = { title: "Get a Quote" };

export default function GetAQuotePage() {
  return (
    <BookingEntry
      eyebrow="Get a Quote"
      photo="plumberBathroom"
      title="Compare quotations before you book"
      description="Planned work? Choose how you'd like to be quoted, describe the job once, and compare prices in LKR."
      options={[
        {
          mode: "quote_visit",
          icon: HardHat,
          title: "Technician Visit",
          description: "Technicians offer an inspection fee. Choose one; they inspect and send a detailed quotation.",
          bestFor: "Jobs that need to be seen in person",
          cta: "Request a visit",
        },
        {
          mode: "quote_online",
          icon: Camera,
          title: "Quote Online",
          description: "Share photos, videos and measurements. Compare remote quotations and pick the best.",
          bestFor: "Clear jobs like painting or tiling",
          cta: "Get quotes online",
        },
      ]}
      steps={[
        "Describe the job, choose a preferred date and confirm your address.",
        "Technicians who cover your district respond with fees or quotations.",
        "Compare and choose. Nothing is booked until you accept.",
      ]}
    />
  );
}
