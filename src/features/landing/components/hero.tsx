import {
  BadgeCheck,
  FileCheck2,
  FileText,
  LifeBuoy,
  Search,
  ShieldCheck,
  Wallet,
  Zap,
} from "lucide-react";
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
  { icon: LifeBuoy, title: "Support when needed", text: "Disputes reviewed fairly" },
] as const;

/**
 * Fills the first screen (viewport minus the 4.5rem header): search-led copy
 * on the left, a photo collage on the right and a trust bar along the bottom.
 */
export function Hero() {
  return (
    <section
      aria-labelledby="hero-title"
      className="relative flex flex-col overflow-hidden border-b lg:min-h-[calc(100svh-4.5rem)]"
    >
      <div aria-hidden="true" className="absolute inset-y-0 right-0 hidden w-[40%] bg-sand lg:block" />

      <Container className="relative grid flex-1 items-center gap-12 py-12 sm:py-16 lg:grid-cols-[1.15fr_1fr] lg:gap-14 lg:py-8">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-2 rounded-full border bg-background py-1 pr-3 pl-1 text-sm font-medium text-muted-foreground">
            <span className="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-semibold text-primary">Sri Lanka</span>
            Home services, booked with confidence
          </p>

          <h1
            id="hero-title"
            className="mt-5 text-[2.4rem] leading-[1.08] font-bold text-foreground sm:text-5xl lg:text-[2.75rem] xl:text-[3.1rem]"
          >
            Reliable Home Services,{" "}
            <span className="text-primary lg:block">Right When You Need Them.</span>
          </h1>
          <p className="mt-4 max-w-xl text-lg leading-relaxed text-muted-foreground">
            Find trusted technicians across Sri Lanka, get quotations, and book home repairs with confidence.
          </p>

          <form
            action={routes.services}
            method="get"
            role="search"
            className="mt-7 flex max-w-xl items-center gap-2 rounded-2xl border bg-card p-2 shadow-[0_12px_32px_-20px_rgb(15_23_42/0.45)] focus-within:border-primary/50"
          >
            <label htmlFor="hero-search" className="sr-only">
              What do you need help with?
            </label>
            <Search className="ml-2 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <input
              id="hero-search"
              name="q"
              type="text"
              enterKeyHint="search"
              autoComplete="off"
              placeholder="What do you need help with? e.g. leaking tap"
              className="h-11 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
            />
            <Button type="submit" size="lg" className="h-11 shrink-0 px-5">
              Search
            </Button>
          </form>

          <Suspense fallback={<div className="mt-4 h-8" aria-hidden="true" />}>
            <PopularServices />
          </Suspense>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button asChild variant="urgent" size="xl" className="h-12 px-6">
              <Link href={routes.getHelpNow}>
                <Zap data-icon="inline-start" aria-hidden="true" />
                Get Help Now
              </Link>
            </Button>
            <Button asChild variant="outline" size="xl" className="h-12 px-6">
              <Link href={routes.getAQuote}>
                <FileText data-icon="inline-start" aria-hidden="true" />
                Get a Quote
              </Link>
            </Button>
          </div>
        </div>

        <figure className="relative mx-auto w-full max-w-xl lg:max-w-none">
          <div className="grid h-[26rem] grid-cols-[1.5fr_1fr] grid-rows-2 gap-3 sm:h-[32rem] sm:gap-4 lg:h-[min(36rem,calc(100svh-16rem))]">
            <div className="relative row-span-2 overflow-hidden rounded-[1.75rem] bg-muted">
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
                priority
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
                priority
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

          <figcaption className="absolute bottom-6 -left-3 flex items-center gap-3 rounded-2xl border bg-card p-3 pr-4 shadow-[0_18px_40px_-22px_rgb(15_23_42/0.5)] sm:-left-6">
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

      <div className="relative border-t bg-background">
        <Container>
          <ul className="grid grid-cols-2 gap-x-6 gap-y-5 py-6 lg:grid-cols-4">
            {assurances.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex items-center gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-primary">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <span className="text-sm leading-tight">
                  <span className="block font-semibold text-foreground">{title}</span>
                  <span className="text-muted-foreground">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </Container>
      </div>
    </section>
  );
}

/** Quick links to the first active categories (Firestore catalogue). */
async function PopularServices() {
  const result = await getCatalogue();
  if (result.status !== "ok" || result.catalogue.categories.length === 0) return null;
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <span className="mr-1 text-sm font-medium text-muted-foreground">Popular:</span>
      {result.catalogue.categories.slice(0, 4).map((c) => (
        <Link
          key={c.id}
          href={`/services/${c.id}`}
          className="rounded-full border bg-background px-3 py-1 text-sm text-foreground transition-colors hover:border-primary/40 hover:text-primary"
        >
          {c.name}
        </Link>
      ))}
    </div>
  );
}
