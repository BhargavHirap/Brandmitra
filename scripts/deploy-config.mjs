#!/usr/bin/env node
/**
 * Writes the Wrangler config from deploy/wrangler.template.json.
 *
 * Wrangler needs the real D1 database id and KV namespace id in its config, and
 * those are different for every Cloudflare account. They arrive as environment
 * variables so they never have to be edited into a committed file:
 *
 *   D1_DATABASE_ID   from the D1 database page in the Cloudflare dashboard
 *   KV_NAMESPACE_ID  from the Workers KV page in the Cloudflare dashboard
 *
 * Two copies are written on purpose, with identical contents:
 *
 *   wrangler.deploy.json  used by the explicit deploy commands in this repo
 *   wrangler.jsonc        the name Wrangler looks for on its own, so a plain
 *                         `npx wrangler deploy` in Cloudflare's Build settings
 *                         works too instead of failing with "Missing entry-point"
 *
 * Both are git-ignored: they are build output, not source.
 *
 * Usage:
 *   D1_DATABASE_ID=... KV_NAMESPACE_ID=... node scripts/deploy-config.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const d1 = (process.env.D1_DATABASE_ID ?? "").trim();
const kv = (process.env.KV_NAMESPACE_ID ?? "").trim();

const problems = [];
if (!d1) problems.push("D1_DATABASE_ID is not set.");
else if (!UUID.test(d1)) problems.push(`D1_DATABASE_ID is not a database id: "${d1}".`);

if (!kv) problems.push("KV_NAMESPACE_ID is not set.");
else if (!/^[0-9a-f]{32}$/i.test(kv) && !UUID.test(kv))
  problems.push(`KV_NAMESPACE_ID is not a namespace id: "${kv}".`);

if (problems.length > 0) {
  console.error("Cannot build the deploy config:");
  for (const problem of problems) console.error(`  - ${problem}`);
  console.error(
    "\nThese are build-time environment variables, not Worker secrets. On Cloudflare:"
      + "\n  Worker → Settings → Build → Build configuration → Build variables"
      + "\nRead docs/13-deploy-on-push.md — it shows where each id comes from in the Cloudflare dashboard.",
  );
  process.exit(1);
}

const template = readFileSync("deploy/wrangler.template.json", "utf8");
const filled = template
  .replaceAll("__D1_DATABASE_ID__", d1)
  .replaceAll("__KV_NAMESPACE_ID__", kv);

// Fail loudly here instead of inside wrangler if the file is not valid JSON.
JSON.parse(filled);

for (const file of ["wrangler.deploy.json", "wrangler.jsonc"]) {
  writeFileSync(file, filled);
}
console.log(
  "Wrote wrangler.deploy.json and wrangler.jsonc (D1 "
    + d1.slice(0, 8)
    + "…, KV "
    + kv.slice(0, 8)
    + "…).",
);
