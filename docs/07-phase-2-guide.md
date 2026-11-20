# Phase 2 — Catalogue guide

Phase 2 turns the storefront from a name and a description into a real menu. It is built,
runs with no paid services, and works from a phone.

---

## What you can do now

| Where | What it does |
| --- | --- |
| `/dashboard/products` | Every product, searchable and filterable by category; Live/Hidden toggle |
| `/dashboard/products/new` | Add a product: name, price, compare-at price, category, image URL, description |
| `/dashboard/products/<id>` | Edit the product, manage customisation groups and options, delete it |
| `/dashboard/categories` | Add, rename, reorder and delete the categories that become storefront tabs |
| `/b/<slug>` | Customers see category tabs, product cards, prices and every option with its surcharge |

Nothing here is simulated: every number, product and option on the public page is read from
the database rows you created.

---

## The 60-second workflow (on a phone)

1. **Categories first.** `/dashboard/categories` → add “Coffee”, “Bakery”, “Combos”.
   The order you set here is the order customers see, so move “Coffee” to the top.
2. **Add a product.** `/dashboard/products/new` → name `Cappuccino`, price `180`.
   Price is a **whole number of rupees** — `180`, never `₹180` or `180.50`.
3. **Add the options.** Open the product → “Add a customisation group” → name `Size`,
   selection `Pick one`, tick “Customer must choose”. Then add the options:
   `Small` (extra 0), `Medium` (extra 40), `Large` (extra 80).
4. **Look at the public page.** Tap “View on storefront”. The product appears under its
   category with `from ₹180`, and “Customisation options” lists Medium `+ ₹40`.

That is the whole loop. Everything else in this guide is detail.

---

## How prices work (important)

- Every price is stored as a whole-currency integer: `180` means ₹180. No decimals anywhere.
- A product's `price` is the **base** price — the cheapest version of the item.
- Each option has a `price_delta` (extra rupees). `0` means no extra charge.
- The storefront shows `from ₹180` when a product has options, then each option's extra.
- The exact price for one particular combination (Large + oat milk) is calculated by the
  cart in **Phase 3**. Today the storefront is honest about it: base price plus surcharges.
- The server parses and range-checks every price again. Typing `-500` or `javascript:` in the
  image field cannot reach the database.

---

## How the customisation groups behave

A group is a question; its options are the answers.

| Setting | Meaning |
| --- | --- |
| **Pick one** | Radio-style choice: Small / Medium / Large |
| **Pick multiple** | Checkboxes: oat milk, extra shot, extra cheese |
| **Customer must choose** | The order cannot be completed without picking from this group |
| **Minimum / maximum picks** | Only for “Pick multiple”: e.g. “choose up to 3 add-ons” |
| **Default choice** | Pre-selected option. A single-choice group keeps only one default |

An option marked **Unavailable** stays in the dashboard but disappears from the storefront —
that is how you handle “out of oat milk today” without editing the menu.

Groups with no options are hidden from customers automatically, so you can create the group
first and fill it in after.

---

## Visibility, stock and deleting

Three separate ideas, deliberately:

- **Visible on the storefront** (`is_active`) — untick to hide the item entirely.
- **In stock right now** (`is_available`) — shown as “Sold out” in the dashboard and hidden
  from customers, without deleting anything.
- **Delete** — permanent. Customisation groups and options are removed with the product.
  Past order lines keep their own recorded name and price (Phase 3), so sales history stays
  correct.

Deleting is two-step: “Delete product” opens a confirmation, and only the confirmation
button actually deletes.

---

## Plan limits

The Free plan allows 10 products. The limit is checked twice:

1. `/dashboard/products/new` shows a “limit reached” card instead of the form.
2. `createProductAction` re-counts before inserting and refuses with `?error=limit`.

Because the check lives on the server, editing the HTML or resending the form does not get
around it. Change the number in the `plans` table (or upgrade later in Phase 7) to allow more.

---

## Tenant isolation in this phase

The most important rule in the codebase: **a business id is never read from the URL or a
form.** It comes from `requireBusiness()`, which reads the logged-in user's
`business_members` row.

Consequences you can rely on:

- Every read, update and delete in `src/app/actions/products.ts` contains
  `AND business_id = ?`.
- Opening another business's product URL returns 404.
- Posting a forged product id (for example another cafe's product) redirects to
  `?error=missing` and changes nothing.

This was tested by seeding two businesses and attempting a forged update: the other
business's row was untouched.

---

## How to test it yourself

1. `npm run dev` and sign up. If you already have a business, sign in.
2. Add two categories, three products, and one “Size” group with three options.
3. Open `/b/<your-slug>` on your phone and confirm:
   - the category tabs and the order of the sections,
   - `from ₹…` on a product with options,
   - a sold-out and a hidden product are absent.
4. Go back to the dashboard and press **Live** to hide a product. Refresh the storefront — it
   is gone. Press **Hidden** to bring it back.
5. Delete a product and check that its options went with it (reopen `/dashboard/products`).
6. Sign in as a second account with its own business: it sees its own empty dashboard, and
   the first business's product URLs return 404.

`npm run typecheck` and `npm run build` must both pass before you hand a change to a
teammate.

---

## Common errors

| Symptom | Cause | Fix |
| --- | --- | --- |
| Redirect to `?error=missing` | The id does not belong to your business | Reload the list; the item was deleted or belongs to someone else |
| “You have reached your plan limit” | 10 products on the Free plan | Delete an item, or raise `plans.product_limit` |
| Product not on the storefront | Hidden, sold out, or its group has no options | Check both checkboxes and add at least one option |
| Price shows as ₹0 | The price field was empty or text | Enter whole rupees, e.g. `180` |
| Image does not appear | The URL is not a public https link | Upload the photo somewhere public first, or leave it blank |
| Options appear on one product only | Groups belong to a single product | Create the group again on the other product (copying groups across products is Phase 5 work) |

---

## What is intentionally not here yet

- **Direct image upload** — needs storage (Cloudflare R2), which arrives with a paid plan.
  Until then paste a public https URL. The server rejects anything that is not http(s).
- **Cart and checkout** — Phase 3. The storefront tells customers to mention their choices
  when ordering; it does not pretend to take an order.
- **Search, pagination beyond 300 rows, bulk import** — add when a pilot business asks.
- **Per-branch menus** — the schema has `business_branches`; menus are one per business today.

Keeping these out is deliberate: a smaller catalogue that is correct beats a bigger one that
lies about prices.
