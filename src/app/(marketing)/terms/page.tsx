import type { Metadata } from "next";

import { LegalPlaceholder } from "@/components/layout/legal-placeholder";

export const metadata: Metadata = { title: "Terms of Service" };

export default function TermsPage() {
  return (
    <LegalPlaceholder
      title="Terms of Service"
      points={[
        "Handy Ceylon connects customers with independent technicians; technicians carry out the work.",
        "Repair work starts only after the customer approves the technician's quotation.",
        "Prices are shown in Sri Lankan rupees (LKR).",
        "Accounts may be suspended for fraud, abuse or repeated policy violations.",
      ]}
    />
  );
}
