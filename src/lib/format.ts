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

/** +94771234567 → 077 123 4567 for display and editing. */
export function formatLocalMobile(e164: string | null | undefined): string {
  if (!e164) return "";
  const digits = e164.replace(/\D/g, "").slice(-9);
  if (digits.length !== 9) return e164;
  return `0${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5)}`;
}

export function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "?"
  );
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat(siteConfig.locale, {
    timeZone: siteConfig.timeZone,
    dateStyle: "medium",
  }).format(new Date(iso));
}
