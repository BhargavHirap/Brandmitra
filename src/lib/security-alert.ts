/**
 * EMAIL ALERT ON A BURST OF REFUSED SIGN-INS.
 *
 * `/dashboard/security` is a list somebody has to remember to open. A password
 * guessing run is exactly the event nobody is watching for, so the founders get
 * one email when refused sign-ins cross a threshold inside a short window.
 *
 * Rules, in the order they matter:
 *
 *   1. It never blocks or changes the refusal it reports. Every failure path
 *      returns an outcome; nothing throws at the caller.
 *   2. One email per burst, not one per attempt. A row in
 *      `security_alert_state` is claimed with a single conditional upsert, so
 *      two simultaneous attempts cannot both decide to send. The claim is the
 *      cooldown: no second email inside `SECURITY_ALERT_COOLDOWN_MINUTES`.
 *   3. It is off until an email provider is configured. No key, no sender or no
 *      recipient list means nothing is sent and nothing is claimed — the screen
 *      says so instead of pretending an alert would arrive.
 *   4. The email carries counts and addresses that were already written to the
 *      log. No password, token or header ever reaches it.
 *
 * Provider: Brevo's transactional API (free plan: 300 emails a day, no card,
 * one verified sender address is enough — no domain to buy). The classic
 * `api-key` header, one POST, a `messageId` back. `SECURITY_ALERT_API_BASE`
 * exists so a test can point it at a stub, exactly like GEMINI_API_BASE.
 *
 * This module deliberately imports nothing: it takes the database as a small
 * structural type, so `tests/security-alert.test.mjs` can run it against a real
 * in-memory SQLite database without the app's `@/` path alias.
 */

const MINUTE_MS = 60_000;

/** The three methods this module needs. `Db` in `src/lib/db.ts` fits it. */
export type Queryable = {
  all<T>(sql: string, params?: (string | number | null)[]): Promise<T[]>;
  first<T>(sql: string, params?: (string | number | null)[]): Promise<T | null>;
  run(sql: string, params?: (string | number | null)[]): Promise<number>;
};

export type AlertConfig = {
  /** Refused sign-ins needed before anything is sent. */
  threshold: number;
  /** How far back those refusals are counted. */
  windowMinutes: number;
  /** The quiet period after a successful alert. */
  cooldownMinutes: number;
  recipients: string[];
  senderEmail: string;
  senderName: string;
  apiKey: string;
  apiBase: string;
  appUrl: string;
};

function envText(name: string): string {
  const value = process.env[name];
  return typeof value === "string" ? value.trim() : "";
}

/** A positive whole number from the environment, clamped to something sane. */
function envNumber(name: string, fallback: number, min: number, max: number): number {
  const value = Number(envText(name));
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return Math.max(min, Math.min(max, Math.round(value)));
}

/** Comma, space or semicolon separated addresses, de-duplicated, lower-cased. */
function addressList(raw: string): string[] {
  const seen = new Set<string>();
  for (const piece of raw.split(/[\s,;]+/)) {
    const address = piece.trim().toLowerCase();
    if (!address.includes("@") || address.length > 160) continue;
    seen.add(address);
  }
  return [...seen].slice(0, 10);
}

/**
 * Everything the alert needs, read fresh from the environment on each call so a
 * changed secret takes effect on the next deployment without a code change.
 *
 * The recipient list falls back to `FOUNDER_EMAILS` — the same list that marks
 * a co-founder account — so a deployment only needs to add the provider key and
 * a sender. `SECURITY_ALERT_EMAILS` exists to send somewhere else.
 */
export function alertConfig(): AlertConfig {
  return {
    threshold: envNumber("SECURITY_ALERT_THRESHOLD", 10, 2, 1000),
    windowMinutes: envNumber("SECURITY_ALERT_WINDOW_MINUTES", 10, 1, 1440),
    cooldownMinutes: envNumber("SECURITY_ALERT_COOLDOWN_MINUTES", 60, 1, 10_080),
    recipients: addressList(envText("SECURITY_ALERT_EMAILS") || envText("FOUNDER_EMAILS")),
    senderEmail: envText("SECURITY_ALERT_FROM"),
    senderName: envText("SECURITY_ALERT_FROM_NAME") || "Vantra",
    apiKey: envText("BREVO_API_KEY"),
    apiBase: (envText("SECURITY_ALERT_API_BASE") || "https://api.brevo.com").replace(/\/+$/, ""),
    appUrl: (envText("SECURITY_ALERT_APP_URL") || "https://brandmitra-u2gvs6.freebuff.site").replace(
      /\/+$/,
      "",
    ),
  };
}

/** True only when an email could actually leave: a key, a sender and somebody to tell. */
export function isAlertConfigured(config: AlertConfig): boolean {
  return Boolean(config.apiKey && config.senderEmail && config.recipients.length > 0);
}

/** What is missing, in the founder's words. Empty means configured. */
export function alertMissing(config: AlertConfig): string[] {
  const missing: string[] = [];
  if (!config.apiKey) missing.push("BREVO_API_KEY");
  if (!config.senderEmail) missing.push("SECURITY_ALERT_FROM");
  if (config.recipients.length === 0) missing.push("FOUNDER_EMAILS or SECURITY_ALERT_EMAILS");
  return missing;
}

/* ── The decision ─────────────────────────────────────────────────────────── */

/**
 * Count and cooldown, with no database in sight.
 *
 * Split out so the two questions — "is this a burst?" and "did we already say
 * so?" — can be tested without a clock, a network or a table.
 */
export function shouldAlert(input: {
  count: number;
  threshold: number;
  lastAlertAt: string | null | undefined;
  now: Date;
  cooldownMinutes: number;
}): boolean {
  if (input.count < input.threshold) return false;
  if (!input.lastAlertAt) return true;
  const last = new Date(input.lastAlertAt).getTime();
  // An unreadable timestamp must not silence the alert forever.
  if (!Number.isFinite(last)) return true;
  return input.now.getTime() - last >= input.cooldownMinutes * MINUTE_MS;
}

export type AlertMessage = { subject: string; text: string };

/**
 * The email itself. Plain text only: no HTML to escape, and it reads the same on
 * a phone's lock-screen preview.
 */
export function buildAlert(input: {
  count: number;
  threshold: number;
  windowMinutes: number;
  cooldownMinutes: number;
  topEmails: { email: string; n: number }[];
  ipCount: number;
  appUrl: string;
}): AlertMessage {
  const span = input.windowMinutes === 1 ? "minute" : "minutes";
  const attempts = input.topEmails.length
    ? [
        "Most attempted addresses:",
        ...input.topEmails.map((row) => `  ${row.email || "(blank)"} — ${row.n}×`),
      ].join("\n")
    : "No address was sent with the attempts.";

  const subject = `Vantra: ${input.count} refused sign-ins in ${input.windowMinutes} ${span}`;

  const text = [
    `${input.count} sign-ins were refused in the last ${input.windowMinutes} ${span}.`,
    `The alert threshold is ${input.threshold}, so this email was sent once.`,
    "",
    attempts,
    "",
    `${input.ipCount} different IP ${input.ipCount === 1 ? "address was" : "addresses were"} reported.`,
    "",
    "Nobody got in: a refused sign-in sets no session and changes nothing.",
    `Full log: ${input.appUrl}/dashboard/security`,
    "",
    `You will not get another of these emails for ${input.cooldownMinutes} minutes.`,
  ].join("\n");

  return { subject, text };
}

/* ── The provider call ────────────────────────────────────────────────────── */

export type AlertSendResult =
  | { ok: true; id: string }
  | { ok: false; error: string; status: number; permanent: boolean };

/**
 * One POST to Brevo. `fetcher` exists so a test can answer instead of the
 * internet; in the app it is always the global fetch.
 *
 * `permanent` means the same request will fail forever — a refused key, a
 * sender Brevo has not verified, a malformed address. Those keep the cooldown
 * claim (retrying every minute would only bury the founder in bounces). A
 * timeout or a 5xx releases it, so the next refused sign-in tries again.
 */
export async function sendAlertEmail(
  config: AlertConfig,
  message: AlertMessage,
  fetcher: typeof fetch = fetch,
): Promise<AlertSendResult> {
  if (!isAlertConfigured(config)) {
    return { ok: false, error: "Email alerts are not configured.", status: 0, permanent: true };
  }

  let response: Response;
  try {
    response = await fetcher(`${config.apiBase}/v3/smtp/email`, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "api-key": config.apiKey,
      },
      body: JSON.stringify({
        sender: { name: config.senderName, email: config.senderEmail },
        to: config.recipients.map((email) => ({ email })),
        subject: message.subject,
        textContent: message.text,
      }),
      signal: AbortSignal.timeout(8_000),
    });
  } catch (error) {
    const name = (error as { name?: string })?.name;
    return {
      ok: false,
      error:
        name === "TimeoutError" || name === "AbortError"
          ? "The email provider took too long to answer."
          : "Could not reach the email provider.",
      status: 0,
      permanent: false,
    };
  }

  let data: { messageId?: string; message?: string; code?: string } = {};
  try {
    data = (await response.json()) as typeof data;
  } catch {
    /* a non-JSON body: the status code is the whole story */
  }

  if (!response.ok) {
    const reason = (data.message || data.code || `Brevo returned HTTP ${response.status}`).slice(0, 300);
    return {
      ok: false,
      error: reason,
      status: response.status,
      // 429 is "slow down", not "you got it wrong".
      permanent: response.status >= 400 && response.status < 500 && response.status !== 429,
    };
  }

  const id = data.messageId;
  if (!id) {
    return {
      ok: false,
      error: "Brevo accepted the call but returned no message id.",
      status: response.status,
      permanent: false,
    };
  }
  return { ok: true, id };
}

/* ── The wiring: count, claim, send ───────────────────────────────────────── */

export type AlertState = {
  last_alert_at: string | null;
  last_count: number;
  last_error: string;
  last_error_at: string | null;
};

const STATE_SQL = `SELECT last_alert_at, last_count, last_error, last_error_at
                     FROM security_alert_state WHERE channel = 'signin_burst'`;

/** The last alert, or null when there has never been one. For the screen. */
export async function readAlertState(db: Queryable): Promise<AlertState | null> {
  const row = await db.first<AlertState>(STATE_SQL, []);
  return row ?? null;
}

export type AlertOutcome =
  /** An email left, or was accepted by the provider. */
  | "sent"
  /** Not enough refusals in the window. */
  | "below_threshold"
  /** Enough, but one was sent inside the cooldown. */
  | "cooldown"
  /** No provider, sender or recipient: nothing was attempted. */
  | "not_configured"
  /** The provider refused it or could not be reached. */
  | "failed";

export type AlertRun = { outcome: AlertOutcome; count: number; error?: string };

/**
 * Called after a refused sign-in has been written. Cheap when it is off (one
 * look at the environment), one indexed count when it is on.
 *
 * The claim is the whole concurrency story: the upsert writes `last_alert_at`
 * only if it is empty or older than the cooldown, and `run` returns how many
 * rows changed. Exactly one caller can see `1`.
 */
export async function maybeAlertOnSignInBurst(
  db: Queryable,
  options: { now?: Date; config?: AlertConfig; fetcher?: typeof fetch } = {},
): Promise<AlertRun> {
  const config = options.config ?? alertConfig();
  if (!isAlertConfigured(config)) return { outcome: "not_configured", count: 0 };

  const now = options.now ?? new Date();

  try {
    const since = new Date(now.getTime() - config.windowMinutes * MINUTE_MS).toISOString();
    const total = await db.first<{ n: number }>(
      "SELECT COUNT(*) AS n FROM security_logs WHERE kind = 'signin_failed' AND created_at >= ?",
      [since],
    );
    const count = Number(total?.n ?? 0);
    if (count < config.threshold) return { outcome: "below_threshold", count };

    const claimedAt = now.toISOString();
    const cooldownBoundary = new Date(
      now.getTime() - config.cooldownMinutes * MINUTE_MS,
    ).toISOString();

    const claimed = await db.run(
      `INSERT INTO security_alert_state
         (channel, last_alert_at, last_count, last_error, last_error_at, updated_at)
       VALUES ('signin_burst', ?, ?, '', NULL, ?)
       ON CONFLICT(channel) DO UPDATE SET
         last_alert_at = excluded.last_alert_at,
         last_count = excluded.last_count,
         updated_at = excluded.updated_at
       WHERE security_alert_state.last_alert_at IS NULL
          OR security_alert_state.last_alert_at < ?`,
      [claimedAt, count, claimedAt, cooldownBoundary],
    );
    if (claimed !== 1) return { outcome: "cooldown", count };

    const [topRows, ipRow] = await Promise.all([
      db.all<{ email: string; n: number }>(
        `SELECT email, COUNT(*) AS n FROM security_logs
          WHERE kind = 'signin_failed' AND created_at >= ?
          GROUP BY email ORDER BY n DESC LIMIT 3`,
        [since],
      ),
      db.first<{ n: number }>(
        `SELECT COUNT(DISTINCT ip) AS n FROM security_logs
          WHERE kind = 'signin_failed' AND created_at >= ? AND ip <> ''`,
        [since],
      ),
    ]);

    const message = buildAlert({
      count,
      threshold: config.threshold,
      windowMinutes: config.windowMinutes,
      cooldownMinutes: config.cooldownMinutes,
      topEmails: topRows.map((row) => ({ email: row.email, n: Number(row.n) })),
      ipCount: Number(ipRow?.n ?? 0),
      appUrl: config.appUrl,
    });

    const result = await sendAlertEmail(config, message, options.fetcher);

    if (result.ok) {
      await db.run(
        `UPDATE security_alert_state
            SET last_error = '', last_error_at = NULL, updated_at = ?
          WHERE channel = 'signin_burst'`,
        [new Date().toISOString()],
      );
      return { outcome: "sent", count };
    }

    const failedAt = new Date().toISOString();
    if (result.permanent) {
      // Keep the claim. A wrong key or an unverified sender will fail the same
      // way in a minute; the screen shows this error until it is fixed.
      await db.run(
        `UPDATE security_alert_state
            SET last_error = ?, last_error_at = ?, updated_at = ?
          WHERE channel = 'signin_burst'`,
        [result.error, failedAt, failedAt],
      );
    } else {
      // Release the claim so the next refused sign-in tries again.
      await db.run(
        `UPDATE security_alert_state
            SET last_alert_at = NULL, last_error = ?, last_error_at = ?, updated_at = ?
          WHERE channel = 'signin_burst'`,
        [result.error, failedAt, failedAt],
      );
    }
    return { outcome: "failed", count, error: result.error };
  } catch {
    // A missing table, an unreachable provider, anything: the refusal stands.
    return { outcome: "failed", count: 0 };
  }
}
