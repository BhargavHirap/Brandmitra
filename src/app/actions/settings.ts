"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { hashPassword, requireUser, verifyPassword } from "@/lib/auth";
import { logAudit, requireBusiness } from "@/lib/business";
import { isIndustry } from "@/lib/industries";
import { getDb } from "@/lib/db";

/**
 * SETTINGS ACTIONS — business details, the owner's own account, and the public
 * WhatsApp number.
 *
 * Business details are owner-only. Account details and the password belong to
 * the signed-in person, so any member can change their own. Emails are unique
 * and re-checked here; passwords are stored only as PBKDF2 hashes.
 */

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function text(formData: FormData, key: string, max = 200): string {
  return String(formData.get(key) ?? "").trim().slice(0, max);
}

export async function updateBusinessDetailsAction(formData: FormData): Promise<void> {
  const { user, business, role } = await requireBusiness();
  if (role !== "owner") redirect("/dashboard/settings?error=forbidden");

  const name = text(formData, "name", 80);
  const industryInput = text(formData, "industry", 40);
  if (name.length < 2) redirect("/dashboard/settings?error=name");

  const industry = isIndustry(industryInput) ? industryInput : business.industry;

  const db = await getDb();
  await db.run("UPDATE businesses SET name = ?, industry = ? WHERE id = ?", [
    name,
    industry,
    business.id,
  ]);

  await logAudit({
    businessId: business.id,
    actorUserId: user.id,
    action: "business.updated",
    entity: "business",
    entityId: business.id,
    payload: { name, industry },
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/website");
  revalidatePath(`/b/${business.slug}`);
  redirect("/dashboard/settings?saved=1");
}

export async function saveWhatsappAction(formData: FormData): Promise<void> {
  const { user, business } = await requireBusiness();
  const whatsapp = text(formData, "whatsapp", 30);

  if (whatsapp && !/^[+0-9][0-9\s()-]{5,29}$/.test(whatsapp)) {
    redirect("/dashboard/whatsapp?error=number");
  }

  const db = await getDb();
  await db.run("UPDATE business_profiles SET whatsapp = ?, updated_at = ? WHERE business_id = ?", [
    whatsapp,
    new Date().toISOString(),
    business.id,
  ]);

  await logAudit({
    businessId: business.id,
    actorUserId: user.id,
    action: "storefront.updated",
    entity: "business_profile",
    entityId: business.id,
    payload: { field: "whatsapp" },
  });

  revalidatePath("/dashboard/whatsapp");
  revalidatePath("/dashboard/website");
  revalidatePath(`/b/${business.slug}`);
  redirect("/dashboard/whatsapp?saved=1");
}

export async function updateAccountAction(formData: FormData): Promise<void> {
  const { user, business } = await requireBusiness();
  const fullName = text(formData, "fullName", 80);
  const email = text(formData, "email", 160).toLowerCase();

  if (!EMAIL.test(email)) redirect("/dashboard/settings?error=email");
  if (fullName.length < 2) redirect("/dashboard/settings?error=personName");

  const db = await getDb();
  const clash = await db.first<{ id: string }>("SELECT id FROM users WHERE lower(email) = ? AND id != ?", [
    email,
    user.id,
  ]);
  if (clash) redirect("/dashboard/settings?error=emailTaken");

  await db.run("UPDATE users SET full_name = ?, email = ? WHERE id = ?", [fullName, email, user.id]);

  await logAudit({
    businessId: business.id,
    actorUserId: user.id,
    action: "account.updated",
    entity: "user",
    entityId: user.id,
    payload: { email },
  });

  revalidatePath("/dashboard/settings");
  redirect("/dashboard/settings?saved=account");
}

export async function changePasswordAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const current = String(formData.get("currentPassword") ?? "");
  const next = String(formData.get("newPassword") ?? "");
  const confirm = String(formData.get("confirmPassword") ?? "");

  if (next.length < 8) redirect("/dashboard/settings?error=short");
  if (next !== confirm) redirect("/dashboard/settings?error=mismatch");

  const db = await getDb();
  const row = await db.first<{ password_hash: string }>(
    "SELECT password_hash FROM users WHERE id = ?",
    [user.id],
  );
  if (!row || !(await verifyPassword(current, row.password_hash))) {
    redirect("/dashboard/settings?error=password");
  }

  await db.run("UPDATE users SET password_hash = ? WHERE id = ?", [
    await hashPassword(next),
    user.id,
  ]);

  await logAudit({
    businessId: null,
    actorUserId: user.id,
    action: "account.updated",
    entity: "user",
    entityId: user.id,
    payload: { field: "password" },
  });

  redirect("/dashboard/settings?saved=password");
}
