"use server";

import { redirect } from "next/navigation";
import {
  createSession,
  destroySession,
  hashPassword,
  isFounderEmail,
  verifyPassword,
} from "@/lib/auth";
import { getDb } from "@/lib/db";
import { logAudit } from "@/lib/business";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function text(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

export async function signUpAction(formData: FormData): Promise<void> {
  const fullName = text(formData, "fullName").slice(0, 80);
  const email = text(formData, "email").toLowerCase().slice(0, 160);
  const password = String(formData.get("password") ?? "");

  if (fullName.length < 2) redirect("/signup?error=name");
  if (!EMAIL_PATTERN.test(email)) redirect("/signup?error=email");
  if (password.length < 8) redirect("/signup?error=password");

  const db = await getDb();
  const existing = await db.first<{ id: string }>("SELECT id FROM users WHERE email = ?", [email]);
  if (existing) redirect("/signup?error=exists");

  const userId = crypto.randomUUID();
  // Co-founders listed in FOUNDER_EMAILS get full access the moment they sign
  // up — every screen of their business, every plan's features, nothing to pay.
  const founder = isFounderEmail(email);
  await db.run(
    `INSERT INTO users (id, email, password_hash, full_name, is_platform_admin, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [userId, email, await hashPassword(password), fullName, founder ? 1 : 0, new Date().toISOString()],
  );

  await logAudit({
    businessId: null,
    actorUserId: userId,
    action: "user.signed_up",
    entity: "user",
    entityId: userId,
    payload: { email, founder },
  });

  await createSession(userId);
  redirect("/onboarding");
}

export async function signInAction(formData: FormData): Promise<void> {
  const email = text(formData, "email").toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) redirect("/login?error=missing");

  const db = await getDb();
  const user = await db.first<{ id: string; email: string; password_hash: string; is_platform_admin: number }>(
    "SELECT id, email, password_hash, is_platform_admin FROM users WHERE email = ?",
    [email],
  );

  // Same message for "no such user" and "wrong password": never reveal which.
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    redirect("/login?error=credentials");
  }

  // A co-founder who already had an account before FOUNDER_EMAILS was set gets
  // the flag on their next sign-in, so nobody has to run SQL by hand.
  if (isFounderEmail(user.email)) {
    if (!user.is_platform_admin) {
      await db.run("UPDATE users SET is_platform_admin = 1 WHERE id = ?", [user.id]);
    }

    // The flag alone only opens screens. A business created before the flag
    // existed is still on Free, so its AI allowance and plan features would be
    // the Free ones. Put a founder's own business on the top plan too — this
    // only ever touches a business they are already a member of.
    await db.run(
      `UPDATE subscriptions SET plan_id = 'enterprise', status = 'active'
        WHERE plan_id = 'free'
          AND business_id IN (SELECT business_id FROM business_members WHERE user_id = ?)`,
      [user.id],
    );
  }

  await createSession(user.id);
  redirect("/dashboard");
}

export async function signOutAction(): Promise<void> {
  await destroySession();
  redirect("/");
}
