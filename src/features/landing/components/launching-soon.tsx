import { Bell, ListChecks, Wrench, type LucideIcon } from "lucide-react";
import Link from "next/link";

import type { PhotoKey } from "@/assets/photos";
import { Container } from "@/components/layout/container";
import { PageHero } from "@/components/layout/page-hero";
import { Button } from "@/components/ui/button";
import { routes } from "@/config/site";

/**
 * Honest placeholder for flows that are not built yet. It must never imitate
 * a working form or pretend a request was submitted.
 */
export function LaunchingSoon({
  icon: Icon,
  eyebrow,
  title,
  description,
  photo,
}: {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  description: string;
  photo: PhotoKey;
}) {
  return (
    <>
      <PageHero eyebrow={eyebrow} title={title} description={description} photo={photo}>
        <span className="inline-flex items-center gap-2 rounded-full bg-urgent px-3.5 py-1.5 text-sm font-semibold text-urgent-foreground">
          <Icon className="size-4" aria-hidden="true" />
          Launching soon
        </span>
      </PageHero>
      <Container className="grid gap-4 py-14 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-2xl border bg-card p-6">
          <Bell className="size-5 text-primary" aria-hidden="true" />
          <h2 className="mt-4 font-semibold text-foreground">Create your account now</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Save your addresses today so booking takes seconds when we open.
          </p>
          <Button asChild size="lg" className="mt-5">
            <Link href={routes.signUp}>Sign up</Link>
          </Button>
        </div>
        <div className="rounded-2xl border bg-card p-6">
          <Wrench className="size-5 text-primary" aria-hidden="true" />
          <h2 className="mt-4 font-semibold text-foreground">Browse services</h2>
          <p className="mt-1 text-sm text-muted-foreground">See which jobs our technicians cover across Sri Lanka.</p>
          <Button asChild variant="outline" size="lg" className="mt-5">
            <Link href={routes.services}>View services</Link>
          </Button>
        </div>
        <div className="rounded-2xl border bg-card p-6 sm:col-span-2 lg:col-span-1">
          <ListChecks className="size-5 text-primary" aria-hidden="true" />
          <h2 className="mt-4 font-semibold text-foreground">Learn how it works</h2>
          <p className="mt-1 text-sm text-muted-foreground">Quotations are approved by you before any work begins.</p>
          <Button asChild variant="outline" size="lg" className="mt-5">
            <Link href="/#how-it-works">How it works</Link>
          </Button>
        </div>
      </Container>
    </>
  );
}
