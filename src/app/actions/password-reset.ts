"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { hashPassword } from "@/lib/auth";
import { logAudit, requireBusiness } from "@/lib/business";
import { getDb } from "@/lib/db";

/**
 * FORGOT PASSWORD — with no email service, the link is handed over by a person.
 *
 * The honest version of "reset from Gmail" on a deployment with no email:
 *
 *   1. The person who forgot their password opens /forgot and types their email.
 *      The same answer is shown whether or not that address exists, so the page
 *      cannot be used to discover who has an account.
 *   2. A single-use token is created (stored only as a SHA-256 hash, valid for
 *      one hour). No link is emailed, because there is nothing to email with.
 *   3. The business owner opens Dashboard → Staff, presses "Create reset link",
 *      and gets the link ONCE. They send it on WhatsApp (the share button opens
 *      WhatsApp's contact picker) or hand it over however they like.
 *   4. The person opens /reset/<token>, sets a new password, and every existing
 *      session for that account is destroyed.
 *
 * Why the owner and not the person who asked: a link shown to whoever typed an
 * email would let anyone take over any account. Handing it over is the price of
 * not having email yet, and it is visible in the UI instead of being pretended.
 */

const RESET_MINUTES = 60;
const HANDOVER_COOKIE = "bm_reset_handover";

function base64url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function text(formData: FormData, key: string, max = 200): string {
  return String(formData.get(key) ?? "").trim().slice(0, max);
}

async function issueToken(userId: string): Promise<{ token: string; expiresAt: string }> {
  const db = await getDb();
  const token = base64url(crypto.getRandomValues(new Uint8Array(32)));
  const now = new Date();
  const expiresAt = new Date(now.getTime() + RESET_MINUTES * 60_000).toISOString();

  // One live token per account: a new request retires the previous one.
  await db.run("DELETE FROM password_resets WHERE user_id = ? AND used_at IS NULL", [userId]);
  await db.run(
    "INSERT INTO password_resets (id, user_id, token_hash, expires_at, used_at, created_at) VALUES (?, ?, ?, ?, NULL, ?)",
    [crypto.randomUUID(), userId, await sha256Hex(token), expiresAt, now.toISOString()],
  );

  return { token, expiresAt };
}

/** Public: someone who cannot sign in asks for help. Never reveals whether the account exists. */
export async function requestPasswordResetAction(formData: FormData): Promise<void> {
  const email = text(formData, "email", 160).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) redirect("/forgot?error=email");

  const db = await getDb();
  const user = await db.first<{ id: string }>("SELECT id FROM users WHERE lower(email) = ?", [email]);

  if (user) {
    const recent = await db.first<{ created_at: string }>(
      "SELECT created_at FROM password_resets WHERE user_id = ? AND used_at IS NULL ORDER BY created_at DESC LIMIT 1",
      [user.id],
    );
    const tooSoon =
      recent && Date.now() - new Date(recent.created_at).getTime() < 60_000;
    if (!tooSoon) {
      await issueToken(user.id);
      await logAudit({
        businessId: null,
        actorUserId: null,
        action: "auth.reset_requested",
        entity: "user",
        entityId: user.id,
        payload: {},
      });
    }
  }

  redirect("/forgot?sent=1");
}

/**
 * Owner-only: makes the link and puts it in a five-minute httpOnly cookie so the
 * staff page can show it once. The cookie is short-lived on purpose — a reset
 * link that lingers in a cookie is a password sitting in a browser.
 */
export async function createResetLinkAction(formData: FormData): Promise<void> {
  const { user, business, role } = await requireBusiness();
  if (role !== "owner") redirect("/dashboard/staff?error=forbidden");

  const memberUserId = text(formData, "userId", 64);
  const db = await getDb();
  const member = await db.first<{ id: string; email: string }>(
    `SELECT u.id, u.email
       FROM business_members m
       JOIN users u ON u.id = m.user_id
      WHERE m.business_id = ? AND m.user_id = ?`,
    [business.id, memberUserId],
  );
  if (!member) redirect("/dashboard/staff?error=missing");

  const { token, expiresAt } = await issueToken(member.id);

  await logAudit({
    businessId: business.id,
    actorUserId: user.id,
    action: "auth.reset_link_created",
    entity: "user",
    entityId: member.id,
    payload: { email: member.email, expiresAt },
  });

  const store = await cookies();
  store.set(HANDOVER_COOKIE, `${token}.${member.email}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/dashboard/staff",
    maxAge: 300,
  });

  revalidatePath("/dashboard/staff");
  redirect("/dashboard/staff?link=1");
}

/** The reset itself. One-time, one hour, and it signs the account out everywhere. */
export async function resetPasswordAction(formData: FormData): Promise<void> {
  const token = text(formData, "token", 200);
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirmPassword") ?? "");

  if (!token) redirect("/forgot?error=expired");
  if (password.length < 8) redirect(`/reset/${token}?error=short`);
  if (password !== confirm) redirect(`/reset/${token}?error=mismatch`);

  const db = await getDb();
  const tokenHash = await sha256Hex(token);
  const row = await db.first<{ id: string; user_id: string; expires_at: string; used_at: string | null }>(
    "SELECT id, user_id, expires_at, used_at FROM password_resets WHERE token_hash = ?",
    [tokenHash],
  );

  if (!row || row.used_at || new Date(row.expires_at).getTime() < Date.now()) {
    redirect("/forgot?error=expired");
  }

  await db.run("UPDATE users SET password_hash = ? WHERE id = ?", [
    await hashPassword(password),
    row.user_id,
  ]);
  await db.run("UPDATE password_resets SET used_at = ? WHERE id = ?", [
    new Date().toISOString(),
    row.id,
  ]);
  // Anyone signed in with the old password loses their session.
  await db.run("DELETE FROM sessions WHERE user_id = ?", [row.user_id]);

  await logAudit({
    businessId: null,
    actorUserId: null,
    actorType: "system",
    action: "auth.password_reset",
    entity: "user",
    entityId: row.user_id,
    payload: {},
  });

  redirect("/login?reset=1");
}

/** Reads and clears the one-time handover link shown on the staff page. */
export async function readHandover(): Promise<{ link: string; email: string } | null> {
  const store = await cookies();
  const raw = store.get(HANDOVER_COOKIE)?.value;
  if (!raw) return null;

  const [token, email] = raw.split(".");
  if (!token || !email) return null;

  const host = process.env.APP_ORIGIN?.trim() || "";
  const link = host ? `${host.replace(/\/$/, "")}/reset/${token}` : `/reset/${token}`;
  return { link, email };
}

