import { ArrowRight, Info } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { PageHeader, Panel } from "@/components/app-shell/page-header";
import { FormAlert } from "@/components/forms/form-alert";
import { Button } from "@/components/ui/button";
import { roleHomes, technicianRoutes } from "@/features/auth/redirects";
import { requireUser } from "@/features/auth/server/dal";
import { getCategoryNamer } from "@/features/catalogue/server/queries";
import {
  ApplicationStatusBadge,
  ApplicationTimeline,
} from "@/features/technicians/components/application-status-card";
import { getApplication } from "@/features/technicians/server/applications";
import { formatLocalMobile } from "@/lib/format";

export const metadata: Metadata = { title: "Technician application" };

export default async function TechnicianApplicationPage() {
  const user = await requireUser({ from: technicianRoutes.application });
  if (user.role === "admin") redirect(roleHomes.admin);

  const [application, categoryName] = await Promise.all([getApplication(user.uid), getCategoryNamer()]);
  if (!application) redirect(technicianRoutes.register);

  const status = application.applicationStatus;
  const categoryNames = application.serviceCategoryIds
    .map(categoryName)
    .join(", ");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Technician application"
        description={`Submitted by ${application.displayName}`}
        actions={<ApplicationStatusBadge status={status} />}
      />

      {status === "approved" ? (
        <FormAlert tone="success" title="You're approved">
          Your technician account is active.
          {user.role === "technician" ? (
            <div className="mt-3">
              <Button asChild size="lg">
                <Link href={roleHomes.technician}>
                  Go to technician dashboard
                  <ArrowRight data-icon="inline-end" aria-hidden="true" />
                </Link>
              </Button>
            </div>
          ) : null}
        </FormAlert>
      ) : null}

      {status === "rejected" ? (
        <FormAlert tone="error" title="Your application wasn't approved this time">
          <p>{application.rejectionReason ?? "Please review your details and try again."}</p>
          <p className="mt-2">
            You can update your details or documents and resubmit. If you think this is a mistake, contact Handy
            Ceylon support from your registered email address.
          </p>
          <div className="mt-3">
            <Button asChild size="lg">
              <Link href={technicianRoutes.register}>Update and resubmit</Link>
            </Button>
          </div>
        </FormAlert>
      ) : null}

      {status === "pending" || status === "under_review" ? (
        <FormAlert tone="info" title="We're reviewing your application">
          You&apos;ll keep using Handy Ceylon as a customer while we check your details. We&apos;ll update this page
          when a decision is made — technician tools unlock only after approval.
        </FormAlert>
      ) : null}

      <div className="grid gap-5 md:grid-cols-[1fr_1.4fr]">
        <Panel title="Progress">
          <ApplicationTimeline
            status={status}
            submittedAt={application.submittedAt}
            reviewedAt={application.reviewedAt}
          />
        </Panel>
        <Panel title="Your details">
          <dl className="grid gap-x-4 gap-y-3 text-sm sm:grid-cols-[auto_1fr]">
            <dt className="text-muted-foreground">Mobile</dt>
            <dd className="text-foreground">{formatLocalMobile(application.phoneNumber)}</dd>
            <dt className="text-muted-foreground">Experience</dt>
            <dd className="text-foreground">{application.yearsOfExperience} years</dd>
            <dt className="text-muted-foreground">Services</dt>
            <dd className="text-foreground">{categoryNames}</dd>
            <dt className="text-muted-foreground">Based in</dt>
            <dd className="text-foreground">
              {application.city}, {application.district}
            </dd>
            <dt className="text-muted-foreground">Service areas</dt>
            <dd className="text-foreground">{application.serviceAreas.join(", ")}</dd>
            <dt className="text-muted-foreground">Documents</dt>
            <dd className="text-foreground">{application.qualificationDocumentPaths.length} attached</dd>
          </dl>
          {status === "pending" || status === "under_review" ? (
            <p className="mt-5 flex gap-2 border-t pt-4 text-xs text-muted-foreground">
              <Info className="size-4 shrink-0" aria-hidden="true" />
              Details are locked while under review.
            </p>
          ) : null}
        </Panel>
      </div>
    </div>
  );
}
