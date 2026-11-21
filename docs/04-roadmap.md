# Vantra — Development Roadmap

Eight phases. Each one ends with something a real business can use, and each one can be
demoed without the next. **Do not start a phase before the previous one passes its
acceptance test** — that rule is what keeps a three-person team from having nine
half-built features.

Team roles used below:

- **M1 — UI/UX** (frontend, storefront, design system)
- **M2 — Backend** (database, auth, orders, AI integration)
- **M3 — Business** (testing, documentation, pilot customers, support)

Everyone learns all three areas; these are owners, not walls.

---

## Phase overview

| Phase | Name | Outcome | Rough effort |
| --- | --- | --- | --- |
| 1 | Foundation | Signup → onboarding → dashboard → editable storefront | 1–2 weeks |
| 2 | Catalogue | Owner lists products, categories, customisation; storefront shows them | 2 weeks |
| 3 | Commerce | Customer orders end to end; owner manages orders | 3 weeks |
| 4 | Kitchen | Live order board + status updates + notifications | 1–2 weeks |
| 5 | AI | Descriptions, marketing studio, business agent (read-only first) | 3 weeks |
| 6 | WhatsApp | Official Cloud API webhook + conversational ordering | 3 weeks |
| 7 | Admin & billing | Super-admin, plans, Razorpay subscriptions | 2–3 weeks |
| 8 | Launch hardening | Security pass, load check, backups, pilot launch | 2 weeks |

---

## Phase 1 — Foundation ✅ (built, see `06-phase-1-guide.md`)

**Objective:** a business can register, describe itself, and get a public page.

**Acceptance test**
1. Sign up with a new email → lands on onboarding.
2. Create "Cafe Alpha" → dashboard opens showing zeros, not fake data.
3. `/b/cafe-alpha` renders the business with its brand colour.
4. Edit the storefront → the public page changes immediately.
5. Sign out → `/dashboard` redirects to `/login`.
6. Second account sees its own empty dashboard, never the first business.

**Files:** see the tree in `02-architecture.md`.

---

## Phase 2 — Website builder & catalogue ✅ (built, see `07-phase-2-guide.md`)

**Objective:** the storefront becomes a real menu, and the owner can manage it from a phone.

**Built**
- `src/app/dashboard/products/page.tsx` — list, name search, category filter, live/hidden
  toggle, plan usage meter.
- `src/app/dashboard/products/new/page.tsx` — create form.
- `src/app/dashboard/products/[id]/page.tsx` — edit form, customisation groups + options,
  two-step delete.
- `src/app/dashboard/categories/page.tsx` — add, rename, reorder (up/down), delete.
- `src/app/actions/products.ts` — 14 server actions, every statement scoped by `business_id`.
- Product images: paste an https URL, validated server-side (upload needs R2, deferred).
- Storefront: category tabs, per-category sections, “from” price, option lists per product.

**Rules kept**
- `plans.product_limit` enforced on create. Products are now uncapped: every plan stores a
  ceiling far above real use (1,000,000) and the screens say "Unlimited". The check itself was
  tested earlier with a seeded limit of 10.
- Slugs generated server-side, unique per business, never asked from the user.
- Prices parsed, rounded and range-checked server-side; the form value is never trusted.

**Acceptance:** an owner adds items with options on a phone, and a customer sees them on the
storefront. Verified on 20 Nov 2026 with real form posts against a production build:
create → edit → add group/option → delete, plan-limit refusal, category life cycle, and a
forged cross-tenant update (rejected, other business untouched).

**Open from the original plan:** R2 image upload (URLs for now) and “the price for every
combination” — that calculation belongs to the Phase 3 cart; the storefront today shows the
base price plus each option's surcharge.

**Common errors:** a product edit that redirects to `?error=missing` means the id does not
belong to the logged-in business (by design). `UNIQUE(slug)` violation → let the server
generate the slug; do not add a slug field to the form.

---

## Phase 3 — Commerce ✅ (built, see `08-phase-3-guide.md`)

**Objective:** a customer orders and the owner sees a real order.

**Built**
- Public cart with a per-business cookie (`bm_cart_<businessId>`, 14 days), so a visitor can
  hold one open cart per shop.
- Add-to-cart on every storefront card: option radios/checkboxes, quantity, plain HTML —
  works without JavaScript.
- `src/lib/cart.ts` — recomputes every line from live product and option rows.
- `src/app/actions/cart.ts` — add, update quantity, remove, empty; validates required,
  minimum and maximum picks, and that each option belongs to the product's group.
- Checkout at `/b/<slug>/cart` — name, phone, note, cash on delivery or pay at store.
- `src/app/actions/orders.ts` — per-business order numbers (`BM-1001`…), price re-check,
  item snapshots, customer upsert, audit entry.
- Customer receipt at `/b/<slug>/order/<uuid>` — unguessable link, no phone-check needed.
- Owner side: `/dashboard/orders` with status filters and counts, `/dashboard/orders/<id>`
  with items, customer, note and the allowed status actions.
- `src/lib/orders.ts` — the status graph (new → accepted → preparing → ready → delivered),
  enforced on the server, not just hidden in the UI.

**Acceptance:** verified on 20 Nov 2026 against a production build: add to cart with options,
quantity change, checkout, receipt and dashboard order all correct; a tampered `total` field
was ignored (₹750 recorded, not ₹1); a double submit produced one order; another business
received 404 for both the receipt and the dashboard order; an out-of-stock option blocked
checkout.

**Not built yet:** Razorpay or any online payment (orders record COD / pay-at-store and stay
`pending` until cash reconciliation in Phase 7), coupons, delivery fees and addresses,
inventory decrement, and the kitchen display (Phase 4).

**Common errors:** “that status change is not allowed” → the transition graph refused it;
reload the order. Checkout says the cart is empty → the cart cookie was cleared or the order
was already placed.

---

## Phase 4 — Kitchen display ✅ (built, see `09-phase-4-guide.md`)

**Objective:** the kitchen works from a tablet/phone, not paper.

**Built**
- `src/app/dashboard/kitchen/page.tsx` — three columns: New (new), Preparing (accepted +
  preparing), Ready (ready); oldest ticket first; item lines with quantity and options, the
  customer note, payment and total; an age pill that turns amber at 15 minutes and red at 30.
- `src/components/kitchen-refresh.tsx` — `router.refresh()` every 10s, manual refresh, pause,
  and an immediate refresh when the tab becomes visible again. No websocket needed.
- `src/app/actions/orders.ts` — `kitchenAdvanceAction`: same transition graph, one conditional
  `UPDATE … AND status = ?` so a double tap or a second tablet cannot move an order two steps.
- Big touch targets (52px primary, 46px secondary) and an explicit **Handed over** vs **Out for
  delivery** choice on ready tickets.
- The transition graph gained **new → preparing** so the kitchen can start cooking without a
  separate “accept” tap; new → ready and new → delivered are still refused.

**Acceptance:** verified on 20 Nov 2026 against a production build with 28 checks — two tenants,
columns and buttons, delivered/cancelled tickets hidden, another business's ticket invisible and
un-advanceable, every legal move audited, illegal jumps and duplicate taps refused, signed-out
redirect to `/login`.

**Deferred:** a chime / browser notification and unread badge (the `notifications` table exists,
unused — a device-testing item, not a simulation), kitchen printing, per-station routing and
prep-time estimates.

---

## Phase 5 — AI features 🟡 (parts 1–3 built, see `10-phase-5-guide.md`,
`11-phase-5-agent-guide.md` and `12-phase-5-marketing-guide.md`)

**Objective:** AI that is useful, cheap and cannot lie about money.

**Built so far — product copy**
- `src/lib/ai.ts` — Gemini REST call (no SDK), prompt building, the price filter and the
  credit meter. Provider-swappable: one `callGemini` function to replace.
- `src/app/actions/ai.ts` — `generateProductCopyAction` (owner-triggered, metered, validates
  product ownership) and `saveProductDescriptionAction` (the only write, description column only).
- `src/components/ai-copy-panel.tsx` — “Write with AI” on the product page: draft a description
  or an Instagram caption, edit it, copy it, or save the description explicitly.
- **Prices are structurally excluded:** the query never selects a price column, the prompt never
  receives one, and `stripPriceClaims()` deletes any sentence with currency, “price”,
  “discount”, “% off”, “free” or urgency wording. A draft that is all price talk is discarded.
- Credits: one `ai.generated` audit row per successful draft, capped at `plans.ai_credits` per
  calendar month.

**Verified on 20 Nov 2026** against a production build with a local Gemini-shaped stub: 24 HTTP
checks (missing key, draft, price-sentence removal, caption, credit rows, monthly cap, cross-tenant
product id) plus a browser walkthrough of “Draft a description” → “Use as description” (saved,
price untouched, audit row written). **The real Google endpoint was not called** — no key exists in
this workspace.

**Built — read-only business agent**
- `src/lib/agent.ts` — eight reports (orders today, last 7 days, this month, open orders, best
  seller, top customers, catalogue summary, products not selling). Each is a hand-written
  `SELECT` scoped by `business_id`; the model only chooses a report id, never SQL.
- `isSelectOnly()` checks every statement before it runs, and the agent module has no write path
  at all — no `db.run`, no update, no delete.
- Money changes are refused in plain code before the model is called (“apply a 90% discount”,
  “set the price to 10”), logged as `ai.refused`, and cost no credit.
- Number guard: a reworded answer containing a number that is not in the report is discarded in
  favour of the report's own sentence.
- `src/components/agent-chat.tsx` + `/dashboard/agent` — question box, suggestion chips, the
  answer with the facts that were read, and the remaining credits.
- Metered like AI copy: one `ai.generated` audit row per answered question.

**Verified on 20 Nov 2026** with 24 HTTP checks against a production build and a
Gemini-shaped stub: two tenants, real answers, both refusal styles, no model call on a refusal,
no cross-tenant numbers, an invented number being discarded, the credit cap, and the no-key setup
card. The real Google endpoint was not called.

**Built — marketing studio**
- `src/lib/marketing.ts` — Instagram and WhatsApp campaign prompts, JSON parsing, the shared
  `stripPriceClaims()` filter and the campaign list query.
- `src/app/actions/marketing.ts` — `generateCampaignAction` returns a draft and writes nothing;
  `saveCampaignAction` is the only write, and filters the posted text again before inserting.
- `src/components/marketing-studio.tsx` + `/dashboard/marketing` — brief, channel and product
  picker, channel preview, editable draft, **Approve & save** or discard, plus the approved list.
- `marketing_campaigns` rows are written with `status = 'approved'` only after the click; drafts
  are never stored and nothing is auto-posted.

**Verified on 20 Nov 2026** with 29 HTTP checks against a production build and a Gemini-shaped
stub: a real draft with a price sentence stripped, no campaign row before approval, the approval
storing the price-free text and auditing it, a tampered price post refused, a forged product id
refused before any model call, and two tenants seeing only their own campaigns. The real Google
endpoint was not called.

**Remaining**
- Write actions ("add a product") only after the read path is trusted: the model returns
  structured JSON, the server validates it against the schema, the owner confirms, then
  the normal server action runs and writes an `audit_logs` row with `actor_type='ai'`.
- Voice input: browser `SpeechRecognition` where available; otherwise record and send to a
  speech-to-text API. Label it "beta" until tested in Marathi/Hindi.

**Hard rules**
- The model never sees or returns a price it can change. It receives prices as context and
  must quote them back; the server re-reads them before any write.
- Every AI call is metered against `plans.ai_credits`.
- A prompt injection in a customer message must not be able to trigger an owner action.

**Acceptance:** 20 scripted questions produce 20 correct answers from real data; one
attempt to make the agent "apply a 90% discount" is refused. The refusal half is built and
verified; the 20-question scripted run still needs the live model (no key in this workspace).

---

## Phase 6 — WhatsApp

**Objective:** customers order on WhatsApp; the order lands in the same dashboard.

**Prerequisites (business work, not code):** Meta Business account verified, a phone
number not registered on WhatsApp, a permanent System User token, a webhook URL with a
verify token, and approved message templates.

**Build**
- `GET /api/whatsapp/webhook` — verification handshake.
- `POST /api/whatsapp/webhook` — signature check (`X-Hub-Signature-256`), then enqueue.
- Conversation state machine in `conversations.state`: browse → choose item → options →
  quantity → confirm → order.
- Deterministic ordering: the AI only interprets intent; the price/cart/order steps are
  plain code with database reads.
- Explicit confirmation before creating an order; order summary echoed back.
- Hindi/Marathi: prompt-level language selection; keep the deterministic steps
  language-independent.

**Acceptance:** a full order placed from a real phone appears in the dashboard with the
correct options and total, and a duplicate webhook delivery does not create a second order.

**Common errors:** webhook retries cause duplicates → store the WhatsApp message id and
ignore repeats. 24-hour session window → use approved templates outside it.

---

## Phase 7 — Admin and billing

**Objective:** you can run the business: see tenants, change plans, suspend abuse, collect
money.

**Build**
- `/admin` with `is_platform_admin` guard (separate layout, separate guard function).
- Businesses list, plan change, suspend/reactivate, usage per business.
- Plan editor writing to `plans` (prices configurable, as required).
- Razorpay subscriptions: order → verify signature → activate `subscriptions` row →
  webhook for renewals/failures.
- Platform stats: signups, active businesses, orders/day, AI credits consumed.
- Support inbox: a simple `support_requests` table + list.

**Acceptance:** suspending a business immediately blocks its dashboard and storefront;
changing a plan price in admin changes the landing page price.

---

## Phase 8 — Launch hardening

**Objective:** survive your first ten real customers.

**Do**
- Tenant-isolation test suite across every page (two accounts, scripted).
- Rate-limit login and signup; add password reset by email.
- Backups: scheduled D1 export; document restore.
- Error monitoring (free tier) and a real 404/500 page.
- Mobile pass on a ₹8,000 Android phone, not just a desktop browser.
- Performance: storefront first load under 2s on 4G.
- One pilot business for two weeks; fix only what they actually hit.

---

## What to tell a customer at each stage

| Stage | Honest pitch |
| --- | --- |
| After Phase 3 | "Your menu and orders, online, commission-free, ₹499/month." |
| After Phase 5 | "…and it writes your Instagram posts." |
| After Phase 6 | "…and customers can order on WhatsApp." |

Selling before the phase exists is how startups lose their first customer's trust. Sell
what is working today.
