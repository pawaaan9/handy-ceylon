import { CloudOff, Layers } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";

import { StatusMessage } from "@/components/feedback/status-message";
import { Container } from "@/components/layout/container";
import { PageHero } from "@/components/layout/page-hero";
import { CatalogueBrowser } from "@/features/catalogue/components/catalogue-browser";
import { getCatalogue } from "@/features/catalogue/server/queries";

export const metadata: Metadata = {
  title: "Services",
  description: "Browse home services available on Handy Ceylon across Sri Lanka.",
};

export default function ServicesPage() {
  return (
    <>
      <PageHero
        eyebrow="Services"
        title="Find the right professional"
        description="Search by problem or browse categories to see what verified technicians can help with."
        photo="plumberUnderSink"
      />
      <Container className="py-12 sm:py-16">
        <Suspense fallback={<BrowserSkeleton />}>
          <CatalogueSection />
        </Suspense>
      </Container>
    </>
  );
}

async function CatalogueSection() {
  const result = await getCatalogue();
  if (result.status === "unavailable") {
    return (
      <StatusMessage
        icon={CloudOff}
        tone="error"
        title="Services are temporarily unavailable"
        description="We couldn't load the service catalogue. Please refresh in a moment."
      />
    );
  }
  if (result.catalogue.categories.length === 0) {
    return (
      <StatusMessage
        icon={Layers}
        title="No services listed yet"
        description="Our service catalogue is being prepared. Please check back soon."
      />
    );
  }
  // The browser reads ?q= and ?category= on the client, inside this boundary.
  return <CatalogueBrowser catalogue={result.catalogue} />;
}

function BrowserSkeleton() {
  return (
    <div role="status" aria-label="Loading services" className="space-y-4">
      <div className="h-11 max-w-xl animate-pulse rounded-lg bg-muted" />
      <div className="flex gap-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-8 w-24 animate-pulse rounded-full bg-muted" />
        ))}
      </div>
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-32 animate-pulse rounded-xl bg-muted" />
      ))}
    </div>
  );
}
