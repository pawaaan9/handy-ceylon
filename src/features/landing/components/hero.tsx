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

import { HomeScene } from "@/components/illustrations/home-scene";
import { LinePattern } from "@/components/illustrations/line-pattern";
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
      {/* Flat sand block behind the visual; no gradients. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 hidden w-[38%] bg-sand lg:block" />
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

        <figure className="relative pb-48 sm:pb-44 lg:mb-20 lg:pb-0">
          <div className="relative overflow-hidden rounded-[2rem] bg-navy">
            <LinePattern className="text-white/[0.06]" />
            <HomeScene className="relative mx-auto w-full max-w-md px-6 pt-8" />
          </div>
          <div className="absolute right-4 -bottom-4 left-4 rounded-2xl border bg-card p-4 shadow-[0_18px_40px_-20px_rgb(15_23_42/0.45)] sm:right-auto sm:left-[-1.5rem] sm:w-[16.5rem] lg:-bottom-24 lg:left-[-3.5rem]">
            <div className="flex items-center justify-between gap-3 border-b pb-3">
              <div>
                <p className="text-[0.7rem] font-semibold tracking-wide text-muted-foreground uppercase">Example request</p>
                <p className="font-heading text-sm font-semibold text-foreground">AC not cooling · Get Help Now</p>
              </div>
              <span className="shrink-0 rounded-full bg-urgent-soft px-2.5 py-1 text-xs font-semibold text-urgent">
                Approve quote
              </span>
            </div>
            <ol className="mt-3 space-y-2.5">
              {exampleSteps.slice(1, 5).map((step, index) => (
                <li key={step.label} className="flex items-center gap-3">
                  <span
                    className={cn(
                      "flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                      step.state === "done" && "border-primary bg-primary text-primary-foreground",
                      step.state === "current" && "border-urgent bg-urgent-soft text-urgent",
                      step.state === "upcoming" && "bg-background text-muted-foreground",
                    )}
                  >
                    {step.state === "done" ? <Check className="size-3.5" aria-hidden="true" /> : index + 2}
                  </span>
                  <span className={cn("text-sm", step.state === "upcoming" ? "text-muted-foreground" : "font-medium text-foreground")}>
                    {step.label}
                  </span>
                </li>
              ))}
            </ol>
            <figcaption className="mt-3 flex items-center gap-2 border-t pt-3 text-xs text-muted-foreground">
              <ShieldCheck className="size-4 text-primary" aria-hidden="true" />
              No work starts until you approve the quotation.
            </figcaption>
          </div>
        </figure>
      </Container>
    </section>
  );
}
