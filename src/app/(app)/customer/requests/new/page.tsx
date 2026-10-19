import { CloudOff, Wrench } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { PageHeader, PageSkeleton } from "@/components/app-shell/page-header";
import { StatusMessage } from "@/components/feedback/status-message";
import { Button } from "@/components/ui/button";
import type { AddressFormValues } from "@/features/addresses/schemas";
import { listAddresses } from "@/features/addresses/server/repository";
import { requireRole } from "@/features/auth/server/dal";
import { bookingModeSchema } from "@/features/bookings/types";
import { getCatalogue } from "@/features/catalogue/server/queries";
import { catalogueSlugSchema } from "@/features/catalogue/types";
import { RequestForm } from "@/features/requests/components/request-form";
import { formatLocalMobile } from "@/lib/format";

export const metadata: Metadata = { title: "New request" };

export default function NewRequestPage(props: PageProps<"/customer/requests/new">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <NewRequestPageContent {...props} />
    </Suspense>
  );
}

const param = (value: string | string[] | undefined) => (typeof value === "string" ? value : undefined);

async function NewRequestPageContent({ searchParams }: PageProps<"/customer/requests/new">) {
  const user = await requireRole(["customer"], { from: "/customer/requests/new" });
  const [query, catalogue, addresses] = await Promise.all([searchParams, getCatalogue(), listAddresses(user.uid)]);

  if (catalogue.status === "unavailable") {
    return (
      <StatusMessage
        icon={CloudOff}
        tone="error"
        title="Services are unavailable right now"
        description="We couldn't load the service list. Please try again in a moment."
      >
        <Button asChild size="lg">
          <Link href="/customer/requests/new">Try again</Link>
        </Button>
      </StatusMessage>
    );
  }
  const { categories, services } = catalogue.catalogue;
  if (categories.length === 0) {
    return (
      <StatusMessage
        icon={Wrench}
        title="No services available yet"
        description="We're adding services now. Please check back soon."
      />
    );
  }

  // Pre-select from links like /services/plumbing → "Get a Quote"; anything invalid is ignored.
  const mode = bookingModeSchema.safeParse(param(query.mode)).data;
  const categoryId = catalogueSlugSchema.safeParse(param(query.category)).data;
  const serviceId = catalogueSlugSchema.safeParse(param(query.service)).data;
  const service = services.find((s) => s.id === serviceId);
  const initial = {
    mode,
    categoryId: service?.categoryId ?? (categories.some((c) => c.id === categoryId) ? categoryId : undefined),
    serviceId: service?.id,
    addressId: addresses.find((a) => a.isDefault)?.id,
  };

  const newAddressDefaults = {
    label: addresses.length === 0 ? "Home" : "",
    recipientName: user.displayName,
    contactNumber: formatLocalMobile(user.phoneNumber),
    houseOrBuilding: "",
    street: "",
    city: "",
    district: "",
    postalCode: "",
    directions: "",
    latitude: "",
    longitude: "",
    makeDefault: false,
  } as unknown as AddressFormValues;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="New service request"
        description="Tell us what you need. It takes about two minutes, and your progress is saved on this device."
      />
      <RequestForm
        uid={user.uid}
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
        services={services}
        addresses={addresses}
        newAddressDefaults={newAddressDefaults}
        initial={initial}
      />
    </div>
  );
}
