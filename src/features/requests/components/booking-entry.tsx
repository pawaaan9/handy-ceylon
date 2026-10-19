import { ArrowRight, type LucideIcon } from "lucide-react";
import Link from "next/link";

import type { PhotoKey } from "@/assets/photos";
import { Container } from "@/components/layout/container";
import { PageHero } from "@/components/layout/page-hero";
import { Button } from "@/components/ui/button";
import { routes } from "@/config/site";
import type { BookingMode } from "@/features/bookings/types";
import { cn } from "@/lib/utils";

export type BookingEntryOption = {
  mode: BookingMode;
  icon: LucideIcon;
  title: string;
  description: string;
  bestFor: string;
  cta: string;
};

/**
 * Public landing for a booking option. Starting a request goes to the
 * customer form, which sends signed-out visitors to log in first.
 */
export function BookingEntry({
  eyebrow,
  title,
  description,
  photo,
  options,
  steps,
}: {
  eyebrow: string;
  title: string;
  description: string;
  photo: PhotoKey;
  options: BookingEntryOption[];
  steps: readonly string[];
}) {
  const single = options.length === 1 ? options[0] : null;
  return (
    <>
      <PageHero eyebrow={eyebrow} title={title} description={description} photo={photo}>
        {single ? (
          <Button asChild variant={single.mode === "urgent" ? "urgent" : "default"} size="xl" className="h-12 px-6">
            <Link href={`${routes.newRequest}?mode=${single.mode}`}>
              {single.cta}
              <ArrowRight data-icon="inline-end" aria-hidden="true" />
            </Link>
          </Button>
        ) : null}
      </PageHero>
      <Container className="space-y-14 py-14 sm:py-16">
        {single ? null : (
          <div className="grid gap-5 md:grid-cols-2">
            {options.map(({ mode, icon: Icon, title: optionTitle, description: text, bestFor, cta }) => (
              <article key={mode} className="flex flex-col rounded-2xl border bg-card p-6 sm:p-7">
                <span className="flex size-11 items-center justify-center rounded-xl bg-brand-soft text-primary">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <h2 className="mt-5 text-xl font-semibold text-foreground">{optionTitle}</h2>
                <p className="mt-2 text-muted-foreground">{text}</p>
                <p className="mt-3 text-sm font-medium text-foreground">Best for: {bestFor}</p>
                <div className="mt-6 pt-1 md:mt-auto">
                  <Button asChild size="xl" className="w-full sm:w-auto">
                    <Link href={`${routes.newRequest}?mode=${mode}`}>
                      {cta}
                      <ArrowRight data-icon="inline-end" aria-hidden="true" />
                    </Link>
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )}

        <section aria-labelledby="booking-steps">
          <h2 id="booking-steps" className="text-xl font-semibold text-foreground">
            What happens next
          </h2>
          <ol className={cn("mt-5 grid gap-4", steps.length > 3 ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-3")}>
            {steps.map((step, i) => (
              <li key={step} className="rounded-2xl border bg-card p-5">
                <span className="flex size-8 items-center justify-center rounded-full bg-navy text-sm font-semibold text-navy-foreground">
                  {i + 1}
                </span>
                <p className="mt-3 text-sm text-foreground">{step}</p>
              </li>
            ))}
          </ol>
          <p className="mt-5 text-sm text-muted-foreground">
            Your exact address is shared only with the technician you choose, and you approve every price in LKR
            before work starts.
          </p>
        </section>
      </Container>
    </>
  );
}
