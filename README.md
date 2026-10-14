# Handy Ceylon

Home-services and technician-booking marketplace for Sri Lanka. Customers book plumbers,
electricians, AC technicians, cleaners, painters, carpenters and more using **Get Help Now**
(urgent) or **Get a Quote** (technician visit or online quote).

**Stack:** Next.js 16 (App Router, Turbopack, Cache Components) · TypeScript (strict) ·
Tailwind CSS 4 · shadcn/ui (Radix) · Lucide · Zod · Firebase Auth, Firestore, Storage ·
Firebase Admin SDK.

> **Stage 1 status:** project foundation and public landing page. Booking flows are not
> live yet — the CTA pages say so honestly. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
> for the data model, roles and status transitions.

## Requirements

- Node.js 20.9+ (developed on Node 25)
- npm 10+
- A Firebase project (Blaze plan recommended for Storage and future Functions)
- Optional: [Firebase CLI](https://firebase.google.com/docs/cli) (`npm i -g firebase-tools`) for rules deployment and emulators

## Getting started

```bash
cd handy-ceylon
npm install
cp .env.example .env.local   # then fill in values — see below
npm run dev                  # http://localhost:3000
```

The landing page runs without Firebase credentials. Firebase modules validate their
configuration lazily and throw a clear error only when a Firebase feature is used.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / serve |
| `npm run lint` | ESLint |
| `npm run typecheck` | Generate route types and run `tsc --noEmit` |
| `npm run emulators` | Firebase Emulator Suite (requires Firebase CLI) |
| `npm run admin:grant -- <email>` | Grant the admin role to an existing user |

## Environment configuration

All variables are documented in [.env.example](.env.example).

| Variable | Exposure | Source |
|---|---|---|
| `NEXT_PUBLIC_FIREBASE_*` | Browser (public by design) | Firebase console → Project settings → Your apps → Web app |
| `NEXT_PUBLIC_USE_FIREBASE_EMULATORS` | Browser | `true` to use local emulators |
| `FIREBASE_ADMIN_PROJECT_ID`, `FIREBASE_ADMIN_CLIENT_EMAIL`, `FIREBASE_ADMIN_PRIVATE_KEY` | **Server only** | Project settings → Service accounts → Generate new private key |
| `FIREBASE_STORAGE_BUCKET` | Server only | Optional override |

Never prefix Admin credentials with `NEXT_PUBLIC_`, and never commit `.env.local` or service-account
JSON files (both are git-ignored). `src/lib/firebase/admin.ts` and `src/config/env.server.ts`
import `server-only`, so importing them from client code fails the build. If the Admin variables are
left empty, the Admin SDK uses Application Default Credentials (e.g. `GOOGLE_APPLICATION_CREDENTIALS`
or Firebase App Hosting).

## Firebase setup

1. **Create a project** at <https://console.firebase.google.com> (region: `asia-south1` (Mumbai) is closest to Sri Lanka).
2. **Register a Web app** and copy its config into the `NEXT_PUBLIC_FIREBASE_*` variables.
3. **Authentication** → enable *Email/Password* (and *Phone* when OTP sign-in is built). Add your
   production domain under *Authorized domains*.
4. **Firestore** → create a database in production mode (`asia-south1`).
5. **Storage** → create the default bucket.
6. **Service account** → generate a private key and copy `client_email` / `private_key` into
   `.env.local` (keep the key on one line with `\n` escapes, wrapped in double quotes).
7. **Deploy rules and indexes:**
   ```bash
   cp .firebaserc.example .firebaserc   # set your project id
   firebase deploy --only firestore:rules,firestore:indexes,storage
   ```
8. **First administrator:** sign up a user, then run `npm run admin:grant -- you@example.com`.

### Local emulators

```bash
npm run emulators   # Auth :9099, Firestore :8080, Storage :9199, UI :4000
```

Set `NEXT_PUBLIC_USE_FIREBASE_EMULATORS=true` and export `FIREBASE_AUTH_EMULATOR_HOST`,
`FIRESTORE_EMULATOR_HOST` and `FIREBASE_STORAGE_EMULATOR_HOST` (see `.env.example`) so the Admin SDK
uses them too.

## Security model (summary)

- Roles live in Firebase custom claims and are set only by server code; users cannot grant themselves
  roles, and `admin` can never be self-selected.
- Lifecycle data (requests, offers, quotations, bookings, reviews) is written only by the server after
  Zod validation, role checks and state-machine checks. Security Rules deny direct client writes.
- Precise addresses are stored separately and visible only to the customer and assigned technician.

## Project structure

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#1-folder-structure).

## Design tokens

Defined in `src/app/globals.css`: teal `primary`, orange `urgent` (for urgent actions only), navy
`foreground`/`navy`, soft neutral `muted`, plus `brand-soft` and `urgent-soft` tints. Headings use
Plus Jakarta Sans, body text uses Inter.
