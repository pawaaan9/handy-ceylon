import Link from "next/link";
import { Suspense } from "react";

import { routes, siteConfig } from "@/config/site";
import { getCatalogue } from "@/features/catalogue/server/queries";

import { Container } from "./container";
import { Logo } from "./logo";

type FooterColumn = { title: string; links: { href: string; label: string }[] };

const staticColumns: FooterColumn[] = [
  {
    title: "Customers",
    links: [
      { href: routes.getHelpNow, label: "Get Help Now" },
      { href: routes.getAQuote, label: "Get a Quote" },
      { href: "/#how-it-works", label: "How it works" },
      { href: routes.login, label: "Log in" },
      { href: routes.signUp, label: "Create an account" },
    ],
  },
  {
    title: "Technicians",
    links: [
      { href: routes.becomeATechnician, label: "Become a technician" },
      { href: "/#why-handy-ceylon", label: "Verification standards" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: routes.terms, label: "Terms of Service" },
      { href: routes.privacy, label: "Privacy Policy" },
    ],
  },
];

async function ServicesColumn() {
  const catalogue = await getCatalogue();
  const categories = catalogue.status === "ok" ? catalogue.catalogue.categories.slice(0, 5) : [];
  return (
    <FooterColumnView
      column={{
        title: "Services",
        links: [
          ...categories.map((c) => ({ href: `/services/${c.id}`, label: c.name })),
          { href: routes.services, label: "All services" },
        ],
      }}
    />
  );
}

function FooterColumnView({ column }: { column: FooterColumn }) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-foreground">{column.title}</h2>
      <ul className="mt-4 space-y-3">
        {column.links.map((link) => (
          <li key={link.label}>
            <Link href={link.href} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

async function CopyrightYear() {
  "use cache";
  return <>{new Date().getFullYear()}</>;
}

export function SiteFooter() {
  return (
    <footer className="border-t bg-muted/60">
      <Container className="grid gap-10 py-14 sm:grid-cols-2 md:grid-cols-[1.4fr_repeat(4,1fr)]">
        <div className="max-w-xs">
          <Logo />
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            {siteConfig.description}
          </p>
        </div>
        <Suspense fallback={<FooterColumnView column={{ title: "Services", links: [{ href: routes.services, label: "All services" }] }} />}>
          <ServicesColumn />
        </Suspense>
        {staticColumns.map((column) => (
          <FooterColumnView key={column.title} column={column} />
        ))}
      </Container>
      <div className="border-t">
        <Container className="flex flex-col gap-2 py-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>
            © <CopyrightYear /> {siteConfig.name}. All rights reserved.
          </p>
          <p>Serving homes across {siteConfig.country} · Prices in LKR</p>
        </Container>
      </div>
    </footer>
  );
}
