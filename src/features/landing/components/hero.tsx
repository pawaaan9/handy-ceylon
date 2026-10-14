import {
  BadgeCheck,
  Check,
  FileText,
  MapPin,
  ShieldCheck,
  Wallet,
  Zap,
} from "lucide-react";
import Link from "next/link";

import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";
import { routes } from "@/config/site";
import { cn } from "@/lib/utils";

const assurances = [
  { icon: BadgeCheck, label: "Verified technicians" },
  { icon: ShieldCheck, label: "Approve quotes before work" },
  { icon: Wallet, label: "Clear pricing in LKR" },
] as const;

const exampleSteps = [
  { label: "Request sent", detail: "AC not cooling · Get Help Now", state: "done" },
  { label: "Technician accepted", detail: "Nearby, verified technician on the way", state: "done" },
  { label: "On-site inspection", detail: "Problem diagnosed at your home", state: "done" },
  { label: "Quotation ready", detail: "Review the itemised price in LKR", state: "current" },
  { label: "Work begins", detail: "Only after you approve", state: "upcoming" },
] as const;

export function Hero() {
  return (
    <section aria-labelledby="hero-title" className="relative overflow-hidden border-b">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(var(--border)_1px,transparent_1px)] [background-size:22px_22px] [mask-image:linear-gradient(to_bottom,black,transparent_75%)] opacity-60"
      />
      <Container className="relative grid items-center gap-12 py-16 sm:py-20 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16 lg:py-24">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1 text-sm font-medium text-muted-foreground">
            <MapPin className="size-4 text-primary" aria-hidden="true" />
            Home services across Sri Lanka
          </p>
          <h1
            id="hero-title"
            className="mt-6 text-4xl leading-[1.08] font-extrabold text-foreground sm:text-5xl lg:text-[3.5rem]"
          >
            Reliable Home Services, <span className="text-primary">Right When You Need Them.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
            Find trusted technicians across Sri Lanka, get quotations, and book home repairs
            with confidence.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild variant="urgent" size="xl">
              <Link href={routes.getHelpNow}>
                <Zap data-icon="inline-start" aria-hidden="true" />
                Get Help Now
              </Link>
            </Button>
            <Button asChild size="xl">
              <Link href={routes.getAQuote}>
                <FileText data-icon="inline-start" aria-hidden="true" />
                Get a Quote
              </Link>
            </Button>
          </div>

          <ul className="mt-10 grid gap-3 text-sm text-foreground sm:grid-cols-3 sm:gap-4">
            {assurances.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-2">
                <Icon className="size-4.5 shrink-0 text-primary" aria-hidden="true" />
                <span className="font-medium">{label}</span>
              </li>
            ))}
          </ul>
        </div>

        <figure className="relative">
          <div className="rounded-2xl border bg-card p-5 shadow-[0_1px_2px_rgb(0_0_0/0.04),0_12px_32px_-12px_rgb(15_23_42/0.18)] sm:p-6">
            <div className="flex items-center justify-between gap-3 border-b pb-4">
              <div>
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Example request
                </p>
                <p className="mt-1 font-heading font-semibold text-foreground">
                  How a repair moves forward
                </p>
              </div>
              <span className="rounded-full bg-urgent-soft px-2.5 py-1 text-xs font-semibold text-urgent">
                Awaiting your approval
              </span>
            </div>
            <ol className="mt-5 space-y-0">
              {exampleSteps.map((step, index) => (
                <li key={step.label} className="relative flex gap-4 pb-5 last:pb-0">
                  {index < exampleSteps.length - 1 ? (
                    <span
                      aria-hidden="true"
                      className={cn(
                        "absolute top-7 left-[0.8125rem] h-[calc(100%-1.75rem)] w-px",
                        step.state === "done" ? "bg-primary/40" : "bg-border",
                      )}
                    />
                  ) : null}
                  <span
                    className={cn(
                      "relative flex size-6.5 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                      step.state === "done" && "border-primary bg-primary text-primary-foreground",
                      step.state === "current" && "border-urgent bg-urgent-soft text-urgent",
                      step.state === "upcoming" && "bg-background text-muted-foreground",
                    )}
                  >
                    {step.state === "done" ? (
                      <Check className="size-3.5" aria-hidden="true" />
                    ) : (
                      index + 1
                    )}
                  </span>
                  <div className="min-w-0 pt-0.5">
                    <p
                      className={cn(
                        "text-sm font-semibold",
                        step.state === "upcoming" ? "text-muted-foreground" : "text-foreground",
                      )}
                    >
                      {step.label}
                    </p>
                    <p className="mt-0.5 text-sm text-muted-foreground">{step.detail}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
          <figcaption className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <ShieldCheck className="size-4 text-primary" aria-hidden="true" />
            No repair work starts until you approve the quotation.
          </figcaption>
        </figure>
      </Container>
    </section>
  );
}
