import { ArrowRight, BadgeCheck, FileCheck2, FileText, ShieldCheck, Wallet, Zap } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";

import { photos } from "@/assets/photos";
import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";
import { routes } from "@/config/site";
import { getCatalogue } from "@/features/catalogue/server/queries";

const assurances = [
  { icon: BadgeCheck, title: "Verified technicians", text: "ID and skills reviewed" },
  { icon: ShieldCheck, title: "You approve the price", text: "No work before approval" },
  { icon: Wallet, title: "Clear LKR pricing", text: "Itemised quotations" },
] as const;

export function Hero() {
  return (
    <section aria-labelledby="hero-title" className="relative overflow-hidden border-b">
      <div aria-hidden="true" className="absolute inset-y-0 right-0 hidden w-[42%] bg-sand lg:block" />
      <Container className="relative grid items-center gap-14 pt-14 pb-20 sm:pt-20 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:pt-24 lg:pb-28">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border bg-background py-1 pr-3 pl-1 text-sm font-medium text-muted-foreground">
            <span className="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-semibold text-primary">Sri Lanka</span>
            Home services, booked with confidence
          </p>
          <h1
            id="hero-title"
            className="mt-6 text-[2.6rem] leading-[1.05] font-bold text-foreground sm:text-6xl lg:text-[4rem]"
          >
            Reliable Home Services, <span className="text-primary">Right When You Need Them.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
            Find trusted technicians across Sri Lanka, get quotations, and book home repairs with confidence.
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Button asChild variant="urgent" size="xl" className="h-12 px-6">
              <Link href={routes.getHelpNow}>
                <Zap data-icon="inline-start" aria-hidden="true" />
                Get Help Now
              </Link>
            </Button>
            <Button asChild size="xl" className="h-12 px-6">
              <Link href={routes.getAQuote}>
                <FileText data-icon="inline-start" aria-hidden="true" />
                Get a Quote
              </Link>
            </Button>
          </div>

          <ul className="mt-12 grid gap-5 border-t pt-8 sm:grid-cols-3">
            {assurances.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-primary">
                  <Icon className="size-[1.1rem]" aria-hidden="true" />
                </span>
                <span className="text-sm leading-tight">
                  <span className="block font-semibold text-foreground">{title}</span>
                  <span className="text-muted-foreground">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <figure className="relative mx-auto w-full max-w-xl lg:max-w-none">
          <div className="grid grid-cols-[1.5fr_1fr] grid-rows-2 gap-3 sm:gap-4">
            <div className="relative row-span-2 aspect-[4/5] overflow-hidden rounded-[1.75rem] bg-muted">
              <Image
                src={photos.electricianAtWork.src}
                alt={photos.electricianAtWork.alt}
                fill
                priority
                placeholder="blur"
                sizes="(min-width: 1024px) 30vw, 60vw"
                className="object-cover object-[45%_50%]"
              />
            </div>
            <div className="relative overflow-hidden rounded-[1.5rem] bg-muted">
              <Image
                src={photos.plumberUnderSink.src}
                alt={photos.plumberUnderSink.alt}
                fill
                placeholder="blur"
                sizes="(min-width: 1024px) 20vw, 40vw"
                className="object-cover"
              />
            </div>
            <div className="relative overflow-hidden rounded-[1.5rem] bg-muted">
              <Image
                src={photos.cleanerUpholstery.src}
                alt={photos.cleanerUpholstery.alt}
                fill
                placeholder="blur"
                sizes="(min-width: 1024px) 20vw, 40vw"
                className="object-cover object-[30%_50%]"
              />
            </div>
          </div>

          <div className="absolute top-6 -left-3 flex items-center gap-3 rounded-2xl border bg-card p-3 pr-4 shadow-[0_18px_40px_-22px_rgb(15_23_42/0.5)] sm:-left-6">
            <span className="flex size-9 items-center justify-center rounded-xl bg-urgent-soft text-urgent">
              <Zap className="size-[1.1rem]" aria-hidden="true" />
            </span>
            <span className="text-sm leading-tight">
              <span className="block font-semibold text-foreground">Technician accepted</span>
              <span className="text-xs text-muted-foreground">On the way to your home</span>
            </span>
          </div>

          <figcaption className="absolute -bottom-6 left-4 flex items-center gap-3 rounded-2xl border bg-card p-3 pr-4 shadow-[0_18px_40px_-22px_rgb(15_23_42/0.5)] sm:left-8">
            <span className="flex size-9 items-center justify-center rounded-xl bg-brand-soft text-primary">
              <FileCheck2 className="size-[1.1rem]" aria-hidden="true" />
            </span>
            <span className="text-sm leading-tight">
              <span className="block font-semibold text-foreground">Quotation ready</span>
              <span className="text-xs text-muted-foreground">Approve before any work starts</span>
            </span>
          </figcaption>
        </figure>
      </Container>

      <Suspense fallback={null}>
        <PopularServices />
      </Suspense>
    </section>
  );
}

/** Quick links to the first few active categories (Firestore catalogue). */
async function PopularServices() {
  const result = await getCatalogue();
  if (result.status !== "ok" || result.catalogue.categories.length === 0) return null;
  return (
    <div className="relative border-t bg-background/80">
      <Container className="flex flex-wrap items-center gap-x-3 gap-y-2 py-4">
        <span className="mr-1 text-sm font-semibold text-foreground">Popular:</span>
        {result.catalogue.categories.slice(0, 6).map((c) => (
          <Link
            key={c.id}
            href={`/services/${c.id}`}
            className="rounded-full border bg-background px-3 py-1 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
          >
            {c.name}
          </Link>
        ))}
        <Link
          href={routes.services}
          className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
        >
          All services <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </Container>
    </div>
  );
}
