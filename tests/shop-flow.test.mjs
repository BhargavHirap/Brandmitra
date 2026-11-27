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
import test, { after, before } from "node:test";
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
  const jar = { cookie: "", all: {} };

  async function send(pathname, init = {}) {
    const headers = new Headers(init.headers);
    const jarCookies = Object.values(jar.all);
    if (jarCookies.length > 0) headers.set("cookie", jarCookies.join("; "));
    const res = await fetch(new URL(pathname, base), { redirect: "manual", ...init, headers });
    for (const cookie of res.headers.getSetCookie()) {
      const pair = cookie.split(";")[0];
      const [name] = pair.split("=");
      // Every cookie the app sets, not just the session: the one-time reset
      // link travels in an httpOnly cookie too.
      jar.all[name] = pair;
      if (name === "bm_session") jar.cookie = pair;
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

  // `send` is exposed so a test can post a form the page itself has hidden.
  return { jar, get, send, submit, cookies: () => Object.values(jar.all).join("; ") };
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

/**
 * One server for the whole file, started outside every test's own clock.
 *
 * Starting `next dev` and compiling the first routes costs more than a test's
 * timeout on a cold machine, so when every test called ensureServer() itself the
 * first test failed at 240s before it had done any work. The server now starts
 * once, before the tests, and is stopped after the last one.
 */
let server;
before(async () => {
  server = await ensureServer();
});
after(async () => {
  await server?.stop();
});

test("a new shop signs up and uses the stock, staff and settings actions", { timeout: 240_000 }, async () => {
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

    // The catalogue starts with categories for the type they picked, not a
    // restaurant menu. A cafe gets the cafe list from src/lib/industries.ts.
    const seededCategories = database()
      .prepare("SELECT name FROM product_categories WHERE business_id = ? ORDER BY sort_order")
      .all(business.id)
      .map((entry) => entry.name);
    assert.deepEqual(
      seededCategories,
      ["Coffee", "Tea", "Cold drinks", "Snacks", "Bakes"],
      "onboarding should seed categories for the chosen business type",
    );

    // Products are not capped on the Free plan, and the screen says so.
    const catalogue = await owner.get("/dashboard/products");
    assert.equal(catalogue.res.status, 200, "the products page should open");
    // React separates text nodes with <!-- --> comments in the server HTML.
    const catalogueText = catalogue.html.replace(/<!--[\s\S]*?-->/g, "");
    assert.match(
      catalogueText,
      /of Unlimited menu items used/,
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

    /* ---- Checkout takes stock; the last unit goes to one buyer ---- */
    location = await owner.submit("/dashboard/inventory", { productId, quantity: "1", threshold: "1" });
    assert.equal(location, "/dashboard/inventory?saved=1");

    const slug = business.slug;
    const buyerA = createApi(server.base);
    const buyerB = createApi(server.base);

    // Two separate browsers, each holding one unit of the same product.
    for (const buyer of [buyerA, buyerB]) {
      location = await buyer.submit(`/b/${slug}`, { slug, productId, quantity: "1" });
      assert.equal(location, `/b/${slug}/cart?added=1`, "adding to the cart should land on the cart");
    }

    // Keep the checkout action id before the cart is consumed: the second
    // buyer's page hides this form once the product is sold out, and the point
    // of the test is that the server refuses even when the form is posted.
    const buyerACart = await buyerA.get(`/b/${slug}/cart`);
    const checkoutAction = findActionId(buyerACart.html, ["slug", "name", "phone"]);
    assert.ok(checkoutAction, "the first buyer's cart should offer a checkout form");

    location = await buyerA.submit(`/b/${slug}/cart`, {
      slug,
      name: "Buyer One",
      phone: "9876500001",
    });
    assert.match(location, new RegExp(`^/b/${slug}/order/`), `the first buyer should get an order, got ${location}`);
    assert.equal(
      row("SELECT stock_on_hand FROM inventory WHERE product_id = ?", productId).stock_on_hand,
      0,
      "checkout should take the unit out of stock",
    );
    assert.equal(
      row("SELECT is_available FROM products WHERE id = ?", productId).is_available,
      0,
      "selling the last unit should mark the product sold out",
    );

    // The second buyer's cart already shows the item as gone, and posts nothing.
    const buyerBCart = await buyerB.get(`/b/${slug}/cart`);
    assert.equal(
      findActionId(buyerBCart.html, ["slug", "name", "phone"]),
      null,
      "a sold-out cart must not offer checkout",
    );
    assert.ok(
      buyerBCart.html.includes("Remove the unavailable items"),
      "the second buyer should be told the item is gone, not shown a checkout button",
    );

    // Posting the action anyway must still be refused by the server, not oversold.
    const secondBody = new FormData();
    secondBody.append("slug", slug);
    secondBody.append("name", "Buyer Two");
    secondBody.append("phone", "9876500002");
    secondBody.append(checkoutAction, "");
    const secondResponse = await buyerB.send(`/b/${slug}/cart`, {
      method: "POST",
      body: secondBody,
    });
    assert.equal(secondResponse.status, 303, "the refused checkout should redirect");
    assert.equal(
      secondResponse.headers.get("location"),
      `/b/${slug}/cart?error=unavailable`,
      "the second buyer must be refused",
    );
    assert.equal(
      row("SELECT COUNT(*) AS n FROM orders WHERE business_id = ?", business.id).n,
      1,
      "a refused checkout must not create an order",
    );
    assert.equal(
      row("SELECT stock_on_hand FROM inventory WHERE product_id = ?", productId).stock_on_hand,
      0,
      "a refused checkout must not push stock below zero",
    );

    /* ---- Two left but three wanted: the server refuses the shortage ---- */
    // The last case can be caught while the page is rendered. This one cannot:
    // both carts look orderable, so only the atomic UPDATE can settle it.
    location = await owner.submit("/dashboard/inventory", { productId, quantity: "3", threshold: "1" });
    assert.equal(location, "/dashboard/inventory?saved=1");

    const buyerC = createApi(server.base);
    const buyerD = createApi(server.base);
    for (const buyer of [buyerC, buyerD]) {
      location = await buyer.submit(`/b/${slug}`, { slug, productId, quantity: "2" });
      assert.equal(location, `/b/${slug}/cart?added=1`);
    }

    location = await buyerC.submit(`/b/${slug}/cart`, {
      slug,
      name: "Buyer Three",
      phone: "9876500003",
    });
    assert.match(location, new RegExp(`^/b/${slug}/order/`), `the third buyer should get an order, got ${location}`);
    assert.equal(
      row("SELECT stock_on_hand FROM inventory WHERE product_id = ?", productId).stock_on_hand,
      1,
      "two of the three units should leave the shelf",
    );
    assert.equal(
      row("SELECT is_available FROM products WHERE id = ?", productId).is_available,
      1,
      "one unit is left, so the product stays on sale",
    );

    const buyerDCart = await buyerD.get(`/b/${slug}/cart`);
    assert.ok(
      findActionId(buyerDCart.html, ["slug", "name", "phone"]),
      "the fourth buyer's cart still looks orderable, which is why the server has to decide",
    );

    location = await buyerD.submit(`/b/${slug}/cart`, {
      slug,
      name: "Buyer Four",
      phone: "9876500004",
    });
    assert.equal(location, `/b/${slug}/cart?error=stock`, "the shortage must be refused by the server");
    assert.equal(
      row("SELECT COUNT(*) AS n FROM orders WHERE business_id = ?", business.id).n,
      2,
      "the refused checkout must not become an order",
    );
    assert.equal(
      row("SELECT stock_on_hand FROM inventory WHERE product_id = ?", productId).stock_on_hand,
      1,
      "the refused checkout must leave the last unit where it was",
    );

    /* ---- Staff: no seat cap, add, change role, remove ------------- */
    const staffUser = createApi(server.base);
    location = await staffUser.submit("/signup", {
      fullName: "E2E Staff",
      email: staffEmail,
      password: ownerPassword,
    });
    assert.equal(location, "/onboarding");
    const staffRow = row("SELECT id FROM users WHERE email = ?", staffEmail);
    assert.ok(staffRow, "the staff member should have a real account");

    // Every plan is uncapped: the owner already has one seat and that is not a
    // reason to refuse a second person.
    location = await owner.submit("/dashboard/staff", { email: staffEmail });
    assert.equal(
      location,
      "/dashboard/staff?saved=1",
      "no plan limits team size, so the free plan must accept a second member",
    );

    // A refusal still has to be a refusal: an address with no account is refused
    // and stores nothing.
    location = await owner.submit("/dashboard/staff", { email: `e2e-nobody-${stamp}@example.com` });
    assert.equal(location, "/dashboard/staff?error=unknown", "an address with no account is refused");
    assert.equal(
      row("SELECT COUNT(*) AS n FROM business_members WHERE business_id = ?", business.id).n,
      2,
      "a refused add must not create a membership",
    );

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
      if (db) {
        db.close();
        db = null; // let the next test reopen the same file
      }
    }
  }
});

test("a salon is shown salon words, not a restaurant menu", { timeout: 240_000 }, async () => {
  const owner = createApi(server.base);
  const email = `e2e-salon-${stamp}@example.com`;
  const shop = `E2E Salon ${stamp}`;
  const text = (html) => html.replace(/<!--[\s\S]*?-->/g, "");

  try {
    purge();

    let location = await owner.submit("/signup", {
      fullName: "E2E Salon Owner",
      email,
      password: ownerPassword,
    });
    assert.equal(location, "/onboarding");

    location = await owner.submit("/onboarding", {
      name: shop,
      industry: "salon",
      city: "Pune",
      tagline: "End-to-end salon",
    });
    assert.equal(location, "/dashboard?welcome=1");

    const dashboard = await owner.get("/dashboard");
    assert.equal(dashboard.res.status, 200);
    const page = text(dashboard.html);

    // The sidebar and the page copy use this business's own vocabulary.
    for (const label of ["Services", "Service groups", "Appointments", "Appointment board", "Clients"]) {
      assert.ok(page.includes(label), `a salon dashboard should say "${label}"`);
    }
    assert.ok(
      !page.includes("Kitchen display"),
      "a salon must not be shown a kitchen display",
    );

    // The seeded categories come from the salon type, not the cafe list.
    const business = row(
      "SELECT id, slug FROM businesses WHERE name = ?",
      shop,
    );
    const seeded = database()
      .prepare("SELECT name FROM product_categories WHERE business_id = ? ORDER BY sort_order")
      .all(business.id)
      .map((entry) => entry.name);
    assert.deepEqual(seeded, ["Haircuts", "Colour", "Styling", "Bridal", "Packages"]);

    // The app board is titled for appointments and offers no delivery step.
    const board = await owner.get("/dashboard/kitchen");
    assert.equal(board.res.status, 200);
    const boardPage = text(board.html);
    assert.ok(boardPage.includes("Appointment board"), "the board should be an appointment board");
    assert.ok(!boardPage.includes("Out for delivery"), "a salon board has no delivery step");

    const products = await owner.get("/dashboard/products");
    assert.ok(text(products.html).includes("Services"), "the catalogue should be called Services");

    // The public storefront speaks the salon's language too, not a restaurant menu.
    const storefront = await fetch(`${server.base}/b/${business.slug}`);
    assert.equal(storefront.status, 200, "the salon storefront should open");
    const storefrontPage = text(await storefront.text());
    assert.ok(
      storefrontPage.includes("Services coming soon"),
      "an empty salon storefront should promise services, not a catalogue",
    );
    assert.ok(storefrontPage.includes("Browse services"), "the hero button should offer services");
    assert.ok(
      !storefrontPage.includes("Catalogue"),
      "a salon storefront must not be called a catalogue",
    );

    const cartPage = text(await (await fetch(`${server.base}/b/${business.slug}/cart`)).text());
    assert.ok(cartPage.includes("Your booking"), "the salon cart should be a booking");
  } finally {
    purge();
  }
});

test("a clinic front desk books a slot, chases a callback and closes it", { timeout: 240_000 }, async () => {
  const owner = createApi(server.base);
  const email = `e2e-clinic-${stamp}@example.com`;
  const shop = `E2E Clinic ${stamp}`;
  const text = (html) => html.replace(/<!--[\s\S]*?-->/g, "");

  // Tomorrow at 09:30 IST, inside the hours this test sets below.
  const todayKey = new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10);
  const tomorrowKey = new Date(Date.parse(`${todayKey}T00:00:00Z`) + 86_400_000)
    .toISOString()
    .slice(0, 10);
  const startsAt = `${tomorrowKey}T09:30:00+05:30`;

  try {
    purge();

    let location = await owner.submit("/signup", {
      fullName: "E2E Clinic Owner",
      email,
      password: ownerPassword,
    });
    assert.equal(location, "/onboarding");

    location = await owner.submit("/onboarding", {
      name: shop,
      industry: "clinic",
      city: "Mumbai",
      tagline: "End-to-end clinic",
    });
    assert.equal(location, "/dashboard?welcome=1");

    const business = row("SELECT id, slug FROM businesses WHERE name = ?", shop);
    assert.ok(business, "onboarding should create the clinic");

    /* ---- The desk speaks this business type's language ------------- */
    let desk = await owner.get("/dashboard/receptionist");
    assert.equal(desk.res.status, 200, "the front desk should open");
    let page = text(desk.html);
    assert.ok(page.includes("Front desk"), "the screen is called Front desk");
    assert.ok(page.includes("Patients"), "a clinic reads Patients, not Customers");
    assert.ok(page.includes("Book a slot"), "there is a booking form");
    assert.ok(
      page.includes("Not connected"),
      "the phone line must say it is not connected instead of pretending to answer",
    );

    /* ---- Hours and slots are the owner's, not a default ------------ */
    location = await owner.submit("/dashboard/receptionist", {
      greeting: "Namaste, Sharma Clinic. Kaise madad kar sakte hain?",
      languages: "Hindi, Hinglish, English",
      opensAt: "09:00",
      closesAt: "11:00",
      slotMinutes: "30",
      followupHours: "2",
      escalationPhone: "+91 98765 43210",
    });
    assert.equal(location, "/dashboard/receptionist?saved=settings");

    const saved = row("SELECT opens_at, closes_at, slot_minutes FROM desk_settings WHERE business_id = ?", business.id);
    assert.equal(saved.opens_at, "09:00");
    assert.equal(saved.closes_at, "11:00");
    assert.equal(saved.slot_minutes, 30);

    /* ---- A booking writes both the slot and the call --------------- */
    location = await owner.submit("/dashboard/receptionist", {
      startsAt,
      customerName: "Sunita Rao",
      phone: "+91 98765 43210",
      service: "Consultation",
      value: "1500",
      notes: "Wants the morning slot",
    });
    assert.equal(location, "/dashboard/receptionist?saved=booked", `booking failed: ${location}`);

    const appointment = row(
      "SELECT id, status, starts_at, value_inr FROM desk_appointments WHERE business_id = ?",
      business.id,
    );
    assert.ok(appointment, "the booking should be stored");
    assert.equal(appointment.starts_at, startsAt);
    assert.equal(appointment.status, "booked");
    assert.equal(appointment.value_inr, 1500);
    assert.equal(
      row("SELECT outcome FROM desk_calls WHERE appointment_id = ?", appointment.id).outcome,
      "booked",
      "a booking also lands in the call log",
    );

    // The same slot cannot be sold twice.
    location = await owner.submit("/dashboard/receptionist", {
      startsAt,
      customerName: "Someone Else",
      phone: "+91 90000 11111",
      service: "Consultation",
      value: "0",
      notes: "",
    });
    assert.equal(location, "/dashboard/receptionist?error=slotTaken");
    assert.equal(
      database().prepare("SELECT COUNT(*) AS n FROM desk_appointments WHERE business_id = ?").get(business.id).n,
      1,
      "the refused booking must not be stored",
    );

    // A time outside the owner's hours is refused, not stored.
    location = await owner.submit("/dashboard/receptionist", {
      startsAt: `${tomorrowKey}T15:00:00+05:30`,
      customerName: "Late Caller",
      phone: "+91 90000 22222",
      service: "Consultation",
      value: "0",
      notes: "",
    });
    assert.equal(location, "/dashboard/receptionist?error=slot");

    /* ---- The confirmation is a real wa.me link with the message ---- */
    desk = await owner.get("/dashboard/receptionist");
    page = text(desk.html);
    assert.ok(page.includes("Sunita"), "the booking appears on the desk");
    assert.ok(page.includes("WhatsApp confirmation"), "the confirmation link is offered");
    assert.ok(page.includes("wa.me/919876543210"), "the link is built from the saved number");
    assert.ok(
      page.includes("confirm ho gaya hai"),
      "the Hinglish confirmation is written for them",
    );

    /* ---- Automatic WhatsApp refuses to lie about being connected --- */
    assert.ok(page.includes("WhatsApp sending"), "the desk shows whether sending is on");
    assert.equal(
      database()
        .prepare("SELECT COUNT(*) AS n FROM desk_messages WHERE business_id = ?")
        .get(business.id).n,
      0,
      "with no Meta credentials nothing is queued — the tap-to-send link is the honest path",
    );

    // Turning it on while Meta is unconfigured must be refused, not accepted and
    // then silently ignored.
    location = await owner.submit("/dashboard/receptionist", {
      autoSend: "on",
      reminderHoursBefore: "12",
      displayNumber: "+91 98765 43210",
    });
    assert.equal(location, "/dashboard/receptionist?error=waNotConnected");
    assert.equal(
      database()
        .prepare("SELECT COUNT(*) AS n FROM desk_messaging WHERE business_id = ? AND auto_send = 1")
        .get(business.id).n,
      0,
      "auto-send must stay off when Meta is not configured",
    );

    // The settings themselves still save, so the owner can prepare before the key exists.
    location = await owner.submit("/dashboard/receptionist", {
      reminderHoursBefore: "12",
      displayNumber: "+91 98765 43210",
    });
    assert.equal(location, "/dashboard/receptionist?saved=messaging");
    const messaging = row(
      "SELECT auto_send, reminder_hours_before, display_number FROM desk_messaging WHERE business_id = ?",
      business.id,
    );
    assert.equal(messaging.reminder_hours_before, 12);
    assert.equal(messaging.display_number, "+91 98765 43210");
    assert.equal(messaging.auto_send, 0);

    // The scheduled sender is closed until someone sets its secret.
    if (!process.env.WHATSAPP_DISPATCH_SECRET) {
      const dispatch = await fetch(new URL("/api/whatsapp/dispatch?key=guess", server.base));
      assert.equal(dispatch.status, 503, "the dispatch route must not run unguarded");
      assert.ok(
        (await dispatch.text()).includes("WHATSAPP_DISPATCH_SECRET"),
        "the refusal says which value is missing",
      );
    }

    /* ---- "Call later" starts a callback with a booking link -------- */
    location = await owner.submit("/dashboard/receptionist", {
      customerName: "Rakesh",
      phone: "+91 90000 33333",
      outcome: "followup",
      language: "hinglish",
      notes: "Asked about evening slots",
    });
    assert.equal(location, "/dashboard/receptionist?saved=call");

    const callback = row(
      "SELECT id, outcome, follow_up_at FROM desk_calls WHERE customer_name = 'Rakesh' AND business_id = ?",
      business.id,
    );
    assert.equal(callback.outcome, "followup");
    assert.ok(callback.follow_up_at, "a follow-up gets a due time two hours out");

    desk = await owner.get("/dashboard/receptionist");
    page = text(desk.html);
    assert.ok(page.includes("Call-backs due"), "the callback queue is on the desk");
    assert.ok(page.includes("Send booking link"), "the callback carries a booking link");

    location = await owner.submit("/dashboard/receptionist", { id: callback.id }, ["status"]);
    assert.equal(location, "/dashboard/receptionist?saved=followup");
    assert.equal(
      row("SELECT follow_up_at FROM desk_calls WHERE id = ?", callback.id).follow_up_at,
      null,
      "marking it done clears the due time",
    );

    /* ---- Closing the slot ------------------------------------------ */
    location = await owner.submit(
      "/dashboard/receptionist",
      { id: appointment.id, status: "completed" },
      ["startsAt"],
    );
    assert.equal(location, "/dashboard/receptionist?saved=appointment");
    assert.equal(
      row("SELECT status FROM desk_appointments WHERE id = ?", appointment.id).status,
      "completed",
    );

    /* ---- Team size is uncapped on every plan ----------------------- */
    assert.equal(
      row("SELECT staff_limit FROM plans WHERE id = 'free'").staff_limit,
      1000000,
      "the free plan must not cap seats",
    );
    assert.ok(
      row("SELECT staff_limit FROM plans WHERE id = 'enterprise'").staff_limit >= 1000000,
      "no plan caps seats",
    );
    const staffPage = await owner.get("/dashboard/staff");
    assert.equal(staffPage.res.status, 200, "the staff page opens");
    assert.ok(
      text(staffPage.html).includes("Unlimited"),
      "staff seats read Unlimited instead of a number",
    );
    const planPage = await owner.get("/dashboard/subscription");
    assert.ok(
      text(planPage.html).includes("Unlimited team seats"),
      "every plan lists unlimited team seats",
    );

    /* ---- Every business type gets the desk, in its own words ------- */
    for (const [industry, word] of [
      ["salon", "Clients"],
      ["gym", "Members"],
      ["wholesaler", "Buyers"],
      ["restaurant", "Guests"],
      ["coaching", "Students"],
      ["other", "Front desk"],
    ]) {
      database().prepare("UPDATE businesses SET industry = ? WHERE id = ?").run(industry, business.id);
      const perType = await owner.get("/dashboard/receptionist");
      assert.equal(perType.res.status, 200, `the desk should open for ${industry}`);
      assert.ok(
        text(perType.html).includes(word),
        `a ${industry} desk should show "${word}"`,
      );
    }
  } finally {
    purge();
    if (db) {
      db.close();
      db = null;
    }
  }
});

test("a forgotten password is reset through a one-time owner-handed link", { timeout: 240_000 }, async () => {
  const owner = createApi(server.base);
  const email = `e2e-reset-${stamp}@example.com`;
  const oldPassword = ownerPassword;
  const newPassword = `reset-${stamp}-new`;
  const shop = `E2E Reset ${stamp}`;
  const text = (html) => html.replace(/<!--[\s\S]*?-->/g, "");

  try {
    purge();

    assert.equal(
      await owner.submit("/signup", { fullName: "E2E Reset", email, password: oldPassword }),
      "/onboarding",
    );
    assert.equal(
      await owner.submit("/onboarding", { name: shop, industry: "clinic", city: "Pune", tagline: "" }),
      "/dashboard?welcome=1",
    );

    /* ---- The request page says who will send the link ---------------- */
    let page = await owner.get("/forgot");
    assert.equal(page.res.status, 200, "the forgot page opens");
    assert.ok(text(page.html).includes("Forgot password"), "it is the forgot page");
    assert.ok(
      text(page.html).includes("Nothing is emailed yet"),
      "it must not promise an email this deployment cannot send",
    );

    let location = await owner.submit("/forgot", { email });
    assert.equal(location, "/forgot?sent=1", "the request is accepted");
    assert.equal(
      row("SELECT COUNT(*) AS n FROM password_resets WHERE used_at IS NULL").n >= 1,
      true,
      "a single-use reset row is created",
    );

    /* ---- Only the owner can turn that request into a link ------------ */
    const business = row("SELECT id FROM businesses WHERE name = ?", shop);
    const ownerUser = row("SELECT id FROM users WHERE email = ?", email);

    page = await owner.get("/dashboard/staff");
    assert.ok(text(page.html).includes("Password resets"), "the owner sees the reset panel");
    assert.ok(text(page.html).includes("Create reset link"), "there is a button to make the link");

    location = await owner.submit("/dashboard/staff", { userId: ownerUser.id });
    assert.equal(location, "/dashboard/staff?link=1", `creating the link should work (got ${location})`);

    page = await owner.get("/dashboard/staff");
    const match = text(page.html).match(/\/reset\/[A-Za-z0-9_-]{16,}/);
    assert.ok(match, "the link is shown once to the owner");
    const resetPath = match[0];
    assert.ok(
      text(page.html).includes("Send on WhatsApp"),
      "the owner can hand it over without an email service",
    );

    /* ---- The link sets a new password -------------------------------- */
    page = await owner.get(resetPath);
    assert.equal(page.res.status, 200);
    assert.ok(text(page.html).includes("Choose a new password"), "the reset form opens");

    location = await owner.submit(resetPath, {
      token: resetPath.split("/").pop(),
      password: newPassword,
      confirmPassword: newPassword,
    });
    assert.equal(location, "/login?reset=1", `the reset should finish (got ${location})`);

    const reused = await owner.get(resetPath);
    assert.ok(
      text(reused.html).includes("This link has expired"),
      "a used link cannot be used twice",
    );

    /* ---- Old password dead, new password works ---------------------- */
    const fresh = createApi(server.base);
    location = await fresh.submit("/login", { email, password: oldPassword });
    assert.equal(location, "/login?error=credentials", "the old password must stop working");

    location = await fresh.submit("/login", { email, password: newPassword });
    assert.equal(location, "/dashboard", "the new password signs in");
  } finally {
    purge();
    if (db) {
      db.close();
      db = null;
    }
  }
});

test("the security log opens for a founder and for nobody else", { timeout: 240_000 }, async () => {
  const owner = createApi(server.base);
  const email = `e2e-security-${stamp}@example.com`;
  const shop = `E2E Security ${stamp}`;
  const probe = `e2e-probe-${stamp}@example.com`;
  const text = (html) => html.replace(/<!--[\s\S]*?-->/g, "");

  try {
    purge();

    assert.equal(
      await owner.submit("/signup", { fullName: "E2E Security", email, password: ownerPassword }),
      "/onboarding",
    );
    assert.equal(
      await owner.submit("/onboarding", { name: shop, industry: "cafe", city: "Pune", tagline: "" }),
      "/dashboard?welcome=1",
    );

    const ownerUser = row("SELECT id FROM users WHERE email = ?", email);
    assert.ok(ownerUser, "signup should create the user row");

    /* ---- A shop owner is redirected, and has no link to click -------- */
    const blocked = await owner.get("/dashboard/security");
    assert.ok(
      blocked.res.status >= 300 && blocked.res.status < 400,
      `a non-founder must be redirected, got ${blocked.res.status}`,
    );
    assert.equal(blocked.res.headers.get("location"), "/dashboard");

    const dashboard = await owner.get("/dashboard");
    assert.equal(dashboard.res.status, 200);
    assert.ok(
      !text(dashboard.html).includes("/dashboard/security"),
      "the sidebar link is founder-only, not merely hidden with CSS",
    );

    /* ---- Two events, written the way the app writes them ------------ */
    const now = new Date().toISOString();
    const insert = database().prepare(
      "INSERT INTO security_logs (id, kind, email, business_id, ip, path, detail, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    );
    insert.run(
      crypto.randomUUID(),
      "signin_failed",
      probe,
      null,
      "203.0.113.9",
      "/login",
      JSON.stringify({ reason: "bad_credentials" }),
      now,
    );
    insert.run(
      crypto.randomUUID(),
      "webhook_rejected",
      "",
      null,
      "203.0.113.9",
      "/api/razorpay/webhook",
      JSON.stringify({ reason: "bad_signature" }),
      now,
    );

    /* ---- A founder reads both, without a redeploy ------------------- */
    database().prepare("UPDATE users SET is_platform_admin = 1 WHERE id = ?").run(ownerUser.id);

    const page = await owner.get("/dashboard/security");
    assert.equal(page.res.status, 200, "a founder should open the log");
    const html = text(page.html);
    assert.ok(html.includes("Refused sign-in"), "the sign-in event is labelled");
    assert.ok(html.includes("Rejected webhook"), "the webhook event is labelled");
    assert.ok(html.includes(probe), "the refused address is shown");
    assert.ok(html.includes("203.0.113.9"), "the reported IP is shown");
    assert.ok(html.includes("bad_signature"), "the stored reason is shown");
    assert.ok(html.includes("/dashboard/security"), "a founder gets the sidebar link");
  } finally {
    try {
      purge();
    } finally {
      if (existsSync(DB_FILE)) {
        const connection = new DatabaseSync(DB_FILE);
        connection.prepare("DELETE FROM security_logs WHERE email LIKE 'e2e-%@example.com'").run();
        connection.close();
      }
      if (db) {
        db.close();
        db = null;
      }
    }
  }
});
