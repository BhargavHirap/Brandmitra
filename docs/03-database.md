# Vantra — Database Design

One schema, defined once in [`src/db/schema.ts`](../src/db/schema.ts), applied automatically
on first use. The same SQL runs on **Cloudflare D1** (production) and **local SQLite**
(development), because both are SQLite.

```
npm run db:sql     # writes db/brandmitra.sql for: npx wrangler d1 execute <db> --remote --file=./db/brandmitra.sql
```

---

## 1. The tenant rule in one line

> Every table that stores business data has a `business_id`, and every query filters on it.

Tables that are intentionally **not** tenant-scoped: `users`, `sessions`, `plans`.
`audit_logs.business_id` is nullable because signups happen before a business exists.

---

## 2. Tables by group

### Identity and access

| Table | Purpose | Key columns |
| --- | --- | --- |
| `users` | A human login. One user can own/join businesses. | `email` UNIQUE, `password_hash`, `is_platform_admin` |
| `sessions` | Active logins. **Token is stored hashed.** | `token_hash` UNIQUE, `expires_at` |
| `business_members` | The link between a user and a business, with a role. **This table is how the app finds a tenant.** | `UNIQUE(business_id, user_id)`, `role` (`owner`, `staff`) |

### The business

| Table | Purpose | Notes |
| --- | --- | --- |
| `businesses` | Tenant root. | `slug` UNIQUE (the public URL), `status` (`active`/`suspended`), `industry` |
| `business_profiles` | Everything the storefront displays. 1:1 with a business. | `brand_color`, `template`, `opening_hours`, `social_links` (JSON string) |
| `business_branches` | Physical locations. Phase 1 creates one "Main branch". | `is_default` |
| `plans` | Subscription definitions, **prices live here, not in code**. | `price_inr`, `product_limit`, `staff_limit`, `ai_credits`, `features` (JSON) |
| `subscriptions` | One row per business: which plan it is on. | `plan_id`, `status`, `current_period_end` |

### Catalogue

| Table | Purpose |
| --- | --- |
| `product_categories` | Named groups ("Pizzas", "Drinks"). `UNIQUE(business_id, slug)`. |
| `products` | Sellable item: name, price, description, image URL, `is_active`, `is_available`. |
| `product_variants` | Simple size/weight variants with a price delta (kept for non-food use). |
| `customization_groups` | One question: "Choose size", "Add toppings". Holds `selection_type`, `min_select`, `max_select`, `is_required`. |
| `customization_options` | Answers: "Large +₹80", "Extra cheese +₹40", "No onion +₹0". |

**How customisation pricing stays honest:** the browser sends option *ids*; the server
looks up every option's `price_delta` in the database, checks it belongs to this business
and this product, and only then computes the total. A tampered request can change what is
ordered, never what it costs.

### Customers and carts

| Table | Purpose |
| --- | --- |
| `customers` | Per-business customer record. `UNIQUE(business_id, phone)` — the same phone at two cafes is two customers, by design. |
| `carts` / `cart_items` | Persisted carts. `channel` distinguishes `web`, `whatsapp`, `qr`. `unit_price` is snapshotted at add-to-cart time. |
| `coupons` | Code, type (`percent`/`flat`), value, minimum order, usage cap, validity window. |
| `reviews` | Rating + comment, optionally tied to a product. |

### Orders and money

| Table | Purpose |
| --- | --- |
| `orders` | The state machine: `new → accepted → preparing → ready → out_for_delivery → delivered`, plus `rejected`/`cancelled`. `UNIQUE(business_id, order_number)`. Money columns are integers. |
| `order_items` | `name_snapshot` and `unit_price` are **copied** at order time, so renaming or repricing a product never rewrites history. `options` stores the chosen option ids/names as JSON. |
| `payments` | One row per payment attempt: `provider` (`cod`, `razorpay`, `upi`), `provider_payment_id`, `status`. |

### Inventory, AI and marketing

| Table | Purpose |
| --- | --- |
| `inventory` | `stock_on_hand`, `low_stock_threshold`, one row per product. |
| `conversations` | A chat thread per channel (`whatsapp`, `web`), with `state` JSON for the ordering flow. |
| `messages` | Individual turns, `role` = `customer` / `assistant` / `system`. |
| `marketing_campaigns` | Generated content, `status` = `draft` / `approved` / `scheduled` / `published`. |
| `notifications` | Per-business (optionally per-user) alerts. |
| `audit_logs` | **Every sensitive action**, including AI actions (`actor_type` = `user`/`ai`/`system`), with a JSON payload. This is what makes the AI agent reviewable and reversible. |
| `security_logs` | Refused sign-ins (`signin_failed`) and webhooks that failed their signature check (`webhook_rejected`): kind, email, ip, path and a JSON detail. Never a password, token or request body, and never shown in the app. |
| `rate_limits` | One row per user, per AI feature, per fixed window. The upsert increments `count`, which is how burst limits are enforced without a second service. Rows older than a day are pruned. |

---

## 3. Relationships at a glance

```
users ──< sessions
users ──< business_members >── businesses ──< business_profiles
                                   │
                                   ├──< business_branches
                                   ├──< subscriptions >── plans
                                   ├──< product_categories ──< products
                                   │                              ├──< product_variants
                                   │                              ├──< customization_groups ──< customization_options
                                   │                              └──< inventory
                                   ├──< customers
                                   ├──< carts ──< cart_items
                                   ├──< orders ──< order_items
                                   │        └──< payments
                                   ├──< coupons
                                   ├──< conversations ──< messages
                                   ├──< marketing_campaigns
                                   ├──< reviews
                                   ├──< notifications
                                   └──< audit_logs
```

`<` means "many". Deleting a business cascades to everything it owns (`ON DELETE CASCADE`),
which is why deletion is a Phase 7 admin action with an explicit confirmation, never a
side effect.

---

## 4. Rules the team must keep

1. **Never store a price in the frontend or in a prompt.** Prices live in `products`,
   `customization_options` and `coupons` and are read at the moment of calculation.
2. **Never delete order rows.** Use statuses (`cancelled`, `rejected`). Financial history
   must survive.
3. **Snapshot names and prices into `order_items`.** History must not change when the menu
   changes.
4. **Money is an integer.** ₹350 is `350`. If you ever need paise, migrate every column at
   once — do not mix units.
5. **Dates are ISO strings** (`new Date().toISOString()`), so SQLite string comparison is
   also chronological comparison.
6. **JSON columns are strings.** Parse them in code (`JSON.parse`) and handle bad input.
7. **New table ⇒ new `business_id`.** If a table stores business data without one, the
   design is wrong.

---

## 5. Applying the schema

- **Locally:** automatic. `getDb()` runs every `CREATE TABLE IF NOT EXISTS` and the plan
  seed on first query. Delete `.data/brandmitra.db` to start over (this destroys local
  data only).
- **Production (D1):** `npm run db:sql` then `npx wrangler d1 execute brandmitra --remote
  --file=./db/brandmitra.sql`. The app also applies the schema on first request, so a
  freshly bound empty database heals itself.
- **Changing the schema:** edit `schema.ts`, then add a migration note in this file.
  SQLite's `ALTER TABLE` is limited — adding a column is easy; renaming or changing a type
  means creating a new table and copying rows. Do that in a phase where you can test it,
  never on a Friday.

---

## 6. Inspecting the local database (no paid tools)

```bash
node -e 'const {DatabaseSync}=require("node:sqlite");const d=new DatabaseSync(".data/brandmitra.db");console.log(d.prepare("select id,name,price from products").all())'
```

Or open the file with any SQLite viewer (DB Browser for SQLite is free) if you are on a
college computer.
