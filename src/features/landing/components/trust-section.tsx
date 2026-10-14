import {
  ArrowRight,
  BadgeCheck,
  LifeBuoy,
  MessagesSquare,
  Receipt,
  ShieldCheck,
  Star,
} from "lucide-react";
import Link from "next/link";

import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";
import { routes } from "@/config/site";

const pillars = [
  {
    icon: BadgeCheck,
    title: "Verified before the first job",
    description:
      "Technicians submit identity documents and proof of skills. Our team reviews every application before they can accept requests.",
  },
  {
    icon: ShieldCheck,
    title: "You approve every price",
    description:
      "Work only begins after you accept an itemised quotation. Decline it and you only pay the agreed inspection fee, if any.",
  },
  {
    icon: Receipt,
    title: "Transparent LKR pricing",
    description:
      "Inspection fees and quotations are shown in Sri Lankan rupees, with labour and materials listed separately.",
  },
  {
    icon: Star,
    title: "Reviews from real bookings",
    description:
      "Only customers with a completed booking can leave a review, so ratings reflect actual work.",
  },
  {
    icon: MessagesSquare,
    title: "Private in-app messaging",
    description:
      "Discuss details with your technician in the app. Your exact address is shared only after you book.",
  },
  {
    icon: LifeBuoy,
    title: "Support when things go wrong",
    description:
      "If a job is disputed, our team reviews the booking history and helps both sides reach a fair outcome.",
  },
] as const;

export function TrustSection() {
  return (
    <section
      id="why-handy-ceylon"
      aria-labelledby="trust-title"
      className="bg-navy py-20 text-navy-foreground sm:py-24"
    >
      <Container>
        <div className="max-w-2xl">
          <p className="text-sm font-semibold text-[oklch(0.8_0.1_184)]">Why Handy Ceylon</p>
          <h2 id="trust-title" className="mt-2 text-3xl font-bold sm:text-4xl">
            Built on trust, for every home in Sri Lanka
          </h2>
          <p className="mt-4 text-base leading-relaxed text-navy-foreground/75 sm:text-lg">
            Letting someone into your home takes confidence. These safeguards are built into every
            booking.
          </p>
        </div>

        <ul className="mt-12 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {pillars.map(({ icon: Icon, title, description }) => (
            <li key={title} className="border-t border-white/12 pt-6">
              <Icon className="size-6 text-[oklch(0.8_0.1_184)]" aria-hidden="true" />
              <h3 className="mt-4 text-lg font-semibold">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-navy-foreground/70">{description}</p>
            </li>
          ))}
        </ul>

        <div
          id="for-technicians"
          className="mt-16 flex flex-col gap-6 rounded-xl border border-white/12 bg-white/[0.04] p-6 sm:p-8 md:flex-row md:items-center md:justify-between"
        >
          <div className="max-w-xl">
            <h3 className="text-xl font-semibold">Are you a skilled technician?</h3>
            <p className="mt-2 text-sm leading-relaxed text-navy-foreground/70">
              Join Handy Ceylon to receive job requests in your area, send quotations in LKR and
              build your reputation through verified reviews.
            </p>
          </div>
          <Button
            asChild
            variant="outline"
            size="xl"
            className="border-white/20 bg-transparent text-navy-foreground hover:bg-white/10 hover:text-navy-foreground"
          >
            <Link href={routes.becomeATechnician}>
              Become a technician
              <ArrowRight data-icon="inline-end" aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </Container>
    </section>
  );
}
