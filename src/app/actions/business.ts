"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import {
  INDUSTRIES,
  TEMPLATES,
  getMembership,
  logAudit,
  requireBusiness,
  slugify,
  uniqueSlug,
} from "@/lib/business";
import { getDb } from "@/lib/db";

function text(formData: FormData, key: string, max = 200): string {
  return String(formData.get(key) ?? "").trim().slice(0, max);
}

const SAFE_COLOR = /^#[0-9a-fA-F]{6}$/;

export async function createBusinessAction(formData: FormData): Promise<void> {
  const user = await requireUser();

  // One business per owner in Phase 1. Multi-business arrives with branches/staff.
  const existing = await getMembership(user.id);
  if (existing) redirect("/dashboard");

  const name = text(formData, "name", 80);
  const industryInput = text(formData, "industry", 40);
  const city = text(formData, "city", 80);
  const tagline = text(formData, "tagline", 120);
  const requestedSlug = text(formData, "slug", 48);

  if (name.length < 2) redirect("/onboarding?error=name");

  const industry = INDUSTRIES.some((item) => item.value === industryInput)
    ? industryInput
    : "other";

  const slug = await uniqueSlug(requestedSlug || slugify(name) || name);
  const businessId = crypto.randomUUID();
  const now = new Date().toISOString();
  const db = await getDb();

  await db.run(
    `INSERT INTO businesses (id, slug, name, industry, status, owner_user_id, created_at)
     VALUES (?, ?, ?, ?, 'active', ?, ?)`,
    [businessId, slug, name, industry, user.id, now],
  );

  await db.run(
    `INSERT INTO business_profiles
       (business_id, tagline, description, logo_url, brand_color, template, currency,
        phone, whatsapp, email, address, city, country, map_url, opening_hours, social_links, updated_at)
     VALUES (?, ?, '', '', '#2F6BFF', 'aurora', 'INR', '', '', ?, '', ?, 'India', '', '', '{}', ?)`,
    [businessId, tagline, user.email, city, now],
  );

  await db.run(
    `INSERT INTO business_members (id, business_id, user_id, role, created_at)
     VALUES (?, ?, ?, 'owner', ?)`,
    [crypto.randomUUID(), businessId, user.id, now],
  );

  await db.run(
    `INSERT INTO business_branches (id, business_id, name, address, phone, is_default, created_at)
     VALUES (?, ?, 'Main branch', ?, '', 1, ?)`,
    [crypto.randomUUID(), businessId, city, now],
  );

  await db.run(
    `INSERT INTO subscriptions (id, business_id, plan_id, status, current_period_end, created_at)
     VALUES (?, ?, 'free', 'active', NULL, ?)`,
    [crypto.randomUUID(), businessId, now],
  );

  await logAudit({
    businessId,
    actorUserId: user.id,
    action: "business.created",
    entity: "business",
    entityId: businessId,
    payload: { name, slug, industry },
  });

  revalidatePath("/dashboard");
  redirect("/dashboard?welcome=1");
}

export async function updateStorefrontAction(formData: FormData): Promise<void> {
  const { user, business } = await requireBusiness();

  const brandColorInput = text(formData, "brandColor", 7);
  const brandColor = SAFE_COLOR.test(brandColorInput) ? brandColorInput.toUpperCase() : "#2F6BFF";
  const templateInput = text(formData, "template", 20);
  const template = TEMPLATES.some((item) => item.value === templateInput) ? templateInput : "aurora";

  const socialLinks = JSON.stringify({
    instagram: text(formData, "instagram", 120),
    facebook: text(formData, "facebook", 120),
    website: text(formData, "website", 120),
  });

  const db = await getDb();
  await db.run(
    `UPDATE business_profiles SET
        tagline = ?, description = ?, brand_color = ?, template = ?,
        phone = ?, whatsapp = ?, email = ?, address = ?, city = ?,
        map_url = ?, opening_hours = ?, social_links = ?, updated_at = ?
      WHERE business_id = ?`,
    [
      text(formData, "tagline", 120),
      text(formData, "description", 1200),
      brandColor,
      template,
      text(formData, "phone", 30),
      text(formData, "whatsapp", 30),
      text(formData, "email", 160),
      text(formData, "address", 240),
      text(formData, "city", 80),
      text(formData, "mapUrl", 300),
      text(formData, "openingHours", 200),
      socialLinks,
      new Date().toISOString(),
      business.id,
    ],
  );

  await logAudit({
    businessId: business.id,
    actorUserId: user.id,
    action: "storefront.updated",
    entity: "business_profile",
    entityId: business.id,
  });

  revalidatePath("/dashboard/website");
  revalidatePath(`/b/${business.slug}`);
  redirect("/dashboard/website?saved=1");
}
