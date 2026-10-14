import { BriefcaseBusiness, MapPin, Star, Wrench } from "lucide-react";
import type { Metadata } from "next";

import { SectionTitle, StatTile, WelcomeBanner } from "@/components/app-shell/dashboard-kit";
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
      <WelcomeBanner
        tone="navy"
        scene="tools"
        eyebrow="Technician dashboard"
        title={`Welcome, ${user.displayName.split(" ")[0]}`}
        description="Your technician account is verified and active."
      />
      {!user.emailVerified ? <VerificationBanner email={user.email} /> : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile label="Open job requests" value="0" tone="urgent" />
        <StatTile label="Completed jobs" value={profile?.completedJobs ?? 0} tone="primary" />
        <StatTile
          label="Rating"
          value={profile && profile.ratingCount > 0 ? profile.ratingAverage.toFixed(1) : "New"}
          tone="sand"
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <section className="rounded-2xl border bg-card p-6">
          <SectionTitle>Job requests</SectionTitle>
          <div className="mt-6 flex flex-col items-center rounded-xl border border-dashed bg-sand/50 px-6 py-10 text-center">
            <BriefcaseBusiness className="size-8 text-primary" aria-hidden="true" />
            <p className="mt-3 font-semibold text-foreground">No requests yet</p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Requests from customers in your service areas will appear here once booking opens.
            </p>
          </div>
        </section>
        <section className="rounded-2xl border bg-card p-6">
          <SectionTitle>Your services</SectionTitle>
          {profile ? (
            <div className="mt-4 space-y-4 text-sm">
              <div className="flex gap-3">
                <Wrench className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
                <div className="flex flex-wrap gap-1.5">
                  {profile.categoryIds.map((id) => (
                    <span key={id} className="rounded-full bg-brand-soft px-2.5 py-1 text-xs font-medium text-primary">
                      {categoryName(id)}
                    </span>
                  ))}
                </div>
              </div>
              <p className="flex gap-3 text-muted-foreground">
                <MapPin className="mt-0.5 size-5 shrink-0 text-urgent" aria-hidden="true" />
                {profile.serviceDistricts.join(", ")}
              </p>
              <p className="flex gap-3 text-muted-foreground">
                <Star className="mt-0.5 size-5 shrink-0 text-clay" aria-hidden="true" />
                Ratings appear after your first completed jobs.
              </p>
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">Your technician profile is being prepared.</p>
          )}
        </section>
      </div>
    </div>
  );
}
