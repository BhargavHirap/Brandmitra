# Phase 1 — Setup, Testing and Troubleshooting

This is the guide for the team. It assumes you have never run a Next.js project before.
Every command is meant to be copy-pasted.

---

## 1. What Phase 1 delivers

| Feature | Where |
| --- | --- |
| Landing page with live pricing from the database | `src/app/page.tsx` |
| Sign up / sign in / sign out | `src/app/(signup,login)`, `src/app/actions/auth.ts` |
| Business onboarding (creates tenant + profile + branch + free subscription) | `src/app/onboarding/page.tsx`, `src/app/actions/business.ts` |
| Dashboard overview with real numbers and a 7-day chart | `src/app/dashboard/page.tsx` |
| Storefront editor (brand colour, template, contact, social) | `src/app/dashboard/website/page.tsx` |
| Public storefront per business | `src/app/b/[slug]/page.tsx` |
| 27-table database, auto-created | `src/db/schema.ts` |
| Session auth + tenant isolation | `src/lib/auth.ts`, `src/lib/business.ts` |

**Not in Phase 1:** products UI, cart, checkout, orders UI, kitchen, AI, WhatsApp, admin,
billing. Those are Phases 2–7 and are visibly marked as locked in the dashboard nav.

---

## 2. Run it on a phone (Termux) or a college computer

### Option A — a computer with Node

```bash
git clone <your repo url> brandmitra
cd brandmitra
npm install
npm run dev
```

Open <http://localhost:3000>. You need **Node 22.5 or newer** (Node 24 recommended)
because the local database uses the built-in `node:sqlite` module.

```bash
node --version    # must print v22.5.0 or higher
```

If `node --version` is older, install Node with
[nvm](https://github.com/nvm-sh/nvm): `nvm install 24 && nvm use 24`.

### Option B — Android only (Termux, free)

```bash
pkg update && pkg install nodejs-lts git -y
git clone <your repo url> brandmitra
cd brandmitra
npm install
npm run dev
```

Then open `http://localhost:3000` in the phone browser. Termux is slower, but it runs the
same code. Keep the phone charging; `npm install` on a phone can take several minutes.

### Option C — a cloud dev environment (recommended for the team)

Any free cloud IDE with a Node terminal works. Run `npm install && npm run dev`, then open
the forwarded port 3000. If the environment gives you a public URL, put its hostname in
`next.config.ts` under `allowedDevOrigins` or Next.js will refuse cross-origin dev
requests.

---

## 3. First-run walkthrough (5 minutes)

1. Open `/` — the landing page. Scroll to pricing: the five plans come from the `plans`
   table, not from the page code.
2. Click **Start free** → create an account (email + 8-character password).
3. You land on **Create your business**. Enter `Cafe Alpha`, leave the address blank so
   the slug is generated, choose *Cafe*, city `Pune`.
4. The dashboard opens with zeros. **That is correct**: this business has no orders yet.
5. Click **Edit storefront**. Set a tagline, a description, a phone number, a brand colour,
   opening hours. Save.
6. Click **View storefront** — `/b/cafe-alpha` shows your details in your brand colour.
7. Sign out. Try `/dashboard` — you are sent to `/login`.

Change a plan price while you are at it:

```bash
node -e 'const {DatabaseSync}=require("node:sqlite");const d=new DatabaseSync(".data/brandmitra.db");d.prepare("update plans set price_inr = 599 where id = ?").run("starter")'
```

Reload `/` — the Starter price is now ₹599. **Pricing is configuration, not code.**

---

## 4. How to test the important thing: tenant isolation

This is the test that must pass after every change, in every phase.

1. Sign up as `alice@test.com`, create business **Alice Bakery**.
2. In a private window, sign up as `bob@test.com`, create **Bob Cafe**.
3. As Bob, open `/dashboard`: you must see **Bob Cafe**, 0 orders, Bob's storefront link.
4. Try `/dashboard/website` as Bob: Bob's data, not Alice's.
5. Try to open Alice's storefront `/b/alice-bakery`: it is public by design — but there is
   no URL that lets Bob edit it. There is no `?businessId=` anywhere in this app, which is
   exactly why that is true.
6. Sign out of Bob and visit `/dashboard`: redirected to `/login`.

Database-level double check:

```bash
node -e 'const {DatabaseSync}=require("node:sqlite");const d=new DatabaseSync(".data/brandmitra.db");console.log(d.prepare("select name, slug, owner_user_id from businesses").all())'
```

Each business has a different `owner_user_id`, and a different row per member.

---

## 5. Commands you will use

```bash
npm run dev         # development server on http://localhost:3000 (binds 0.0.0.0)
npm run typecheck   # TypeScript errors, no build
npm run build       # production build — run before every deploy
npm start           # run the production build locally
npm run db:sql      # generate db/brandmitra.sql for Cloudflare D1
```

Reset the local database (destroys local data only):

```bash
rm -rf .data && npm run dev
```

---

## 6. Common errors and what they actually mean

| Error | Cause | Fix |
| --- | --- | --- |
| `Local database unavailable: this Node version has no process.getBuiltinModule` | Node older than 22.5 | Install Node 24 (`nvm install 24`) |
| `Module not found: Can't resolve '@/...'` | Wrong import path or missing `paths` in tsconfig | Paths start with `@/` and point inside `src/` |
| `Option 'baseUrl' has been removed` | TypeScript 7 installed | `npm install -D typescript@5.9.3` |
| Page shows `Application error: a server-side exception` | A query failed; read the terminal | The real message is in the terminal, not the browser |
| `UNIQUE constraint failed: businesses.slug` | Two businesses want the same public URL | Slugs are generated with `uniqueSlug()`; do not insert businesses by hand |
| Cookie does not stick / login loops | Dev server on a different hostname than the browser | Use the same host (`localhost` everywhere) and clear cookies |
| `Blocked cross-origin request` in dev | Browser host not in `allowedDevOrigins` | Add the hostname in `next.config.ts` |
| Styles look unstyled | `globals.css` not imported by `app/layout.tsx` | Keep `import "./globals.css"` in the root layout |
| `npm install` fails on Termux | Missing build tools for a native package | `pkg install python make clang` then retry |

**Reading an error properly:** the browser shows a generic message. The terminal running
`npm run dev` shows the stack trace with the file and line. Always look there first.

---

## 7. Deploying (when the team is ready)

Phase 1 runs locally today. For a public URL:

1. Create a site (Freebuff Sites or Cloudflare Workers) and a D1 database named
   `brandmitra`.
2. Bind the database to the Worker as **`DB`** — the app looks for exactly that name.
3. `npm run db:sql`, then `npx wrangler d1 execute brandmitra --remote --file=./db/brandmitra.sql`.
4. Deploy the built app.

**Honest status:** the app has been verified locally (typecheck, production build,
authenticated pages, public storefront). The D1 binding path has **not** been exercised
against a real Cloudflare deployment yet. Treat "works locally" and "works in production"
as two different claims until the first deploy is tested.

---

## 8. For the team: how to split Phase 2

- **M1:** product list screen, product form layout, storefront category tabs and product
  cards. Start from `src/components/ui.tsx` so the design stays consistent.
- **M2:** `src/app/actions/products.ts` (create/update/delete with ownership checks),
  plan-limit enforcement, image upload.
- **M3:** write the Phase 2 acceptance test, take the first cafe's real menu (with photos
  and prices) and use it as the only test data. No lorem ipsum menus.

Definition of done for every screen: works on a 360px-wide phone, shows real data or a
clear empty state, enforces the tenant rule, and leaves an audit row for every write.
