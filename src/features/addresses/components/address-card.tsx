import { MapPin, Phone, UserRound } from "lucide-react";

import { addressLines, formatPhone } from "../format";
import type { AddressView } from "../schemas";
import { AddressActions } from "./address-actions";

export function AddressCard({ address }: { address: AddressView }) {
  return (
    <article
      aria-labelledby={`address-${address.id}`}
      className="flex flex-col rounded-xl border bg-card p-5 data-[default=true]:border-primary/40"
      data-default={address.isDefault}
    >
      <div className="flex items-start justify-between gap-3">
        <h2 id={`address-${address.id}`} className="font-semibold text-foreground">
          {address.label}
        </h2>
        {address.isDefault ? (
          <span className="rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-semibold text-primary">
            Default
          </span>
        ) : null}
      </div>
      <div className="mt-3 space-y-2 text-sm text-muted-foreground">
        <p className="flex gap-2">
          <MapPin className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
          <span>
            {addressLines(address).map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
          </span>
        </p>
        <p className="flex gap-2">
          <UserRound className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
          {address.recipientName}
        </p>
        <p className="flex gap-2">
          <Phone className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
          {formatPhone(address.contactNumber)}
        </p>
        {address.directions ? <p className="border-l-2 pl-3 italic">{address.directions}</p> : null}
      </div>
      <div className="mt-5 border-t pt-4">
        <AddressActions id={address.id} label={address.label} isDefault={address.isDefault} />
      </div>
    </article>
  );
}
