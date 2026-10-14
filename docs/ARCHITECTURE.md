# Handy Ceylon — Architecture

Home-services and technician-booking marketplace for Sri Lanka.
Currency **LKR** (stored as integer cents) · time zone **Asia/Colombo** · locale `en-LK`.

## 1. Folder structure

```
src/
  app/                      Routes only — thin pages that compose features
    (marketing)/            Public site: landing + placeholder CTA pages
    api/account/onboard/    Route Handler: assigns the initial role (Admin SDK)
    error.tsx, not-found.tsx
  components/
    ui/                     shadcn/ui primitives (generated; customise sparingly)
    layout/                 Container, Logo, SiteHeader, SiteFooter, SectionHeading
    feedback/               StatusMessage (empty / error / unavailable states)
  config/
    site.ts                 Brand, locale, currency, time zone, route map
    env.client.ts           Zod-validated public Firebase config (lazy)
    env.server.ts           Zod-validated Admin credentials (server-only)
  features/                 Domain modules — business logic lives here, not in UI
    auth/                   roles, Zod schemas, server/ (token verification, onboarding)
    bookings/               booking modes, statuses, state machine, request/quote schemas
    services/               launch service catalogue
    landing/components/     Landing-page sections
  lib/
    firebase/client.ts      Browser SDK (Auth, Firestore, Storage, emulator support)
    firebase/admin.ts       Admin SDK — `server-only`
    firestore/collections.ts  Collection/subcollection names
    firestore/models.ts     Typed document shapes with field ownership
    api/responses.ts        Domain error → JSON response mapping
    format.ts               LKR and Asia/Colombo formatting
    utils.ts                `cn()` class merging
firestore.rules · storage.rules · firestore.indexes.json · firebase.json
scripts/grant-admin.mjs     The only way to create an administrator
```

Future features slot in as `src/features/<domain>/{components,server,schemas.ts,...}`
with routes under `src/app/(customer)`, `(technician)` and `(admin)` route groups.

## 2. Firebase architecture

| Concern | Where | Notes |
|---|---|---|
| Sign-in | Firebase Auth (browser SDK) | Email/password + phone OTP planned. |
| Roles | Custom claims `{ role, technicianVerified }` + `users/{uid}.role` mirror | Set **only** by the Admin SDK. |
| Reads | Browser SDK, gated by `firestore.rules` | Realtime lists for dashboards, chat. |
| Privileged writes | Route Handlers / Server Actions using `lib/firebase/admin.ts` | Validate with Zod, verify ID token, check role, check state transition, write in a transaction. |
| Direct client writes | Only: own profile's non-privileged fields, chat messages, notification `read` flag | Field lists enforced in rules. |
| Files | Cloud Storage, uploader-scoped paths | Request media shared with technicians via short-lived signed URLs from the server. |
| Background work (next phase) | Cloud Functions / scheduled jobs | Request expiry, quotation expiry, rating aggregation, notifications. |

Server identity: `getUserFromRequest()` verifies `Authorization: Bearer <ID token>` with
revocation checks. Once session cookies are added, the same Data Access Layer will read
them instead — UI code never decides authorization.

## 3. Firestore data model

| Collection | Key | Purpose | Read | Client write |
|---|---|---|---|---|
| `users/{uid}` | uid | Account, role mirror, status | self, admin | self: `displayName`, `photoURL` |
| `users/{uid}/notifications/{id}` | auto | In-app notifications | self | self: `read` only |
| `customerProfiles/{uid}` | uid | Saved addresses | self, admin | self: addresses |
| `technicianProfiles/{uid}` | uid | Public profile, categories, districts, rating | public if approved; self; admin | self: bio, categories, districts, availability |
| `technicianPrivate/{uid}` | uid | NIC, verification docs | self, admin | — |
| `serviceCategories/{id}` | slug | Catalogue | public | — (admin via server) |
| `serviceRequests/{id}` | auto | Customer request, any mode; city/district + approx geohash only | owner, assigned tech, verified techs while `open`, admin | — |
| `serviceRequests/{id}/private/location` | fixed | Precise address | owner, assigned tech, admin | — |
| `serviceRequests/{id}/offers/{techId}` | tech uid | Urgent acceptance or inspection-fee offer | request owner, that tech, admin | — |
| `quotations/{id}` | auto | Itemised quote, versioned | its customer & technician, admin | — |
| `bookings/{id}` | auto | Engagement after assignment | participants, admin | — |
| `bookings/{id}/statusHistory/{id}` | auto | Append-only audit log | participants, admin | — |
| `conversations/{id}` | auto | Chat thread per request/booking | participants, admin | — |
| `conversations/{id}/messages/{id}` | auto | Messages | participants | participants: create only, `senderId == uid` |
| `reviews/{bookingId}` | booking id | One review per completed booking | public | — |

Relationships:

```
users 1─1 customerProfiles | technicianProfiles (+ technicianPrivate)
customer 1─* serviceRequests ─* offers (one per technician)
serviceRequests 1─* quotations (versioned via previousQuotationId)
serviceRequests 1─0..1 bookings ─1 conversation ─* messages
bookings ─0..1 acceptedQuotation; bookings 1─0..1 reviews → technicianProfiles.rating*
```

Document shapes with per-field ownership: `src/lib/firestore/models.ts`.

## 4. Role-based authorization

* Roles: `customer`, `technician`, `admin`.
* On first sign-in the client calls `POST /api/account/onboard` with `customer` or `technician`.
  The schema rejects `admin`; the server refuses if a role already exists and writes both the
  custom claim and `users/{uid}` in a transaction (idempotent retry if claim-setting fails).
* Technicians start with `technicianVerified: false` and `verificationStatus: "pending"`;
  only verified technicians can see open requests. Admin approval sets both.
* Admins are created only with `npm run admin:grant -- <email>` using service-account credentials.
* Defence in depth: Security Rules (data layer) + server checks (`requireRole`, state machine).
  Front-end role checks are for UX only.

## 5. Status transitions

Implemented in `src/features/bookings/state-machine.ts` (`assertTransition` before every write).

**Service request:** `open → assigned | cancelled (customer/admin) | expired (system)`

**Offer:** `pending → selected (customer) | declined (system) | withdrawn (technician) | expired (system)`

**Quotation:** `submitted → accepted | rejected (customer) | withdrawn (technician) | superseded | expired (system)`

**Booking** (created at `scheduled` when a technician is assigned):

```
scheduled ─▶ en_route ─▶ on_site ─┬─▶ quotation_pending ─┬─▶ quotation_approved ─▶ in_progress ─▶ completed
   │            │                 │   (visit modes, or    └─▶ closed_without_work      │              │
   └─cancel─────┘                 │    online re-scope)       (customer declines)      └─▶ disputed ◀─┘
                                  └─▶ in_progress (quote_online only: accepted quote covers scope)
disputed ─▶ completed | cancelled (admin)
```

| Workflow | Path |
|---|---|
| **Get Help Now** (`urgent`) | request `open` → first verified technician accepts (offer `selected`) → booking `scheduled` → `en_route` → `on_site` → technician submits quotation → `quotation_pending` → customer approves → `in_progress` → `completed` |
| **Technician Visit** (`quote_visit`) | request `open` → technicians submit inspection-fee offers → customer selects one (others `declined`) → booking `scheduled` (fee recorded) → … same as urgent from `en_route` |
| **Quote Online** (`quote_online`) | request `open` with media → technicians submit quotations → customer accepts one (others `rejected`) → booking `scheduled` with `acceptedQuotationId` → `en_route` → `on_site` → `in_progress` (or revised quotation if scope differs) → `completed` |
