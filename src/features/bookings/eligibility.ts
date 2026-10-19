import type { ServiceRequestDoc, TechnicianDoc } from "@/lib/firestore/models";

export type EligibilityResult = { eligible: true } | { eligible: false; reason: string };

type TechnicianFacts = Pick<
  TechnicianDoc,
  "accountStatus" | "verificationStatus" | "availability" | "categoryIds" | "serviceDistricts"
>;
type RequestFacts = Pick<ServiceRequestDoc, "customerId" | "categoryId" | "district">;

/**
 * Whether this technician may take this urgent request, from stored facts only:
 * an approved, active account that is marked online and covers the request's
 * service category and district. Availability is never assumed.
 */
export function technicianEligibility(
  technicianUid: string,
  tech: TechnicianFacts,
  request: RequestFacts,
): EligibilityResult {
  const ready = technicianReadiness(tech);
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

/** Whether the account can take any job right now: approved, active and marked online. */
export function technicianReadiness(
  tech: Pick<TechnicianFacts, "accountStatus" | "verificationStatus" | "availability">,
): EligibilityResult {
  if (tech.accountStatus !== "active" || tech.verificationStatus !== "approved") {
    return { eligible: false, reason: "Your technician account isn't active, so you can't take jobs right now." };
  }
  if (tech.availability !== "online") {
    return { eligible: false, reason: "Go online to accept urgent requests." };
  }
  return { eligible: true };
}

/** Requests are checked against their own deadline whenever they are read or acted on. */
export function isPastDeadline(expiresAt: { toMillis(): number }, now = Date.now()): boolean {
  return expiresAt.toMillis() <= now;
}
