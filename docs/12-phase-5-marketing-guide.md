# Phase 5 (part 3) — AI marketing studio

The studio drafts an Instagram post or a WhatsApp broadcast from your own catalogue, shows it as a
preview, and saves it only when you press **Approve & save**. There is no auto-posting, because
there is no Instagram or WhatsApp connection in this phase — the studio never claims otherwise.

**Where it lives:** `/dashboard/marketing` — sidebar **Grow with AI → AI marketing studio**, now
open.

---

## The flow in one picture

```
brief + channel + up to 3 products
        ↓  (server action, one AI credit)
   DRAFT in the browser  ── discard ──▶ gone, never stored
        ↓  edit if you like
   Approve & save
        ↓  (no AI call, no credit)
   marketing_campaigns row (status = approved) + audit entry under your name
```

A draft is not a campaign. It lives only in the page you are looking at; reloading or leaving
throws it away. Approving is the single write in this feature.

---

## What the AI receives

Only what it needs to write a message:

- business name, industry and city,
- the channel (Instagram post or WhatsApp broadcast) and your one-line brief,
- the product **names**, their category names and their option names.

No price, no compare-at price, no option surcharge and no order data is selected by the query or
put in the prompt. The model cannot see money, so it cannot quote or invent it.

## What is filtered, twice

1. `generateCampaign()` runs every draft through `stripPriceClaims()`, the same filter AI copy uses.
   A sentence with a currency symbol, "Rs", "INR", "MRP", "price", "discount", "% off", "free" or
   urgency wording is deleted. If nothing usable survives, the draft is discarded with a message.
2. `saveCampaignAction` runs the filter again on the **posted** title and content before inserting.
   A tampered form (or a paste with a price in it) is refused with
   `/dashboard/marketing?error=price` and nothing is saved.

The panel tells you when a sentence was removed rather than silently changing the text.

---

## Channels

| Channel | Written as | Stored as |
| --- | --- | --- |
| Instagram post | 2–4 sentences, then a line of 3–5 hashtags | `channel = 'instagram'` |
| WhatsApp broadcast | 1–2 sentences, under 220 characters, no hashtags | `channel = 'whatsapp'` |

Both previews show your business name and initial, so you can judge the text the way a customer
will see it in the feed or the chat list.

---

## Credits

One draft = one `ai.generated` audit row, counted against `plans.ai_credits` per calendar month
(Free = 20). Approving, editing and discarding are free — they make no AI call. When the allowance
is spent the button is disabled with a clear message until the 1st of next month.

---

## Setup

Same key as the rest of the AI features:

```bash
# .env.local (git-ignored)
GEMINI_API_KEY=your-key-here
```

Restart `npm run dev`. Optional `GEMINI_MODEL` / `GEMINI_API_BASE` are documented in
`10-phase-5-guide.md`. Without a key the studio shows the setup card and generates nothing.

---

## Files

| File | Role |
| --- | --- |
| `src/lib/marketing.ts` | Channels, prompt, JSON parsing, the price filter, the campaign list query |
| `src/app/actions/marketing.ts` | `generateCampaignAction` (metered, nothing saved) and `saveCampaignAction` (the only write) |
| `src/components/marketing-studio.tsx` | Brief, channel, product picker, preview, editable approval form |
| `src/app/dashboard/marketing/page.tsx` | The page, the saved banner, the approved-campaign list and the rules |

---

## Test it yourself

1. Open **AI marketing studio**. Without a key you get the setup card, not an invented campaign.
2. Write a brief (“Weekend special on the dosa”), pick Instagram and one product, press **Draft a
   campaign**. Read the preview — the badge says **Not saved**.
3. Reload the page before approving: the draft is gone, and no campaign row exists.
4. Draft again, edit a word, press **Approve & save**. The page reloads with the saved banner and
   the campaign appears in **Approved campaigns**.
5. Approve a draft, then open the dashboard: **Marketing campaign approved** appears in Recent
   activity, under your name.
6. Paste a price into the message box and approve: it is refused and nothing is stored.

---

## Verification record

Verified on 20 Nov 2026 against a production build (`next build` + `next start`) with a local
Gemini-shaped stub and two seeded tenants:

- 29/29 HTTP checks passed: page and rules render, no SQL in the HTML, another tenant's campaign is
  invisible, signed-out redirect, a real draft with a price sentence stripped and one credit row
  written, **no campaign row before approval**, the preview carrying the draft into the approval
  form, a tampered price post redirected to `?error=price` with nothing stored, a real approval
  redirecting to `?saved=1` and storing `status = approved` with the price-free content, the
  `campaign.approved` audit row, the saved banner and list, another business's product id refused
  before any model call, and tenant B seeing only its own campaign.
- Typecheck and production build exit 0.
- The no-key path was re-checked on a second production server: “AI is not connected on this
  deployment”.

**The real Google endpoint has not been called** — no key exists in this workspace. Draft quality
with the live model is the one thing you must confirm with your own key.

---

## Common errors

| Symptom | Cause | Fix |
| --- | --- | --- |
| “AI is not connected on this deployment” | `GEMINI_API_KEY` missing or the server was not restarted | Add it and restart |
| “That message mentioned pricing, so it was not saved” | Your edit (or the model) put money in the text | Remove the price; the storefront price field is the only price |
| “The draft only talked about prices” | Every sentence was filtered out | Give a brief with something to say besides the offer |
| “Those products do not belong to this business” | A forged product id | Pick from the list; ids are always checked against this business |
| Nothing in **Approved campaigns** | The draft was never approved | A draft is discarded when you leave the page |
