# Phase 5 (part 2) — the read-only AI business agent

The agent answers questions about your own shop: today's orders, this week's sales, your best
seller, what is still open, your catalogue. It is **read-only on purpose** — the first AI feature
allowed near business data should be the one that cannot change it.

**Where it lives:** `/dashboard/agent` — the sidebar entry **Grow with AI → AI business agent** is
now open (the marketing studio is still marked P5 and locked).

---

## What it can answer

Eight reports, each one a hand-written `SELECT` in `src/lib/agent.ts`:

| Report | Example question | What it reads |
| --- | --- | --- |
| Orders today | “How many orders today?” | Count, value and open orders for the UTC day |
| Last 7 days | “How was this week?” | Orders, value and the busiest day of the last 7 days |
| This month | “What is my average order value?” | Orders, total and average order value this month |
| What needs attention | “What is still pending?” | Open orders grouped by status |
| Best seller | “Which product sells the most?” | Top three products by units sold, last 30 days |
| Top customers | “Who orders the most?” | Three customers by order count, last 90 days, **names only** |
| Catalogue summary | “How many products do I have?” | Live/hidden counts, price range, how many have no description |
| Products not selling | “What should I promote?” | Live products with no sales in the last 30 days |

Cancelled and rejected orders are excluded from every sales figure. All dates are UTC, like the
rest of the dashboard.

---

## How it stays read-only

1. **The model never writes SQL.** It returns one JSON object: `{"template":"orders_today"}` or
   `{"template":"none"}`. The server checks that id against the fixed list and ignores anything
   else. A prompt injection can at most pick a different report from the same safe list.
2. **There is no write path.** `src/lib/agent.ts` only calls `db.first` and `db.all`. It has no
   `db.run`, no update and no delete, and imports no action that can write.
3. **Every query is checked before it runs.** `isSelectOnly()` refuses any statement that does not
   start with `SELECT`, contains a `;`, or mentions `INSERT`, `UPDATE`, `DELETE`, `DROP`, `ALTER`,
   `CREATE`, `REPLACE`, `ATTACH`, `PRAGMA` or `VACUUM`. Today all eight pass — the check exists so
   a future edit cannot quietly slip a write in.
4. **Price-change requests are refused in code, before the model.** Patterns like
   “apply a 90% discount”, “set the dosa price to 10”, “make everything free” are matched by
   `asksToChangeMoney()`. The reply explains that the agent is read-only and where to change a
   price properly (Products → the item → the price field). The refusal is logged as
   `ai.refused`, costs no credit, and never reaches the AI provider.
5. **The wording cannot invent a number.** After the chosen report runs, the model may rewrite
   the answer, but every digit in its sentence must already exist in the report's facts or in the
   report's own sentence (`numbersAreGrounded`). If it adds one, its sentence is discarded and
   the report's own wording is shown instead, with a note in the panel.
6. **Tenant scope is not negotiable.** Every query takes `business_id` as its first parameter,
   and that id comes from `requireBusiness()` (the logged-in user's membership row), never from
   the question, the URL or the form.

Prices *can* appear in answers — reading your own prices is the owner's job. The agent can quote
them; it cannot change them.

---

## Credits

One answered question is one `ai.generated` row, counted against `plans.ai_credits` per calendar
month (Free = 20), exactly like AI copy. Refusals and “I cannot match that” replies write no
`ai.generated` row, so they are free. When the allowance is used the panel says so and the Ask
button is disabled until the 1st of next month.

---

## Setup

The agent uses the same key as AI copy. If `GEMINI_API_KEY` is missing, the page shows the setup
card and nothing is answered:

```bash
# .env.local (git-ignored)
GEMINI_API_KEY=your-key-here
```

Restart `npm run dev`. Optional: `GEMINI_MODEL` and `GEMINI_API_BASE` (see the Phase 5 part 1
guide). The key is read only in server code; the browser never receives it.

---

## Files

| File | Role |
| --- | --- |
| `src/lib/agent.ts` | The eight reports and their SQL, the refusal matcher, the SQL guard, the number guard, the two model calls |
| `src/app/actions/agent.ts` | `askAgentAction`: refusal → config/credits → report → audit → state |
| `src/components/agent-chat.tsx` | Question box, suggestion chips, answer card with the facts that were read |
| `src/app/dashboard/agent/page.tsx` | The page: the agent, the report list and the safety explanation |
| `src/lib/ai.ts` | `callGeminiText()` — the shared provider call, now exported for the agent |

---

## Test it yourself

1. Open **AI business agent**. Without a key you get the setup card, not an invented answer.
2. With a key, ask “How many orders today?” — compare the numbers with the Overview page.
3. Ask “Which product is my best seller?” and check it against Products → sales history.
4. Try “Apply a 90% discount to everything” — the answer is a refusal, the credits badge does not
   move, and nothing in your catalogue changes.
5. Ask something unrelated, like “What does a zebra eat?” — the agent says it cannot match that
   instead of guessing.
6. Open a second account's dashboard and repeat — every answer is that business's data only.

---

## Verification record

Verified on 20 Nov 2026 against a production build (`next build` + `next start`) with a local stub
that speaks the Gemini response shape, and two seeded tenants:

- 24/24 HTTP checks passed: page renders for the owner, no SQL in the HTML, signed-out redirect,
  a real answer from the owner's rows, the audit row (`ai.generated`, report id), one routing and
  one phrasing call, two price-change refusals (including “apply a 90% discount”), refusals
  calling neither the model nor the credit meter, the refusal audit row, best-seller and
  catalogue reports, no cross-tenant numbers, the polite “cannot match that” path, a deliberately
  invented number being replaced by the report's own sentence, the monthly credit cap, and a
  second tenant seeing only its own figures.
- Typecheck and production build both exit 0.
- The no-key path was re-checked on a second production server: the page shows “AI is not
  connected on this deployment”.

**The real Google endpoint has not been called** — no key exists in this workspace. The routing
and wording quality of the live model is the one thing you must confirm with your own key.

---

## Common errors

| Symptom | Cause | Fix |
| --- | --- | --- |
| “AI is not connected on this deployment” | `GEMINI_API_KEY` missing or the server was not restarted | Add it to `.env.local`, restart |
| “That is not something I can do” | The question asked to change money | Change the price in Products; the agent stays read-only |
| “I could not match that to a report” | No report covers the question | Use one of the listed questions; nothing was guessed or charged |
| “The AI's wording was replaced…” | The model added a number that is not in your records | Nothing to fix — the shown answer is the report's own sentence |
| “You have used all 20 AI credits” | Free monthly allowance spent | Wait for the 1st, or move to a plan with more credits |
