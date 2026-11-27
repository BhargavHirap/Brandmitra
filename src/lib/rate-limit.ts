import { getDb, type Db } from "@/lib/db";

/**
 * BURST LIMITS FOR AI ACTIONS.
 *
 * The monthly AI credits in `plans.ai_credits` already cap how much a business
 * may spend in a month, but they allow a signed-in user to press the button
 * fifty times in a minute — every one of those is a paid provider call, and the
 * credits are only counted after a call succeeds. This is the second fence: a
 * fixed-window counter per user, per feature, kept in `rate_limits`.
 *
 * One window is one row. The counter is incremented by a single upsert, so two
 * taps at the same instant cannot both read "19 of 20": SQLite applies the
 * upserts one after the other. The upsert is followed by a SELECT in the same
 * `batch()` call, which is one round trip on D1 and sees the row it just wrote.
 *
 * The limit is a burst limit, not a product feature: it is deliberately high
 * enough that a person doing real work never meets it.
 */

export type RateLimitRule = {
  /** Stable prefix for the counter key. Changing it resets that counter. */
  id: string;
  /** Calls allowed inside one window. */
  limit: number;
  windowSeconds: number;
  /** How the limit is named in the sentence the user reads. */
  label: string;
};

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
};

export const AI_RATE_LIMITS = {
  productCopy: {
    id: "ai.product_copy",
    limit: 20,
    windowSeconds: 600,
    label: "AI product copy",
  },
  campaign: {
    id: "ai.campaign",
    limit: 10,
    windowSeconds: 600,
    label: "AI campaign drafts",
  },
  deskScript: {
    id: "ai.desk_script",
    limit: 10,
    windowSeconds: 600,
    label: "AI call scripts",
  },
  agent: {
    id: "ai.agent",
    limit: 20,
    windowSeconds: 600,
    label: "the AI business agent",
  },
  menuScan: {
    id: "ai.menu_scan",
    limit: 10,
    windowSeconds: 600,
    label: "menu photo scans",
  },
} as const satisfies Record<string, RateLimitRule>;

/** Counters older than this are deleted on the next call, so the table stays small. */
const KEEP_SECONDS = 24 * 60 * 60;

/**
 * Counts one call for `subject` (a user id) against `rule`.
 *
 * `subject` must come from the session, never from a form field, or a caller
 * could spend somebody else's allowance or reset their own.
 */
export async function checkRateLimit(
  rule: RateLimitRule,
  subject: string,
  db?: Db,
): Promise<RateLimitResult> {
  const database = db ?? (await getDb());
  const now = Date.now();
  const windowMs = rule.windowSeconds * 1000;
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const key = `${rule.id}:${subject}`;
  const nowIso = new Date(now).toISOString();

  const results = await database.batch<{ count: number }>([
    {
      sql: "DELETE FROM rate_limits WHERE window_start < ?",
      params: [now - KEEP_SECONDS * 1000],
    },
    {
      sql: `INSERT INTO rate_limits (key, window_start, count, updated_at)
            VALUES (?, ?, 1, ?)
            ON CONFLICT(key) DO UPDATE SET
              count = CASE
                        WHEN rate_limits.window_start = excluded.window_start
                        THEN rate_limits.count + 1
                        ELSE 1
                      END,
              window_start = excluded.window_start,
              updated_at = excluded.updated_at`,
      params: [key, windowStart, nowIso],
    },
    {
      sql: "SELECT count FROM rate_limits WHERE key = ?",
      params: [key],
    },
  ]);

  const count = Number(results[2]?.[0]?.count ?? 1);
  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((windowStart + windowMs - now) / 1000),
  );

  return {
    allowed: count <= rule.limit,
    limit: rule.limit,
    remaining: Math.max(0, rule.limit - count),
    retryAfterSeconds,
  };
}

/** The sentence a refused action shows. No credit was spent and nothing changed. */
export function rateLimitMessage(result: RateLimitResult, label: string): string {
  const wait =
    result.retryAfterSeconds >= 60
      ? `${Math.ceil(result.retryAfterSeconds / 60)} minute${result.retryAfterSeconds >= 120 ? "s" : ""}`
      : `${result.retryAfterSeconds} seconds`;

  return `That is ${result.limit} requests for ${label} in a short time, so the next one was not sent. Wait about ${wait} and try again — nothing was used up and nothing changed.`;
}
