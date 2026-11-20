# Brandmitra — Product Analysis, Limitations and the MVP We Should Build First

Written for a three-person team of first-year B.Sc. IT students with Android phones,
occasional college computers and close to zero funding.

---

## 1. The honest analysis of the vision

The vision is coherent: **one platform where a small business gets a website, an order
desk, an AI assistant and marketing help**. That is a real market. Cafes, bakeries and
restaurants in India already pay ₹500–₹3,000 per month for pieces of this (a website, a
billing app, a WhatsApp ordering tool, a delivery aggregator commission of 18–30%).

Your advantage is **bundling + price + WhatsApp-first ordering**, not AI for its own sake.
The AI is the reason a two-person cafe can run all of it without hiring anyone.

### What is genuinely strong

| Strength | Why it matters |
| --- | --- |
| Multi-tenant storefront + dashboard in one product | One signup produces a working shop, not a form that says "we'll call you". |
| WhatsApp ordering | In India, WhatsApp *is* the ordering app. Aggregators charge 18–30% commission; direct WhatsApp orders cost near zero. |
| Configurable product customisation | "Large, extra cheese, no onion" is how real food ordering works; generic e-commerce carts can't express it. |
| AI with database-verified prices | This is the difference between a demo and a product that cannot cheat a customer or the owner. |
| Prices/plans in the database | You can change pricing without a developer or a deploy. |

### The five risks that actually kill projects like this

1. **Scope.** The request lists ~90 features. A team of three beginners cannot ship 90
   features; they can ship 6 features well. Everything below is ordered by that reality.
2. **Third-party approval delays.** Meta WhatsApp Business API needs a verified Meta
   Business account, a phone number that is not already on WhatsApp, and template
   approval. Razorpay needs KYC (PAN, bank account, business proof). These take days to
   weeks and **cannot be done by code**. Build the product so it works without them, then
   switch them on.
3. **AI cost and AI lying.** Gemini has a free tier, but it is quota-limited. More
   importantly, an LLM will happily invent "₹299" for a ₹350 pizza. Prices, stock and
   order status must always come from SQL, never from the model.
4. **Security with no database-level safety net.** The preferred stack (Supabase
   Postgres + Row Level Security) gives you a second wall. The stack we can actually run
   and deploy for free right now (Cloudflare D1, which is SQLite) has **no RLS**. That
   means tenant isolation must be enforced in application code, every single query — which
   is exactly how `src/lib/business.ts` is written. This is a real trade-off, not a detail.
5. **Beginner velocity.** Every new technology costs a week of learning. Fewer moving
   parts beats a "correct" architecture the team cannot debug at 1 a.m.

### Things in the brief that must be deferred

Real-time order push, group ordering, gift cards, referrals, abandoned-cart recovery,
AI demand forecasting, custom domains, multi-language storefronts, staff roles, delivery
management, loyalty, PWA offline mode. Each is a phase of its own. **None of them should
block a working shop with a working checkout.**

---

## 2. The recommended MVP

> **A cafe can sign up, get `brandmitra.com/b/its-name`, list 10 items with sizes and
> add-ons, take an order, and see it in a dashboard and a kitchen screen — all on a phone.**

That is the smallest thing a real business would pay for. It is also testable end to end
by three people in about one semester.

### In scope for v1 (Phase 1 → Phase 4 of the roadmap)

1. Email + password accounts, sessions, business onboarding.
2. Generated storefront with brand colour, template, contact details, opening hours.
3. Products, categories, customisation groups (size, toppings, spice level).
4. Cart, checkout, coupon codes, Cash on Delivery / "pay at counter".
5. Orders in the dashboard with the eight statuses, plus a Kitchen Display.
6. Customer records created automatically from orders.
7. One paid integration (Razorpay test mode) and one AI feature (product descriptions),
   switched on only after the core loop works.

### Out of scope for v1

WhatsApp ordering, the AI business agent, marketing studio, admin billing automation,
multi-branch, staff permissions. The database already has tables for all of them — the
schema is ready; the screens are not. **Do not build screens for features you cannot
test with a real business.**

---

## 3. Why restaurants first, and why the schema is still generic

Restaurants are the hardest *product* case (customisation, kitchen workflow, speed) and
the easiest *sales* case (owners are on WhatsApp, decisions are made in one conversation).
If the platform handles a pizza with six options, a clothing store's size/colour matrix is
a simpler version of the same data model.

The generic pieces are already generic in the schema:

- `products` + `customization_groups` + `customization_options` serve pizza toppings,
  saree sizes, cake messages and gym memberships.
- `industry` on `businesses` + `template` on `business_profiles` drive presentation, not
  data structure.
- `orders.status` is a fixed state machine for every industry; a salon's "ready" and a
  bakery's "ready" mean the same thing operationally.

Adding grocery later means new categories and a weight-based price option — not a rewrite.

---

## 4. What "success" looks like in 90 days

| Milestone | Measure |
| --- | --- |
| Product works | One real cafe takes 20 orders through Brandmitra in a week |
| Reliability | Zero reported wrong-price or wrong-total incidents |
| Security | A second test account cannot see the first business's data (tested, documented) |
| Money | First ₹499 subscription collected, even manually via UPI |
| Learning | Each team member can explain and modify the part they own |

**Vanity metrics to ignore:** number of signups, number of features, Instagram followers.
A cafe owner who reorders every month is worth more than 500 signups who never list a
product.

---

## 5. The single most important engineering rule

> A business id is **never** read from a URL, form field, header or cookie.
> It is always looked up from `business_members` for the logged-in user.

Everything else in this codebase follows from that rule. If the team remembers one thing
from this document, it should be this one.
