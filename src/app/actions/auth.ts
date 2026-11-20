"use server";

import { redirect } from "next/navigation";
import { createSession, destroySession, hashPassword, verifyPassword } from "@/lib/auth";
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
  await db.run(
    `INSERT INTO users (id, email, password_hash, full_name, is_platform_admin, created_at)
     VALUES (?, ?, ?, ?, 0, ?)`,
    [userId, email, await hashPassword(password), fullName, new Date().toISOString()],
  );

  await logAudit({
    businessId: null,
    actorUserId: userId,
    action: "user.signed_up",
    entity: "user",
    entityId: userId,
    payload: { email },
  });

  await createSession(userId);
  redirect("/onboarding");
}

export async function signInAction(formData: FormData): Promise<void> {
  const email = text(formData, "email").toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) redirect("/login?error=missing");

  const db = await getDb();
  const user = await db.first<{ id: string; password_hash: string }>(
    "SELECT id, password_hash FROM users WHERE email = ?",
    [email],
  );

  // Same message for "no such user" and "wrong password": never reveal which.
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    redirect("/login?error=credentials");
  }

  await createSession(user.id);
  redirect("/dashboard");
}

export async function signOutAction(): Promise<void> {
  await destroySession();
  redirect("/");
}
