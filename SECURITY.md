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

## Still open

- **No per-user rate limiting.** Repeated AI calls are bounded only by the
  provider's own quota; a signed-in user can press a button in a loop. Needs a
  counter in D1 (or a Durable Object) keyed by user id for the AI and
  menu-scan actions.
- **No `security_logs` table.** Failed sign-ins and rejected webhooks are not
  recorded anywhere yet.
- **Payments are not live.** `RAZORPAY_*` secrets are not set, so plan buttons
  stay disabled. `payment.failed` and refunds are acknowledged and ignored by the
  webhook — nothing reconciles a failed or refunded payment back to a plan.
- **No stock decrement at checkout.** Availability is checked before an item is
  added, but two simultaneous checkouts can both pass. Needs an atomic
  `UPDATE … WHERE stock >= ?` inside a transaction.
- **No CSP beyond `frame-ancestors`.** A full `script-src` policy is the next
  step; it needs testing against the framework's inline bootstrap scripts.
- **No automated dependency or secret scanning** in CI.
