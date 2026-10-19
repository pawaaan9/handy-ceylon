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
  services: "/services",
  getHelpNow: "/get-help-now",
  getAQuote: "/get-a-quote",
  customerRequests: "/customer/requests",
  /** Customer request form; accepts ?mode=urgent|quote_visit|quote_online&category=&service= */
  newRequest: "/customer/requests/new",
  login: "/login",
  signUp: "/signup",
  becomeATechnician: "/technician/register",
  terms: "/terms",
  privacy: "/privacy",
} as const;
