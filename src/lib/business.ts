import { redirect } from "next/navigation";
import { requireUser, type SessionUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

/**
 * TENANT LAYER — the single most important security rule in this codebase.
 *
 * A business id is NEVER taken from the URL, a form field, or a header.
 * It is always derived from the logged-in user's membership row in the database.
 * Every query for business data must take that id as its first argument, so a
 * logged-in owner physically cannot read another business's rows.
 */

export type BusinessRow = {
  id: string;
  slug: string;
  name: string;
  industry: string;
  status: string;
  owner_user_id: string;
  created_at: string;
};

export type MembershipContext = {
  user: SessionUser;
  business: BusinessRow;
  role: string;
  planId: string;
};

/* The list of business types lives in src/lib/industries.ts (INDUSTRY_GROUPS). */

/**
 * Products are not capped by any plan. The `plans.product_limit` column still
 * exists (the actions keep their "at most" check), but every plan stores this
 * ceiling, and the screens say "Unlimited" instead of printing the number.
 */
export const UNLIMITED_PRODUCTS = 1_000_000;

export function isUnlimitedProducts(limit: number): boolean {
  return Number(limit) >= UNLIMITED_PRODUCTS;
}

export function productLimitLabel(limit: number): string {
  return isUnlimitedProducts(limit) ? "Unlimited" : String(limit);
}

/**
 * Team seats are not capped by any plan either. The `plans.staff_limit` column
 * still exists and `<` is still checked on the server, but every plan stores
 * this ceiling, so adding a colleague never depends on buying a bigger plan.
 */
export const UNLIMITED_STAFF = 1_000_000;

export function isUnlimitedStaff(limit: number): boolean {
  return Number(limit) >= UNLIMITED_STAFF;
}

export function staffLimitLabel(limit: number): string {
  return isUnlimitedStaff(limit) ? "Unlimited" : String(limit);
}

export const TEMPLATES = [
  { value: "aurora", label: "Aurora", note: "Editorial, image-first" },
  { value: "grid", label: "Grid", note: "Dense catalogue" },
  { value: "monolith", label: "Monolith", note: "Bold, high contrast" },
] as const;

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 48);
}

/** Find a free public slug, e.g. cafe-alpha, cafe-alpha-2, cafe-alpha-3. */
export async function uniqueSlug(base: string): Promise<string> {
  const db = await getDb();
  const root = slugify(base) || "business";
  let candidate = root;
  for (let attempt = 2; attempt < 200; attempt += 1) {
    const taken = await db.first<{ id: string }>("SELECT id FROM businesses WHERE slug = ?", [
      candidate,
    ]);
    if (!taken) return candidate;
    candidate = `${root}-${attempt}`;
  }
  return `${root}-${Math.random().toString(36).slice(2, 7)}`;
}

export async function getMembership(userId: string): Promise<Omit<MembershipContext, "user"> | null> {
  const db = await getDb();
  const row = await db.first<BusinessRow & { role: string; plan_id: string | null }>(
    `SELECT b.id, b.slug, b.name, b.industry, b.status, b.owner_user_id, b.created_at,
            m.role, s.plan_id
       FROM business_members m
       JOIN businesses b ON b.id = m.business_id
       LEFT JOIN subscriptions s ON s.business_id = b.id
      WHERE m.user_id = ?
      ORDER BY m.created_at ASC
      LIMIT 1`,
    [userId],
  );
  if (!row) return null;

  const { role, plan_id: planId, ...business } = row;
  return { business, role, planId: planId ?? "free" };
}

/**
 * Founders (`users.is_platform_admin`) belong to the brand's own business and
 * need to see every screen of it while the product is being shown and tested.
 * That flag only ever adds permission to a business the person is already a
 * member of — it never reaches into another business's rows — and it is set by
 * `npm run grant:founders`, never from a form.
 */
export function effectiveRole(user: SessionUser, role: string): string {
  return user.isPlatformAdmin ? "owner" : role;
}

/** Use inside any /dashboard page or action. Redirects if the user has no business yet. */
export async function requireBusiness(): Promise<MembershipContext> {
  const user = await requireUser();
  const membership = await getMembership(user.id);
  if (!membership) redirect("/onboarding");
  if (membership.business.status === "suspended") redirect("/suspended");
  return { user, ...membership, role: effectiveRole(user, membership.role) };
}

export async function logAudit(input: {
  businessId: string | null;
  actorUserId: string | null;
  actorType?: "user" | "ai" | "system";
  action: string;
  entity?: string;
  entityId?: string;
  payload?: Record<string, unknown>;
}): Promise<void> {
  const db = await getDb();
  await db.run(
    `INSERT INTO audit_logs
       (id, business_id, actor_user_id, actor_type, action, entity, entity_id, payload, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      crypto.randomUUID(),
      input.businessId,
      input.actorUserId,
      input.actorType ?? "user",
      input.action,
      input.entity ?? "",
      input.entityId ?? "",
      JSON.stringify(input.payload ?? {}),
      new Date().toISOString(),
    ],
  );
}
