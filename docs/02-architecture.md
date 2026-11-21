# Vantra — Architecture, Stack and Folder Structure

---

## 1. The stack we actually run (and where it differs from the brief)

The brief asked for Supabase + FastAPI. Those are good choices in general, but they need
accounts, keys, a second server and a second deploy pipeline — and a second language for a
beginner team. Phase 1 therefore uses **one language, one framework, one deploy target**.
Each substitution is reversible; nothing in the app is locked in.

| Brief asked for | We use now | Why | What it costs us later |
| --- | --- | --- | --- |
| Next.js + React + Tailwind | **Same** (Next 15 App Router, React 19, Tailwind 4) | Matches the brief; server components let pages query the DB directly. | — |
| Python FastAPI backend | **Next.js server actions + server components** | No separate service, no API keys between frontend and backend, no CORS, one deploy. | If a background job or a heavy ML task appears, add a small worker then; the DB is already the contract. |
| Supabase Postgres + RLS | **Cloudflare D1 (SQLite) in production, `node:sqlite` locally** | Free, no server to manage, deploys with the site, identical SQL both places. | **No Row Level Security.** Isolation is enforced in code (see §4). Moving to Postgres later means porting SQL, not the app's shape. |
| Supabase Auth | **Own email/password auth** (PBKDF2-SHA256, 100k iterations) | No external keys; customers need accounts anyway; testable offline. | You own password reset, email verification and 2FA. Add them deliberately. |
| Supabase Storage | **Not wired yet** — product images are URLs | Phase 2 will add R2 (free tier) behind a small upload action. | Image uploads are the one gap a real business notices immediately; schedule it early in Phase 2. |
| Gemini API | **Planned, not integrated** | Requires a key and usage limits; Phase 5. | The AI features are honestly labelled "Phase 5" rather than faked. |
| Vercel | **Freebuff Sites / your own Cloudflare account** | Deploys Worker + assets free; D1 is already Cloudflare. | Vercel works too, but then the database and the app live in two vendors. |
| Razorpay / WhatsApp Cloud API | **Planned, not integrated** | Both need business verification. | Orders currently work on Cash on Delivery only. |

**Current cost of the running system: ₹0.** See `05-free-vs-paid.md`.

---

## 2. Request flow (what happens when an owner opens the dashboard)

```
Browser
  │  GET /dashboard + Cookie: bm_session=<token>
  ▼
Next.js server component (src/app/dashboard/page.tsx)
  │  requireBusiness()
  │    ├─ getCurrentUser()      → sessions JOIN users  (token hashed in SQL, SHA-256)
  │    ├─ getMembership(user)   → business_members JOIN businesses   ← the tenant id
  │    └─ status check          → suspended? redirect /suspended
  ▼
getDb()  →  D1 binding (production)  |  node:sqlite file (local)
  ▼
SQL with `WHERE business_id = ?`  ← always this business's id, never the URL's
  ▼
HTML streamed to the browser
```

Mutations go through **server actions** (`src/app/actions/*.ts`). A form posts to the
server; the action re-derives the tenant, validates every field, writes, appends an
`audit_logs` row, then redirects. There is no public write API to abuse, and no secret
ever reaches the browser.

---

## 3. Folder structure

```
brandmitra/
├─ src/
│  ├─ app/
│  │  ├─ layout.tsx                 root HTML shell, metadata, PWA manifest
│  │  ├─ globals.css                design tokens + .btn/.field/.card classes
│  │  ├─ page.tsx                   public landing page (pricing read from DB)
│  │  ├─ login/page.tsx             sign in
│  │  ├─ signup/page.tsx            create account
│  │  ├─ onboarding/page.tsx        create the business (one per owner in Phase 1)
│  │  ├─ suspended/page.tsx         shown when a business is suspended
│  │  ├─ dashboard/
│  │  │  ├─ layout.tsx              sidebar + topbar + tenant guard for every page
│  │  │  ├─ page.tsx                Overview: revenue, orders, 7-day chart, checklist
│  │  │  └─ website/page.tsx        storefront editor (brand, contact, social)
│  │  ├─ b/[slug]/page.tsx          PUBLIC storefront for one business
│  │  └─ actions/
│  │     ├─ auth.ts                 signUp / signIn / signOut
│  │     └─ business.ts             createBusiness / updateStorefront
│  ├─ components/
│  │  ├─ brand.tsx                  logo mark + wordmark
│  │  ├─ auth-shell.tsx             shared login/signup frame + error text
│  │  ├─ dashboard-nav.tsx          client nav, later phases shown locked with a badge
│  │  ├─ color-field.tsx            colour picker synced with the hex input
│  │  └─ ui.tsx                     PageHeader / Stat / Panel / EmptyState
│  ├─ db/
│  │  └─ schema.ts                  THE schema: 27 tables + plan seed (single source of truth)
│  └─ lib/
│     ├─ db.ts                      Db interface, D1 + node:sqlite drivers, auto schema apply
│     ├─ auth.ts                    hashing, sessions, getCurrentUser, requireUser
│     ├─ business.ts                requireBusiness, uniqueSlug, logAudit
│     ├─ industries.ts              business types, starter categories
│     └─ format.ts                  money/date formatting, initials
├─ db/brandmitra.sql                generated by `npm run db:sql` (for wrangler d1 execute)
├─ scripts/emit-schema.mjs          reads schema.ts and writes the .sql file
├─ docs/                            these documents
├─ public/manifest.webmanifest      PWA basics
└─ next.config.ts                   allowed dev origins for the cloud preview
```

**Rule of thumb for the team:** `src/app` = screens, `src/app/actions` = writes,
`src/lib` = reusable logic, `src/db` = the schema. If a file does not fit one of those, it
probably should not exist yet.

---

## 4. Tenant isolation without RLS

D1 is SQLite; SQLite has no row-level security. So the guarantee is structural:

```ts
// src/lib/business.ts
export async function requireBusiness(): Promise<MembershipContext> {
  const user = await requireUser();

  // The ONLY source of a business id: the membership table, keyed by the session user.
  const row = await db.first(
    `SELECT b.*, m.role, s.plan_id
       FROM business_members m
       JOIN businesses b ON b.id = m.business_id
       LEFT JOIN subscriptions s ON s.business_id = b.id
      WHERE m.user_id = ?
      ORDER BY m.created_at ASC LIMIT 1`,
    [user.id],
  );

  if (!row) redirect("/onboarding");
  if (row.status === "suspended") redirect("/suspended");
  return { user, business: row, role: row.role, planId: row.plan_id ?? "free" };
}
```

Every page and action begins with `await requireBusiness()` and every query passes
`business.id`. Consequences:

- A logged-in owner **cannot** ask for another business's data, because their request
  never contains a business id.
- The public storefront (`/b/[slug]`) is the only unauthenticated read, and it selects
  only customer-facing columns by public slug — never orders, customers or staff.
- The platform admin (Phase 7) will need cross-tenant reads; that is a **separate**
  explicit helper, not a relaxation of this one.

**The test that must never fail:** create two accounts, two businesses, then try
`/dashboard` while signed in as user B after user A created data. You must see B's zeros,
not A's numbers. Repeat for every new page in every phase.

Additional rules already enforced in code:

- Passwords: PBKDF2-SHA256, 100k iterations, 16-byte random salt, constant-time compare.
- Sessions: 32 random bytes, stored **hashed** (SHA-256) in `sessions`, httpOnly +
  sameSite=lax cookie, `secure` in production, 30-day expiry.
- Money: integer rupees, so `0.1 + 0.2` style drift cannot happen.
- Every write validates its own inputs; the brand colour is regex-checked before it is
  stored and used in inline styles.
- Audit rows are appended for signup, business creation and storefront edits — the same
  table the AI agent will write to in Phase 5.

---

## 5. Scaling path (when you actually need it)

1. **More traffic** → D1 handles read-heavy small-business traffic well; add indexes
   (already present on `business_id`, status and dates) before adding infrastructure.
2. **Images** → R2 + a signed upload action; never store base64 in SQLite.
3. **Real-time orders** → Durable Object or a short polling interval (10s) on the kitchen
   screen. Polling is cheaper and easier to reason about; start there.
4. **AI** → keep the model behind one module (`src/lib/ai.ts` later) with a single
   function per capability, so Gemini can be swapped for another provider without touching
   product code.
5. **Postgres + RLS** → only if you need multi-region or analytical SQL. The schema ports;
   `src/lib/db.ts` is the only file that knows the driver exists.

---

## 6. Why the UI is built the way it is

- **Design tokens first** (`@theme` in `globals.css`): charcoal `#0b0b0f`, off-white
  `#f6f7f9`, electric blue `#2F6BFF`. No page hardcodes a random hex value.
- **Mobile-first**: the dashboard sidebar becomes a horizontal chip nav under `lg`; every
  form is single-column until `sm`.
- **Locked, not fake**: features not built yet appear in the nav with a `P2`/`P6` badge
  instead of a page that pretends to work.
- **No data theatre**: a business with no orders sees zeros and an explanation, never
  invented charts. This is a hard rule for every later phase.
