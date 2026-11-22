#!/usr/bin/env node
/**
 * GIVES FOUNDER ACCESS TO NAMED ACCOUNTS.
 *
 *   npm run grant:founders -- me@example.com cofounder1@example.com cofounder2@example.com
 *
 * "Founder" is not a new concept in the database: it is the `is_platform_admin`
 * flag that already existed on `users`. This script turns it on for exactly the
 * accounts you name, nothing more, and puts each of them on the top plan so every
 * screen of the product is switched on while you show it to people.
 *
 * What it changes, per email:
 *   users.is_platform_admin = 1     every screen of their own business, owner-level
 *   subscriptions.plan_id   = enterprise   all features, the largest AI allowance
 *   plans.staff_limit       = 1000000      no seat cap (already the default now)
 *
 * What it does NOT do: create accounts, reset passwords, touch anyone else's
 * business, or open a business the person is not a member of. Founders are only
 * powerful inside a business they already belong to.
 *
 * Run it locally against .data/brandmitra.db, or copy the SQL it prints into your
 * deployed database with one wrangler command (see the end of its output).
 */
import { existsSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DB_FILE = path.join(ROOT, ".data", "brandmitra.db");

const emails = process.argv
  .slice(2)
  .map((value) => value.trim().toLowerCase())
  .filter((value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value));

if (emails.length === 0) {
  console.error(
    [
      "Usage: npm run grant:founders -- you@example.com cofounder@example.com [more@example.com]",
      "",
      "Each address must already have a Vantra account (they sign up first, normally),",
      "and the person must have finished onboarding their own business.",
    ].join("\n"),
  );
  process.exit(1);
}

if (!existsSync(DB_FILE)) {
  console.error(
    `No database at ${DB_FILE}.\nStart the app once (npm run dev) so it is created, then run this again.`,
  );
  process.exit(1);
}

const db = new DatabaseSync(DB_FILE);
db.exec("PRAGMA foreign_keys = ON;");

const sql = [];
const now = new Date().toISOString();

console.log(`Granting founder access to ${emails.length} account(s).\n`);

let changed = 0;
for (const email of emails) {
  const user = db.prepare("SELECT id, email, is_platform_admin FROM users WHERE lower(email) = ?").get(email);
  if (!user) {
    console.log(`  ✗ ${email} — no Vantra account yet. They sign up at /signup first.`);
    continue;
  }

  db.prepare("UPDATE users SET is_platform_admin = 1 WHERE id = ?").run(user.id);
  sql.push(`UPDATE users SET is_platform_admin = 1 WHERE lower(email) = '${email}';`);

  const memberships = db
    .prepare("SELECT business_id, role FROM business_members WHERE user_id = ?")
    .all(user.id);

  if (memberships.length === 0) {
    console.log(
      `  ⚠ ${email} — founder flag set, but they have no business yet. It applies to whatever they create or are added to.`,
    );
    changed += 1;
    continue;
  }

  for (const membership of memberships) {
    const business = db.prepare("SELECT name FROM businesses WHERE id = ?").get(membership.business_id);
    db.prepare("UPDATE plans SET staff_limit = 1000000 WHERE staff_limit < 1000000").run();

    const existing = db
      .prepare("SELECT id FROM subscriptions WHERE business_id = ?")
      .get(membership.business_id);

    if (existing) {
      db.prepare("UPDATE subscriptions SET plan_id = 'enterprise', status = 'active' WHERE business_id = ?").run(
        membership.business_id,
      );
    } else {
      db.prepare(
        "INSERT INTO subscriptions (id, business_id, plan_id, status, current_period_end, created_at) VALUES (?, ?, 'enterprise', 'active', NULL, ?)",
      ).run(crypto.randomUUID(), membership.business_id, now);
    }

    sql.push(
      `UPDATE subscriptions SET plan_id = 'enterprise', status = 'active' WHERE business_id = (SELECT id FROM businesses WHERE name = '${String(
        business?.name ?? "",
      ).replaceAll("'", "''")}');`,
    );
    sql.push(
      `INSERT INTO subscriptions (id, business_id, plan_id, status, created_at) SELECT 'founder-${membership.business_id.slice(
        0,
        8,
      )}', id, 'enterprise', 'active', '${now}' FROM businesses WHERE id = '${membership.business_id}' AND NOT EXISTS (SELECT 1 FROM subscriptions WHERE business_id = '${membership.business_id}');`,
    );

    console.log(
      `  ✓ ${email} — founder, owner-level on "${business?.name ?? membership.business_id}", plan set to Enterprise (all features, 25,000 AI credits a month).`,
    );
  }
  changed += 1;
}

if (changed === 0) {
  console.log("\nNothing changed. Check the addresses and try again.");
  db.close();
  process.exit(1);
}

console.log(
  [
    "",
    "Done. Sign out and back in (or reload) so the new permissions are read.",
    "Team seats are unlimited on every plan, so adding your co-founders at",
    "Dashboard → Staff has no cap — but founder access itself belongs only to",
    "the accounts listed above. Everyone else can be added as staff, without it.",
    "",
    "── For the deployed database ─────────────────────────────────────────────",
    "Cloudflare D1 is a separate copy. Run the SQL below against it:",
    "",
    `   npx wrangler d1 execute brandmitra --remote --command="<one statement at a time>"`,
    "",
    ...sql.map((statement) => `   ${statement}`),
    "",
    `(The database name comes from deploy/wrangler.template.json; use --local for your own machine.)`,
  ].join("\n"),
);

db.close();
