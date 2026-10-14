import { FileText, Zap } from "lucide-react";
import Link from "next/link";

import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";
import { routes } from "@/config/site";

export function FinalCta() {
  return (
    <section aria-labelledby="final-cta-title" className="py-20 sm:py-24">
      <Container>
        <div className="flex flex-col items-start gap-8 rounded-2xl border bg-brand-soft px-6 py-10 sm:px-10 md:flex-row md:items-center md:justify-between">
          <div className="max-w-xl">
            <h2 id="final-cta-title" className="text-2xl font-bold text-foreground sm:text-3xl">
              Something needs fixing at home?
            </h2>
            <p className="mt-3 text-muted-foreground">
              Tell us what&apos;s wrong and get help from verified technicians near you.
            </p>
          </div>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
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
        </div>
      </Container>
    </section>
  );
}
