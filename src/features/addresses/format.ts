import { formatLocalMobile } from "@/lib/format";

import type { AddressView } from "./schemas";

export function addressLines(a: Pick<AddressView, "houseOrBuilding" | "street" | "city" | "district" | "postalCode">) {
  return [
    `${a.houseOrBuilding}, ${a.street}`,
    `${a.city}${a.postalCode ? ` ${a.postalCode}` : ""}`,
    `${a.district} District`,
  ];
}

export function formatPhone(e164: string): string {
  return formatLocalMobile(e164);
}
