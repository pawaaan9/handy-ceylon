# Handy Ceylon

Home-services and technician-booking marketplace for Sri Lanka. Customers book plumbers,
electricians, AC technicians, cleaners, painters, carpenters and more using **Get Help Now**
(urgent) or **Get a Quote** (technician visit or online quote).

**Stack:** Next.js 16 (App Router, Turbopack, Cache Components) · TypeScript (strict) ·
Tailwind CSS 4 · shadcn/ui (Radix) · Lucide · Zod · React Hook Form · Firebase Auth,
Firestore, Storage · Firebase Admin SDK.

**Status:** foundation, landing page, authentication & user management, service catalogue, saved
addresses and **customer service requests** (Phase 4) are complete. Technician matching, offers and
quotations come next: submitted requests stay `open` until those phases land.

## Features

- **Sign up / log in** with email + password, **mobile number (SMS code)** or **Google**.
  Public sign-up always creates a customer; Google and mobile users complete a short profile.
- Email verification, forgot/reset password (custom `/auth/action` handler), remember-me sessions,
  linking an email to a mobile-only account.
- **Separate role collections**: `customers`, `technicians`, `admins`.
- **Technician applications** with document uploads; admins approve/reject; approval creates the technician account.
- **Service catalogue** in Firestore with search, category filters, subcategories and active/inactive control.
- **Saved addresses** with a default address, full validation and ownership enforced on the server.
- **Service requests**: a multi-step form (service → address → details → photos/videos → review) for
  **Get Help Now**, **Get a Quote › Technician Visit** and **Get a Quote › Quote Online**, with draft
  saving, upload progress, duplicate-safe submission, a request list, a detail page and cancellation.
- Role-protected customer, technician and admin areas; flat, gradient-free UI with split-screen auth pages.

## Requirements

- Node.js 20.9+ (developed on Node 25), npm 10+
- A Firebase project on the **Blaze** plan (needed for phone/SMS auth and Storage)
- For local emulators: [Firebase CLI](https://firebase.google.com/docs/cli) and **JDK 21+**

## Getting started

```bash
cd handy-ceylon
npm install
cp .env.example .env.local      # fill in values — see below
npm run seed:catalogue          # load service categories into Firestore
npm run dev                     # http://localhost:3000
```

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` / `build` / `start` | Develop, build, serve |
| `npm run lint` · `npm run typecheck` | ESLint · route types + `tsc --noEmit` |
| `npm test` | Unit tests (Vitest) |
| `npm run test:emulators` | Repository + Security Rules tests against the Auth/Firestore/Storage emulators (Java 21+) |
| `npm run seed:catalogue [-- --dry-run]` | Seed/refresh the service catalogue (idempotent, never deletes) |
| `npm run admin:grant -- <email> [--revoke]` | Grant or revoke the administrator role |
| `npm run emulators` | Start the Firebase Emulator Suite |

The emulators need Java 21+, e.g.
`export JAVA_HOME=$(/usr/libexec/java_home -v 21)` (or `/opt/homebrew/opt/openjdk@21` with Homebrew).

## Environment configuration

All variables are documented in [.env.example](.env.example).

| Variable | Exposure | Source |
|---|---|---|
| `NEXT_PUBLIC_FIREBASE_*` | Browser (public by design) | Project settings → Your apps → Web app |
| `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` | Browser | Optional, Google Analytics |
| `NEXT_PUBLIC_USE_FIREBASE_EMULATORS` | Browser | `true` for local emulators |
| `FIREBASE_ADMIN_PROJECT_ID`, `FIREBASE_ADMIN_CLIENT_EMAIL`, `FIREBASE_ADMIN_PRIVATE_KEY` | **Server only** | Service account key |
| `FIREBASE_STORAGE_BUCKET` | Server only | Optional override |

Never prefix Admin credentials with `NEXT_PUBLIC_` or commit `.env.local` / service-account JSON
(both are git-ignored). Admin modules import `server-only`, so client imports fail the build.

## Firebase setup (console)

1. **Firestore** → *Create database* (production mode, `asia-south1`).
2. **Storage** → create the default bucket.
3. **Authentication → Sign-in method** → enable:
   - **Email/Password**
   - **Google** (set a support email)
   - **Phone** — requires the Blaze plan; under *Settings → SMS region policy* allow **Sri Lanka (+94)**.
     Add test phone numbers for development if you don't want real SMS.
4. **Authentication → Settings → Authorized domains** → add your production domain (`localhost` is there by default).
5. *Optional:* **Authentication → Templates** → set the action URL to `https://<your-domain>/auth/action`
   so reset/verification links use the branded pages (Firebase's default pages also work).
6. Deploy rules and indexes:
   ```bash
   cp .firebaserc.example .firebaserc   # set your project id
   firebase deploy --only firestore:rules,firestore:indexes,storage
   ```
7. Seed the catalogue: `npm run seed:catalogue`.
8. Create the first administrator — see below.
9. *Recommended:* in **Google Cloud Console → Cloud Storage → your bucket → Lifecycle**, add a rule
   to delete objects with the prefix `requestMedia/` older than 7 days. This removes uploads from
   request drafts that were never submitted.

### First administrator

1. Sign up normally (email + password) and verify the email.
2. On a trusted machine with `.env.local` credentials: `npm run admin:grant -- you@example.com`.
3. Log in again — you land on `/admin/dashboard`. Revoke with `npm run admin:grant -- you@example.com --revoke`.

There is no admin sign-up page and no client code can create an admin record (rules deny it).

### Local emulators

```bash
npm run emulators   # Auth :9099, Firestore :8080, Storage :9199, UI :4000
```

Set `NEXT_PUBLIC_USE_FIREBASE_EMULATORS=true` and the `FIREBASE_*_EMULATOR_HOST` variables from
`.env.example`. Phone sign-in codes and email links appear in the emulator UI / terminal; Google
sign-in shows the emulator's test account picker.

## Data model (summary)

| Collection | Contents |
|---|---|
| `customers/{uid}` (+ `/addresses/{id}`) | Customer accounts and saved addresses |
| `technicians/{uid}` | Approved technician accounts and profiles |
| `admins/{uid}` | Administrator accounts |
| `technicianApplications/{uid}` | Applications and review decisions |
| `serviceCategories/{slug}`, `services/{id}` | Catalogue (active flags, subcategories) |
| `phoneIndex/{E.164}` | One account per mobile number |
| `serviceRequests/{id}` (+ `/private/details`, `/history/{id}`) | Customer service requests — see below |
| `notifications/{uid}/items/{id}` | Notifications for any role |

Security Rules: `firestore.rules` and `storage.rules`. Full field-level types: `src/lib/firestore/models.ts`.

### Service requests

| Path | Fields | Who can read |
|---|---|---|
| `serviceRequests/{id}` | `customerId`, `mode` (`urgent` · `quote_visit` · `quote_online`), `status` (`open` · `assigned` · `cancelled` · `expired`), `categoryId`, `serviceId`, `catalogue` (category/service/subcategory names at submission), `addressId`, `city`, `district`, `title`, `description`, `urgency`, `preferredSchedule` (`asap` · `flexible` · `scheduled` + date & time slot, Asia/Colombo), `measurements`, `attachments[]`, `selectedTechnicianId`, `acceptedQuotationId`, `bookingId`, `offerCount`, `quotationCount`, `cancellation`, `expiresAt`, `createdAt`, `updatedAt` | Owner, admins, the assigned technician; technicians while `open` |
| `…/private/details` | `address` (full snapshot of the saved address), `accessInstructions` | Owner, admins, assigned technician |
| `…/history/{eventId}` | Append-only audit log: `from`, `to`, `actorId`, `actorRole`, `note`, `at` | Owner, admins, assigned technician |

- **Writes are server-only.** Customers create and cancel requests through Server Actions; rules deny
  every client write, so nobody can set a status or assign a technician from the browser.
- **IDs and timestamps** are generated on the server. The document id is derived from the customer's uid
  and a per-submission key, so double-clicks and retries resolve to the same request.
- **Address snapshot:** the chosen address is copied into `private/details`, so later edits to (or
  deletion of) the saved address never change the request.
- **Money** is stored as integer LKR cents (`LkrCents`) on offers, quotations and bookings, never as floats.
- **Attachments** (up to 6: photos ≤ 10 MB; up to 2 videos ≤ 50 MB / 60 s) upload to the customer's
  draft folder `requestMedia/{uid}/{submissionKey}/`. On submission the server re-reads each file's
  real type and size, then copies it to the server-owned `serviceRequests/{id}/media/` and deletes the draft.
- Customers may have at most 10 open requests. `expiresAt` (24 h urgent, 7 days quotes) is recorded
  now and enforced when matching is added.

## Security model

- The server decides roles from the role collections; the browser's claims are only used by Security Rules.
- All account, address, application, catalogue and service-request writes go through Server Actions using the Admin SDK,
  with Zod validation, session-derived user ids and state-machine checks. Rules deny direct client writes.
- Verified email/phone values always come from Firebase Auth, never from form input.

## Design

Flat brand colours only (no gradients): teal `primary`, orange `urgent`, `navy`, plus `sand`, `clay`,
`leaf` and `sky` swatches for illustrations and tiles (`src/app/globals.css`). Headings use Plus Jakarta
Sans, body text Inter. Illustrations are hand-built SVGs in `src/components/illustrations`.
