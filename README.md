# Brandmitra

**The AI operating system for modern businesses.**

Brandmitra gives a small business its own storefront, order desk, customer tools and AI
assistant from a single signup — multi-tenant, mobile-first, built to expand from
restaurants to any retail category.

This repository is a **working application**, not a mockup. Phases 1–4 are complete and testable;
Phase 5 is partly built (AI copy, the read-only business agent and the marketing studio).

**Live site:** https://brandmitra-u2gvs6.freebuff.site — Next.js on Cloudflare Workers with a
D1 database. Sign up, create a business and your storefront opens at `/b/<your-slug>`.

---

## Quick start

```bash
npm install
npm run dev          # http://localhost:3000
```

Requirements: **Node 22.5+** (Node 24 recommended — the local database uses the built-in
`node:sqlite` module). No API keys, no external accounts, no paid services.

The database creates itself on first request at `.data/brandmitra.db`.

```bash
npm run typecheck    # TypeScript check
npm run build        # production build
npm run db:sql       # emit db/brandmitra.sql for Cloudflare D1
```

---

## Deploy on every push

`.github/workflows/deploy.yml` builds and deploys the app to Cloudflare Workers on every push
to `main` — no manual deploy step, free plan, no credit card. It stays skipped until the
repository has a `CLOUDFLARE_ACCOUNT_ID` variable, so pushes never go red before setup.

One-time setup: create a free Cloudflare account, a D1 database and a KV namespace, then either
let **Cloudflare Workers Builds** build the repo on every push (no token needed), or add one
GitHub secret and three variables for the Actions route. The step-by-step, phone-friendly
version of both is [Deploy on every push](docs/13-deploy-on-push.md).

Freebuff Sites (the `freebuff.site` address) has no push-to-deploy hook, so that site is still
published with the **Publish** button. Both are documented in the same guide.

---

## What works today (Phases 1–4, plus Phase 5 AI features)

- Marketing landing page with pricing read from the database
- Email + password auth (PBKDF2-SHA256, hashed session tokens, httpOnly cookies)
- Business onboarding: tenant, profile, branch and Free subscription created atomically
- Dashboard overview: revenue, orders, today/month, 7-day chart, setup checklist,
  top products, audit trail — every figure from this business's own rows
- Storefront editor: brand colour, template, description, contact, hours, social links
- Catalogue: add, edit and delete products with prices, compare-at prices, image URLs,
  visibility and stock switches; plan product limits enforced server-side
- Categories: add, rename, reorder and delete; they become the storefront tabs
- Customisation options: required/optional groups (pick one or pick many) with per-option
  surcharges, e.g. Size (Small / Medium +₹40 / Large +₹80) and Add-ons
- Public per-business storefront at `/b/<slug>` with category tabs, product cards, prices
  and the options for each item
- Cart and checkout: customers pick options, change quantities and place a cash-on-delivery
  or pay-at-store order from their phone, with no JavaScript required
- Order receipt on an unguessable private link, showing items, options, total and live status
- Order desk in the dashboard: status filters, itemised orders, customer contact, and a
  server-enforced status workflow (new → accepted → preparing → ready → delivered)
- Kitchen display at `/dashboard/kitchen`: New / Preparing / Ready columns, big touch targets,
  self-refreshing every 10 seconds, with one-tap status moves that the server validates
- AI product copy (needs a free `GEMINI_API_KEY`): draft a product description or an Instagram
  caption, edit it, copy it, or save the description — the model never sees or writes a price,
  and every draft is metered against your plan's credits
- Read-only AI business agent at `/dashboard/agent` (same key): answers eight fixed questions
  about today's orders, this week's sales, best sellers, open tickets, top customers and the
  catalogue. The AI only chooses a report and rewords its numbers — it never writes SQL, never
  changes a record, and refuses anything about changing a price
- AI marketing studio at `/dashboard/marketing` (same key): draft an Instagram post or a WhatsApp
  broadcast from your catalogue, read it in a channel preview, edit it, and only then approve it —
  drafts are never stored, prices are filtered out of the text, and nothing is auto-posted
- 27-table schema covering the whole product roadmap
- Tenant isolation enforced in code (`src/lib/business.ts`) — a business id is never read
  from a URL or form

## Not built yet (honest list)

Online payments (Razorpay), coupons, delivery fees, WhatsApp Cloud API, admin dashboard,
billing, and kitchen extras (chime, browser notifications, printing). They are marked as locked
with phase badges inside the dashboard, and they are **not** simulated anywhere. AI copy, the
read-only agent and the marketing studio are built but stay disabled until `GEMINI_API_KEY` is
set — without the key those screens say so instead of inventing answers.

Third-party integrations have **not** been configured or tested — they need keys and, for
WhatsApp and Razorpay, business verification.

---

## Documentation

| Document | What it covers |
| --- | --- |
| [Product analysis & MVP](docs/01-product-analysis.md) | Vision, risks, what to build first, what to defer |
| [Architecture](docs/02-architecture.md) | Stack decisions, deviations from the brief, folder structure, security |
| [Database](docs/03-database.md) | All 27 tables, relationships, isolation rules, money handling |
| [Roadmap](docs/04-roadmap.md) | Phases 1–8 with acceptance tests, owners and effort |
| [Free vs paid](docs/05-free-vs-paid.md) | Every service, its free tier and its real limits |
| [Phase 1 guide](docs/06-phase-1-guide.md) | Setup, first-run walkthrough, testing, errors, deployment |
| [Phase 2 guide](docs/07-phase-2-guide.md) | Catalogue workflow, customisation options, storefront behaviour, how to test it |
| [Phase 3 guide](docs/08-phase-3-guide.md) | Cart, checkout, money rules, order statuses, test orders |
| [Phase 4 guide](docs/09-phase-4-guide.md) | Kitchen board, auto-refresh, touch targets, advance rules |
| [Phase 5 guide](docs/10-phase-5-guide.md) | AI copy, the price filter, Gemini setup, credits |
| [Phase 5 agent guide](docs/11-phase-5-agent-guide.md) | Read-only business agent: the eight reports, the SQL guard, price-change refusals |
| [Phase 5 marketing guide](docs/12-phase-5-marketing-guide.md) | Marketing studio: draft → preview → approve, the double price filter, campaign storage |
| [Deploy on every push](docs/13-deploy-on-push.md) | Cloudflare account setup, GitHub secrets/variables, what runs on a push, failure messages |

---

## Stack

Next.js 15 (App Router) · React 19 · Tailwind CSS 4 · TypeScript · Cloudflare D1 (SQLite) in
production, `node:sqlite` locally · server actions for all writes · PWA manifest.

Chosen for one reason: **one language, one framework, one deployable unit, zero fixed
cost** — so three beginners can run it, debug it and afford it.

Optional: a free Google Gemini key enables AI copy, the business agent and the marketing studio.
Copy `.env.example` to `.env.local` and add `GEMINI_API_KEY`; nothing else in the app needs it.
