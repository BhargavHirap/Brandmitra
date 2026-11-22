# The front desk (AI receptionist, in stages)

Every business type in Vantra gets a **Front desk** screen. A clinic sees patients,
a salon sees clients, a gym sees members, a wholesaler sees buyers — same module,
their own words, because the labels come from `src/lib/workspace.ts`.

Open it at **Dashboard → Front desk** (`/dashboard/receptionist`).

---

## What it does today, for ₹0

| Piece | What it actually does |
| --- | --- |
| Slot calendar | Builds slots from your own opening hours, closing time, slot length and weekly off days. Two people cannot take the same slot. |
| Booking | One form: slot, name, phone, what they are coming for, value. It writes the booking **and** a line in the call log. |
| Call log | Log every call as missed, answered, booked, or “will call later”. This is the raw data for the morning report. |
| Call-backs | “They will call later” starts a timer (2 hours by default). When it comes due, the desk shows a WhatsApp booking link ready to send. |
| Recall list | Everyone whose last visit was more than 45 days ago, with a recall message written for them. This is the list that fills quiet weeks without ads. |
| Morning report | Yesterday’s calls, answered, missed, bookings and the value on the book — plus a one-tap “send to my WhatsApp”. |
| Messages | Confirmation, reminder, call-back and recall text in **Hindi, Hinglish and English**, pre-filled into a `wa.me` link. |

The **value** in a booking is what the owner types. Vantra never estimates it, because
a made-up “₹38,000 recovered” would be worse than a blank field.

---

## The phone line is not connected — and it says so

Nothing answers calls for you yet. A real AI receptionist needs four paid pieces:

1. **A phone number** from a telecom/CPaaS provider that can stream call audio.
2. **Speech-to-text** that understands Hindi and Hinglish, not just English.
3. **A voice** (text-to-speech) that sounds natural on a phone line.
4. **A model** that decides what to say and books the slot.

Each of those is metered by the minute. Until all four exist, the desk records what
happened and prepares the messages. It never shows a fake “call answered by AI” badge.

---

## Free AI (no credits to buy)

You already put a **Gemini API key** in the Worker. That key is on Google’s **free
tier**: no card, no monthly bill — just rate limits (requests per minute and per day).
That is the free AI this app uses, and it is enough for a handful of shops.

Two important details:

- **The templates cost nothing.** Confirmations, reminders, recalls and the morning
  report are plain text built in `src/lib/reception.ts`. If the key is missing, rate
  limited, or the month’s credits are used up, the desk still works.
- **AI is the optional extra.** “Phone script, in your words” spends **one** credit to
  rewrite the greeting and messages. The Free plan includes 20 credits a month; each
  AI call in the app is one credit.

If Google’s free tier runs out mid-month, nothing breaks. You wait for the daily reset,
paste the templates, or raise the plan’s credit allowance in `src/db/schema.ts`
(`ai_credits`) — that is a product decision, not a technical limit.

**When you have money:** the same code path works with a paid Gemini key or a different
provider. Only `callGemini` in `src/lib/ai.ts` changes.

---

## Free WhatsApp (no API, no billing)

`wa.me` links are **free forever** and need no approval from Meta. Every WhatsApp button
in Vantra opens WhatsApp with the message already typed, and a human taps send.

What that means in practice:

- **The customer must have the owner’s number saved**, or the owner must open the link
  on their own phone to send to the customer. The desk pre-fills the customer’s number,
  so the owner taps “WhatsApp confirmation” and sends.
- **Nothing is automatic.** No message goes out while the owner sleeps.
- **It is honest.** The screen says “you still tap send” instead of claiming delivery.

**When you have money:** the WhatsApp Cloud API from Meta gives you real automated
sending. That wiring is already in the app, so the only step left is the Meta side —
`docs/16-whatsapp-cloud-api.md` walks through it. It needs a Meta Business account, a
dedicated number,
approved templates, and a permanent token. Meta’s pricing changes often — check the
current rates before promising a customer “free messages”.

The app is already shaped for it: every message body is built by one function
(`confirmationText`, `reminderText`, `recallText`) and every send is a single button.
Swapping `wa.me` links for API calls later touches one file, not fifty screens.

---

## How to sell it (the honest pitch)

Until the phone line exists, sell what is real:

> “You are losing 30–40% of your calls. I cannot answer your phone yet, but I can stop
> the leaks: every missed call logged, every caller called back within two hours, every
> old customer recalled with a WhatsApp message, and a morning report on your phone.”

That is worth a monthly fee on its own — and it is a truthful thing to say in a sales
meeting, which matters more than a demo that answers one test call.

---

## Upgrade order, when there is money

1. **WhatsApp Cloud API** — biggest visible win: confirmations send themselves. Already
   coded: set `WHATSAPP_TOKEN` and `WHATSAPP_PHONE_NUMBER_ID`, get two utility templates
   approved, and flip the switch in the *WhatsApp sending* panel. Guide:
   `docs/16-whatsapp-cloud-api.md`.
2. **A phone number + speech** — then the desk can answer, using the same greeting and
   slot rules you already configured.
3. **Paid AI** — only after call volume outgrows the free tier.

Each step is additive. Nothing in this screen has to be thrown away.
