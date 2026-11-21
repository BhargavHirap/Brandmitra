# Vantra — What Is Free, What Costs Money, and What to Avoid

Prices and quotas change. Treat every number here as "check the provider's pricing page
before you commit" — the *structure* of this document will still be right.

**Current cost of the running Phase 1 system: ₹0/month.**

---

## 1. Everything you need for Phase 1 — free

| Service | What it does here | Free tier reality |
| --- | --- | --- |
| **Next.js / React / Tailwind** | The whole app | Open source, no cost, ever |
| **Node.js** | Runs the dev server and the build | Free |
| **Local SQLite (`node:sqlite`)** | Development database | Built into Node 22.5+, no install |
| **Cloudflare D1** | Production database | Free tier: 5 GB storage, generous daily read/write rows — far beyond your first 100 businesses |
| **Cloudflare Workers / Freebuff Sites** | Hosting the app | Free tier handles a small SaaS comfortably |
| **GitHub** | Code, issues, project board | Free for public and private repos |
| **VS Code / Codespaces / any cloud IDE** | Editor | Free (Codespaces has a monthly free quota) |
| **Figma free / Excalidraw** | Design and diagrams | Free |
| **Google Fonts, system fonts** | Typography | Free |
| **UptimeRobot free tier** | "Is my site up?" alerts | Free, 5-minute checks |
| **Sentry free tier** | Error monitoring | Small monthly event quota, enough to start |

## 2. Free tiers with real limits you must design around

| Service | Free allowance (typical) | The limit that will bite you | Mitigation |
| --- | --- | --- | --- |
| **Gemini API** | Free tier for several Flash models, rate-limited per minute/day | You will hit requests-per-minute on a busy day | Cache results, batch, use cheaper models for short tasks, meter per plan (`plans.ai_credits`) |
| **Cloudflare Workers** | ~100k requests/day | CPU time per request (10 ms on free) | Keep storefront pages light; cache public pages |
| **D1** | 5 GB, daily row quotas | Writes per day on heavy order volume | Fine until thousands of orders/day; archive old rows later |
| **R2 storage** | 10 GB storage, free egress | Class A operations | Compress images to WebP, cap upload size |
| **Resend / email** | ~100 emails/day | Transactional volume | Batch digests, only send what matters |
| **Speech-to-text** | Small trial credits | Minutes of audio | Prefer the browser's built-in `SpeechRecognition` first |

## 3. What genuinely costs money (and when to pay)

| Item | Approx. cost | When it becomes necessary |
| --- | --- | --- |
| **Domain name** (`vantra.com`) | ₹800–1,500 / year | Before you talk to real customers — trust matters |
| **Razorpay** | ~2% per successful transaction (+ GST); no monthly fee | Phase 3, once orders are real. Test mode is free |
| **Meta WhatsApp Cloud API** | Per-conversation / per-template pricing; some service conversations are free, marketing templates are charged | Phase 6. You also need a verified Meta Business account (free but takes review time) |
| **SMS / OTP** | ₹0.15–0.30 per SMS | Only if you add phone login; email/password is free |
| **Custom AI volume** | Pay-per-token beyond the free tier | When a paying customer exceeds the free quota — pass it through via plan limits |
| **Paid hosting** (if you outgrow free) | $5–20/month | After real revenue, not before |
| **Company registration, GST** | ₹2,000–10,000 one-time | When you invoice businesses formally, not for the pilot |

## 4. Free alternatives to "obvious" paid choices

| Instead of | Use | Trade-off |
| --- | --- | --- |
| Supabase Pro | Cloudflare D1 free | No RLS, no built-in auth — this codebase handles both |
| Vercel Pro | Cloudflare Workers / Freebuff Sites | Different deploy model |
| Auth0 / Clerk | Own auth (already built) | You maintain reset/verification |
| Paid analytics | Cloudflare Web Analytics (free) or a simple `events` table | Less detail |
| Paid email marketing | A CSV export + WhatsApp broadcast (later) | No automation |
| Paid design tools | Figma free, Tailwind tokens | — |
| Paid image CDN | R2 + Next image optimisation | Some setup |

## 5. Cost discipline rules for the team

1. **No free trial that silently becomes a subscription.** If you add a card anywhere, put a
   cancellation reminder in the team calendar the same day.
2. **One paying customer before one paid tool.** Revenue first, tooling second.
3. **Meter AI from day one.** `plans.ai_credits` exists so the free plan cannot cost you money.
4. **Never put a paid service in the critical path of signup.** Onboarding must work with
   zero third-party keys.
5. **Keep a `costs.md` note in the repo** listing every account, its plan and renewal date.
