// End-to-end browser test of the Phase 2 auth flows against the Firebase
// emulators. Run with: npm run test:e2e  (needs Google Chrome + JDK 21)
//
// It builds the app into .next-e2e (so it never clashes with your own
// `next dev`), serves it with `next start` against the emulators, then drives Chrome through
// sign-up, verification, login/logout, password reset, profile updates, the
// technician application, admin approval and role-based access control.

import { execFile, spawn } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import puppeteer from "puppeteer-core";

const PROJECT_ID = "demo-handy-ceylon";
const PORT = 3210;
const BASE = `http://localhost:${PORT}`;
const AUTH_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST;
const CHROME =
  process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

if (!AUTH_HOST || !process.env.FIRESTORE_EMULATOR_HOST) {
  console.error('Run via "npm run test:e2e" so the Firebase emulators are available.');
  process.exit(1);
}

const appEnv = {
  ...process.env,
  NEXT_PUBLIC_FIREBASE_API_KEY: "demo-api-key",
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: `${PROJECT_ID}.firebaseapp.com`,
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: PROJECT_ID,
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: `${PROJECT_ID}.appspot.com`,
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "000000000000",
  NEXT_PUBLIC_FIREBASE_APP_ID: "1:000000000000:web:demo",
  NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID: "",
  NEXT_PUBLIC_USE_FIREBASE_EMULATORS: "true",
  FIREBASE_ADMIN_PROJECT_ID: PROJECT_ID,
  FIREBASE_ADMIN_CLIENT_EMAIL: "",
  FIREBASE_ADMIN_PRIVATE_KEY: "",
  FIREBASE_STORAGE_BUCKET: `${PROJECT_ID}.appspot.com`,
  NEXT_DIST_DIR: ".next-e2e",
};

initializeApp({ projectId: PROJECT_ID });
const adminAuth = getAuth();
const db = getFirestore();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let passed = 0;
function ok(message) {
  passed += 1;
  console.log(`  ✓ ${message}`);
}
function assert(condition, message) {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

// ---------- server ----------
async function buildApp() {
  if (process.env.E2E_SKIP_BUILD === "1") return;
  console.log("Building the app for E2E (.next-e2e)…");
  await promisify(execFile)("npx", ["next", "build"], { env: appEnv, maxBuffer: 64 * 1024 * 1024 });
}

function startServer() {
  const server = spawn("npx", ["next", "start", "--port", String(PORT)], {
    env: appEnv,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let log = "";
  server.stdout.on("data", (d) => (log += d));
  server.stderr.on("data", (d) => (log += d));
  return { server, getLog: () => log };
}

async function waitForServer() {
  for (let i = 0; i < 120; i++) {
    try {
      const res = await fetch(`${BASE}/terms`);
      if (res.ok) return;
    } catch {}
    await sleep(1000);
  }
  throw new Error("Next.js server did not start");
}

// ---------- browser helpers ----------
/**
 * A freshly created headless Chrome profile can stall its first IndexedDB
 * opens, and the Firebase SDK waits on IndexedDB (heartbeat header) before
 * every request. Open throwaway databases until the backend responds.
 */
async function warmUpIndexedDb(page) {
  await goto(page, "/terms");
  for (let attempt = 1; attempt <= 20; attempt++) {
    const ready = await page.evaluate(
      (n) =>
        new Promise((resolve) => {
          const t = setTimeout(() => resolve(false), 1500);
          const req = indexedDB.open(`warmup-${n}`);
          req.onsuccess = () => {
            clearTimeout(t);
            req.result.close();
            indexedDB.deleteDatabase(`warmup-${n}`);
            resolve(true);
          };
          req.onerror = () => resolve(false);
        }),
      attempt,
    );
    if (ready) return;
  }
  throw new Error("IndexedDB never became available in headless Chrome");
}

async function goto(page, path) {
  await page.goto(`${BASE}${path}`, { waitUntil: "load", timeout: 120_000 });
}

async function waitForPath(page, predicate, label, timeout = 60_000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const url = new URL(page.url());
    if (predicate(url)) return url;
    await sleep(150);
  }
  throw new Error(`Timed out waiting for ${label}; currently at ${page.url()}`);
}
const atPath = (page, path) => waitForPath(page, (u) => u.pathname === path, path);

async function waitForText(page, text, timeout = 60_000) {
  await page.waitForFunction((t) => document.body.innerText.includes(t), { timeout }, text);
}

async function fill(page, selector, value) {
  await page.waitForSelector(selector, { visible: true });
  await page.click(selector, { count: 3 });
  await page.keyboard.press("Backspace");
  await page.type(selector, value);
}

async function hydrated(page) {
  // Client components attach React props once hydrated.
  await page.waitForFunction(
    () => {
      const el =
        document.querySelector("form button[type=submit]") ??
        document.querySelector('button[aria-label="Account menu"]');
      return el && Object.keys(el).some((k) => k.startsWith("__reactProps"));
    },
    { timeout: 60_000 },
  );
}

async function submit(page) {
  await click(page, "form button[type=submit]");
}

async function click(page, selector) {
  await page.waitForSelector(selector, { visible: true });
  await page.click(selector);
}

async function logout(page) {
  await hydrated(page);
  await click(page, 'button[aria-label="Account menu"]');
  await page.locator("::-p-text(Log out)").click();
  await atPath(page, "/login");
}

async function login(page, email, password, { remember = false } = {}) {
  await goto(page, "/login");
  await hydrated(page);
  await fill(page, "#email", email);
  await fill(page, "#password", password);
  if (remember) await click(page, "#remember");
  await submit(page);
}

async function oobCode(email, requestType) {
  const res = await fetch(`http://${AUTH_HOST}/emulator/v1/projects/${PROJECT_ID}/oobCodes`);
  const { oobCodes } = await res.json();
  const match = oobCodes.filter((c) => c.email === email && c.requestType === requestType).pop();
  assert(match, `${requestType} email was sent to ${email}`);
  return match;
}

// ---------- the test ----------
const customer = {
  name: "Nimal Perera",
  email: "nimal.e2e@example.com",
  phone: "077 123 4567",
  password: "Valid1Password",
  newPassword: "Changed2Password",
};
const adminUser = { email: "admin.e2e@example.com", password: "Admin1Password" };

const tmp = mkdtempSync(join(tmpdir(), "hc-e2e-"));
const pngPath = join(tmp, "avatar.png");
writeFileSync(
  pngPath,
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    "base64",
  ),
);
const pdfPath = join(tmp, "nvq-certificate.pdf");
writeFileSync(pdfPath, "%PDF-1.4\n% Handy Ceylon test document\n");

// Start from empty emulators (the npm script retries once on a fresh run).
await fetch(`http://${AUTH_HOST}/emulator/v1/projects/${PROJECT_ID}/accounts`, { method: "DELETE" });
await fetch(
  `http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`,
  { method: "DELETE" },
);

await buildApp();
const { server, getLog } = startServer();
const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--no-first-run", "--no-default-browser-check"],
});
const browserLog = [];
const inflight = new Map();
function watch(p) {
  p.on("request", (r) => inflight.set(r, `${r.method()} ${r.url()} @${new Date().toISOString().slice(11, 19)}`));
  p.on("requestfinished", (r) => {
    inflight.delete(r);
    if (!r.url().includes("/_next/static") && !r.url().includes("_rsc=")) {
      browserLog.push(`[http ${r.response()?.status()}] ${r.method()} ${r.url().slice(0, 140)}`);
    }
  });
  p.on("requestfailed", (r) => inflight.delete(r));
  p.on("console", (m) => browserLog.push(`[browser ${m.type()}] ${m.text()}`));
  p.on("pageerror", (e) => browserLog.push(`[pageerror] ${e.message}`));
  p.on("requestfailed", (r) => browserLog.push(`[requestfailed] ${r.url()} ${r.failure()?.errorText}`));
  return p;
}
const page = watch(await browser.newPage());
page.setDefaultTimeout(60_000);

try {
  console.log("Starting Next.js against the emulators…");
  await waitForServer();
  await warmUpIndexedDb(page);

  console.log("\nUnauthenticated access");
  for (const path of ["/customer/dashboard", "/technician/dashboard", "/admin/dashboard"]) {
    await goto(page, path);
    const url = await waitForPath(page, (u) => u.pathname === "/login", "login redirect");
    assert(url.searchParams.get("next") === path, `next=${path}`);
  }
  ok("protected pages redirect to /login with a return path");

  console.log("\nSign up");
  await goto(page, "/signup");
  await hydrated(page);
  await submit(page);
  await waitForText(page, "Enter your full name");
  ok("empty form shows validation messages");
  await fill(page, "#fullName", customer.name);
  await fill(page, "#email", customer.email);
  await fill(page, "#phoneNumber", customer.phone);
  await fill(page, "#password", customer.password);
  await fill(page, "#confirmPassword", "Mismatch1Password");
  await click(page, "#acceptTerms");
  await submit(page);
  await waitForText(page, "Passwords do not match");
  ok("password confirmation is validated");
  await fill(page, "#confirmPassword", customer.password);
  await submit(page);
  await atPath(page, "/verify-email");
  await waitForText(page, "Verify your email");
  const record = await adminAuth.getUserByEmail(customer.email);
  const userDoc = (await db.doc(`users/${record.uid}`).get()).data();
  assert(userDoc.role === "customer", "new account is a customer");
  assert(record.customClaims?.role === "customer", "customer claim set");
  assert(!("password" in userDoc), "no password stored in Firestore");
  ok("sign-up creates a customer account and Firestore profile, then asks for verification");

  console.log("\nEmail verification");
  await goto(page, "/technician/register");
  await waitForText(page, "Verify your email first");
  ok("technician application is blocked until the email is verified");
  const verify = await oobCode(customer.email, "VERIFY_EMAIL");
  await goto(page, `/auth/action?mode=verifyEmail&oobCode=${encodeURIComponent(verify.oobCode)}`);
  await waitForText(page, "Email verified");
  assert((await adminAuth.getUser(record.uid)).emailVerified, "Auth record verified");
  await goto(page, "/verify-email");
  await waitForText(page, "Your email is verified");
  ok("verification link verifies the account; the server reads the authoritative state");

  console.log("\nCustomer access control");
  await goto(page, "/customer/dashboard");
  await waitForText(page, "Hello, Nimal");
  for (const path of ["/technician/dashboard", "/admin/dashboard", "/admin/technician-applications"]) {
    await goto(page, path);
    await atPath(page, "/customer/dashboard");
  }
  ok("customers are redirected away from technician and admin areas");

  console.log("\nCustomer profile");
  await goto(page, "/customer/profile");
  await hydrated(page);
  // Wait until the browser SDK is restored (upload button enabled).
  await page.waitForFunction(() => {
    const b = [...document.querySelectorAll("button")].find((x) => x.textContent?.includes("photo"));
    return b && !b.disabled;
  });
  const avatarInput = await page.$('input[type=file][accept*="image/png"]');
  await avatarInput.uploadFile(pngPath);
  await page.waitForFunction(() => document.body.innerText.includes("Change photo"), { timeout: 60_000 });
  const photoURL = (await db.doc(`users/${record.uid}`).get()).get("photoURL");
  assert(typeof photoURL === "string" && photoURL.includes("avatar"), "photoURL saved by the server");
  ok("profile photo uploads to Storage and the server stores its URL");

  await fill(page, "#address-line1", "12 Temple Road");
  await fill(page, "#address-city", "Kandy");
  await page.select("#address-district", "Kandy");
  await fill(page, "#address-line2", "Near the clock tower");
  await submit(page);
  await waitForText(page, "Your profile has been saved.");
  const profile = (await db.doc(`customerProfiles/${record.uid}`).get()).data();
  assert(profile.savedAddresses[0].city === "Kandy", "address persisted");
  assert((await db.doc(`users/${record.uid}`).get()).get("role") === "customer", "role unchanged");
  ok("profile and default address are saved to Firestore");

  console.log("\nLogout and login");
  await logout(page);
  await goto(page, "/customer/dashboard");
  await atPath(page, "/login");
  ok("logging out ends the session");

  await login(page, customer.email, "Wrong1Password");
  await waitForText(page, "Incorrect email or password.");
  ok("wrong password shows a friendly error");

  await login(page, customer.email, customer.password, { remember: true });
  await atPath(page, "/customer/dashboard");
  const persistent = (await page.cookies()).find((c) => c.name === "__session");
  assert(persistent && persistent.expires > Date.now() / 1000 + 13 * 24 * 3600, "14-day cookie");
  assert(persistent.httpOnly, "session cookie is httpOnly");
  ok("login with remember-me sets a 14-day httpOnly session cookie");

  await goto(page, "/login");
  await atPath(page, "/customer/dashboard");
  await goto(page, "/signup");
  await atPath(page, "/customer/dashboard");
  ok("signed-in users are redirected away from login and sign-up");

  await logout(page);

  console.log("\nDuplicate sign-up");
  await goto(page, "/signup");
  await hydrated(page);
  await fill(page, "#fullName", "Someone Else");
  await fill(page, "#email", customer.email);
  await fill(page, "#phoneNumber", "0779876543");
  await fill(page, "#password", customer.password);
  await fill(page, "#confirmPassword", customer.password);
  await click(page, "#acceptTerms");
  await submit(page);
  await waitForText(page, "An account with this email already exists");
  ok("duplicate email is refused");

  console.log("\nPassword reset");
  await goto(page, "/forgot-password");
  await hydrated(page);
  await fill(page, "#email", "nobody@example.com");
  await submit(page);
  await waitForText(page, "If an account exists");
  ok("unknown emails get the same generic confirmation");

  await goto(page, "/forgot-password");
  await hydrated(page);
  await fill(page, "#email", customer.email);
  await submit(page);
  await waitForText(page, "If an account exists");
  const reset = await oobCode(customer.email, "PASSWORD_RESET");
  await goto(page, `/auth/action?mode=resetPassword&oobCode=${encodeURIComponent(reset.oobCode)}`);
  await waitForText(page, "Choose a new password for");
  await hydrated(page);
  await fill(page, "#password", customer.newPassword);
  await fill(page, "#confirmPassword", customer.newPassword);
  await submit(page);
  await waitForText(page, "Password updated");
  await goto(page, `/auth/action?mode=resetPassword&oobCode=${encodeURIComponent(reset.oobCode)}`);
  await waitForText(page, "Link can't be used");
  ok("reset link changes the password once and cannot be reused");

  await login(page, customer.email, customer.password);
  await waitForText(page, "Incorrect email or password.");
  await login(page, customer.email, customer.newPassword);
  await atPath(page, "/customer/dashboard");
  const browserSession = (await page.cookies()).find((c) => c.name === "__session");
  assert(browserSession.session === true, "browser-session cookie without remember-me");
  ok("old password stops working; new password logs in (browser-session cookie)");

  console.log("\nTechnician application");
  await goto(page, "/technician/register");
  await waitForText(page, "Technician application");
  await hydrated(page);
  await page.waitForFunction(() => {
    const b = [...document.querySelectorAll("button")].find((x) => x.textContent?.includes("Attach document"));
    return b && !b.disabled;
  });
  await fill(page, "#intro", "Experienced plumber handling leaks, pipe fitting and pump installation for homes in Colombo.");
  await fill(page, "#years", "8");
  await page.click("#category-plumbing");
  await fill(page, "#skills", "PPR fitting, pump installation");
  await page.select("#district", "Colombo");
  await fill(page, "#city", "Nugegoda");
  await page.click("#area-Colombo");
  await page.click("#area-Gampaha");
  const docInput = await page.$('input[type=file][accept*="application/pdf"]');
  await docInput.uploadFile(pdfPath);
  await waitForText(page, "nvq-certificate.pdf");
  await submit(page);
  await atPath(page, "/technician/application");
  await waitForText(page, "Pending review");
  const application = (await db.doc(`technicianApplications/${record.uid}`).get()).data();
  assert(application.applicationStatus === "pending", "pending application stored");
  assert(application.qualificationDocumentPaths.length === 1, "document attached");
  assert((await db.doc(`users/${record.uid}`).get()).get("role") === "customer", "still a customer");
  ok("application is submitted as pending without granting technician access");

  await goto(page, "/technician/dashboard");
  await atPath(page, "/technician/application");
  ok("pending applicants see their application status instead of the technician dashboard");

  console.log("\nAdministrator");
  const adminRecord = await adminAuth.createUser({ ...adminUser, emailVerified: true, displayName: "Ops Admin" });
  await promisify(execFile)("node", ["scripts/grant-admin.mjs", adminUser.email], { env: appEnv });
  assert((await db.doc(`users/${adminRecord.uid}`).get()).get("role") === "admin", "admin provisioned");
  ok("grant-admin script provisions the administrator");

  const adminContext = await browser.createBrowserContext();
  const adminPage = watch(await adminContext.newPage());
  adminPage.setDefaultTimeout(60_000);
  await warmUpIndexedDb(adminPage);
  await login(adminPage, adminUser.email, adminUser.password);
  await atPath(adminPage, "/admin/dashboard");
  await waitForText(adminPage, "Administration");
  await goto(adminPage, "/customer/dashboard");
  await atPath(adminPage, "/admin/dashboard");
  ok("admin logs in to the admin area and is kept out of customer pages");

  await goto(adminPage, "/admin/technician-applications");
  await waitForText(adminPage, customer.name);
  await goto(adminPage, `/admin/technician-applications/${record.uid}`);
  await hydrated(adminPage);
  await adminPage.locator("button::-p-text(Approve)").click();
  await waitForText(adminPage, "Approved");
  ok("admin approves the application");

  console.log("\nApproved technician");
  assert((await db.doc(`users/${record.uid}`).get()).get("role") === "technician", "role promoted");
  assert((await adminAuth.getUser(record.uid)).customClaims?.role === "technician", "claim updated");
  assert((await db.doc(`technicianProfiles/${record.uid}`).get()).exists, "technician profile created");
  await goto(page, "/technician/application");
  await waitForText(page, "You're approved");
  await goto(page, "/technician/dashboard");
  await waitForText(page, "Your technician account is verified and active.");
  await goto(page, "/customer/dashboard");
  await atPath(page, "/technician/dashboard");
  await goto(page, "/admin/dashboard");
  await atPath(page, "/technician/dashboard");
  ok("existing session picks up the technician role; customer and admin areas are closed");

  console.log(`\nAll ${passed} E2E checks passed.`);
} catch (error) {
  const shot = join(tmp, "failure.png");
  await page.screenshot({ path: shot, fullPage: true }).catch(() => {});
  console.error(`\n✗ ${error.message}\n  at ${page.url()}\n  screenshot: ${shot}`);
  const requests = await page
    .evaluate(() =>
      performance
        .getEntriesByType("resource")
        .slice(-15)
        .map((e) => `${e.name} ${Math.round(e.duration)}ms`),
    )
    .catch(() => []);
  console.error(["recent requests:", ...requests].join("\n  "));
  console.error(["in-flight requests:", ...inflight.values()].join("\n  "));
  const idb = await page
    .evaluate(
      () =>
        new Promise((resolve) => {
          const t = setTimeout(() => resolve("indexedDB.open timed out"), 3000);
          const req = indexedDB.open("firebase-heartbeat-database");
          req.onsuccess = () => {
            clearTimeout(t);
            const db = req.result;
            resolve(`indexedDB ok (stores: ${[...db.objectStoreNames].join(",")})`);
            db.close();
          };
          req.onerror = () => resolve(`indexedDB error ${req.error}`);
          req.onblocked = () => resolve("indexedDB blocked");
        }),
    )
    .catch((e) => `evaluate failed ${e.message}`);
  console.error(`diagnostic: ${idb}`);
  console.error(browserLog.slice(-30).join("\n"));
  console.error(getLog().split("\n").slice(-40).join("\n"));
  process.exitCode = 1;
} finally {
  await browser.close();
  server.kill("SIGTERM");
}
