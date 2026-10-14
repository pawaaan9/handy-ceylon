import { BriefcaseBusiness, MapPin, Wrench } from "lucide-react";
import type { Metadata } from "next";

import { PageHeader, Panel } from "@/components/app-shell/page-header";
import { VerificationBanner } from "@/components/app-shell/verification-banner";
import { requireRole } from "@/features/auth/server/dal";
import { getCategoryNamer } from "@/features/catalogue/server/queries";
import { getTechnicianProfile } from "@/features/technicians/server/profile";

export const metadata: Metadata = { title: "Technician dashboard" };

export default async function TechnicianDashboardPage() {
  const user = await requireRole(["technician"], { from: "/technician/dashboard" });
  const [profile, categoryName] = await Promise.all([getTechnicianProfile(user.uid), getCategoryNamer()]);

  return (
    <div className="space-y-8">
      <PageHeader
        title={`Welcome, ${user.displayName.split(" ")[0]}`}
        description="Your technician account is verified and active."
      />
      {!user.emailVerified ? <VerificationBanner email={user.email} /> : null}
      <div className="grid gap-5 md:grid-cols-2">
        <Panel title="Job requests">
          <p className="flex gap-3 text-sm text-muted-foreground">
            <BriefcaseBusiness className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
            Customer requests in your service areas will appear here once booking opens.
          </p>
        </Panel>
        <Panel title="Your services">
          {profile ? (
            <div className="space-y-3 text-sm text-muted-foreground">
              <p className="flex gap-3">
                <Wrench className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
                {profile.categoryIds.map(categoryName).join(", ")}
              </p>
              <p className="flex gap-3">
                <MapPin className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
                {profile.serviceDistricts.join(", ")}
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Your technician profile is being prepared.</p>
          )}
        </Panel>
      </div>
    </div>
  );
}
