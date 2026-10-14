import { ArrowRight, Camera, Check, Clock, FileText, HardHat, Ruler, Zap, type LucideIcon } from "lucide-react";
import Link from "next/link";

import { LinePattern } from "@/components/illustrations/line-pattern";
import { Container } from "@/components/layout/container";
import { SectionHeading } from "@/components/layout/section-heading";
import { Button } from "@/components/ui/button";
import { routes } from "@/config/site";

const urgentSteps = [
  "Describe what's wrong and where",
  "A nearby verified technician accepts",
  "Approve the on-site quotation, then work begins",
] as const;

const quoteOptions: readonly { icon: LucideIcon; title: string; description: string; bestFor: string }[] = [
  {
    icon: HardHat,
    title: "Technician Visit",
    description: "Technicians offer an inspection fee. Choose one; they inspect and send a detailed quotation.",
    bestFor: "Jobs that need to be seen in person",
  },
  {
    icon: Camera,
    title: "Quote Online",
    description: "Share photos, videos and measurements. Compare remote quotations and pick the best.",
    bestFor: "Clear jobs like painting or tiling",
  },
];

export function BookingOptions() {
  return (
    <section id="booking-options" aria-labelledby="booking-options-title" className="bg-sand/50 py-20 sm:py-28">
      <Container>
        <SectionHeading
          id="booking-options-title"
          eyebrow="Booking options"
          title="Two ways to book, depending on how urgent it is"
          description="Get someone out fast when something breaks, or take your time and compare quotations for planned work."
        />

        <div className="mt-12 grid gap-6 lg:grid-cols-2">
          <article className="relative flex flex-col overflow-hidden rounded-3xl bg-navy p-7 text-navy-foreground sm:p-9">
            <LinePattern className="text-white/[0.05]" />
            <div className="relative flex items-center justify-between">
              <span className="flex size-12 items-center justify-center rounded-2xl bg-urgent text-urgent-foreground">
                <Zap className="size-6" aria-hidden="true" />
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold">
                <Clock className="size-3.5" aria-hidden="true" />
                For urgent problems
              </span>
            </div>
            <h3 className="relative mt-6 text-2xl font-bold sm:text-3xl">Get Help Now</h3>
            <p className="relative mt-3 max-w-md text-white/75">
              Burst pipe, power cut or AC breakdown? Available technicians nearby can accept your visit.
            </p>
            <ol className="relative mt-7 space-y-3">
              {urgentSteps.map((step, i) => (
                <li key={step} className="flex items-center gap-3 text-sm">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-white/20 text-xs font-semibold">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
            <div className="relative mt-9 pt-2 lg:mt-auto">
              <Button asChild variant="urgent" size="xl" className="h-12 w-full px-6 sm:w-auto">
                <Link href={routes.getHelpNow}>
                  Get Help Now
                  <ArrowRight data-icon="inline-end" aria-hidden="true" />
                </Link>
              </Button>
            </div>
          </article>

          <article className="flex flex-col rounded-3xl border bg-card p-7 sm:p-9">
            <div className="flex items-center justify-between">
              <span className="flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                <FileText className="size-6" aria-hidden="true" />
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-primary">
                <Ruler className="size-3.5" aria-hidden="true" />
                For planned work
              </span>
            </div>
            <h3 className="mt-6 text-2xl font-bold text-foreground sm:text-3xl">Get a Quote</h3>
            <p className="mt-3 max-w-md text-muted-foreground">
              Compare technicians and prices before you commit. Choose the option that suits your job.
            </p>
            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              {quoteOptions.map(({ icon: Icon, title, description, bestFor }) => (
                <div key={title} className="rounded-2xl border bg-background p-5">
                  <Icon className="size-5 text-primary" aria-hidden="true" />
                  <h4 className="mt-3 font-semibold text-foreground">{title}</h4>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{description}</p>
                  <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-foreground">
                    <Check className="size-3.5 text-primary" aria-hidden="true" />
                    {bestFor}
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-9 pt-2 lg:mt-auto">
              <Button asChild size="xl" className="h-12 w-full px-6 sm:w-auto">
                <Link href={routes.getAQuote}>
                  Get a Quote
                  <ArrowRight data-icon="inline-end" aria-hidden="true" />
                </Link>
              </Button>
            </div>
          </article>
        </div>
      </Container>
    </section>
  );
}
