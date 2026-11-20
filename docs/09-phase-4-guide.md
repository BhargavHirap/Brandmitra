# Phase 4 — Kitchen display

The kitchen screen is for the person cooking, not the owner. It shows three columns — **New**,
**Preparing**, **Ready** — refreshes itself every ten seconds, and moves a ticket forward with one
big button that a thumb can hit without aiming.

---

## The board

| Column | Contains | Button |
| --- | --- | --- |
| New | Orders placed but not started | **Start preparing** |
| Preparing | Orders accepted or already being cooked | **Mark ready** |
| Ready | Cooked, waiting to leave the counter | **Handed over** (pickup) or **Out for delivery** (delivery) |

Each ticket shows the order number, when it was placed, how long it has been waiting, the status,
every line with its quantity and chosen options, the customer's note in a highlighted box, the
payment method and the total. Oldest tickets are first, so nothing quietly starves at the bottom.

The age pill changes colour: neutral under 15 minutes, amber from 15, red from 30. It is a nudge,
not an alarm — nothing is auto-cancelled.

---

## How the refresh works

`src/components/kitchen-refresh.tsx` is a small client component. Every 10 seconds it calls
`router.refresh()`, which asks Next.js to re-render the server page and re-read the database
without a browser reload. Scroll position, the pause state and any open page survive.

- **Refresh now** does the same thing immediately.
- **Pause / Resume** stops the timer — useful while reading a long ticket.
- Opening the tab again (a phone taken out of a pocket) refreshes straight away, so nobody ever
  works from a screen that is minutes out of date.

Polling is the boring, free choice. It needs no websocket server, no extra service and no money,
and ten seconds is far shorter than any dish takes to cook. Real-time push can replace it later
without touching the board's markup, because the page is server-rendered either way.

---

## The rules did not get looser

The kitchen buttons post to `kitchenAdvanceAction`, which uses the same transition graph as the
order page (`src/lib/orders.ts`). A button is not a permission:

- **New → Preparing** is allowed, because the kitchen starts cooking from the ticket it sees.
  Accepting first is optional, not required.
- **New → Ready** and **New → Delivered** are still refused.
- Delivered and cancelled tickets do not appear on the board.
- Every move is written to `audit_logs` with `screen: "kitchen"`.

One extra guard matters with two tablets on the counter: the update is
`UPDATE … WHERE id = ? AND business_id = ? AND status = ?`. A double tap, or two staff pressing
the same ticket at once, cannot move an order two steps. The losing request gets a friendly
“someone else moved that ticket first” message, and the board re-renders with the truth.

---

## Files

| File | Role |
| --- | --- |
| `src/app/dashboard/kitchen/page.tsx` | Server page: reads this business's open tickets and renders the three columns |
| `src/components/kitchen-refresh.tsx` | Polling, last-updated time, pause and manual refresh |
| `src/app/actions/orders.ts` | `kitchenAdvanceAction` — validates, updates one row, audits, returns to the board |
| `src/lib/orders.ts` | `KITCHEN_COLUMNS`, `KITCHEN_ACTIONS`, transition graph, status labels |
| `src/components/dashboard-nav.tsx` | “Kitchen display” is unlocked |

Isolation is unchanged: the business id comes from `requireBusiness()`, never from the URL, and
every query is filtered by it.

---

## Test it yourself (3 minutes, two devices)

1. Open `/dashboard/kitchen` on the shop tablet or phone.
2. On another phone, open your storefront, add an item, check out.
3. Within ten seconds the ticket appears in **New**, with its options and total.
4. Tap **Start preparing** → it moves to the middle column. Tap **Mark ready** → right column.
5. Open the customer's receipt on the second phone: the status has followed along.
6. Tap **Handed over** → the ticket leaves the board.
7. Try to skip a step by tampering with the posted status: the server refuses it.
8. Sign in as another business and open the board: you only ever see that business's tickets.

`npm run typecheck` and `npm run build` must pass. The Phase 4 run against a production build
executed 28 checks: columns and buttons, hidden delivered/cancelled tickets, another business's
ticket invisible and un-advanceable, every legal move, refused illegal moves and duplicate taps,
one audit row per real change, and the signed-out redirect.

---

## Common errors

| Symptom | Cause | Fix |
| --- | --- | --- |
| “Someone else moved that ticket first” | Another device advanced the same order | Nothing to do — the board already shows the new state |
| “That move is not allowed” | The ticket's status changed under you | Refresh; the buttons follow the current status |
| Board says “No tickets in the kitchen” | Everything is delivered or cancelled | Check `/dashboard/orders` for history |
| A ticket never appears | The order is delivered/cancelled, or belongs to another business | Confirm on the orders desk |
| Page does not update | Auto-refresh paused, or the phone lost the network | Tap **Refresh now** / **Resume** |

---

## What is intentionally not here yet

- **A chime or push notification.** The board is visible and self-refreshing; sound and browser
  notifications are a Phase 8 polish item, and they need testing on real Android devices before
  being promised. The `notifications` table exists and is unused.
- **Real-time websockets.** Polling is enough for one counter.
- **Kitchen printing, per-station routing, prep-time estimates.**
- **Multi-device presence or “who is cooking what”.** Staff accounts arrive with Phase 8.
