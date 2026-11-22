# Secrets and environment variables

Everything the app needs to be configured is listed here. Nothing on this page ever goes into a
commit: values are typed into the Cloudflare dashboard, GitHub settings, or a git-ignored
`.env.local` on your own machine.

Two words first:

- **Secret** — a hidden value. Cloudflare and GitHub store it but never show it again, so nobody
  can read it out of the dashboard or the repository.
- **Variable** — a normal value (an id, a setting). Visible in the dashboard, fine to look at,
  still not committed to the repo because it is different for every account.

There are two different moments when a value is used:

- **Build time** — needed while `npm run build:worker` is running (on your machine, GitHub
  Actions, or Cloudflare Workers Builds). Missing → the build stops with an error.
- **Run time** — needed while the Worker is answering requests. Missing → that feature shows its
  setup card instead of working. The rest of the app keeps working.

---

## 1. The list

### Run-time values on the Worker

| Name | Needed? | Kind | What it does | Where it goes |
| --- | --- | --- | --- | --- |
| `GEMINI_API_KEY` | Optional | **Secret** | Turns on AI product copy, the read-only business agent and the marketing studio. Read only in server code (`src/lib/ai.ts`); the browser never receives it. | Cloudflare dashboard → **Workers & Pages → brandmitra → Settings → Variables and Secrets** → Add → Type **Secret**. Locally: `.env.local` |
| `GEMINI_MODEL` | Optional | Variable | Pins a different free model. Default `gemini-3.8-flash`. | Same place as above, type **Text**. Locally: `.env.local` |
| `GEMINI_API_BASE` | Optional | Variable | Only for a proxy or staging endpoint that speaks the same `/models/<model>:generateContent` shape. Leave unset in normal use. | Same place as above, type **Text** |
| `WHATSAPP_TOKEN` | Optional | **Secret** | Meta's permanent access token. Turns on automatic confirmations and reminders on the front desk. Read only in `src/lib/whatsapp.ts`; never stored in the database. | Cloudflare → **Variables and Secrets** → type **Secret**. Locally: `.env.local` |
| `WHATSAPP_PHONE_NUMBER_ID` | Optional | Variable | The phone-number ID from the Meta app's WhatsApp page (a long number, not a phone number). | Same place, type **Text** |
| `WHATSAPP_TEMPLATE_CONFIRMATION` | Optional | Variable | Name of the approved template for confirmations, with `{{1}}` first name, `{{2}}` day and time, `{{3}}` business name. | Same place, type **Text** |
| `WHATSAPP_TEMPLATE_REMINDER` | Optional | Variable | Same, for reminders. | Same place, type **Text** |
| `WHATSAPP_TEMPLATE_LANG` | Optional | Variable | Template language code, e.g. `en` or `hi`. Default `en`. | Same place, type **Text** |
| `WHATSAPP_API_VERSION` | Optional | Variable | Graph API version, default `v25.0`. Raise it here when Meta retires that version. | Same place, type **Text** |
| `WHATSAPP_DISPATCH_SECRET` | Optional | **Secret** | Guards `/api/whatsapp/dispatch`, the URL a free scheduler calls. Without it that route refuses to run. | Same place, type **Secret** |
| `WHATSAPP_API_BASE` | Optional | Variable | Only for a proxy or the local stub used by `npm run check:whatsapp`. Leave unset in normal use. | Same place, type **Text** |

Without the two WhatsApp values nothing is queued and the front desk keeps its free `wa.me` links. The
`docs/16-whatsapp-cloud-api.md` guide walks through getting them from Meta.

Without `GEMINI_API_KEY` the AI screens are not broken — they show "AI is not connected on this
deployment" and generate nothing. Nothing is faked.

### Build-time values (deploy configuration)

| Name | Needed? | Kind | What it does | Where it goes |
| --- | --- | --- | --- | --- |
| `D1_DATABASE_ID` | **Required to deploy** | Variable | The Database ID of the D1 database `brandmitra`. `scripts/deploy-config.mjs` writes it into `wrangler.deploy.json`. | GitHub → **Settings → Secrets and variables → Actions → Variables** (route A), or **Workers Builds → Settings → Build variables** (route B). Locally: the shell command you run |
| `KV_NAMESPACE_ID` | **Required to deploy** | Variable | The Namespace ID of the KV namespace `brandmitra-cache`, used as the page cache. Same script, same file. | Same places as `D1_DATABASE_ID` |

Both ids are shown in the Cloudflare dashboard (D1 database page, Workers KV page). They are not
secrets in the dangerous sense, but they are account-specific, so the repository keeps
`__D1_DATABASE_ID__` / `__KV_NAMESPACE_ID__` placeholders in `deploy/wrangler.template.json` and
fills them in at build time.

### Credentials for the GitHub Actions deploy (route A only)

Only needed if you use `.github/workflows/deploy.yml`. **Workers Builds (route B) does not need
them** — Cloudflare's GitHub App already has access.

| Name | Kind | What it does | Where it goes |
| --- | --- | --- | --- |
| `CLOUDFLARE_API_TOKEN` | **Secret** | Lets the workflow upload the Worker. Create it with the *Edit Cloudflare Workers* template. | GitHub → **Settings → Secrets and variables → Actions → Secrets** |
| `CLOUDFLARE_ACCOUNT_ID` | Variable | Which account to deploy into. Also used as the on/off switch: while it is missing, the workflow job is skipped and CI stays green. | GitHub → **Settings → Secrets and variables → Actions → Variables** |

### Development-only

| Name | Kind | What it does |
| --- | --- | --- |
| `BRANDMITRA_PREVIEW_HOST` | Variable, not secret | The `*.style.dev` hostname of the cloud preview. Next.js refuses cross-origin dev requests, so the host is added to `allowedDevOrigins` in `next.config.ts`. It changes every time the preview machine is recreated. |

### Set automatically — do not add these

- `NODE_ENV` — set by Next.js (`production` in a real build). The app uses it to mark session and
  cart cookies `secure` only in production.
- D1 `DB`, the KV binding `NEXT_INC_CACHE_KV`, `ASSETS` and `WORKER_SELF_REFERENCE` — these are
  **bindings**, not environment variables. They are declared in `deploy/wrangler.template.json`
  and attached during deploy. You never type them anywhere.

---

## 2. Where each value is typed, step by step

### On your own machine (development)

```bash
cp .env.example .env.local
# then edit .env.local and add:
GEMINI_API_KEY=your-key-here
```

`.env.local` is git-ignored (`.gitignore` blocks `.env` and `.env.*`). Restart `npm run dev` after
changing it — values are read when the server starts.

### On the deployed Worker (production)

1. Open the Cloudflare dashboard → **Workers & Pages** → **brandmitra**.
2. **Settings → Variables and Secrets → Add**.
3. Name it exactly `GEMINI_API_KEY`, paste the value, choose type **Secret**, save/deploy.
4. Secrets belong to the Worker, so later deploys (a push, a Workers Builds run, a manual
   `wrangler deploy`) keep them. You only re-add one if you delete the Worker.

The same values can be set from a terminal with Wrangler, if you prefer:

```bash
npx wrangler secret put GEMINI_API_KEY --config wrangler.deploy.json
```

That prompts for the value and stores it on the Worker. It needs `wrangler login` first, and it
does not put the value in any file.

### In GitHub (only for the Actions route)

**Settings → Secrets and variables → Actions**:

- **Secrets** tab → `CLOUDFLARE_API_TOKEN` (encrypted, never displayed again)
- **Variables** tab → `CLOUDFLARE_ACCOUNT_ID`, `D1_DATABASE_ID`, `KV_NAMESPACE_ID`

### In Cloudflare Workers Builds (the route this project uses)

**Worker → Settings → Build** → *Build variables*: add `D1_DATABASE_ID` and `KV_NAMESPACE_ID`.
Add `GEMINI_API_KEY` under *Variables and Secrets* instead, as a Secret.

---

## 3. How to check it worked

| What you want | How to check |
| --- | --- |
| Key is live | Open a product → **Write with AI**. The yellow "AI is not connected" card is gone and a draft appears. |
| Name is right but value is wrong | You see "The AI service refused the request" — fix the value in AI Studio, re-paste it. |
| Key still missing | The card is still there after a hard refresh. Check the exact spelling `GEMINI_API_KEY`, that the type is Secret, and that you clicked Save/Deploy. |
| Build-time ids are set | A deploy that reaches *Deploy* in its log instead of stopping at `Cannot build the deploy config`. |
| Nothing leaked into the repo | `git log -p | grep -i gemini` prints nothing. If it ever does, delete the key in AI Studio and create a new one — editing the commit is not enough. |

---

## 4. Rules for three beginners sharing one project

- Never paste a key into chat, an issue, a screenshot, a commit, or a `.env.example`.
- One key per person while testing, so you can revoke yours without breaking the others.
- Free Gemini keys can be deleted and recreated at any time: `https://aistudio.google.com/apikey`.
- If a value accidentally lands in a file, remove it, rotate the key, and check `git status` for
  `.env*` before committing.
- The deploy config `wrangler.deploy.json` is generated and git-ignored; it holds the D1 and KV ids,
  so never commit it.
