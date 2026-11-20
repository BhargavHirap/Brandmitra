"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logAudit, requireBusiness, slugify } from "@/lib/business";
import { getDb, type Db } from "@/lib/db";

/**
 * CATALOGUE ACTIONS — products, categories and customisation options.
 *
 * Three rules are repeated everywhere in this file:
 *   1. The business id always comes from requireBusiness(), never from the form.
 *   2. Every UPDATE / DELETE carries `AND business_id = ?`, so even a guessed
 *      product id from another business changes nothing.
 *   3. Prices are parsed and range-checked here. The browser's "price" input is
 *      a convenience, not a source of truth.
 */

const MAX_PRICE = 10_000_000;

function text(formData: FormData, key: string, max = 200): string {
  return String(formData.get(key) ?? "")
    .trim()
    .slice(0, max);
}

function checkbox(formData: FormData, key: string): boolean {
  const value = formData.get(key);
  return value === "on" || value === "1" || value === "true";
}

/** "₹350", "350.4" and "350" all become the integer 350. */
function toPrice(raw: string): number {
  const parsed = Number.parseFloat(raw.replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.min(Math.round(parsed), MAX_PRICE);
}

function toInt(raw: string, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

/** Only http(s) images are stored, so `javascript:` URLs can never reach the page. */
function safeImageUrl(raw: string): string {
  if (!raw) return "";
  return /^https?:\/\/\S+$/i.test(raw) ? raw.slice(0, 500) : "";
}

async function uniqueScopedSlug(
  db: Db,
  table: "products" | "product_categories",
  businessId: string,
  base: string,
): Promise<string> {
  const root = slugify(base) || "item";
  let candidate = root;
  for (let attempt = 2; attempt < 200; attempt += 1) {
    const taken = await db.first<{ id: string }>(
      `SELECT id FROM ${table} WHERE business_id = ? AND slug = ?`,
      [businessId, candidate],
    );
    if (!taken) return candidate;
    candidate = `${root}-${attempt}`;
  }
  return `${root}-${Math.random().toString(36).slice(2, 7)}`;
}

async function productQuota(db: Db, businessId: string, planId: string) {
  const plan = await db.first<{ product_limit: number }>(
    "SELECT product_limit FROM plans WHERE id = ?",
    [planId],
  );
  const row = await db.first<{ n: number }>(
    "SELECT COUNT(*) AS n FROM products WHERE business_id = ?",
    [businessId],
  );
  return { used: Number(row?.n ?? 0), limit: Number(plan?.product_limit ?? 10) };
}

async function ownedProduct(db: Db, businessId: string, productId: string) {
  return db.first<{ id: string; name: string }>(
    "SELECT id, name FROM products WHERE id = ? AND business_id = ?",
    [productId, businessId],
  );
}

async function ownedGroup(db: Db, businessId: string, groupId: string) {
  return db.first<{ id: string; product_id: string; name: string }>(
    "SELECT id, product_id, name FROM customization_groups WHERE id = ? AND business_id = ?",
    [groupId, businessId],
  );
}

type ProductInput = {
  name: string;
  categoryId: string | null;
  description: string;
  price: number;
  compareAt: number | null;
  imageUrl: string;
  isActive: number;
  isAvailable: number;
};

async function readProductForm(
  db: Db,
  businessId: string,
  formData: FormData,
): Promise<{ input: ProductInput } | { error: string }> {
  const name = text(formData, "name", 90);
  if (name.length < 2) return { error: "name" };

  const price = toPrice(text(formData, "price", 20));
  const compareAtRaw = text(formData, "compareAtPrice", 20);
  const compareAtValue = compareAtRaw ? toPrice(compareAtRaw) : 0;
  // A "was" price below the real price is confusing advertising, so drop it.
  const compareAt = compareAtValue > price ? compareAtValue : null;

  let categoryId: string | null = null;
  const requestedCategory = text(formData, "categoryId", 64);
  if (requestedCategory) {
    const owned = await db.first<{ id: string }>(
      "SELECT id FROM product_categories WHERE id = ? AND business_id = ?",
      [requestedCategory, businessId],
    );
    if (!owned) return { error: "category" };
    categoryId = owned.id;
  }

  return {
    input: {
      name,
      categoryId,
      description: text(formData, "description", 600),
      price,
      compareAt,
      imageUrl: safeImageUrl(text(formData, "imageUrl", 500)),
      isActive: checkbox(formData, "isActive") ? 1 : 0,
      isAvailable: checkbox(formData, "isAvailable") ? 1 : 0,
    },
  };
}

function revalidateCatalogue(slug: string, productId?: string) {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/products");
  if (productId) revalidatePath(`/dashboard/products/${productId}`);
  revalidatePath(`/b/${slug}`);
}

export async function createProductAction(formData: FormData): Promise<void> {
  const { user, business, planId } = await requireBusiness();
  const db = await getDb();

  const parsed = await readProductForm(db, business.id, formData);
  if ("error" in parsed) redirect(`/dashboard/products/new?error=${parsed.error}`);
  const { input } = parsed;

  const quota = await productQuota(db, business.id, planId);
  if (quota.used >= quota.limit) redirect("/dashboard/products/new?error=limit");

  const productId = crypto.randomUUID();
  const now = new Date().toISOString();
  const slug = await uniqueScopedSlug(db, "products", business.id, input.name);
  const sortRow = await db.first<{ m: number | null }>(
    "SELECT MAX(sort_order) AS m FROM products WHERE business_id = ?",
    [business.id],
  );

  await db.run(
    `INSERT INTO products
       (id, business_id, category_id, name, slug, description, price, compare_at_price,
        image_url, is_active, is_available, sort_order, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      productId,
      business.id,
      input.categoryId,
      input.name,
      slug,
      input.description,
      input.price,
      input.compareAt,
      input.imageUrl,
      input.isActive,
      input.isAvailable,
      Number(sortRow?.m ?? 0) + 1,
      now,
    ],
  );

  await logAudit({
    businessId: business.id,
    actorUserId: user.id,
    action: "product.created",
    entity: "product",
    entityId: productId,
    payload: { name: input.name, price: input.price },
  });

  revalidateCatalogue(business.slug, productId);
  redirect(`/dashboard/products/${productId}?created=1`);
}

export async function updateProductAction(formData: FormData): Promise<void> {
  const { user, business } = await requireBusiness();
  const db = await getDb();

  const productId = text(formData, "id", 64);
  const existing = productId ? await ownedProduct(db, business.id, productId) : null;
  if (!existing) redirect("/dashboard/products?error=missing");

  const parsed = await readProductForm(db, business.id, formData);
  if ("error" in parsed) {
    redirect(`/dashboard/products/${existing.id}?error=${parsed.error}`);
  }
  const { input } = parsed;

  await db.run(
    `UPDATE products SET
        category_id = ?, name = ?, description = ?, price = ?, compare_at_price = ?,
        image_url = ?, is_active = ?, is_available = ?
      WHERE id = ? AND business_id = ?`,
    [
      input.categoryId,
      input.name,
      input.description,
      input.price,
      input.compareAt,
      input.imageUrl,
      input.isActive,
      input.isAvailable,
      existing.id,
      business.id,
    ],
  );

  await logAudit({
    businessId: business.id,
    actorUserId: user.id,
    action: "product.updated",
    entity: "product",
    entityId: existing.id,
    payload: { name: input.name, price: input.price },
  });

  revalidateCatalogue(business.slug, existing.id);
  redirect(`/dashboard/products/${existing.id}?saved=1`);
}

export async function toggleProductAction(formData: FormData): Promise<void> {
  const { user, business } = await requireBusiness();
  const db = await getDb();

  const productId = text(formData, "id", 64);
  const field = text(formData, "field", 12);
  if (field !== "active" && field !== "available") redirect("/dashboard/products");

  const existing = await ownedProduct(db, business.id, productId);
  if (!existing) redirect("/dashboard/products?error=missing");

  const column = field === "active" ? "is_active" : "is_available";
  await db.run(
    `UPDATE products SET ${column} = CASE ${column} WHEN 1 THEN 0 ELSE 1 END
      WHERE id = ? AND business_id = ?`,
    [existing.id, business.id],
  );

  await logAudit({
    businessId: business.id,
    actorUserId: user.id,
    action: "product.updated",
    entity: "product",
    entityId: existing.id,
    payload: { name: existing.name, toggled: column },
  });

  revalidateCatalogue(business.slug, existing.id);
  redirect("/dashboard/products?saved=1");
}

export async function deleteProductAction(formData: FormData): Promise<void> {
  const { user, business } = await requireBusiness();
  const db = await getDb();

  const productId = text(formData, "id", 64);
  const existing = await ownedProduct(db, business.id, productId);
  if (!existing) redirect("/dashboard/products?error=missing");

  // Customisation groups and options cascade at the database level.
  await db.run("DELETE FROM products WHERE id = ? AND business_id = ?", [
    existing.id,
    business.id,
  ]);

  await logAudit({
    businessId: business.id,
    actorUserId: user.id,
    action: "product.deleted",
    entity: "product",
    entityId: existing.id,
    payload: { name: existing.name },
  });

  revalidateCatalogue(business.slug, existing.id);
  redirect("/dashboard/products?deleted=1");
}

/* ------------------------------------------------------------------ */
/* Categories                                                          */
/* ------------------------------------------------------------------ */

export async function createCategoryAction(formData: FormData): Promise<void> {
  const { user, business } = await requireBusiness();
  const db = await getDb();
  const name = text(formData, "name", 40);
  if (name.length < 2) redirect("/dashboard/categories?error=name");

  const duplicate = await db.first<{ id: string }>(
    "SELECT id FROM product_categories WHERE business_id = ? AND lower(name) = lower(?)",
    [business.id, name],
  );
  if (duplicate) redirect("/dashboard/categories?error=duplicate");

  const slug = await uniqueScopedSlug(db, "product_categories", business.id, name);
  const sortRow = await db.first<{ m: number | null }>(
    "SELECT MAX(sort_order) AS m FROM product_categories WHERE business_id = ?",
    [business.id],
  );

  await db.run(
    `INSERT INTO product_categories (id, business_id, name, slug, sort_order, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      crypto.randomUUID(),
      business.id,
      name,
      slug,
      Number(sortRow?.m ?? 0) + 1,
      new Date().toISOString(),
    ],
  );

  await logAudit({
    businessId: business.id,
    actorUserId: user.id,
    action: "category.created",
    entity: "product_category",
    payload: { name },
  });

  revalidateCatalogue(business.slug);
  revalidatePath("/dashboard/categories");
  redirect("/dashboard/categories?saved=1");
}

export async function renameCategoryAction(formData: FormData): Promise<void> {
  const { user, business } = await requireBusiness();
  const db = await getDb();

  const categoryId = text(formData, "id", 64);
  const name = text(formData, "name", 40);
  if (name.length < 2) redirect("/dashboard/categories?error=name");

  const owned = await db.first<{ id: string }>(
    "SELECT id FROM product_categories WHERE id = ? AND business_id = ?",
    [categoryId, business.id],
  );
  if (!owned) redirect("/dashboard/categories?error=missing");

  await db.run("UPDATE product_categories SET name = ? WHERE id = ? AND business_id = ?", [
    name,
    owned.id,
    business.id,
  ]);

  await logAudit({
    businessId: business.id,
    actorUserId: user.id,
    action: "category.updated",
    entity: "product_category",
    entityId: owned.id,
    payload: { name },
  });

  revalidateCatalogue(business.slug);
  revalidatePath("/dashboard/categories");
  redirect("/dashboard/categories?saved=1");
}

export async function moveCategoryAction(formData: FormData): Promise<void> {
  const { business } = await requireBusiness();
  const db = await getDb();

  const categoryId = text(formData, "id", 64);
  const direction = text(formData, "direction", 8) === "up" ? "up" : "down";

  const rows = await db.all<{ id: string; sort_order: number }>(
    "SELECT id, sort_order FROM product_categories WHERE business_id = ? ORDER BY sort_order ASC, name ASC",
    [business.id],
  );
  const index = rows.findIndex((row) => row.id === categoryId);
  if (index === -1) redirect("/dashboard/categories?error=missing");

  const swapWith = direction === "up" ? index - 1 : index + 1;
  if (swapWith < 0 || swapWith >= rows.length) redirect("/dashboard/categories");

  // Normalise positions first so duplicate sort_order values cannot block a swap.
  const current = rows[index];
  const neighbour = rows[swapWith];
  await db.run("UPDATE product_categories SET sort_order = ? WHERE id = ? AND business_id = ?", [
    neighbour.sort_order,
    current.id,
    business.id,
  ]);
  await db.run("UPDATE product_categories SET sort_order = ? WHERE id = ? AND business_id = ?", [
    current.sort_order,
    neighbour.id,
    business.id,
  ]);

  revalidateCatalogue(business.slug);
  revalidatePath("/dashboard/categories");
  redirect("/dashboard/categories");
}

export async function deleteCategoryAction(formData: FormData): Promise<void> {
  const { user, business } = await requireBusiness();
  const db = await getDb();

  const categoryId = text(formData, "id", 64);
  const owned = await db.first<{ id: string; name: string }>(
    "SELECT id, name FROM product_categories WHERE id = ? AND business_id = ?",
    [categoryId, business.id],
  );
  if (!owned) redirect("/dashboard/categories?error=missing");

  // Products are kept: category_id becomes NULL (ON DELETE SET NULL).
  await db.run("DELETE FROM product_categories WHERE id = ? AND business_id = ?", [
    owned.id,
    business.id,
  ]);

  await logAudit({
    businessId: business.id,
    actorUserId: user.id,
    action: "category.deleted",
    entity: "product_category",
    entityId: owned.id,
    payload: { name: owned.name },
  });

  revalidateCatalogue(business.slug);
  revalidatePath("/dashboard/categories");
  redirect("/dashboard/categories?deleted=1");
}

/* ------------------------------------------------------------------ */
/* Customisation groups and options                                    */
/* ------------------------------------------------------------------ */

export async function createGroupAction(formData: FormData): Promise<void> {
  const { user, business } = await requireBusiness();
  const db = await getDb();

  const productId = text(formData, "productId", 64);
  const product = await ownedProduct(db, business.id, productId);
  if (!product) redirect("/dashboard/products?error=missing");

  const name = text(formData, "name", 50);
  if (name.length < 2) {
    redirect(`/dashboard/products/${product.id}?error=group`);
  }

  const selectionType = text(formData, "selectionType", 10) === "multi" ? "multi" : "single";
  const required = checkbox(formData, "isRequired");
  const minSelect =
    selectionType === "single" ? (required ? 1 : 0) : toInt(text(formData, "minSelect", 5), 0, 0, 20);
  const maxSelect =
    selectionType === "single"
      ? 1
      : Math.max(minSelect, toInt(text(formData, "maxSelect", 5), 3, 1, 20));

  const sortRow = await db.first<{ m: number | null }>(
    "SELECT MAX(sort_order) AS m FROM customization_groups WHERE product_id = ? AND business_id = ?",
    [product.id, business.id],
  );

  await db.run(
    `INSERT INTO customization_groups
       (id, business_id, product_id, name, selection_type, is_required, min_select, max_select, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      crypto.randomUUID(),
      business.id,
      product.id,
      name,
      selectionType,
      required ? 1 : 0,
      minSelect,
      maxSelect,
      Number(sortRow?.m ?? 0) + 1,
    ],
  );

  await logAudit({
    businessId: business.id,
    actorUserId: user.id,
    action: "product.options.updated",
    entity: "customization_group",
    entityId: product.id,
    payload: { product: product.name, group: name },
  });

  revalidateCatalogue(business.slug, product.id);
  redirect(`/dashboard/products/${product.id}?saved=1#options`);
}

export async function updateGroupAction(formData: FormData): Promise<void> {
  const { user, business } = await requireBusiness();
  const db = await getDb();

  const groupId = text(formData, "id", 64);
  const group = await ownedGroup(db, business.id, groupId);
  if (!group) redirect("/dashboard/products?error=missing");

  const name = text(formData, "name", 50);
  if (name.length < 2) redirect(`/dashboard/products/${group.product_id}?error=group#options`);

  const selectionType = text(formData, "selectionType", 10) === "multi" ? "multi" : "single";
  const required = checkbox(formData, "isRequired");
  const minSelect =
    selectionType === "single" ? (required ? 1 : 0) : toInt(text(formData, "minSelect", 5), 0, 0, 20);
  const maxSelect =
    selectionType === "single"
      ? 1
      : Math.max(minSelect, toInt(text(formData, "maxSelect", 5), 3, 1, 20));

  await db.run(
    `UPDATE customization_groups SET
        name = ?, selection_type = ?, is_required = ?, min_select = ?, max_select = ?
      WHERE id = ? AND business_id = ?`,
    [name, selectionType, required ? 1 : 0, minSelect, maxSelect, group.id, business.id],
  );

  await logAudit({
    businessId: business.id,
    actorUserId: user.id,
    action: "product.options.updated",
    entity: "customization_group",
    entityId: group.product_id,
    payload: { group: name },
  });

  revalidateCatalogue(business.slug, group.product_id);
  redirect(`/dashboard/products/${group.product_id}?saved=1#options`);
}

export async function deleteGroupAction(formData: FormData): Promise<void> {
  const { user, business } = await requireBusiness();
  const db = await getDb();

  const groupId = text(formData, "id", 64);
  const group = await ownedGroup(db, business.id, groupId);
  if (!group) redirect("/dashboard/products?error=missing");

  await db.run("DELETE FROM customization_groups WHERE id = ? AND business_id = ?", [
    group.id,
    business.id,
  ]);

  await logAudit({
    businessId: business.id,
    actorUserId: user.id,
    action: "product.options.updated",
    entity: "customization_group",
    entityId: group.product_id,
    payload: { removed: group.name },
  });

  revalidateCatalogue(business.slug, group.product_id);
  redirect(`/dashboard/products/${group.product_id}?saved=1#options`);
}

export async function createOptionAction(formData: FormData): Promise<void> {
  const { user, business } = await requireBusiness();
  const db = await getDb();

  const groupId = text(formData, "groupId", 64);
  const group = await ownedGroup(db, business.id, groupId);
  if (!group) redirect("/dashboard/products?error=missing");

  const name = text(formData, "name", 40);
  if (name.length < 1) {
    redirect(`/dashboard/products/${group.product_id}?error=option#options`);
  }

  const priceDelta = toPrice(text(formData, "priceDelta", 20));
  const isDefault = checkbox(formData, "isDefault") ? 1 : 0;

  const optionId = crypto.randomUUID();
  await db.run(
    `INSERT INTO customization_options
       (id, business_id, group_id, name, price_delta, is_default, is_available)
     VALUES (?, ?, ?, ?, ?, ?, 1)`,
    [optionId, business.id, group.id, name, priceDelta, isDefault],
  );

  // A single-choice group can only have one default.
  if (isDefault) {
    await db.run(
      `UPDATE customization_options SET is_default = 0
        WHERE group_id = ? AND business_id = ? AND id != ?`,
      [group.id, business.id, optionId],
    );
  }

  await logAudit({
    businessId: business.id,
    actorUserId: user.id,
    action: "product.options.updated",
    entity: "customization_option",
    entityId: group.product_id,
    payload: { group: group.name, option: name, priceDelta },
  });

  revalidateCatalogue(business.slug, group.product_id);
  redirect(`/dashboard/products/${group.product_id}?saved=1#options`);
}

export async function updateOptionAction(formData: FormData): Promise<void> {
  const { user, business } = await requireBusiness();
  const db = await getDb();

  const optionId = text(formData, "id", 64);
  const option = await db.first<{ id: string; group_id: string; name: string }>(
    "SELECT id, group_id, name FROM customization_options WHERE id = ? AND business_id = ?",
    [optionId, business.id],
  );
  if (!option) redirect("/dashboard/products?error=missing");

  const group = await ownedGroup(db, business.id, option.group_id);
  if (!group) redirect("/dashboard/products?error=missing");

  const name = text(formData, "name", 40);
  if (name.length < 1) {
    redirect(`/dashboard/products/${group.product_id}?error=option#options`);
  }

  const priceDelta = toPrice(text(formData, "priceDelta", 20));
  const isDefault = checkbox(formData, "isDefault") ? 1 : 0;
  const isAvailable = checkbox(formData, "isAvailable") ? 1 : 0;

  await db.run(
    `UPDATE customization_options SET name = ?, price_delta = ?, is_default = ?, is_available = ?
      WHERE id = ? AND business_id = ?`,
    [name, priceDelta, isDefault, isAvailable, option.id, business.id],
  );

  if (isDefault) {
    await db.run(
      `UPDATE customization_options SET is_default = 0
        WHERE group_id = ? AND business_id = ? AND id != ?`,
      [group.id, business.id, option.id],
    );
  }

  await logAudit({
    businessId: business.id,
    actorUserId: user.id,
    action: "product.options.updated",
    entity: "customization_option",
    entityId: group.product_id,
    payload: { option: name, priceDelta },
  });

  revalidateCatalogue(business.slug, group.product_id);
  redirect(`/dashboard/products/${group.product_id}?saved=1#options`);
}

export async function deleteOptionAction(formData: FormData): Promise<void> {
  const { user, business } = await requireBusiness();
  const db = await getDb();

  const optionId = text(formData, "id", 64);
  const option = await db.first<{ id: string; group_id: string; name: string }>(
    "SELECT id, group_id, name FROM customization_options WHERE id = ? AND business_id = ?",
    [optionId, business.id],
  );
  if (!option) redirect("/dashboard/products?error=missing");

  const group = await ownedGroup(db, business.id, option.group_id);
  if (!group) redirect("/dashboard/products?error=missing");

  await db.run("DELETE FROM customization_options WHERE id = ? AND business_id = ?", [
    option.id,
    business.id,
  ]);

  await logAudit({
    businessId: business.id,
    actorUserId: user.id,
    action: "product.options.updated",
    entity: "customization_option",
    entityId: group.product_id,
    payload: { removed: option.name },
  });

  revalidateCatalogue(business.slug, group.product_id);
  redirect(`/dashboard/products/${group.product_id}?saved=1#options`);
}
