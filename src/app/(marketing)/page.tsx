import { BookingOptions } from "@/features/landing/components/booking-options";
import { FinalCta } from "@/features/landing/components/final-cta";
import { Hero } from "@/features/landing/components/hero";
import { HowItWorks } from "@/features/landing/components/how-it-works";
import { ServiceCategories } from "@/features/landing/components/service-categories";
import { TrustSection } from "@/features/landing/components/trust-section";

export default function HomePage() {
  return (
    <>
      <Hero />
      <ServiceCategories />
      <BookingOptions />
      <HowItWorks />
      <TrustSection />
      <FinalCta />
    </>
  );
}
