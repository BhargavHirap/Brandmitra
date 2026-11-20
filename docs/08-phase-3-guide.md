# Phase 3 — Cart, checkout and orders

Phase 3 closes the loop: a customer picks items and options on the storefront, pays on
delivery, and the owner sees a real order with exact prices.

---

## The customer journey

```
/b/<slug>                → pick options and quantity → Add to cart
/b/<slug>/cart           → review, change quantity, remove, fill in name + phone
/b/<slug>/order/<uuid>   → receipt with order number, items and live status
```

The cart button in the storefront header shows the number of items. The cart is remembered
for 14 days in a cookie named `bm_cart_<businessId>` — one cart per shop, so two businesses
never share items.

---

## The owner journey

| Page | What it shows |
| --- | --- |
| `/dashboard` | Pending orders, today's and this month's revenue, 7-day chart, best sellers |
| `/dashboard/orders` | Every order, filter tabs per status, revenue and open-order counts |
| `/dashboard/orders/<id>` | Items with their options, customer, note, payment, status actions |

Status can only move along this graph, and the server enforces it:

```
new ──┬──► accepted ──► preparing ──► ready ──┬──► out_for_delivery ──► delivered
      │                                     └──► delivered
      └──► preparing            (the kitchen board starts cooking straight from New)

any of new / accepted / preparing / ready / out_for_delivery ──► cancelled
```

Anything else is refused with “that status change is not allowed”. The customer's receipt
updates at the same time.

---

## Money rules (the important part)

1. **The browser never sends a price.** The cart form posts a product id, option ids and a
   quantity. The checkout form posts a name, a phone number, a note and a payment method.
2. **Every line is recalculated from the database** in `loadCart()` when the cart page opens,
   again at checkout, and only then snapshotted into `order_items`.
3. **Snapshots are permanent.** `order_items` stores the name, unit price (base + option
   surcharges) and the chosen option names. Editing a product price tomorrow never rewrites
   yesterday's order.
4. **A tampered total is ignored.** Adding `total=1` to the checkout request changes nothing;
   the test suite checks this exact case.
5. **Payment status is never guessed.** Orders are recorded as `pending`. Cash is marked
   collected during reconciliation (Phase 7) — marking an order “delivered” does not silently
   claim the money arrived.

---

## Why a double submit cannot create two orders

The order id is derived from the cart id. If the same cart tries to check out twice (double
tap, back button, a retry), the second attempt finds the existing order and opens its receipt
instead of inserting a new one. The database's primary key is the final backstop.

---

## Cart integrity

The cart is a live view, not a frozen quote:

- A product that becomes hidden or sold out is flagged in the cart with the reason, and the
  checkout button is replaced by “remove it to continue”.
- An option that goes unavailable is flagged the same way.
- Quantity is clamped to 1–20.
- Prices always show today's numbers, so nobody is surprised at checkout.

---

## Test it yourself (5 minutes)

1. Add a product with two option groups to the cart; check the unit price equals base +
   both surcharges.
2. Change the quantity; the line total and grand total must follow.
3. Place an order with a test name and phone.
4. Open `/dashboard/orders` — the order is there with the same total.
5. Move it through accepted → preparing → ready → delivered and refresh the receipt after
   each step.
6. Try `POST`-ing an illegal jump (for example new → delivered) — it is refused.
7. Sign in as a different business and open the first business's order URL: 404.

`npm run typecheck` and `npm run build` must pass before handing work over.

---

## Common errors

| Symptom | Cause | Fix |
| --- | --- | --- |
| “Your cart is empty” after checkout | The order was already placed and the cart cleared | Open the receipt link or check `/dashboard/orders` |
| “Some items are no longer available” | A product or option went out of stock while in the cart | Remove the flagged line, or re-enable it in the catalogue |
| Order total looks old | The order is a snapshot from checkout time | Edit prices for future orders only |
| Customer cannot find the receipt | They closed the tab | The receipt URL is saved in the order detail page; the owner can share it |
| Order status buttons missing | The order is delivered or cancelled | Closed orders cannot change |

---

## What is intentionally not here yet

- **Online payment.** No Razorpay keys are configured and nothing is simulated; orders are
  cash-on-delivery or pay-at-store.
- **Coupons and delivery fees.** Columns exist in `orders`; no UI writes them yet.
- **Addresses and delivery zones.** The note field carries pickup/delivery instructions.
- **Inventory decrement.** Stock is a manual switch until Phase 8.
- **Kitchen display, notifications, live polling.** Phase 4.
- **Customer accounts.** Orders work for guests; customers are deduplicated by phone number
  inside each business.
