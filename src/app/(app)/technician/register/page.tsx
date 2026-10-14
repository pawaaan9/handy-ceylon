import { BadgeCheck, MailWarning, ShieldCheck, Wallet } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { WelcomeBanner } from "@/components/app-shell/dashboard-kit";
import { PageHeader, Panel, PageSkeleton } from "@/components/app-shell/page-header";
import { LinkEmailForm } from "@/features/auth/components/link-email-form";
import { FormAlert } from "@/components/forms/form-alert";
import { Button } from "@/components/ui/button";
import { authRoutes, roleHomes, technicianRoutes } from "@/features/auth/redirects";
import { getCurrentUser, isEmailVerified } from "@/features/auth/server/dal";
import { TechnicianApplicationForm } from "@/features/technicians/components/application-form";
import type { TechnicianApplicationFormValues } from "@/features/technicians/schemas";
import { getApplication } from "@/features/technicians/server/applications";
import { getCatalogue } from "@/features/catalogue/server/queries";
import { formatLocalMobile } from "@/lib/format";

export const metadata: Metadata = { title: "Become a technician" };

const benefits = [
  { icon: BadgeCheck, text: "Get verified once and receive requests in the districts you choose." },
  { icon: Wallet, text: "Set your own inspection fees and send itemised quotations in LKR." },
  { icon: ShieldCheck, text: "Customers approve quotes before work starts — no payment disputes over scope." },
];

export default function TechnicianRegisterPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <TechnicianRegisterPageContent />
    </Suspense>
  );
}

async function TechnicianRegisterPageContent() {
  const user = await getCurrentUser();
  const encodedNext = encodeURIComponent(technicianRoutes.register);

  if (!user) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <WelcomeBanner
          tone="navy"
          photo="technicianToolBelt"
          eyebrow="For skilled professionals"
          title="Become a Handy Ceylon technician"
          description="Join a network of verified home-service professionals across Sri Lanka."
        />
        <Panel>
          <ul className="space-y-4">
            {benefits.map(({ icon: Icon, text }) => (
              <li key={text} className="flex gap-3 text-sm text-muted-foreground">
                <Icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
                {text}
              </li>
            ))}
          </ul>
          <div className="mt-6 border-t pt-6">
            <p className="text-sm text-muted-foreground">
              Start by creating a free account and verifying your email. Then you can submit your technician
              application for review.
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <Button asChild size="xl">
                <Link href={`${authRoutes.signUp}?next=${encodedNext}`}>Create account to apply</Link>
              </Button>
              <Button asChild size="xl" variant="outline">
                <Link href={`${authRoutes.login}?next=${encodedNext}`}>I already have an account</Link>
              </Button>
            </div>
          </div>
        </Panel>
      </div>
    );
  }

  if (!user.role) redirect(authRoutes.completeProfile);
  if (user.role === "technician") redirect(roleHomes.technician);
  if (user.role === "admin") {
    return (
      <div className="mx-auto max-w-2xl">
        <FormAlert tone="info" title="Administrator account">
          Administrator accounts can&apos;t apply as technicians. Use a separate customer account to apply.
        </FormAlert>
      </div>
    );
  }

  const application = await getApplication(user.uid);
  if (application && application.applicationStatus !== "rejected") redirect(technicianRoutes.application);

  if (!user.email) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <PageHeader
          title="Add an email to apply"
          description="We review applications and send decisions by email, so a verified email address is required."
        />
        <Panel>
          <LinkEmailForm returnTo={technicianRoutes.register} />
        </Panel>
      </div>
    );
  }

  const verified = await isEmailVerified(user.uid);
  if (!verified) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <PageHeader title="Become a Handy Ceylon technician" />
        <Panel>
          <div className="flex gap-3">
            <MailWarning className="mt-0.5 size-5 shrink-0 text-urgent" aria-hidden="true" />
            <div className="space-y-3">
              <p className="font-semibold text-foreground">Verify your email first</p>
              <p className="text-sm text-muted-foreground">
                We need a confirmed email address before reviewing a technician application. Check your inbox for
                the link we sent to {user.email}.
              </p>
              <Button asChild size="lg">
                <Link href={`${authRoutes.verifyEmail}?next=${encodedNext}`}>Verify email</Link>
              </Button>
            </div>
          </div>
        </Panel>
      </div>
    );
  }

  const catalogue = await getCatalogue();
  if (catalogue.status === "unavailable" || catalogue.catalogue.categories.length === 0) {
    return (
      <div className="mx-auto max-w-2xl">
        <FormAlert tone="error" title="Applications are temporarily unavailable">
          We couldn&apos;t load the list of services. Please try again in a few minutes.
        </FormAlert>
      </div>
    );
  }
  const categories = catalogue.catalogue.categories.map((c) => ({ id: c.id, name: c.name }));
  const activeIds = new Set(categories.map((c) => c.id));

  const defaultValues: TechnicianApplicationFormValues = {
    fullName: application?.displayName ?? user.displayName,
    phoneNumber: formatLocalMobile(application?.phoneNumber ?? user.phoneNumber),
    professionalIntroduction: application?.professionalIntroduction ?? "",
    yearsOfExperience: application?.yearsOfExperience ?? "",
    // Drop categories that have since been deactivated.
    serviceCategoryIds: (application?.serviceCategoryIds ?? []).filter((id) => activeIds.has(id)),
    skills: application?.skills.join(", ") ?? "",
    qualifications: application?.qualifications ?? "",
    serviceAreas: application?.serviceAreas ?? [],
    district: (application?.district ?? "") as TechnicianApplicationFormValues["district"],
    city: application?.city ?? "",
    qualificationDocumentPaths: application?.qualificationDocumentPaths ?? [],
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <WelcomeBanner
        tone="navy"
        photo="technicianToolBelt"
        eyebrow="Technician application"
        title={application ? "Update your application" : "Tell us about your work"}
        description="Our team reviews every application before technician tools unlock."
      />
      {application?.rejectionReason ? (
        <FormAlert tone="error" title="What to fix before resubmitting">
          {application.rejectionReason}
        </FormAlert>
      ) : null}
      <Panel>
        <TechnicianApplicationForm
          categories={categories}
          uid={user.uid}
          email={user.email}
          photoURL={user.photoURL}
          defaultValues={defaultValues}
          submittedDocumentPaths={application?.qualificationDocumentPaths ?? []}
          isResubmission={Boolean(application)}
        />
      </Panel>
    </div>
  );
}
