import {
  ArrowRight,
  BadgeCheck,
  LifeBuoy,
  MessagesSquare,
  Receipt,
  ShieldCheck,
  Star,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { LinePattern } from "@/components/illustrations/line-pattern";
import { photos } from "@/assets/photos";
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
      className="relative overflow-hidden bg-navy py-20 text-navy-foreground sm:py-28"
    >
      <LinePattern className="text-white/[0.04]" />
      <Container className="relative">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.6fr] lg:gap-16">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold tracking-wide uppercase">
              <span className="size-1.5 rounded-full bg-urgent" aria-hidden="true" />
              Why Handy Ceylon
            </p>
            <h2 id="trust-title" className="mt-5 text-3xl font-bold sm:text-[2.6rem] sm:leading-tight">
              Built on trust, for every home in Sri Lanka
            </h2>
            <p className="mt-4 text-base leading-relaxed text-white/70 sm:text-lg">
              Letting someone into your home takes confidence. These safeguards are built into every booking.
            </p>
            <div className="relative mt-8 hidden aspect-[4/3] overflow-hidden rounded-3xl lg:block">
              <Image
                src={photos.technicianPortrait.src}
                alt={photos.technicianPortrait.alt}
                fill
                placeholder="blur"
                sizes="30vw"
                className="object-cover object-[60%_30%]"
              />
            </div>
          </div>

          <ul className="grid gap-4 sm:grid-cols-2">
            {pillars.map(({ icon: Icon, title, description }) => (
              <li key={title} className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
                <span className="flex size-11 items-center justify-center rounded-xl bg-white/10 text-white">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <h3 className="mt-5 text-lg font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/65">{description}</p>
              </li>
            ))}
          </ul>
        </div>

        <div
          id="for-technicians"
          className="mt-16 flex flex-col gap-6 rounded-3xl bg-white p-7 text-navy sm:p-9 md:flex-row md:items-center md:justify-between"
        >
          <div className="flex items-center gap-5">
            <div className="relative hidden size-24 shrink-0 overflow-hidden rounded-2xl sm:block">
              <Image
                src={photos.technicianToolBelt.src}
                alt=""
                fill
                placeholder="blur"
                sizes="96px"
                className="object-cover"
              />
            </div>
            <div className="max-w-xl">
              <h3 className="text-xl font-bold">Are you a skilled technician?</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                Receive job requests in your area, send quotations in LKR and build your reputation through verified
                reviews.
              </p>
            </div>
          </div>
          <Button asChild size="xl" className="h-12 shrink-0 px-6">
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
