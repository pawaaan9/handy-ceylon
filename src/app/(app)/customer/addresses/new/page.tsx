import type { Metadata } from "next";

import { PageHeader, Panel } from "@/components/app-shell/page-header";
import { AddressForm } from "@/features/addresses/components/address-form";
import type { AddressFormValues } from "@/features/addresses/schemas";
import { listAddresses } from "@/features/addresses/server/repository";
import { requireRole } from "@/features/auth/server/dal";
import { formatLocalMobile } from "@/lib/format";

export const metadata: Metadata = { title: "Add address" };

export default async function NewAddressPage() {
  const user = await requireRole(["customer"], { from: "/customer/addresses/new" });
  const existing = await listAddresses(user.uid);

  const defaultValues = {
    label: existing.length === 0 ? "Home" : "",
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
    makeDefault: existing.length === 0,
  } as unknown as AddressFormValues;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="Add an address" description="Technicians use these details to reach you." />
      <Panel>
        <AddressForm mode="create" defaultValues={defaultValues} />
      </Panel>
    </div>
  );
}
