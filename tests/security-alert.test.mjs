/**
 * SECURITY ALERT TEST.
 *
 * The alert has three parts worth checking and none of them needs a browser:
 * the threshold and cooldown decision, the email that is built, and the
 * count/claim/send sequence against a real SQLite database.
 *
 * The database is `:memory:` and built from the app's own `SCHEMA_SQL`, so the
 * conditional upsert is tested against the real table — not a copy of it. The
 * provider is a fake `fetch`, so no key and no internet are involved.
 *
 * Run it with:  node --test tests/security-alert.test.mjs
 */
import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { SCHEMA_SQL, splitSql } from "../src/db/schema.ts";
import {
  alertConfig,
  buildAlert,
  isAlertConfigured,
  maybeAlertOnSignInBurst,
  readAlertState,
  shouldAlert,
} from "../src/lib/security-alert.ts";

const ENV_KEYS = [
  "BREVO_API_KEY",
  "SECURITY_ALERT_FROM",
  "SECURITY_ALERT_FROM_NAME",
  "SECURITY_ALERT_EMAILS",
  "FOUNDER_EMAILS",
  "SECURITY_ALERT_THRESHOLD",
  "SECURITY_ALERT_WINDOW_MINUTES",
  "SECURITY_ALERT_COOLDOWN_MINUTES",
  "SECURITY_ALERT_API_BASE",
  "SECURITY_ALERT_APP_URL",
];

/** Applies env for one test and puts the previous values back afterwards. */
async function withEnv(values, run) {
  const previous = new Map(ENV_KEYS.map((key) => [key, process.env[key]]));
  for (const key of ENV_KEYS) {
    if (values[key] === undefined) delete process.env[key];
    else process.env[key] = values[key];
  }
  try {
    return await run();
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

/** A configured deployment, aimed at nothing in particular. */
function configured(extra = {}) {
  return {
    BREVO_API_KEY: "stub-key-not-a-secret",
    SECURITY_ALERT_FROM: "alerts@vantra.test",
    SECURITY_ALERT_EMAILS: "founder-one@example.com, founder-two@example.com",
    SECURITY_ALERT_THRESHOLD: "10",
    SECURITY_ALERT_WINDOW_MINUTES: "10",
    SECURITY_ALERT_COOLDOWN_MINUTES: "60",
    SECURITY_ALERT_APP_URL: "https://vantra.test",
    ...extra,
  };
}

/** The three methods the alert module uses, over an in-memory database. */
function memoryDb() {
  const handle = new DatabaseSync(":memory:");
  for (const statement of splitSql(SCHEMA_SQL)) handle.exec(statement);
  return {
    all: async (sql, params = []) => handle.prepare(sql).all(...params),
    first: async (sql, params = []) => handle.prepare(sql).get(...params) ?? null,
    run: async (sql, params = []) => Number(handle.prepare(sql).run(...params).changes ?? 0),
  };
}

/** Writes `times` refused sign-ins, the way the sign-in action writes them. */
async function refused(db, times, at, address = "attacker@example.com") {
  for (let index = 0; index < times; index += 1) {
    await db.run(
      `INSERT INTO security_logs (id, kind, email, business_id, ip, path, detail, created_at)
       VALUES (?, 'signin_failed', ?, NULL, ?, '/login', '{"reason":"bad_credentials"}', ?)`,
      [
        crypto.randomUUID(),
        address,
        `203.0.113.${(index % 250) + 1}`,
        at.toISOString(),
      ],
    );
  }
}

/** A fake provider that records every call and answers with `reply()`. */
function captureFetch(sent, reply = () => ({ status: 201, body: { messageId: "stub-id-1" } })) {
  return async (url, init) => {
    sent.push({ url: String(url), headers: init.headers, body: JSON.parse(init.body) });
    const answer = reply(sent.length, sent[sent.length - 1]);
    return new Response(JSON.stringify(answer.body), {
      status: answer.status,
      headers: { "content-type": "application/json" },
    });
  };
}

/* ------------------------------------------------------------------ */

test("the threshold and the cooldown decide, and nothing else does", () => {
  const now = new Date("2026-11-27T10:00:00.000Z");
  const decide = (count, lastAlertAt) =>
    shouldAlert({ count, threshold: 10, lastAlertAt, now, cooldownMinutes: 60 });

  assert.equal(decide(9, null), false, "one short of the threshold sends nothing");
  assert.equal(decide(10, null), true, "the tenth refusal is a burst");
  assert.equal(decide(40, "2026-11-27T09:30:00.000Z"), false, "half an hour later is the cooldown");
  assert.equal(decide(40, "2026-11-27T08:59:00.000Z"), true, "sixty-one minutes later is allowed");
  assert.equal(decide(40, "not a date"), true, "an unreadable timestamp must not silence alerts");
});

test("the email names the count, the window and the addresses", () => {
  const message = buildAlert({
    count: 14,
    threshold: 10,
    windowMinutes: 10,
    cooldownMinutes: 60,
    topEmails: [
      { email: "attacker@example.com", n: 9 },
      { email: "second@example.com", n: 5 },
    ],
    ipCount: 3,
    appUrl: "https://vantra.test",
  });

  assert.match(message.subject, /14 refused sign-ins in 10 minutes/);
  assert.match(message.text, /14 sign-ins were refused in the last 10 minutes/);
  assert.match(message.text, /attacker@example\.com — 9×/);
  assert.match(message.text, /3 different IP addresses/);
  assert.match(message.text, /https:\/\/vantra\.test\/dashboard\/security/);
  assert.match(message.text, /nobody got in/i);
});

test("a burst sends one email to every founder, then waits out the cooldown", async () => {
  await withEnv(configured(), async () => {
    const db = memoryDb();
    const sent = [];
    const now = new Date("2026-11-27T10:00:00.000Z");

    await refused(db, 4, now);
    const quiet = await maybeAlertOnSignInBurst(db, { now, fetcher: captureFetch(sent) });
    assert.equal(quiet.outcome, "below_threshold");
    assert.equal(sent.length, 0, "four refusals send nothing");

    await refused(db, 6, now);
    const burst = await maybeAlertOnSignInBurst(db, { now, fetcher: captureFetch(sent) });
    assert.equal(burst.outcome, "sent");
    assert.equal(burst.count, 10);
    assert.equal(sent.length, 1, "exactly one email for the burst");

    const call = sent[0];
    assert.match(call.url, /\/v3\/smtp\/email$/);
    assert.equal(call.headers["api-key"], "stub-key-not-a-secret");
    assert.deepEqual(
      call.body.to.map((entry) => entry.email),
      ["founder-one@example.com", "founder-two@example.com"],
    );
    assert.match(call.body.subject, /10 refused sign-ins in 10 minutes/);
    assert.match(call.body.textContent, /attacker@example\.com — 10×/);

    // More refusals, still inside the hour: the cooldown holds.
    await refused(db, 5, now);
    const held = await maybeAlertOnSignInBurst(db, {
      now: new Date(now.getTime() + 5 * 60_000),
      fetcher: captureFetch(sent),
    });
    assert.equal(held.outcome, "cooldown");
    assert.equal(sent.length, 1);

    // Past the hour, a fresh burst is worth a fresh email.
    const later = new Date(now.getTime() + 61 * 60_000);
    await refused(db, 10, later, "second-wave@example.com");
    const again = await maybeAlertOnSignInBurst(db, { now: later, fetcher: captureFetch(sent) });
    assert.equal(again.outcome, "sent");
    assert.equal(sent.length, 2);

    const state = await readAlertState(db);
    assert.equal(state.last_error, "", "a delivered alert clears any earlier error");
    assert.equal(state.last_count >= 10, true);
  });
});

test("a refused key keeps the cooldown, an outage releases it", async () => {
  await withEnv(configured(), async () => {
    const now = new Date("2026-11-27T10:00:00.000Z");

    /* ---- 401: wrong key. Retrying every minute would be noise. ---- */
    const wrongKeyDb = memoryDb();
    await refused(wrongKeyDb, 12, now);
    const nothingSent = [];
    const refusedCall = await maybeAlertOnSignInBurst(wrongKeyDb, {
      now,
      fetcher: captureFetch(nothingSent, () => ({
        status: 401,
        body: { message: "Key not found" },
      })),
    });
    assert.equal(refusedCall.outcome, "failed");
    assert.equal(refusedCall.error, "Key not found");

    let state = await readAlertState(wrongKeyDb);
    assert.ok(state.last_alert_at, "a refused key keeps the claim");
    assert.equal(state.last_error, "Key not found");
    assert.equal(nothingSent.length, 1);

    const held = await maybeAlertOnSignInBurst(wrongKeyDb, {
      now: new Date(now.getTime() + 60_000),
      fetcher: captureFetch(nothingSent),
    });
    assert.equal(held.outcome, "cooldown");

    /* ---- 503: the provider is down. The next attempt should try. ---- */
    const outageDb = memoryDb();
    await refused(outageDb, 12, now);
    const outageCall = await maybeAlertOnSignInBurst(outageDb, {
      now,
      fetcher: captureFetch(nothingSent, () => ({ status: 503, body: { message: "unavailable" } })),
    });
    assert.equal(outageCall.outcome, "failed");

    state = await readAlertState(outageDb);
    assert.equal(state.last_alert_at, null, "an outage releases the claim");
    assert.equal(state.last_error, "unavailable");

    const retrySent = [];
    const retried = await maybeAlertOnSignInBurst(outageDb, {
      now: new Date(now.getTime() + 60_000),
      fetcher: captureFetch(retrySent),
    });
    assert.equal(retried.outcome, "sent", "the next refused sign-in tries again");
    assert.equal(retrySent.length, 1);
  });
});

test("with no provider nothing is sent and nothing is claimed", async () => {
  await withEnv(
    {
      BREVO_API_KEY: "",
      SECURITY_ALERT_FROM: "",
      SECURITY_ALERT_EMAILS: "",
      FOUNDER_EMAILS: "",
    },
    async () => {
      const db = memoryDb();
      const sent = [];
      const now = new Date("2026-11-27T10:00:00.000Z");
      await refused(db, 20, now);

      const config = alertConfig();
      assert.equal(isAlertConfigured(config), false);

      const run = await maybeAlertOnSignInBurst(db, { now, fetcher: captureFetch(sent) });
      assert.equal(run.outcome, "not_configured");
      assert.equal(sent.length, 0);
      assert.equal(await readAlertState(db), null, "an unconfigured alert writes no state");
    },
  );
});
