import { getDb } from "@/lib/db";

/**
 * SECURITY LOG.
 *
 * A refused sign-in and a webhook that failed its signature check are the two
 * events worth having a record of: one is somebody guessing passwords, the other
 * is somebody pretending to be the payment provider. Neither is a business
 * event, so neither belongs in `audit_logs` — this table is only read when
 * something looks wrong.
 *
 * Rules:
 *   1. A log write never throws. If D1 is down, the sign-in refusal still
 *      happens; losing the note is better than turning a refusal into a crash.
 *   2. No password, token, signature or request body is stored. A stored secret
 *      is a leaked secret, and a body can contain card data.
 *   3. It is not shown to any user in the app.
 */

export type SecurityEventKind = "signin_failed" | "webhook_rejected";

export async function logSecurityEvent(input: {
  kind: SecurityEventKind;
  email?: string;
  businessId?: string | null;
  ip?: string;
  path?: string;
  detail?: Record<string, unknown>;
}): Promise<void> {
  try {
    const db = await getDb();
    await db.run(
      `INSERT INTO security_logs (id, kind, email, business_id, ip, path, detail, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        crypto.randomUUID(),
        input.kind,
        (input.email ?? "").slice(0, 160),
        input.businessId ?? null,
        (input.ip ?? "").slice(0, 64),
        (input.path ?? "").slice(0, 200),
        JSON.stringify(input.detail ?? {}),
        new Date().toISOString(),
      ],
    );
  } catch {
    // Never let the record of a refusal break the refusal itself.
  }
}

/**
 * The caller's address, as the edge sees it.
 *
 * Cloudflare sets `cf-connecting-ip`; other proxies use the first entry of
 * `x-forwarded-for`. Both are attacker-supplied on an unprotected origin, so the
 * value is stored as a hint for reading the log, never used for a decision.
 */
export function clientIpFrom(headers: { get(name: string): string | null }): string {
  const direct = headers.get("cf-connecting-ip");
  if (direct) return direct.trim();
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return "";
}
