# Security

What protects this app, what changed in the hardening pass of 27 Nov 2026, how to
test each claim yourself, and what is still open.

Vantra is a Next.js 16 app on Cloudflare Workers with a D1 database. There is no
separate backend service: every read and write happens inside a React Server
Component or a server action, so the browser only ever receives rendered HTML
and a React bundle. That shape removes a whole class of problems (no public REST
API to guard, no client-side auth decisions), and it is why some items in a
typical checklist do not apply here.

## The one rule

**The browser shows, the server decides.** No permission, price, total or "is
this mine" question is answered in the browser. Every server action calls
`requireUser()` / `getCurrentUser()` from `src/lib/auth.ts` first and scopes its
SQL by the user's own business id taken from that session — never from a form
field.

## What was insecure, and what changed

### 1. The landing page could not be read until JavaScript arrived

Not a security hole, but the reported symptom: every section started at
`opacity: 0` and was revealed by an `IntersectionObserver` after React hydrated.
A phone still downloading the bundle saw a blank page. On a mid-range Android
that is a second or more of nothing.

Fixed in `src/components/landing/reveal.tsx` and `src/app/globals.css`: the fade
is now a CSS scroll-driven animation (`animation-timeline: view()`), the markup
is visible in the first paint, `Reveal` is a server component so it ships no
JavaScript at all, and `prefers-reduced-motion: reduce` still turns the effect
off.

### 2. A thrown render showed a bare framework error page

One failed database read or a bug in a page printed "Application error" with no
way back and no reference the owner could quote.

Fixed with `src/app/error.tsx` (retry + a way home), `src/app/global-error.tsx`
(the root layout itself failing) and `src/app/not-found.tsx`. None of them print
the error message or a stack trace — a trace can name tables and query text. The
`digest` is kept because it matches a server log line without carrying data.

### 3. No baseline response headers

Fixed in `next.config.ts`:

- `X-Content-Type-Options: nosniff` — a file cannot be treated as a type it is not.
- `Referrer-Policy: strict-origin-when-cross-origin` — full URLs stay on our origin.
- `Permissions-Policy: camera=(), microphone=(), geolocation=()` — the app never
  asks for these, so nothing (including embedded third-party code) can.
- `Content-Security-Policy: frame-ancestors 'self' …` — clickjacking. The
  allowlist exists because the app is also viewed inside the editor's preview
  panel; `X-Frame-Options: DENY` would blank that.

### 4. Nothing stopped a signed-in user hammering the AI buttons

The monthly credit in `plans.ai_credits` counts *successful* answers, so a loop
of fifty presses was fifty paid provider calls before any limit applied. Each AI
action now counts one row in `rate_limits` through a single upsert, keyed by the
signed-in user's id (never a form field), and refuses the call when the window is
spent:

| Action | Calls | Window |
| --- | --- | --- |
| Product copy (`src/app/actions/ai.ts`) | 20 | 10 min |
| Campaign drafts (`src/app/actions/marketing.ts`) | 10 | 10 min |
| Call scripts (`src/app/actions/reception.ts`) | 10 | 10 min |
| Business agent (`src/app/actions/agent.ts`) | 20 | 10 min |
| Menu photo scan (`src/app/actions/menu-import.ts`) | 10 | 10 min |

The refusal is a sentence, not an error page, spends no credit and changes
nothing. See `src/lib/rate-limit.ts`.

### 5. Refused sign-ins and rejected webhooks left no trace

`security_logs` records two kinds of event and nothing else: `signin_failed`
(email, IP, path, `reason: bad_credentials`) and `webhook_rejected` (IP, path,
`reason: missing_signature` / `bad_signature` / `body_not_json`).

Deliberate limits: the same `reason` is written for "no such account" and "wrong
password" so the log cannot be used to discover which addresses exist; no
password, token, signature or request body is stored; and the write is wrapped in
try/catch, so a logging failure never turns a refusal into a crash
(`src/lib/security.ts`). Nothing in the app reads the table — it is for the owner
to inspect with SQL when something looks wrong.

### 6. Two buyers could oversell the last unit

Checkout checked availability when the item went into the cart, then wrote the
order; stock was never reduced, and two tabs could both pass the check.

`placeOrderAction` now reserves stock **before** the order row exists, one
conditional UPDATE per tracked line:

```sql
UPDATE inventory SET stock_on_hand = stock_on_hand - ?
 WHERE business_id = ? AND product_id = ? AND stock_on_hand >= ?
```

SQLite applies writes one at a time, so the second buyer's UPDATE matches no row
and returns `0` changes — that is the signal to refuse, and the cart comes back
with "someone else took the last of one item". Reading the stock and then
subtracting would have been the bug: both readers see 1, both write 0.

Two related facts: a product that reaches zero is marked `is_available = 0` in
the same step, so the storefront shows it sold out; and if the order fails to
save for any reason the reserved units are put back (`releaseStock`), so a failed
checkout never eats stock. Products with no `inventory` row stay unlimited, as
before.

## What was already in place

- **No secret in the browser.** Verified: all served JS chunks were fetched and
  searched for `AIza`, `GEMINI_API_KEY`, `sk_live`, `service_role` and
  `RAZORPAY_KEY_SECRET` — zero matches. `GEMINI_API_KEY`, `WHATSAPP_TOKEN` and the
  Razorpay keys are read only inside server code and in Workers secrets. See
  `.env.example`.
- **Payments are server-verified.** A paid plan is switched on only by
  `/api/razorpay/webhook`, which verifies the raw body against
  `x-razorpay-signature` in constant time (`src/lib/razorpay.ts`) before writing
  anything. A request with a bad or missing signature is rejected `400`.
- **Founder access is server-side.** `FOUNDER_EMAILS` is read from the
  environment on the server and compared during sign-in; a founder flag set in
  the browser means nothing.
- **Sessions are HttpOnly cookies** (`bm_session`) issued by `createSession`;
  sign-out destroys the row and the cookie server-side, and a password reset
  signs out every other device.
- **Outbound calls have timeouts** — `AbortSignal.timeout(...)` on the AI request
  (20 s budget with one retry) and on the WhatsApp send (15 s). Both classify a
  429 as "do not retry" and a 5xx or timeout as "retry once".
- **SQL is parameterised everywhere**; no user value is concatenated into a
  statement.
- **Uploads are images only** and server actions are capped at 4 MB
  (`serverActions.bodySizeLimit`).

## How to test it yourself

Open the live site, press F12, and try these:

1. **Steal an API key** — Sources → search all files for `AIza`, `sk_live`,
   `service_role`. Nothing. `localStorage` and `sessionStorage` hold no token.
2. **Bypass a paid feature** — in the Console set `localStorage.isPro = "true"`
   and reload. The plan comes from the `subscriptions` row on the server, so
   nothing changes.
3. **See another business's data** — sign in as business A, copy a URL from
   business B (`/dashboard/orders/<id>`). You get a 404, because the query is
   scoped to your own business id.
4. **Reach a dashboard screen signed out** — open `/dashboard/orders` in a
   private window. The server redirects to `/login`; it is not a client-side
   guard.
5. **Forge a webhook** — `curl -X POST https://…/api/razorpay/webhook -d '{}'`
   returns `400 Bad or missing signature`, and no plan is activated.
6. **Break a page** — visit a URL that does not exist. You get the app's own 404,
   not a stack trace. Confirm with `curl -sI` that the four headers above are on
   the response.
7. **Read the error** — trigger a failing page and check that the screen says
   only "That screen did not load", with no query text or table names.
8. **Watch a refused sign-in get recorded** — sign in with a wrong password,
   then run
   `SELECT kind, email, ip, created_at FROM security_logs ORDER BY created_at DESC LIMIT 5;`.
   The attempt is there; the password is not.
9. **Hammer an AI button** — press Generate in the marketing studio eleven times
   in ten minutes. The eleventh says how long to wait and no credit is used. In
   the database: `SELECT key, count FROM rate_limits;`
10. **Race two checkouts** — set a product's stock to 1, put it in two separate
    browsers' carts, then check out in both. The first gets an order number, the
    second gets "someone else took the last of one item", stock reads `0`, and
    `SELECT COUNT(*) FROM orders` did not grow by two.

## Still open

- **Payments are not live.** `RAZORPAY_*` secrets are not set, so plan buttons
  stay disabled. `payment.failed` and refunds are acknowledged and ignored by the
  webhook — nothing reconciles a failed or refunded payment back to a plan.
- **Refunds still do not return stock.** A refund or a cancelled order is not
  reconciled back into `inventory` — the owner puts the unit back by hand on the
  inventory screen. Doing it automatically needs the order-status transition to
  write stock, which is a product decision (a cancelled pizza is not resellable).
- **No CSP beyond `frame-ancestors`.** A full `script-src` policy is the next
  step; it needs testing against the framework's inline bootstrap scripts.
- **No automated dependency or secret scanning** in CI.
