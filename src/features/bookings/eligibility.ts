import type { ServiceRequestDoc, TechnicianDoc } from "@/lib/firestore/models";

export type EligibilityResult = { eligible: true } | { eligible: false; reason: string };

type TechnicianFacts = Pick<
  TechnicianDoc,
  "accountStatus" | "verificationStatus" | "availability" | "categoryIds" | "serviceDistricts"
>;
type RequestFacts = Pick<ServiceRequestDoc, "customerId" | "categoryId" | "district"> &
  Partial<Pick<ServiceRequestDoc, "mode">>;

/**
 * Whether this technician may take or quote for this request, from stored
 * facts only: an approved, active account covering the request's service
 * category and district. Get Help Now also needs the technician marked
 * online — availability is never assumed. Quotes don't, because the
 * technician proposes their own visit times or timeline.
 */
export function technicianEligibility(
  technicianUid: string,
  tech: TechnicianFacts,
  request: RequestFacts,
): EligibilityResult {
  const ready = (request.mode ?? "urgent") === "urgent" ? technicianReadiness(tech) : accountReadiness(tech);
  if (!ready.eligible) return ready;
  if (request.customerId === technicianUid) {
    return { eligible: false, reason: "You can't accept your own request." };
  }
  if (!tech.categoryIds.includes(request.categoryId)) {
    return { eligible: false, reason: "This request isn't in one of your service categories." };
  }
  if (!tech.serviceDistricts.includes(request.district)) {
    return { eligible: false, reason: "This request is outside the districts you cover." };
  }
  return { eligible: true };
}

/** An approved, active technician account (the minimum for quoting). */
export function accountReadiness(tech: Pick<TechnicianFacts, "accountStatus" | "verificationStatus">): EligibilityResult {
  if (tech.accountStatus !== "active" || tech.verificationStatus !== "approved") {
    return { eligible: false, reason: "Your technician account isn't active, so you can't take jobs right now." };
  }
  return { eligible: true };
}

/** Whether the account can take an urgent job right now: approved, active and marked online. */
export function technicianReadiness(
  tech: Pick<TechnicianFacts, "accountStatus" | "verificationStatus" | "availability">,
): EligibilityResult {
  const account = accountReadiness(tech);
  if (!account.eligible) return account;
  if (tech.availability !== "online") {
    return { eligible: false, reason: "Go online to accept urgent requests." };
  }
  return { eligible: true };
}

/** Requests are checked against their own deadline whenever they are read or acted on. */
export function isPastDeadline(expiresAt: { toMillis(): number }, now = Date.now()): boolean {
  return expiresAt.toMillis() <= now;
}
