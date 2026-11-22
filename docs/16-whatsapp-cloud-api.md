# Automatic WhatsApp: the Cloud API, step by step

This is the upgrade from **"the owner taps send"** to **"the confirmation and the reminder
leave by themselves"**. It is already wired in the code — there is nothing left to build.
What is missing is a Meta account and two values in the Cloudflare dashboard.

Read the whole page before starting. Part 1 costs nothing and takes about an hour with
approval waits; part 5 explains what it costs after that, honestly.

---

## What changes when this is on

| Before (free, works today) | After (Meta account connected) |
| --- | --- |
| Booking writes the slot and a call row | Same, plus a **confirmation** queued and sent |
| A `wa.me` link per booking, the owner taps send | The customer's phone buzzes on its own |
| Reminders are a second link | A reminder leaves N hours before the slot, no one involved |
| Nothing proves a message went out | Each message shows **Sent** only after Meta returns a message id |
| Cancel a booking | Its queued reminder is skipped, not sent |

The desk screen grows a **WhatsApp sending** panel: on/off, how many hours before the slot
the reminder leaves, and the last eight messages with their real status and Meta's reason
when something fails. The `wa.me` links stay on every booking as a backup, because a paid
API can be down and a shop still has to tell a customer their slot is confirmed.

---

## Part 1 — A Meta app with WhatsApp on it (free)

1. Go to <https://developers.facebook.com> and sign in with a Facebook account. Use the
   account that will own the business, not a personal one you might lose.
2. **My Apps → Create app**. Choose the **Business** type. Name it after the business.
3. On the app dashboard, find **WhatsApp** in the products list and click **Set up**.
4. Meta creates a **test phone number** for you and shows three things on the
   *API Setup* page:
   - **Phone number ID** — a long number like `123456789012345`. This is **not** a phone
     number, and it is not the WhatsApp Business Account ID either. Copy this one.
   - **WhatsApp Business Account ID** — needed when you create templates later.
   - A **temporary access token** that dies in 24 hours. Do not use it for the app; Part 2
     replaces it with a permanent one.
5. In the same page, add your own phone number as a **recipient** (test numbers may only
   message numbers you have added). Send the sample message once — if it arrives, the app
   itself works and any later problem is a token or template problem, not a Meta account
   problem.

You can stop here and use a real business number later. The test number is enough to see
the whole flow work.

---

## Part 2 — A permanent token (free)

The 24-hour token is for trying things out. Automatic sending needs one that does not
expire.

1. Open **business.facebook.com → Business settings** (Business Manager).
2. **Users → System users → Add**. Name it `vantra-sender`, role **Admin**. A system user
   is a robot account: it does not belong to a person, so the token survives staff changes.
3. With that system user selected, **Add assets → Apps →** pick your app → **Full control**.
4. Click **Generate new token**, choose your app, set expiry to **Never**, and tick:
   - `whatsapp_business_messaging`
   - `whatsapp_business_management`
5. Copy the token **once**. It is shown one time only. Treat it like a password: never
   paste it into chat, a WhatsApp message, a commit, or a screenshot.

---

## Part 3 — Put the two values on the Worker

The token is a secret. It never goes into the database, the repository or the page — the
app reads it from the environment in `src/lib/whatsapp.ts` and nowhere else.

**Cloudflare dashboard** (the same place the Gemini key goes):

> Workers & Pages → **brandmitra** → Settings → **Variables and Secrets** → Add

| Name | Type | Value |
| --- | --- | --- |
| `WHATSAPP_TOKEN` | **Secret** | the permanent token from Part 2 |
| `WHATSAPP_PHONE_NUMBER_ID` | Text | the phone number ID from Part 1 |

Then redeploy (any push to `main`) so the Worker restarts with them.

**On your own machine**, put the same two lines in `.env.local` and restart `npm run dev`.

To check it took, open **Dashboard → Front desk**. The *WhatsApp sending* panel changes
from "Not connected" to "Connected", and the missing-values list disappears. The panel
reads the environment on every page load, so a wrong value shows up immediately — no
guessing.

---

## Part 4 — Templates, which is the part people miss

Meta does not let a business open a conversation with whatever text it likes. A message the
business starts must use a **template Meta has approved**, unless the customer wrote to you
in the last 24 hours.

A booking confirmation and a reminder are both business-started. So without a template,
Meta refuses the message with an error like *"Message failed to send because more than 24
hours have passed since the customer last replied"* — and the desk will show you exactly
that sentence next to the message, in red. Nothing is hidden.

So create two templates:

1. **WhatsApp Manager → Account tools → Message templates → Create template**
   (or `business.facebook.com/wa/manage/message-templates/`).
2. Category: **Utility**. Name: `booking_confirmation`. Language: English (add Hindi as a
   second language later if you want).
3. Body — three placeholders, in this order:

   ```
   Namaste {{1}}, your booking at {{3}} is confirmed for {{2}}.
   Reply here if you need to change it.
   ```

   The order is fixed by the app: `{{1}}` first name, `{{2}}` day and time, `{{3}}`
   business name. A template with a different count or order will be refused by Meta.
4. Submit. Utility templates are usually approved in minutes, sometimes a few hours. You
   get an email either way.
5. Repeat with name `booking_reminder`:

   ```
   Reminder: {{1}}, your visit at {{3}} is {{2}}. See you then.
   ```

6. Tell the app the names. Add two more variables on the Worker (Text, not secret):

   | Name | Value |
   | --- | --- |
   | `WHATSAPP_TEMPLATE_CONFIRMATION` | `booking_confirmation` |
   | `WHATSAPP_TEMPLATE_REMINDER` | `booking_reminder` |

   Add `WHATSAPP_TEMPLATE_LANG` too if your templates are not in `en` (for example `hi`).

Until these two names exist, the app sends plain text and Meta will usually refuse outside
the 24-hour window. That is why the panel prints a warning about it.

---

## Part 5 — What it costs, in plain words

Meta charges the business, not Vantra, and only when a message is **delivered**.

As of Meta's India rate card effective **1 October 2026**:

- a **utility** message (a booking confirmation or reminder is exactly this) is about
  **₹0.115** per delivered message in India;
- a **marketing** message is about **₹0.86** — do not send offers on this channel by
  accident;
- the **first 1,000 service messages per phone number per month are free**, and messages
  **from** a customer to you are never charged;
- the API itself has no monthly fee.

So a clinic doing 25 bookings a day sends 50 messages a day: about **₹5.75 a day**, or
roughly **₹175 a month**. That is the number to quote when selling, and it is the number
the customer's own bookings pay for many times over.

Rates change on 1 January, 1 April, 1 July or 1 October with a month's notice. Check
<https://developers.facebook.com/docs/whatsapp/pricing> before you quote a price to anyone.

**Do not turn this on for a business that has no money for it.** The free `wa.me` links send
the same message with one tap and cost nothing. The panel is a switch for when the owner is
ready, not a default.

---

## Part 6 — Making reminders leave while nobody is looking

Something has to wake the app up and post what is due. Two things do that, and they
complement each other:

1. **Opening the desk.** Every visit to *Front desk* sends whatever is already due. In a
   shop that checks the dashboard each morning, most reminders go out this way, with no
   scheduler at all.
2. **A scheduler.** A free cron service calls this URL:

   ```
   GET https://<your-worker-domain>/api/whatsapp/dispatch?key=<WHATSAPP_DISPATCH_SECRET>
   ```

   It answers with JSON: `{"ok":true,"sent":2,"failed":0,"skipped":0,"remaining":0}`.

   Setup, once:

   - Add `WHATSAPP_DISPATCH_SECRET` on the Worker as a **Secret** — a long random string.
     Without it the route answers **503** and does nothing, so it can never sit open on
     the internet.
   - At <https://cron-job.org> (free), create a job with that full URL, every 15 minutes,
     and enable *treat 4xx/5xx as failure* so you get an email when something breaks.

The route sends at most 40 messages per call and marks a message **failed** after three
attempts, or immediately when Meta says the request itself is wrong (a bad token, an
unapproved template). Retries are spaced ten minutes apart.

---

## What this does NOT do

- **It does not answer phone calls.** That still needs a telephone line and a speech
  service; the desk says "Not connected" about the phone and will keep saying it.
- **It does not read replies.** A customer who replies "please move it to 6 pm" sends a
  message nobody in Vantra reads yet. That needs a webhook with signature checking, and it
  is the next piece of work, not this one.
- **It does not send marketing.** Only the confirmation and the reminder. The recall list
  stays tap-to-send, because a wrong automated "come back" message is a complaint waiting
  to happen.
- **It does not store your token.** Only `WHATSAPP_PHONE_NUMBER_ID` may be saved per
  business in the desk settings; the token lives in the environment.

---

## Proving it works before you trust it

The sending code has a check that needs no Meta account and can never send a real message:

```bash
npm run check:whatsapp
```

It starts a stub that pretends to be `graph.facebook.com`, boots the app against it, signs a
clinic up, turns automatic sending on and books a slot. Then it asserts the boring things
that decide whether real customers get messages:

- the request goes to `/<version>/<phone-number-id>/messages` with the token in the
  `Authorization` header and **not** in the URL;
- with templates configured, the payload is a template whose `{{1}}` is the first name,
  `{{2}}` the day and time and `{{3}}` the business name; without them it is plain text;
- both rows in `desk_messages` turn `sent` with Meta's message id on them;
- a message Meta rejects is marked `failed` after **one** attempt, with Meta's own words;
- a reminder still waiting when the booking is cancelled becomes `skipped`, never sent;
- `/api/whatsapp/dispatch` answers **401** to a wrong key and **200** to the real one.

Stop the dev server first: Next.js runs one dev server per folder. That is the only reason
the script needs the port to itself.

What it cannot prove is that *your* Meta app, token and templates are right. Only a real
booking to a real phone number does that — and the first one should be to your own number.

---

## When something goes wrong

| What you see | What it means | Fix |
| --- | --- | --- |
| Panel still says **Not connected** | The Worker does not see the values | Add them as **Worker → Settings → Variables and Secrets**, then redeploy. Text, not a build variable |
| Message **Failed** with `Invalid OAuth access token` | Token expired or was regenerated | Part 2 again; update `WHATSAPP_TOKEN` |
| Message **Failed**: "more than 24 hours have passed…" | No approved template, outside the customer window | Part 4, then set the template names |
| Message **Failed**: `(#132000) Number of parameters does not match` | Template has a different number of placeholders | The template needs exactly `{{1}}`, `{{2}}`, `{{3}}` |
| Message **Waiting** with a future time | Normal — that is a reminder not due yet | Nothing |
| `400` on `phone number not registered on WhatsApp` | The number is not on WhatsApp, or lacks a country code | Store the customer's number with `+91` |
| Dispatch URL answers **401** | Wrong or missing `key` | Use the exact `WHATSAPP_DISPATCH_SECRET` |
| Dispatch URL answers **503** | Secret not set, or WhatsApp not configured | Part 3 and Part 6 |

Every failure is recorded in `desk_messages` with Meta's own words, and the panel shows
them next to the message. Nothing is retried silently forever and nothing is marked sent
that was not.
