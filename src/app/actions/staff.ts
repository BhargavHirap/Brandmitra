"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logAudit, requireBusiness } from "@/lib/business";
import { getDb } from "@/lib/db";

/**
 * STAFF ACTIONS.
 *
 * A person must already have a Vantra account before they can be added —
 * there is no email service in this project yet, so anything else would be a
 * fake "invite sent" message. Adding a member links that existing account to
 * this business. The owner row can never be changed or removed here, and the
 * plan's staff limit is checked on the server.
 */

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function text(formData: FormData, key: string, max = 160): string {
  return String(formData.get(key) ?? "").trim().slice(0, max);
}

export async function addStaffAction(formData: FormData): Promise<void> {
  const { user, business, planId, role } = await requireBusiness();
  if (role !== "owner") redirect("/dashboard/staff?error=forbidden");

  const email = text(formData, "email").toLowerCase();
  if (!EMAIL.test(email)) redirect("/dashboard/staff?error=email");
  if (email === user.email.toLowerCase()) redirect("/dashboard/staff?error=self");

  const db = await getDb();
  const [plan, countRow, target] = await Promise.all([
    db.first<{ staff_limit: number; name: string }>(
      "SELECT staff_limit, name FROM plans WHERE id = ?",
      [planId],
    ),
    db.first<{ n: number }>("SELECT COUNT(*) AS n FROM business_members WHERE business_id = ?", [
      business.id,
    ]),
    db.first<{ id: string; full_name: string }>(
      "SELECT id, full_name FROM users WHERE lower(email) = ?",
      [email],
    ),
  ]);

  const limit = Number(plan?.staff_limit ?? 1);
  const used = Number(countRow?.n ?? 0);
  if (used >= limit) redirect("/dashboard/staff?error=limit");

  if (!target) redirect("/dashboard/staff?error=unknown");

  const existing = await db.first<{ id: string }>(
    "SELECT id FROM business_members WHERE business_id = ? AND user_id = ?",
    [business.id, target.id],
  );
  if (existing) redirect("/dashboard/staff?error=member");

  await db.run(
    "INSERT INTO business_members (id, business_id, user_id, role, created_at) VALUES (?, ?, ?, 'staff', ?)",
    [crypto.randomUUID(), business.id, target.id, new Date().toISOString()],
  );

  await logAudit({
    businessId: business.id,
    actorUserId: user.id,
    action: "staff.added",
    entity: "business_member",
    payload: { email, role: "staff" },
  });

  revalidatePath("/dashboard/staff");
  redirect("/dashboard/staff?saved=1");
}

export async function changeStaffRoleAction(formData: FormData): Promise<void> {
  const { user, business, role } = await requireBusiness();
  if (role !== "owner") redirect("/dashboard/staff?error=forbidden");

  const memberId = text(formData, "id", 64);
  const nextRole = text(formData, "role", 20) === "manager" ? "manager" : "staff";

  const db = await getDb();
  const member = await db.first<{ id: string; user_id: string; role: string; email: string }>(
    `SELECT m.id, m.user_id, m.role, u.email
       FROM business_members m
       JOIN users u ON u.id = m.user_id
      WHERE m.id = ? AND m.business_id = ?`,
    [memberId, business.id],
  );
  if (!member) redirect("/dashboard/staff?error=missing");
  if (member.role === "owner") redirect("/dashboard/staff?error=owner");

  await db.run("UPDATE business_members SET role = ? WHERE id = ? AND business_id = ?", [
    nextRole,
    member.id,
    business.id,
  ]);

  await logAudit({
    businessId: business.id,
    actorUserId: user.id,
    action: "staff.updated",
    entity: "business_member",
    entityId: member.id,
    payload: { email: member.email, role: nextRole },
  });

  revalidatePath("/dashboard/staff");
  redirect("/dashboard/staff?saved=1");
}

export async function removeStaffAction(formData: FormData): Promise<void> {
  const { user, business, role } = await requireBusiness();
  if (role !== "owner") redirect("/dashboard/staff?error=forbidden");

  const memberId = text(formData, "id", 64);
  const db = await getDb();

  const member = await db.first<{ id: string; role: string; email: string }>(
    `SELECT m.id, m.role, u.email
       FROM business_members m
       JOIN users u ON u.id = m.user_id
      WHERE m.id = ? AND m.business_id = ?`,
    [memberId, business.id],
  );
  if (!member) redirect("/dashboard/staff?error=missing");
  if (member.role === "owner") redirect("/dashboard/staff?error=owner");

  await db.run("DELETE FROM business_members WHERE id = ? AND business_id = ? AND role != 'owner'", [
    member.id,
    business.id,
  ]);

  await logAudit({
    businessId: business.id,
    actorUserId: user.id,
    action: "staff.removed",
    entity: "business_member",
    entityId: member.id,
    payload: { email: member.email },
  });

  revalidatePath("/dashboard/staff");
  redirect("/dashboard/staff?removed=1");
}
