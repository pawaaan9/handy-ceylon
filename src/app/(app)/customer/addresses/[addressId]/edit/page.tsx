import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { PageHeader, Panel, PageSkeleton } from "@/components/app-shell/page-header";
import { AddressForm } from "@/features/addresses/components/address-form";
import { addressIdSchema, type AddressFormValues } from "@/features/addresses/schemas";
import { getAddress } from "@/features/addresses/server/repository";
import { requireRole } from "@/features/auth/server/dal";
import { formatLocalMobile } from "@/lib/format";

export const metadata: Metadata = { title: "Edit address" };

export default function EditAddressPage(props: PageProps<"/customer/addresses/[addressId]/edit">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <EditAddressPageContent {...props} />
    </Suspense>
  );
}

async function EditAddressPageContent({ params }: PageProps<"/customer/addresses/[addressId]/edit">) {
  const { addressId } = await params;
  const user = await requireRole(["customer"], { from: `/customer/addresses/${addressId}/edit` });
  const id = addressIdSchema.safeParse(addressId);
  // Looked up under the signed-in customer only: other customers' ids 404.
  const address = id.success ? await getAddress(user.uid, id.data) : null;
  if (!address) notFound();

  const defaultValues: AddressFormValues = {
    label: address.label,
    recipientName: address.recipientName,
    contactNumber: formatLocalMobile(address.contactNumber),
    houseOrBuilding: address.houseOrBuilding,
    street: address.street,
    city: address.city,
    district: address.district,
    postalCode: address.postalCode ?? "",
    directions: address.directions ?? "",
    latitude: address.location ? String(address.location.lat) : "",
    longitude: address.location ? String(address.location.lng) : "",
    makeDefault: false,
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title={`Edit “${address.label}”`} />
      <Panel>
        <AddressForm mode="edit" addressId={address.id} defaultValues={defaultValues} isDefault={address.isDefault} />
      </Panel>
    </div>
  );
}
