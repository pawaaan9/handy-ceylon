import {
  ArrowRight,
  Camera,
  Check,
  Clock,
  FileText,
  HardHat,
  Ruler,
  Zap,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";

import { Container } from "@/components/layout/container";
import { SectionHeading } from "@/components/layout/section-heading";
import { Button } from "@/components/ui/button";
import { routes } from "@/config/site";

type QuoteOption = {
  icon: LucideIcon;
  title: string;
  description: string;
  bestFor: string;
};

const quoteOptions: readonly QuoteOption[] = [
  {
    icon: HardHat,
    title: "Technician Visit",
    description:
      "Technicians offer an inspection fee. Choose one, they inspect the job at your home and send a detailed quotation.",
    bestFor: "Best for jobs that need to be seen in person",
  },
  {
    icon: Camera,
    title: "Quote Online",
    description:
      "Share photos, videos and measurements. Technicians quote remotely so you can compare prices and choose.",
    bestFor: "Best for clearly defined jobs like painting or tiling",
  },
];

const urgentPoints = [
  "Burst pipes, power failures, AC breakdowns",
  "See who accepted before they arrive",
  "Approve or decline the on-site quotation",
] as const;

export function BookingOptions() {
  return (
    <section
      id="booking-options"
      aria-labelledby="booking-options-title"
      className="border-y bg-muted/50 py-20 sm:py-24"
    >
      <Container>
        <SectionHeading
          id="booking-options-title"
          eyebrow="Booking options"
          title="Two ways to book, depending on how urgent it is"
          description="Get someone out fast when something breaks, or take your time and compare quotations for planned work."
        />

        <div className="mt-12 grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
          <article className="flex flex-col rounded-xl border border-urgent/25 bg-card p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-lg bg-urgent-soft text-urgent">
                <Zap className="size-5" aria-hidden="true" />
              </span>
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-urgent">
                <Clock className="size-4" aria-hidden="true" />
                For urgent problems
              </span>
            </div>
            <h3 className="mt-5 text-2xl font-bold text-foreground">Get Help Now</h3>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              Describe the problem and available technicians nearby can accept your visit. After
              inspecting, the technician sends a quotation and repair work starts only once you
              approve it.
            </p>
            <ul className="mt-6 space-y-2.5 text-sm text-foreground">
              {urgentPoints.map((point) => (
                <li key={point} className="flex gap-2.5">
                  <Check className="mt-0.5 size-4 shrink-0 text-urgent" aria-hidden="true" />
                  {point}
                </li>
              ))}
            </ul>
            <div className="mt-8 pt-2 lg:mt-auto">
              <Button asChild variant="urgent" size="xl" className="w-full sm:w-auto">
                <Link href={routes.getHelpNow}>
                  Get Help Now
                  <ArrowRight data-icon="inline-end" aria-hidden="true" />
                </Link>
              </Button>
            </div>
          </article>

          <article className="flex flex-col rounded-xl border bg-card p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-lg bg-brand-soft text-primary">
                <FileText className="size-5" aria-hidden="true" />
              </span>
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-primary">
                <Ruler className="size-4" aria-hidden="true" />
                For planned work
              </span>
            </div>
            <h3 className="mt-5 text-2xl font-bold text-foreground">Get a Quote</h3>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              Compare technicians and prices before you commit. Choose the option that suits your
              job.
            </p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {quoteOptions.map(({ icon: Icon, title, description, bestFor }) => (
                <div key={title} className="rounded-lg border bg-background p-5">
                  <div className="flex items-center gap-2.5">
                    <Icon className="size-5 text-primary" aria-hidden="true" />
                    <h4 className="font-semibold text-foreground">{title}</h4>
                  </div>
                  <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
                    {description}
                  </p>
                  <p className="mt-3 text-xs font-medium text-foreground">{bestFor}</p>
                </div>
              ))}
            </div>
            <div className="mt-8 pt-2 lg:mt-auto">
              <Button asChild size="xl" className="w-full sm:w-auto">
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
