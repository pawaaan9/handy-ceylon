import { ArrowRight, FileText, ShieldCheck, Zap } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { Button } from "@/components/ui/button";
import { routes } from "@/config/site";
import { CategoryMedia } from "@/features/catalogue/components/category-media";
import { getCatalogue } from "@/features/catalogue/server/queries";

import { HeaderAccount, HeaderAccountSkeleton } from "./header-account";
import { HeaderFrame } from "./header-frame";
import { ServicesMenu, type HeaderLink } from "./services-menu";

const links: readonly HeaderLink[] = [
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#booking-options", label: "Booking options" },
  { href: routes.becomeATechnician, label: "For technicians" },
];

async function ServicesNav() {
  const result = await getCatalogue();
  return (
    <ServicesMenu
      categories={result.status === "ok" ? result.catalogue.categories : []}
      links={links}
    />
  );
}

const mobileLinks = [
  {
    href: routes.services,
    label: "All services",
    hint: "Plumbing, electrical, AC and more",
  },
  {
    href: "/#how-it-works",
    label: "How it works",
    hint: "From request to repair in four steps",
  },
  {
    href: "/#booking-options",
    label: "Booking options",
    hint: "Get Help Now or Get a Quote",
  },
  {
    href: routes.becomeATechnician,
    label: "For technicians",
    hint: "Apply to receive job requests",
  },
] as const;

/** Category tiles for the mobile menu; renders nothing when the catalogue is empty. */
async function MobileServices() {
  const result = await getCatalogue();
  const categories =
    result.status === "ok" ? result.catalogue.categories.slice(0, 6) : [];
  if (categories.length === 0) return null;
  return (
    <section>
      <h2 className="mb-3 text-xs font-semibold tracking-wider text-white/50 uppercase">
        Popular services
      </h2>
      <ul className="grid grid-cols-3 gap-2">
        {categories.map((category, index) => (
          <li key={category.id}>
            <Link
              href={`/services/${category.id}`}
              className="flex h-full flex-col items-center gap-2 rounded-2xl bg-white/[0.06] px-2 py-3 text-center text-xs font-medium text-white/85 transition-colors hover:bg-white/10"
            >
              <CategoryMedia
                category={category}
                index={index}
                className="size-9 rounded-xl"
              />
              <span className="leading-tight">{category.name}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function MobileMenu() {
  return (
    <div className="flex flex-1 flex-col gap-7 px-5 pt-2 pb-6">
      <nav aria-label="Mobile">
        <ul className="divide-y divide-white/10">
          {mobileLinks.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="group flex items-center justify-between gap-4 py-4"
              >
                <span>
                  <span className="block text-xl font-semibold text-white">
                    {link.label}
                  </span>
                  <span className="text-sm text-white/55">{link.hint}</span>
                </span>
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-white/70 transition-colors group-hover:bg-urgent group-hover:text-white">
                  <ArrowRight className="size-4" aria-hidden="true" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <Suspense fallback={null}>
        <MobileServices />
      </Suspense>

      <div className="mt-auto space-y-3 rounded-3xl bg-white/[0.06] p-4">
        <Suspense fallback={<HeaderAccountSkeleton variant="mobile" />}>
          <HeaderAccount variant="mobile" />
        </Suspense>
        <div className="grid grid-cols-2 gap-2">
          <Button
            asChild
            variant="urgent"
            size="xl"
            className="h-12 rounded-full"
          >
            <Link href={routes.getHelpNow}>
              <Zap data-icon="inline-start" aria-hidden="true" />
              Get Help
            </Link>
          </Button>
          <Button asChild size="xl" className="h-12 rounded-full">
            <Link href={routes.getAQuote}>
              <FileText data-icon="inline-start" aria-hidden="true" />
              Get a Quote
            </Link>
          </Button>
        </div>
        <p className="flex items-center justify-center gap-1.5 pt-1 text-xs text-white/50">
          <ShieldCheck className="size-3.5" aria-hidden="true" />
          Prices agreed in LKR before work starts
        </p>
      </div>
    </div>
  );
}

/** Public site header: floating navy capsule with services menu and account-aware actions. */
export function SiteHeader() {
  return (
    <>
      <HeaderFrame
        nav={
          <Suspense fallback={<ServicesMenu categories={[]} links={links} />}>
            <ServicesNav />
          </Suspense>
        }
        actions={
          <>
            <Suspense fallback={<HeaderAccountSkeleton />}>
              <HeaderAccount />
            </Suspense>
            <Button
              asChild
              variant="urgent"
              size="lg"
              className="h-10 rounded-full px-4"
            >
              <Link href={routes.getHelpNow}>
                <Zap data-icon="inline-start" aria-hidden="true" />
                Get Help Now
              </Link>
            </Button>
          </>
        }
        mobileActions={
          <Button
            asChild
            variant="urgent"
            size="icon-lg"
            className="rounded-xl"
            aria-label="Get Help Now"
          >
            <Link href={routes.getHelpNow}>
              <Zap aria-hidden="true" />
            </Link>
          </Button>
        }
        mobileMenu={<MobileMenu />}
      />
    </>
  );
}
