import { ArrowLeft, ExternalLink, FileText } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { PageHeader, Panel, PageSkeleton } from "@/components/app-shell/page-header";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ApplicationReviewForm } from "@/features/admin/components/application-review-form";
import { requireRole } from "@/features/auth/server/dal";
import { getCategoryNamer } from "@/features/catalogue/server/queries";
import { ApplicationStatusBadge } from "@/features/technicians/components/application-status-card";
import { getApplication, getDocumentLinks } from "@/features/technicians/server/applications";
import { applicationTransitions } from "@/features/technicians/types";
import { formatDate, formatLocalMobile, initials } from "@/lib/format";
import { nextStatuses } from "@/lib/state-machine";

export const metadata: Metadata = { title: "Review application" };

export default function ApplicationDetailPage(props: PageProps<"/admin/technician-applications/[uid]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ApplicationDetailPageContent {...props} />
    </Suspense>
  );
}

async function ApplicationDetailPageContent({
  params,
}: PageProps<"/admin/technician-applications/[uid]">) {
  const { uid } = await params;
  await requireRole(["admin"], { from: `/admin/technician-applications/${uid}` });
  const application = await getApplication(uid);
  if (!application) notFound();

  const [documents, categoryName] = await Promise.all([
    getDocumentLinks(application.qualificationDocumentPaths),
    getCategoryNamer(),
  ]);
  const allowed = nextStatuses(applicationTransitions, application.applicationStatus, "admin");

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Button asChild variant="ghost" size="lg" className="-ml-2.5">
        <Link href={`/admin/technician-applications?status=${application.applicationStatus}`}>
          <ArrowLeft data-icon="inline-start" aria-hidden="true" />
          All applications
        </Link>
      </Button>

      <div className="flex items-center gap-4">
        <Avatar className="size-16 border">
          <AvatarImage src={application.photoURL} alt="" className="object-cover" />
          <AvatarFallback>{initials(application.displayName)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <PageHeader
            title={application.displayName}
            description={`Submitted ${formatDate(application.submittedAt)}${
              application.submissionCount > 1 ? ` · resubmission #${application.submissionCount}` : ""
            }`}
            actions={<ApplicationStatusBadge status={application.applicationStatus} />}
          />
        </div>
      </div>

      {allowed.length > 0 ? (
        <Panel title="Decision" description="Approval grants the technician role immediately.">
          <ApplicationReviewForm applicantUid={application.uid} allowed={allowed} />
        </Panel>
      ) : application.applicationStatus === "rejected" && application.rejectionReason ? (
        <Panel title="Rejection reason">
          <p className="text-sm text-muted-foreground">{application.rejectionReason}</p>
        </Panel>
      ) : null}

      <div className="grid gap-5 md:grid-cols-2">
        <Panel title="Contact">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-3 text-sm">
            <dt className="text-muted-foreground">Email</dt>
            <dd className="break-all text-foreground">{application.email}</dd>
            <dt className="text-muted-foreground">Mobile</dt>
            <dd className="text-foreground">{formatLocalMobile(application.phoneNumber)}</dd>
            <dt className="text-muted-foreground">Based in</dt>
            <dd className="text-foreground">
              {application.city}, {application.district}
            </dd>
            <dt className="text-muted-foreground">Travels to</dt>
            <dd className="text-foreground">{application.serviceAreas.join(", ")}</dd>
          </dl>
        </Panel>
        <Panel title="Experience">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-3 text-sm">
            <dt className="text-muted-foreground">Years</dt>
            <dd className="text-foreground">{application.yearsOfExperience}</dd>
            <dt className="text-muted-foreground">Services</dt>
            <dd className="text-foreground">
              {application.serviceCategoryIds
                .map(categoryName)
                .join(", ")}
            </dd>
            <dt className="text-muted-foreground">Skills</dt>
            <dd className="text-foreground">{application.skills.join(", ")}</dd>
          </dl>
        </Panel>
      </div>

      <Panel title="Introduction">
        <p className="text-sm leading-relaxed whitespace-pre-line text-foreground">
          {application.professionalIntroduction}
        </p>
        {application.qualifications ? (
          <>
            <h3 className="mt-5 text-sm font-semibold text-foreground">Qualifications</h3>
            <p className="mt-1 text-sm leading-relaxed whitespace-pre-line text-muted-foreground">
              {application.qualifications}
            </p>
          </>
        ) : null}
      </Panel>

      <Panel title="Documents" description="Links expire after 10 minutes.">
        {documents.length === 0 ? (
          <p className="text-sm text-muted-foreground">No documents attached.</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {documents.map((doc) => (
              <li key={doc.path} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                <FileText className="size-4 shrink-0 text-primary" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate">{doc.name}</span>
                {doc.url ? (
                  <a
                    href={doc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                  >
                    Open <ExternalLink className="size-3.5" aria-hidden="true" />
                  </a>
                ) : (
                  <span className="text-muted-foreground">Unavailable</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
