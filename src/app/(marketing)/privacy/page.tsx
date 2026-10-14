import type { Metadata } from "next";

import { LegalPlaceholder } from "@/components/layout/legal-placeholder";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <LegalPlaceholder
      title="Privacy Policy"
      points={[
        "We collect your name, email, mobile number and service addresses to provide bookings.",
        "Your exact address is shared with a technician only after you confirm a booking.",
        "Technician verification documents are visible only to Handy Ceylon administrators.",
        "Passwords are handled by Firebase Authentication and are never stored by Handy Ceylon.",
      ]}
    />
  );
}
