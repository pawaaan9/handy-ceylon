import { MapPinPlus, MapPinned } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/app-shell/page-header";
import { FormAlert } from "@/components/forms/form-alert";
import { Button } from "@/components/ui/button";
import { AddressCard } from "@/features/addresses/components/address-card";
import { MAX_ADDRESSES } from "@/features/addresses/schemas";
import { listAddresses } from "@/features/addresses/server/repository";
import { requireRole } from "@/features/auth/server/dal";

export const metadata: Metadata = { title: "Saved addresses" };

const messages: Record<string, string> = {
  created: "Address saved.",
  updated: "Address updated.",
  deleted: "Address deleted.",
  default: "Default address updated.",
};

export default async function AddressesPage({ searchParams }: PageProps<"/customer/addresses">) {
  const user = await requireRole(["customer"], { from: "/customer/addresses" });
  const [addresses, { status }] = await Promise.all([listAddresses(user.uid), searchParams]);
  const message = typeof status === "string" ? messages[status] : undefined;
  const atLimit = addresses.length >= MAX_ADDRESSES;

  const addButton = (
    <Button asChild size="xl" disabled={atLimit}>
      <Link href="/customer/addresses/new" aria-disabled={atLimit}>
        <MapPinPlus data-icon="inline-start" aria-hidden="true" />
        Add address
      </Link>
    </Button>
  );

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Saved addresses"
        description="Where technicians come to work. Your default address is pre-selected when you book."
        actions={addresses.length > 0 && !atLimit ? addButton : undefined}
      />
      {message ? <FormAlert tone="success">{message}</FormAlert> : null}
      {atLimit ? (
        <FormAlert tone="info">
          You&apos;ve saved the maximum of {MAX_ADDRESSES} addresses. Delete one to add another.
        </FormAlert>
      ) : null}

      {addresses.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-dashed bg-card px-6 py-16 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-brand-soft text-primary">
            <MapPinned className="size-6" aria-hidden="true" />
          </span>
          <h2 className="mt-4 text-lg font-semibold text-foreground">No saved addresses yet</h2>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Add your home or office so booking a technician takes seconds.
          </p>
          <div className="mt-6">{addButton}</div>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {addresses.map((address) => (
            <AddressCard key={address.id} address={address} />
          ))}
        </div>
      )}
    </div>
  );
}
