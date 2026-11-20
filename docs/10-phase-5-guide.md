# Phase 5 (part 1) — AI product copy

The first AI feature is deliberately the least risky one: it writes words about a product you
already have. It cannot change a price, cannot change stock, and cannot save anything without you
pressing a button.

**Where it lives:** open any product in `/dashboard/products/<id>` — the blue **Write with AI** panel
sits above the product form. The read-only business agent (part 2 of Phase 5) is covered in
`11-phase-5-agent-guide.md`.

---

## What it does

Two buttons, one draft box:

| Button | Output | Can be saved? |
| --- | --- | --- |
| **Draft a description** | 2–3 sentences, under 300 characters | Yes — **Use as description** writes the description field only |
| **Draft an Instagram caption** | 1–2 sentences plus 3–5 hashtags | No — **Copy text** puts it on your clipboard |

You can edit the draft before using it, discard it, or generate another. Every draft costs one AI
credit from your plan (Free = 20 per month), counted per calendar month.

---

## Why prices are structurally safe

This is the part worth reading twice.

1. **The model never receives a price.** The query in `src/app/actions/ai.ts` selects the product
   name, its description, its category name and its option *names*. There is no `price`,
   `compare_at_price` or `price_delta` column in that query, so no price can leak into the prompt.
2. **The model never returns a price that is used.** Even if it invents one, `stripPriceClaims()`
   in `src/lib/ai.ts` deletes every sentence containing a currency symbol, "Rs", "INR", "MRP",
   "price", "discount", "% off", "free" or urgency phrases like "today only". If nothing survives,
   the draft is thrown away with a clear message instead of being shown.
3. **The model never writes to the database.** Generation returns text to the browser. Saving is a
   separate server action that updates `products.description` and nothing else.
4. **The price the customer pays is still computed from your price field** by the cart, exactly as
   in Phase 3. AI copy has no path into money.

The filter also protects you from copy that would be illegal or embarrassing: the prompt forbids
invented awards, ratings, health claims and "best in the city" claims, and the panel reminds you
that a removed sentence may have mentioned pricing.

---

## Setup (one key, free tier)

1. Open **aistudio.google.com/apikey** and create a free API key.
2. In the project root, create `.env.local` (it is git-ignored):

   ```bash
   GEMINI_API_KEY=your-key-here
   ```

3. Restart `npm run dev`.

Optional environment variables:

| Variable | Default | Why you would change it |
| --- | --- | --- |
| `GEMINI_MODEL` | `gemini-3.8-flash` | Pin a different free model, e.g. `gemini-3.5-flash-lite` for cheaper/high-volume use |
| `GEMINI_API_BASE` | `https://generativelanguage.googleapis.com/v1beta` | A proxy or a staging endpoint; it must speak the same `:generateContent` shape |

Without `GEMINI_API_KEY` the panel shows a setup card and the button does nothing. Nothing is
simulated and no placeholder copy is invented — that is the same rule as every other unbuilt
feature in this project.

On Cloudflare Workers, add the same names as secrets/environment variables in the deployment
settings. The key is read only inside server code (`src/lib/ai.ts` is imported by a server action),
so it never reaches the browser bundle.

---

## Files

| File | Role |
| --- | --- |
| `src/lib/ai.ts` | Provider call (Gemini REST), prompts, price filter, credit meter helper |
| `src/app/actions/ai.ts` | `generateProductCopyAction` (metered, validated) and `saveProductDescriptionAction` |
| `src/components/ai-copy-panel.tsx` | The panel: two buttons, editable draft, copy, save, credits line |
| `src/app/dashboard/products/[id]/page.tsx` | Mounts the panel and passes the current plan usage |

---

## Test it yourself

1. Open a product you own. Without a key, the panel explains exactly what to add.
2. Add the key, restart, open the product again: the credits badge shows `20 of 20` on Free.
3. Press **Draft a description**. The text appears in an editable box; the badge drops to 19.
4. Press **Use as description** → the page reloads with “Saved” and the description field is filled.
5. Open your storefront and check the product — the new text is there, the price is untouched.
6. Press **Draft an Instagram caption** → copy it. Nothing is saved, and that is stated in the UI.
7. Try to exhaust the credits: after 20 drafts the button is disabled with a clear message.

Verified on 20 Nov 2026 against a production build with a local stub that speaks the Gemini
response shape: 18 checks covering the missing-key path, a normal draft, a price sentence being
removed, the caption path, the saved description, the audit/credit rows, the credit cap and a
cross-tenant product id. **The real Google endpoint has not been called** because no key exists in
this workspace — that is the one step you must confirm after adding your own key.

---

## Common errors

| Symptom | Cause | Fix |
| --- | --- | --- |
| “AI is not connected on this deployment” | `GEMINI_API_KEY` missing or the server was not restarted | Add the key to `.env.local`, restart `npm run dev` |
| “The AI service refused the request” | Wrong key, disabled API, or a model id your key cannot use | Check the key in AI Studio; try `GEMINI_MODEL=gemini-3.8-flash` |
| “Rate-limiting us right now” | Free-tier requests per minute exceeded | Wait a minute; free tiers have per-minute and per-day quotas |
| “The draft only talked about prices” | Every sentence mentioned money and was filtered out | Generate again, or add a short existing description for context |
| Credits look wrong | Each successful draft is one `ai.generated` audit row | Check `/dashboard` recent activity; credits reset on the 1st (UTC) |

---

## What is intentionally not here yet

- **The marketing studio, the business agent and voice input.** Those are the rest of Phase 5 and
  they need the read-only question path first.
- **Streaming responses.** A short draft arrives in a second or two; streaming would complicate the
  server action for little gain.
- **Batch generation for the whole catalogue.** One product, one press, one credit — predictable
  and cheap.
- **Saving captions.** There is no social publishing integration, so the caption is copy-only
  rather than pretending to be scheduled somewhere.
