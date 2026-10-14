export const siteConfig = {
  name: "Handy Ceylon",
  description:
    "Find trusted technicians across Sri Lanka, get quotations, and book home repairs with confidence.",
  locale: "en-LK",
  currency: "LKR",
  timeZone: "Asia/Colombo",
  country: "Sri Lanka",
} as const;

export const routes = {
  home: "/",
  getHelpNow: "/get-help-now",
  getAQuote: "/get-a-quote",
  signIn: "/sign-in",
  becomeATechnician: "/become-a-technician",
} as const;
