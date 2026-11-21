"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logAudit, requireBusiness } from "@/lib/business";
import { getDb, type Db } from "@/lib/db";

/**
 * STOCK ACTIONS.
 *
 * Stock lives in its own `inventory` table, one row per product, so a product
 * does not have to carry columns it may never use. Zero stock also marks the
 * product sold out on the storefront; restocking brings it back. That behaviour
 * is stated on the page, because it changes something the owner can see.
 */

function int(formData: FormData, key: string, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(String(formData.get(key) ?? ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

async function applyStock(
  db: Db,
  businessId: string,
  product: { id: string; name: string },
  quantity: number,
  threshold: number,
): Promise<void> {
  const now = new Date().toISOString();

  await db.run(
    `INSERT INTO inventory (id, business_id, product_id, stock_on_hand, low_stock_threshold, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(business_id, product_id) DO UPDATE SET
        stock_on_hand = excluded.stock_on_hand,
        low_stock_threshold = excluded.low_stock_threshold,
        updated_at = excluded.updated_at`,
    [crypto.randomUUID(), businessId, product.id, quantity, threshold, now],
  );

  // Zero on hand means "sold out" to customers; any positive number is back in stock.
  await db.run("UPDATE products SET is_available = ? WHERE id = ? AND business_id = ?", [
    quantity > 0 ? 1 : 0,
    product.id,
    businessId,
  ]);
}

export async function saveStockAction(formData: FormData): Promise<void> {
  const { user, business } = await requireBusiness();
  const db = await getDb();

  const productId = String(formData.get("productId") ?? "").trim().slice(0, 64);
  const product = await db.first<{ id: string; name: string }>(
    "SELECT id, name FROM products WHERE id = ? AND business_id = ?",
    [productId, business.id],
  );
  if (!product) redirect("/dashboard/inventory?error=missing");

  const quantity = int(formData, "quantity", 0, 0, 1_000_000);
  const threshold = int(formData, "threshold", 5, 0, 100_000);

  await applyStock(db, business.id, product, quantity, threshold);

  await logAudit({
    businessId: business.id,
    actorUserId: user.id,
    action: "inventory.updated",
    entity: "product",
    entityId: product.id,
    payload: { product: product.name, quantity, threshold },
  });

  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard/products");
  revalidatePath(`/b/${business.slug}`);
  redirect("/dashboard/inventory?saved=1");
}

export async function adjustStockAction(formData: FormData): Promise<void> {
  const { user, business } = await requireBusiness();
  const db = await getDb();

  const productId = String(formData.get("productId") ?? "").trim().slice(0, 64);
  const product = await db.first<{ id: string; name: string }>(
    "SELECT id, name FROM products WHERE id = ? AND business_id = ?",
    [productId, business.id],
  );
  if (!product) redirect("/dashboard/inventory?error=missing");

  const current = await db.first<{ stock_on_hand: number; low_stock_threshold: number }>(
    "SELECT stock_on_hand, low_stock_threshold FROM inventory WHERE business_id = ? AND product_id = ?",
    [business.id, product.id],
  );
  const threshold = Number(current?.low_stock_threshold ?? 5);
  const delta = int(formData, "delta", 0, -1_000_000, 1_000_000);
  const quantity = Math.max(0, Number(current?.stock_on_hand ?? 0) + delta);

  await applyStock(db, business.id, product, quantity, threshold);

  await logAudit({
    businessId: business.id,
    actorUserId: user.id,
    action: "inventory.updated",
    entity: "product",
    entityId: product.id,
    payload: { product: product.name, quantity, delta },
  });

  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard/products");
  revalidatePath(`/b/${business.slug}`);
  redirect("/dashboard/inventory?saved=1");
}
