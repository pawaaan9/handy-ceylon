import Link from "next/link";

import { routes, siteConfig } from "@/config/site";
import { serviceCategories } from "@/features/services/categories";

import { Container } from "./container";
import { Logo } from "./logo";

const footerColumns = [
  {
    title: "Services",
    links: serviceCategories.slice(0, 5).map((c) => ({ href: "/#services", label: c.name })),
  },
  {
    title: "Customers",
    links: [
      { href: routes.getHelpNow, label: "Get Help Now" },
      { href: routes.getAQuote, label: "Get a Quote" },
      { href: "/#how-it-works", label: "How it works" },
      { href: routes.signIn, label: "Sign in" },
    ],
  },
  {
    title: "Technicians",
    links: [
      { href: routes.becomeATechnician, label: "Become a technician" },
      { href: "/#why-handy-ceylon", label: "Verification standards" },
    ],
  },
] as const;

async function CopyrightYear() {
  "use cache";
  return <>{new Date().getFullYear()}</>;
}

export function SiteFooter() {
  return (
    <footer className="border-t bg-muted/60">
      <Container className="grid gap-10 py-14 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div className="max-w-xs">
          <Logo />
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            {siteConfig.description}
          </p>
        </div>
        {footerColumns.map((column) => (
          <div key={column.title}>
            <h2 className="text-sm font-semibold text-foreground">{column.title}</h2>
            <ul className="mt-4 space-y-3">
              {column.links.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
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
