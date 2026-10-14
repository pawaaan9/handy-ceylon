import { siteConfig } from "@/config/site";

/**
 * Money is stored as integer LKR cents to avoid floating-point drift.
 * Display rounds to whole rupees, which is how home-service prices are quoted.
 */
const lkrFormatter = new Intl.NumberFormat(siteConfig.locale, {
  style: "currency",
  currency: siteConfig.currency,
  maximumFractionDigits: 0,
});

export function formatLkr(amountInCents: number): string {
  return lkrFormatter.format(amountInCents / 100);
}

export function lkrToCents(rupees: number): number {
  return Math.round(rupees * 100);
}

const dateTimeFormatter = new Intl.DateTimeFormat(siteConfig.locale, {
  timeZone: siteConfig.timeZone,
  dateStyle: "medium",
  timeStyle: "short",
});

/** Formats in Asia/Colombo regardless of the server or browser time zone. */
export function formatDateTime(date: Date): string {
  return dateTimeFormatter.format(date);
}
