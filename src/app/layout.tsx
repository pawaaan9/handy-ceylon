import type { Metadata, Viewport } from "next";
import { Google_Sans } from "next/font/google";

import { siteConfig } from "@/config/site";

import "./globals.css";

/** Google Sans for the whole UI (variable 400–700, optical sizing, GRAD 0). */
const googleSans = Google_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  axes: ["opsz"],
  display: "swap",
  // Next.js has no size metrics for Google Sans, so it can't generate an adjusted
  // fallback; use the system UI font while it loads instead of warning on every build.
  adjustFontFallback: false,
  fallback: ["system-ui", "sans-serif"],
});

export const metadata: Metadata = {
  title: {
    default: `${siteConfig.name} — Reliable home services in Sri Lanka`,
    template: `%s · ${siteConfig.name}`,
  },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  openGraph: {
    type: "website",
    locale: "en_LK",
    siteName: siteConfig.name,
    title: `${siteConfig.name} — Reliable home services in Sri Lanka`,
    description: siteConfig.description,
  },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // globals.css enables smooth scrolling; this tells Next.js to pause it during route changes.
    <html lang="en-LK" data-scroll-behavior="smooth" className={`${googleSans.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
