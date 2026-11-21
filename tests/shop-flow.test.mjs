/**
 * END-TO-END SHOP TEST.
 *
 * Signs up a shop the same way a person does — by filling in real forms — then
 * exercises the stock, staff and settings actions and checks the database
 * afterwards. Nothing is mocked: every step is an HTTP request to the running
 * app, and every server action runs for real.
 *
 * How it talks to the app: every form in this project is a plain HTML form
 * posting to a Next.js server action, so it also works with JavaScript turned
 * off. The rendered page carries a hidden `$ACTION_ID_...` field, and posting
 * that field back to the page URL runs the action. That is exactly what this
 * test does, so it needs no browser and no test-only hooks in the app.
 *
 * Run it with:  npm run test:e2e
 * It uses a dev server already listening on port 3000 if there is one, and
 * otherwise starts its own on port 3325. Test rows are named `e2e-...` and are
 * deleted at the end, including if a step fails.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DB_FILE = path.join(ROOT, ".data", "brandmitra.db");
const OWN_PORT = Number(process.env.E2E_PORT ?? 3325);
const CANDIDATES = [
  process.env.E2E_BASE_URL,
  "http://127.0.0.1:3000",
  `http://127.0.0.1:${OWN_PORT}`,
].filter(Boolean);

const stamp = Date.now().toString(36);
const ownerEmail = `e2e-owner-${stamp}@example.com`;
const staffEmail = `e2e-staff-${stamp}@example.com`;
const ownerPassword = `e2e-pass-${stamp}`;
const newEmail = `e2e-renamed-${stamp}@example.com`;
const newPassword = `e2e-next-${stamp}`;
const shopName = `E2E Cafe ${stamp}`;
const productName = `E2E Chai ${stamp}`;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/* ------------------------------------------------------------------ */
/* Server                                                              */
/* ------------------------------------------------------------------ */

async function reachable(base) {
  try {
    const res = await fetch(`${base}/login`, { redirect: "manual" });
    return res.status === 200;
  } catch {
    return false;
  }
}

async function ensureServer() {
  for (const base of CANDIDATES) {
    if (await reachable(base)) return { base, stop: async () => {} };
  }

  const nextBin = path.join(ROOT, "node_modules", "next", "dist", "bin", "next");
  assert.ok(existsSync(nextBin), "Run `npm install` first: node_modules/next is missing.");

  const child = spawn(process.execPath, [nextBin, "dev", "-H", "127.0.0.1", "-p", String(OWN_PORT)], {
    cwd: ROOT,
    env: { ...process.env, BRANDMITRA_PREVIEW_HOST: "" },
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
  });

  let logs = "";
  child.stdout.on("data", (chunk) => (logs += chunk));
  child.stderr.on("data", (chunk) => (logs += chunk));

  const base = `http://127.0.0.1:${OWN_PORT}`;
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`next dev exited before it was ready:\n${logs.slice(-4000)}`);
    }
    if (await reachable(base)) {
      return {
        base,
        stop: async () => {
          try {
            process.kill(-child.pid, "SIGTERM");
          } catch {
            try {
              child.kill("SIGTERM");
            } catch {
              /* already gone */
            }
          }
          await sleep(500);
        },
      };
    }
    await sleep(500);
  }
  child.kill("SIGTERM");
  throw new Error(`next dev did not answer on ${base} within 2 minutes:\n${logs.slice(-4000)}`);
}

/* ------------------------------------------------------------------ */
/* HTTP: forms and cookies                                             */
/* ------------------------------------------------------------------ */

const ACTION_INPUT = /name="(\$ACTION_ID_[0-9a-f]+)"/;

/**
 * Finds the action id of the form on the page whose fields include every name
 * in `fields` and none of `without`. The rendered page also contains a serialised
 * copy of the markup, so only real <form> blocks are considered.
 */
function findActionId(html, fields, without = []) {
  for (const match of html.matchAll(/<form\b[^>]*>([\s\S]*?)<\/form>/g)) {
    const form = match[1];
    const names = [...form.matchAll(/name="([^"]+)"/g)]
      .map((entry) => entry[1])
      .filter((name) => !name.startsWith("$ACTION_ID_"));
    if (!fields.every((field) => names.includes(field))) continue;
    if (without.some((field) => names.includes(field))) continue;
    const action = form.match(ACTION_INPUT);
    if (action) return action[1];
  }
  return null;
}

function createApi(base) {
  const jar = { cookie: "" };

  async function send(pathname, init = {}) {
    const headers = new Headers(init.headers);
    if (jar.cookie) headers.set("cookie", jar.cookie);
    const res = await fetch(new URL(pathname, base), { redirect: "manual", ...init, headers });
    for (const cookie of res.headers.getSetCookie()) {
      if (cookie.startsWith("bm_session=")) jar.cookie = cookie.split(";")[0];
    }
    return res;
  }

  async function get(pathname) {
    const res = await send(pathname);
    return { res, html: await res.text() };
  }

  /** Opens `pathname`, fills the matching form and submits it like a browser would. */
  async function submit(pathname, fields, without = []) {
    const { res, html } = await get(pathname);
    assert.equal(res.status, 200, `GET ${pathname} returned ${res.status}, not the form`);
    const actionId = findActionId(html, Object.keys(fields), without);
    assert.ok(
      actionId,
      `No form on ${pathname} has the fields ${Object.keys(fields).join(", ")}` +
        (without.length ? ` without ${without.join(", ")}` : ""),
    );

    const body = new FormData();
    for (const [key, value] of Object.entries(fields)) body.append(key, value);
    body.append(actionId, "");

    const response = await send(pathname, { method: "POST", body });
    assert.equal(
      response.status,
      303,
      `POST ${pathname} returned ${response.status}, so the action did not redirect`,
    );
    const location = response.headers.get("location");
    assert.ok(location, `POST ${pathname} did not return a Location header`);
    return location;
  }

  return { jar, get, submit };
}

/* ------------------------------------------------------------------ */
/* Database (the same local SQLite file the dev server writes)          */
/* ------------------------------------------------------------------ */

let db = null;

function database() {
  if (!db) {
    assert.ok(
      existsSync(DB_FILE),
      `No database at ${DB_FILE}. Start the app once (npm run dev) so it creates .data/brandmitra.db.`,
    );
    db = new DatabaseSync(DB_FILE);
    db.exec("PRAGMA foreign_keys = ON;");
  }
  return db;
}

function row(sql, ...params) {
  return database().prepare(sql).get(...params) ?? null;
}

/** Removes every row created by this test, safely for the foreign keys. */
function purge() {
  if (!existsSync(DB_FILE)) return;
  const connection = database();
  const users = connection.prepare("SELECT id FROM users WHERE email LIKE 'e2e-%@example.com'").all();
  for (const user of users) {
    const businesses = connection.prepare("SELECT id FROM businesses WHERE owner_user_id = ?").all(user.id);
    for (const business of businesses) {
      connection.prepare("DELETE FROM businesses WHERE id = ?").run(business.id);
    }
    connection.prepare("DELETE FROM audit_logs WHERE actor_user_id = ?").run(user.id);
    connection.prepare("DELETE FROM users WHERE id = ?").run(user.id);
  }
}

/* ------------------------------------------------------------------ */
/* The test                                                            */
/* ------------------------------------------------------------------ */

test("a new shop signs up and uses the stock, staff and settings actions", { timeout: 240_000 }, async () => {
  const server = await ensureServer();
  const owner = createApi(server.base);

  try {
    purge();

    /* ---- Sign up and open the business ---------------------------- */
    let location = await owner.submit("/signup", {
      fullName: "E2E Owner",
      email: ownerEmail,
      password: ownerPassword,
    });
    assert.equal(location, "/onboarding", "signing up should continue to onboarding");
    assert.ok(owner.jar.cookie.startsWith("bm_session="), "signup should set the session cookie");

    const ownerRow = row("SELECT id, email FROM users WHERE email = ?", ownerEmail);
    assert.ok(ownerRow, "signup should create the user row");

    location = await owner.submit("/onboarding", {
      name: shopName,
      industry: "cafe",
      city: "Pune",
      tagline: "End-to-end test shop",
    });
    assert.equal(location, "/dashboard?welcome=1", "creating a business should open the dashboard");

    const business = row("SELECT id, slug, name, industry FROM businesses WHERE owner_user_id = ?", ownerRow.id);
    assert.ok(business, "onboarding should create the business");
    assert.equal(business.name, shopName);
    assert.equal(business.industry, "cafe");
    assert.equal(
      row("SELECT role FROM business_members WHERE business_id = ? AND user_id = ?", business.id, ownerRow.id).role,
      "owner",
    );

    // Products are not capped on the Free plan, and the screen says so.
    const catalogue = await owner.get("/dashboard/products");
    assert.equal(catalogue.res.status, 200, "the products page should open");
    // React separates text nodes with <!-- --> comments in the server HTML.
    const catalogueText = catalogue.html.replace(/<!--[\s\S]*?-->/g, "");
    assert.match(
      catalogueText,
      /of Unlimited products used/,
      "the Free plan should show an unlimited product allowance",
    );

    /* ---- A product to track --------------------------------------- */
    location = await owner.submit("/dashboard/products/new", {
      name: productName,
      price: "40",
      isActive: "on",
      isAvailable: "on",
    });
    const productMatch = location.match(/^\/dashboard\/products\/([0-9a-f-]{36})/);
    assert.ok(productMatch, `creating a product should open it, got "${location}"`);
    const productId = productMatch[1];

    /* ---- Stock: zero sells out, restocking brings it back ---------- */
    location = await owner.submit("/dashboard/inventory", { productId, quantity: "0", threshold: "3" });
    assert.equal(location, "/dashboard/inventory?saved=1", "saving stock should confirm the save");
    assert.equal(
      row("SELECT stock_on_hand FROM inventory WHERE product_id = ?", productId).stock_on_hand,
      0,
      "zero stock should be stored",
    );
    assert.equal(
      row("SELECT is_available FROM products WHERE id = ?", productId).is_available,
      0,
      "zero stock should mark the product sold out",
    );

    location = await owner.submit("/dashboard/inventory", { productId, delta: "10" });
    assert.equal(location, "/dashboard/inventory?saved=1");
    assert.equal(
      row("SELECT stock_on_hand FROM inventory WHERE product_id = ?", productId).stock_on_hand,
      10,
      "a +10 adjustment should be added to the stored quantity",
    );
    assert.equal(
      row("SELECT is_available FROM products WHERE id = ?", productId).is_available,
      1,
      "restocking should make the product available again",
    );

    /* ---- Staff: seat limit, add, change role, remove -------------- */
    const staffUser = createApi(server.base);
    location = await staffUser.submit("/signup", {
      fullName: "E2E Staff",
      email: staffEmail,
      password: ownerPassword,
    });
    assert.equal(location, "/onboarding");
    const staffRow = row("SELECT id FROM users WHERE email = ?", staffEmail);
    assert.ok(staffRow, "the staff member should have a real account");

    // The Free plan has one seat and the owner already uses it.
    location = await owner.submit("/dashboard/staff", { email: staffEmail });
    assert.equal(location, "/dashboard/staff?error=limit", "the seat limit should be enforced");
    assert.equal(
      row("SELECT id FROM business_members WHERE business_id = ? AND user_id = ?", business.id, staffRow.id),
      null,
      "a refused add must not create a membership",
    );

    // Upgrading is a fixture here: this project has no payment provider yet.
    database().prepare("UPDATE subscriptions SET plan_id = 'starter' WHERE business_id = ?").run(business.id);

    location = await owner.submit("/dashboard/staff", { email: staffEmail });
    assert.equal(location, "/dashboard/staff?saved=1", "adding staff on a bigger plan should work");
    const member = row(
      "SELECT id, role FROM business_members WHERE business_id = ? AND user_id = ?",
      business.id,
      staffRow.id,
    );
    assert.ok(member, "the staff membership should be stored");
    assert.equal(member.role, "staff");

    location = await owner.submit("/dashboard/staff", { id: member.id, role: "manager" });
    assert.equal(location, "/dashboard/staff?saved=1");
    assert.equal(
      row("SELECT role FROM business_members WHERE id = ?", member.id).role,
      "manager",
      "the saved role should change",
    );

    location = await owner.submit("/dashboard/staff", { id: member.id }, ["role"]);
    assert.equal(location, "/dashboard/staff?removed=1");
    assert.equal(
      row("SELECT id FROM business_members WHERE id = ?", member.id),
      null,
      "removing a member should delete the membership",
    );

    /* ---- Settings: business, account, password, WhatsApp ---------- */
    location = await owner.submit("/dashboard/settings", { name: `${shopName} Renamed`, industry: "bakery" });
    assert.equal(location, "/dashboard/settings?saved=1");
    const renamed = row("SELECT name, industry FROM businesses WHERE id = ?", business.id);
    assert.equal(renamed.name, `${shopName} Renamed`);
    assert.equal(renamed.industry, "bakery");

    location = await owner.submit("/dashboard/settings", { fullName: "E2E Owner Renamed", email: newEmail });
    assert.equal(location, "/dashboard/settings?saved=account");
    const account = row("SELECT full_name, email FROM users WHERE id = ?", ownerRow.id);
    assert.equal(account.full_name, "E2E Owner Renamed");
    assert.equal(account.email, newEmail);

    location = await owner.submit("/dashboard/settings", {
      currentPassword: ownerPassword,
      newPassword,
      confirmPassword: newPassword,
    });
    assert.equal(location, "/dashboard/settings?saved=password");

    location = await owner.submit("/dashboard/whatsapp", { whatsapp: "+91 98765 43210" });
    assert.equal(location, "/dashboard/whatsapp?saved=1");
    assert.equal(
      row("SELECT whatsapp FROM business_profiles WHERE business_id = ?", business.id).whatsapp,
      "+91 98765 43210",
    );

    // The new email and password really work: sign in again from scratch.
    const returning = createApi(server.base);
    location = await returning.submit("/login", { email: newEmail, password: newPassword });
    assert.equal(location, "/dashboard", "the changed email and password should sign in");
  } finally {
    try {
      purge();
    } finally {
      if (db) db.close();
      await server.stop();
    }
  }
});
