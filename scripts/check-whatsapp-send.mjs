#!/usr/bin/env node
/**
 * PROVES THE SEND PATH WITHOUT A META ACCOUNT.
 *
 * Starts a stub that pretends to be graph.facebook.com, boots the real app
 * against it, signs a clinic up, books a slot with automatic sending on, and
 * checks what actually happened:
 *
 *   - the app POSTed to /<version>/<phone number id>/messages with the token
 *   - the payload was a template with {{1}} name, {{2}} when, {{3}} business
 *     (and plain text when no template is configured)
 *   - desk_messages flipped from queued to sent with Meta's message id
 *   - a Meta 400 is recorded as failed with Meta's own words, not retried
 *   - /api/whatsapp/dispatch refuses a wrong key and runs with the right one
 *
 * It never talks to Meta, so it can never send a real message or spend money.
 * Run it with:  node scripts/check-whatsapp-send.mjs
 */
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { existsSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DB_FILE = path.join(ROOT, ".data", "brandmitra.db");
const APP_PORT = Number(process.env.WA_CHECK_PORT ?? 3331);
const STUB_PORT = Number(process.env.WA_STUB_PORT ?? 8799);
const BASE = `http://127.0.0.1:${APP_PORT}`;
const STUB = `http://127.0.0.1:${STUB_PORT}`;
const SECRET = "stub-dispatch-secret";
const TOKEN = "stub-token-not-a-real-one";
const PHONE_NUMBER_ID = "111222333444555";
const stamp = Date.now().toString(36);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/* ── The fake Meta ───────────────────────────────────────────────────────── */

const received = [];
let nextMode = "ok";

const stub = createServer((request, response) => {
  let body = "";
  request.on("data", (chunk) => (body += chunk));
  request.on("end", () => {
    const entry = { url: request.url, auth: request.headers.authorization, body: null };
    try {
      entry.body = JSON.parse(body);
    } catch {
      entry.body = body;
    }
    received.push(entry);

    response.setHeader("content-type", "application/json");
    if (nextMode === "reject" && entry.body?.to === "919000012345") {
      response.statusCode = 400;
      response.end(
        JSON.stringify({
          error: {
            message:
              "(#132000) Number of parameters does not match the expected number of params",
            code: 132000,
          },
        }),
      );
      return;
    }
    response.statusCode = 200;
    response.end(JSON.stringify({ messages: [{ id: `wamid.STUB${received.length}` }] }));
  });
});

/* ── The app ─────────────────────────────────────────────────────────────── */

async function startApp(extraEnv) {
  const nextBin = path.join(ROOT, "node_modules", "next", "dist", "bin", "next");
  if (!existsSync(nextBin)) throw new Error("Run `npm ci` first: node_modules/next is missing.");

  const child = spawn(
    process.execPath,
    [nextBin, "dev", "-H", "127.0.0.1", "-p", String(APP_PORT)],
    {
      cwd: ROOT,
      env: {
        ...process.env,
        BRANDMITRA_PREVIEW_HOST: "",
        WHATSAPP_TOKEN: TOKEN,
        WHATSAPP_PHONE_NUMBER_ID: PHONE_NUMBER_ID,
        WHATSAPP_API_BASE: STUB,
        WHATSAPP_DISPATCH_SECRET: SECRET,
        ...extraEnv,
      },
      detached: true,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let logs = "";
  child.stdout.on("data", (chunk) => (logs += chunk));
  child.stderr.on("data", (chunk) => (logs += chunk));

  const deadline = Date.now() + 180_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`next dev exited:\n${logs.slice(-3000)}`);
    try {
      const res = await fetch(`${BASE}/login`, { redirect: "manual" });
      if (res.status === 200) {
        return async () => {
          try {
            process.kill(-child.pid, "SIGTERM");
          } catch {
            child.kill("SIGTERM");
          }
          await sleep(700);
        };
      }
    } catch {
      /* not up yet */
    }
    await sleep(500);
  }
  child.kill("SIGTERM");
  throw new Error(`next dev did not answer within 3 minutes:\n${logs.slice(-3000)}`);
}

/* ── Form helpers (same trick as tests/shop-flow.test.mjs) ───────────────── */

const ACTION_INPUT = /name="(\$ACTION_ID_[0-9a-f]+)"/;

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

function client() {
  const jar = {};
  async function send(pathname, init = {}) {
    const headers = new Headers(init.headers);
    if (jar.cookie) headers.set("cookie", jar.cookie);
    const res = await fetch(new URL(pathname, BASE), { redirect: "manual", ...init, headers });
    for (const cookie of res.headers.getSetCookie()) {
      if (cookie.startsWith("bm_session=")) jar.cookie = cookie.split(";")[0];
    }
    return res;
  }
  async function get(pathname) {
    const res = await send(pathname);
    return { res, html: await res.text() };
  }
  async function submit(pathname, fields, without = []) {
    const { res, html } = await get(pathname);
    if (res.status !== 200) throw new Error(`GET ${pathname} → ${res.status}`);
    const actionId = findActionId(html, Object.keys(fields), without);
    if (!actionId) throw new Error(`No form on ${pathname} with ${Object.keys(fields).join(", ")}`);
    const body = new FormData();
    for (const [key, value] of Object.entries(fields)) body.append(key, value);
    body.append(actionId, "");
    const response = await send(pathname, { method: "POST", body });
    return { status: response.status, location: response.headers.get("location") };
  }
  return { get, submit, cookie: () => jar.cookie };
}

/* ── Database ────────────────────────────────────────────────────────────── */

let db = null;
function database() {
  if (!db) db = new DatabaseSync(DB_FILE);
  return db;
}
function row(sql, ...params) {
  return database().prepare(sql).get(...params) ?? null;
}
function purge(emails) {
  for (const email of emails) {
    const user = row("SELECT id FROM users WHERE email = ?", email);
    if (!user) continue;
    for (const business of database()
      .prepare("SELECT id FROM businesses WHERE owner_user_id = ?")
      .all(user.id)) {
      database().prepare("DELETE FROM businesses WHERE id = ?").run(business.id);
    }
    database().prepare("DELETE FROM users WHERE id = ?").run(user.id);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(`FAILED: ${message}`);
}

const checks = [];
function pass(message) {
  checks.push(message);
  console.log(`  ✓ ${message}`);
}

/* ── One full flow ───────────────────────────────────────────────────────── */

const todayKey = new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10);
const tomorrowKey = new Date(Date.parse(`${todayKey}T00:00:00Z`) + 86_400_000)
  .toISOString()
  .slice(0, 10);
const startsAt = `${tomorrowKey}T09:30:00+05:30`;

async function flow(label, { expectTemplate }) {
  const email = `wa-check-${label}-${stamp}@example.com`;
  const shop = `WA Check ${label} ${stamp}`;
  const api = client();

  let result = await api.submit("/signup", {
    fullName: "WA Check",
    email,
    password: `wa-check-${stamp}`,
  });
  assert(result.location === "/onboarding", "signup continues to onboarding");

  result = await api.submit("/onboarding", {
    name: shop,
    industry: "clinic",
    city: "Mumbai",
    tagline: "",
  });
  assert(result.location === "/dashboard?welcome=1", "onboarding creates the business");

  const business = row("SELECT id FROM businesses WHERE name = ?", shop);
  assert(business, "the business row exists");

  // Hours that include 09:30, plus the reminder lead time.
  result = await api.submit("/dashboard/receptionist", {
    greeting: "Namaste, this is the test clinic.",
    languages: "Hindi, Hinglish, English",
    opensAt: "09:00",
    closesAt: "11:00",
    slotMinutes: "30",
    followupHours: "2",
    escalationPhone: "+91 98765 43210",
  });
  assert(result.location === "/dashboard/receptionist?saved=settings", "desk settings save");

  // 72 hours before a 09:30 slot is already in the past, so both the
  // confirmation and the reminder are due the moment the booking is made.
  result = await api.submit("/dashboard/receptionist", {
    autoSend: "on",
    reminderHoursBefore: "72",
    displayNumber: "+91 98765 43210",
  });
  assert(
    result.location === "/dashboard/receptionist?saved=messaging",
    "auto-send turns on when Meta is configured",
  );

  const before = received.length;

  result = await api.submit("/dashboard/receptionist", {
    startsAt,
    customerName: "Sunita Rao",
    phone: "+91 98765 43210",
    service: "Consultation",
    value: "1500",
    notes: "",
  });
  assert(
    result.location === "/dashboard/receptionist?saved=sent",
    `booking reports a real send (got ${result.location})`,
  );

  const calls = received.slice(before);
  assert(calls.length >= 2, `two messages were POSTed to the stub (got ${calls.length})`);
  const first = calls[0];
  assert(first.url.includes(`/v25.0/${PHONE_NUMBER_ID}/messages`), "posts to the number's messages endpoint");
  pass(`${label}: POSTs to /v25.0/${PHONE_NUMBER_ID}/messages`);

  assert(first.auth === `Bearer ${TOKEN}`, "sends the token as a bearer header");
  pass(`${label}: token travels in the Authorization header`);

  if (expectTemplate) {
    assert(first.body.type === "template", "sends a template, not free text");
    assert(first.body.template.name === "booking_confirmation", "uses the confirmation template");
    assert(first.body.template.language.code === "en", "uses the configured template language");
    const params = first.body.template.components[0].parameters.map((item) => item.text);
    assert(params[0] === "Sunita", `{{1}} is the first name (got ${params[0]})`);
    assert(params[2].startsWith("WA Check"), `{{3}} is the business name (got ${params[2]})`);
    pass(`${label}: template {{1}} ${params[0]}, {{2}} ${params[1]}, {{3}} ${params[2]}`);
  } else {
    assert(first.body.type === "text", "falls back to plain text when no template is named");
    assert(first.body.text.body.includes("confirm ho gaya hai"), "the Hinglish body is the queued text");
    pass(`${label}: plain text body sent when no template is configured`);
  }

  const messages = database()
    .prepare(
      "SELECT kind, status, provider_id, to_phone, send_at FROM desk_messages WHERE business_id = ? ORDER BY kind",
    )
    .all(business.id);
  assert(messages.length === 2, `one confirmation and one reminder were queued (got ${messages.length})`);
  assert(
    messages.every((message) => message.status === "sent"),
    `both messages are marked sent, not assumed (${messages.map((m) => `${m.kind}=${m.status}`).join(", ")})`,
  );
  assert(
    messages.every((message) => message.provider_id.startsWith("wamid.STUB")),
    "each row stores the id Meta returned",
  );
  assert(messages.every((message) => message.to_phone === "919876543210"), "the number is E.164 digits");
  pass(`${label}: confirmation and reminder both sent with Meta's message ids`);

  /* Failure path: Meta refuses, and that is recorded rather than hidden. */
  nextMode = "reject";
  result = await api.submit("/dashboard/receptionist", {
    startsAt: `${tomorrowKey}T10:00:00+05:30`,
    customerName: "Ravi Kumar",
    phone: "+91 90000 12345",
    service: "Follow-up",
    value: "0",
    notes: "",
  });
  nextMode = "ok";
  const failed = database()
    .prepare(
      "SELECT kind, status, attempts, error FROM desk_messages WHERE business_id = ? AND to_phone = '919000012345' ORDER BY kind",
    )
    .all(business.id);
  const rejected = failed.find((message) => message.status === "failed");
  assert(rejected, `a refused message is marked failed (${JSON.stringify(failed)})`);
  assert(
    rejected.error.includes("132000") || rejected.error.includes("Number of parameters"),
    "Meta's own reason is stored, word for word",
  );
  assert(rejected.attempts === 1, "a 400 is not retried: one attempt only");
  pass(`${label}: a refused message is 'failed' with Meta's reason, not retried`);

  // A reminder that is still waiting must never go out for a cancelled visit.
  // One hour's notice on a slot tomorrow is comfortably in the future, so only
  // the confirmation is due now and the reminder stays queued.
  result = await api.submit("/dashboard/receptionist", {
    autoSend: "on",
    reminderHoursBefore: "1",
    displayNumber: "+91 98765 43210",
  });
  assert(result.location === "/dashboard/receptionist?saved=messaging", "the lead time can be changed");

  result = await api.submit("/dashboard/receptionist", {
    startsAt: `${tomorrowKey}T10:30:00+05:30`,
    customerName: "Meera Shah",
    phone: "+91 90000 55555",
    service: "Consultation",
    value: "0",
    notes: "",
  });
  assert(result.location === "/dashboard/receptionist?saved=sent", "a second booking sends its confirmation");

  const appointment = row(
    "SELECT id FROM desk_appointments WHERE business_id = ? AND customer_name = 'Meera Shah'",
    business.id,
  );
  const waiting = row(
    "SELECT status FROM desk_messages WHERE business_id = ? AND appointment_id = ? AND kind = 'reminder'",
    business.id,
    appointment.id,
  );
  assert(waiting.status === "queued", `the reminder waits for its own time (${waiting.status})`);

  await api.submit("/dashboard/receptionist", { id: appointment.id, status: "cancelled" }, ["startsAt"]);
  const leftover = row(
    "SELECT status FROM desk_messages WHERE business_id = ? AND appointment_id = ? AND kind = 'reminder'",
    business.id,
    appointment.id,
  );
  assert(leftover.status === "skipped", `a cancelled booking skips its reminder (${leftover.status})`);
  pass(`${label}: a waiting reminder is skipped when the booking is cancelled`);

  return email;
}

/* ── Main ────────────────────────────────────────────────────────────────── */

const emails = [];
let stopApp = async () => {};

try {
  await new Promise((resolve) => stub.listen(STUB_PORT, "127.0.0.1", resolve));
  console.log(`Stub Meta on ${STUB}\n`);

  console.log("1. With approved templates configured");
  stopApp = await startApp({
    WHATSAPP_TEMPLATE_CONFIRMATION: "booking_confirmation",
    WHATSAPP_TEMPLATE_REMINDER: "booking_reminder",
    WHATSAPP_TEMPLATE_LANG: "en",
  });
  emails.push(await flow("templates", { expectTemplate: true }));

  const wrongKey = await fetch(`${BASE}/api/whatsapp/dispatch?key=nope`);
  assert(wrongKey.status === 401, `a wrong dispatch key is refused (got ${wrongKey.status})`);
  const rightKey = await fetch(`${BASE}/api/whatsapp/dispatch?key=${SECRET}`);
  const body = await rightKey.json();
  assert(rightKey.status === 200 && body.ok === true, "the dispatch route runs with the right key");
  assert(typeof body.remaining === "number", "it reports what is left in the queue");
  pass(`dispatch: 401 for a wrong key, 200 with ${JSON.stringify(body).slice(0, 60)}…`);

  await stopApp();
  stopApp = async () => {};

  console.log("\n2. With no templates named (plain text fallback)");
  stopApp = await startApp({});
  emails.push(await flow("text", { expectTemplate: false }));

  console.log("\nAll checks passed.");
} catch (error) {
  console.error(`\n${error.message}`);
  process.exitCode = 1;
} finally {
  await stopApp();
  try {
    purge(emails);
  } catch {
    /* best effort */
  }
  stub.close();
  if (db) db.close();
}
