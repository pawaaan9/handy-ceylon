import { FileText, Zap } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { photos } from "@/assets/photos";
import { LinePattern } from "@/components/illustrations/line-pattern";
import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";
import { routes } from "@/config/site";

export function FinalCta() {
  return (
    <section aria-labelledby="final-cta-title" className="py-20 sm:py-28">
      <Container>
        <div className="relative grid items-center gap-8 overflow-hidden rounded-[2rem] bg-primary px-7 py-12 text-primary-foreground sm:px-12 lg:grid-cols-[1.2fr_1fr]">
          <LinePattern className="text-white/[0.07]" />
          <div className="relative">
            <h2 id="final-cta-title" className="text-3xl font-bold sm:text-4xl">
              Something needs fixing at home?
            </h2>
            <p className="mt-3 max-w-lg text-white/80">
              Tell us what&apos;s wrong and get help from verified technicians near you — with the price agreed before
              work starts.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild variant="urgent" size="xl" className="h-12 px-6">
                <Link href={routes.getHelpNow}>
                  <Zap data-icon="inline-start" aria-hidden="true" />
                  Get Help Now
                </Link>
              </Button>
              <Button asChild size="xl" className="h-12 bg-white px-6 text-primary hover:bg-white/90">
                <Link href={routes.getAQuote}>
                  <FileText data-icon="inline-start" aria-hidden="true" />
                  Get a Quote
                </Link>
              </Button>
            </div>
          </div>
          <div className="relative hidden h-full min-h-72 overflow-hidden rounded-3xl lg:block">
            <Image
              src={photos.plumberBathroom.src}
              alt={photos.plumberBathroom.alt}
              fill
              placeholder="blur"
              sizes="40vw"
              className="object-cover"
            />
          </div>
        </div>
      </Container>
    </section>
  );
}
