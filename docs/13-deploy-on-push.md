# Deploy on every push

Every push to `main` builds Brandmitra and deploys it to **your own free Cloudflare account**.
No local terminal, no manual deploy step: GitHub Actions does the build and the upload.

This is separate from the Freebuff Sites deployment at
<https://brandmitra-u2gvs6.freebuff.site>. Freebuff Sites only publishes from inside the
Freebuff app — it has no push-to-deploy hook and hands out no deploy credentials — so
automatic deployment runs on Cloudflare directly. Pick one:

| | Freebuff Sites (current live site) | Cloudflare + GitHub Actions (this guide) |
| --- | --- | --- |
| Deploy trigger | Press **Publish** in Freebuff | `git push` to `main` |
| You need | nothing more | a free Cloudflare account, once |
| Address | `brandmitra-u2gvs6.freebuff.site` | `brandmitra.<your-name>.workers.dev`, or your own domain |
| Database | Freebuff D1 (already has your data) | a new empty D1 (data does not copy over) |
| Cost | free | free (Workers, D1 and KV free tiers) |

Do not point both at the same database. If you move, copy the data first and keep the old
site read-only for a day.

---

## Route B — Workers Builds (no API token, easiest)

Cloudflare can build and deploy this repository itself, on every push, with no token and no
GitHub secret. Use this route if you would rather not create credentials.

In the Cloudflare dashboard: **Compute (Workers) → Create → Connect to Git**, pick
`BhargavHirap/Brandmitra`, then set these values **exactly**:

| Field | Value |
| --- | --- |
| Worker name | `brandmitra-deploy` |
| Production branch | `main` |
| Root directory | `/` |
| Build command | `npm ci && npm run build:worker` |
| Deploy command | `npx wrangler deploy --config wrangler.deploy.json` |

Then open **Settings → Build → Environment variables** (the build environment, not the
runtime one) and add both, as plain text:

| Name | Value |
| --- | --- |
| `D1_DATABASE_ID` | the id from your D1 database page |
| `KV_NAMESPACE_ID` | the id from your KV namespace page |

The Worker name must stay `brandmitra-deploy`: it is written in
[`deploy/wrangler.template.json`](../deploy/wrangler.template.json), and Cloudflare rejects a
build that deploys to a different name.

Why those commands: `npm run build` alone produces a Next.js folder that Cloudflare cannot run.
`npm run build:worker` writes the Wrangler config from your two ids, then runs the OpenNext
adapter and produces `.open-next/worker.js` plus `.open-next/assets`, which is what
`wrangler deploy` uploads. `npm ci` is included so the build never depends on Cloudflare
detecting the lockfile for you.

Runtime secrets (for example `GEMINI_API_KEY`) still go in **Settings → Variables and Secrets**
of the Worker, never in the repository.

---

## What runs on a push

[`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml):

1. installs from `package-lock.json` (`npm ci`)
2. runs the TypeScript check
3. builds the Worker bundle with OpenNext, writing `wrangler.deploy.json` from
   [`deploy/wrangler.template.json`](../deploy/wrangler.template.json) using your ids
5. deploys with `wrangler deploy`

Until the repository has the `CLOUDFLARE_ACCOUNT_ID` variable, the deploy job is **skipped**,
so pushes keep passing CI while you decide.

The cache uses Workers KV instead of R2, so nothing here needs a credit card.
The database tables create themselves on the first request — there is no migration step.

---

## Route A — GitHub Actions with an API token

## One-time setup (about 10 minutes, on a phone is fine)

All of this happens in the Cloudflare dashboard and on GitHub, no terminal needed.

### 1. Cloudflare account

Create one at <https://dash.cloudflare.com/sign-up>. Stay on the **Free** plan.

### 2. Create the database

**Storage & Databases → D1 SQL Database → Create**.
Name it `brandmitra`, pick a region near your users, create it, then copy the
**Database ID** (a long id like `314e0905-…`). That is `D1_DATABASE_ID`.

### 3. Create the cache namespace

**Storage & Databases → Workers KV → Create instance**.
Name it `brandmitra-cache` and copy its **Namespace ID** (32 hex characters).
That is `KV_NAMESPACE_ID`.

### 4. Create an API token

**My Profile → API Tokens → Create Token → "Edit Cloudflare Workers" template → Continue**.
Then make sure these permissions are included:

- Account · Workers Scripts · **Edit**
- Account · D1 · **Edit**
- Account · Workers KV Storage · **Edit**
- Account · Account Settings · **Read**

Create the token and copy it once — Cloudflare never shows it again. That is
`CLOUDFLARE_API_TOKEN`.

The **Account ID** is on the right side of the dashboard's overview page, or in the URL.

### 5. Put the four values on GitHub

Repository → **Settings → Secrets and variables → Actions**.

**Secrets** tab → *New repository secret*:

| Name | Value |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | the token from step 4 |

**Variables** tab → *New repository variable*:

| Name | Value |
| --- | --- |
| `CLOUDFLARE_ACCOUNT_ID` | your Cloudflare account id |
| `D1_DATABASE_ID` | the id from step 2 |
| `KV_NAMESPACE_ID` | the id from step 3 |

Variables are not secrets, but keeping the ids there means nobody has to edit a file.

### 6. Push

```bash
git commit --allow-empty -m "Deploy on push"
git push
```

Watch **Actions → Deploy** in the repository. When it is green, open
`https://brandmitra.<your-subdomain>.workers.dev` and sign up — the storefront flow is the
same as on the Freebuff site.

Your subdomain is shown under **Compute (Workers) → brandmitra → Settings → Domains & Routes**.

### 7. App secrets

`GEMINI_API_KEY` is a server secret and never goes in the repository. Add it in
**Compute (Workers) → brandmitra → Settings → Variables and Secrets** (type: Secret), then
re-run the workflow or push again so a new deployment picks it up.

---

## Running a deploy by hand

Still possible, from any machine with Node 22.5+:

```bash
npm ci
D1_DATABASE_ID=... KV_NAMESPACE_ID=... npm run deploy
```

The same three commands the workflow runs. It needs `CLOUDFLARE_API_TOKEN` and
`CLOUDFLARE_ACCOUNT_ID` in the environment.

---

## When something fails

| Message | Cause and fix |
| --- | --- |
| Job says *Skipped* | `CLOUDFLARE_ACCOUNT_ID` variable is missing — step 5 |
| `Cannot build the deploy config: D1_DATABASE_ID is not set` | Add the `D1_DATABASE_ID` variable |
| `D1_DATABASE_ID is not a database id` | You pasted the name or the account id instead of the database id |
| `Authentication error [code: 10000]` | The token is wrong, expired, or lacks the permissions in step 4 |
| `You do not have permission to access this resource` | The token belongs to a different account than `CLOUDFLARE_ACCOUNT_ID` |
| Site opens but pages error | Check **Workers → brandmitra → Logs**, and that the D1 binding is named `DB` |

## Limits worth knowing

Workers free plan: 100,000 requests per day, 10 ms CPU per request (averaged), D1 free tier
5 million rows read and 100,000 rows written per day. KV free tier: 100,000 reads and
1,000 writes per day. For a few hundred storefront visitors a day this is plenty — see
[free vs paid](05-free-vs-paid.md) before a launch that could go viral.
