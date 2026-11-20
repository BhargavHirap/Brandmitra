"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cartCookieName, getCartId } from "@/lib/cart";
import { getDb, type Db } from "@/lib/db";

/**
 * PUBLIC CART ACTIONS.
 *
 * These run for anonymous visitors, so they never trust a business id, price or
 * product id from the browser without checking it against the database:
 *   - the business is found by its public slug,
 *   - the product must belong to that business and be visible,
 *   - each chosen option must belong to this product's group, be available,
 *     and satisfy the group's required / minimum / maximum rules,
 *   - the unit price is computed here from the live rows, never sent by the page.
 */

const MAX_QUANTITY = 20;
const CART_DAYS = 14;

function text(formData: FormData, key: string, max = 200): string {
  return String(formData.get(key) ?? "")
    .trim()
    .slice(0, max);
}

async function businessBySlug(slug: string) {
  const db = await getDb();
  return db.first<{ id: string; slug: string; name: string; status: string }>(
    "SELECT id, slug, name, status FROM businesses WHERE slug = ?",
    [slug],
  );
}

async function ensureOpenCart(db: Db, businessId: string): Promise<string> {
  const store = await cookies();
  const name = cartCookieName(businessId);
  const existing = store.get(name)?.value;

  if (existing) {
    const cart = await db.first<{ id: string }>(
      "SELECT id FROM carts WHERE id = ? AND business_id = ? AND status = 'open'",
      [existing, businessId],
    );
    if (cart) return cart.id;
  }

  const cartId = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.run(
    `INSERT INTO carts (id, business_id, customer_id, status, channel, created_at, updated_at)
     VALUES (?, ?, NULL, 'open', 'web', ?, ?)`,
    [cartId, businessId, now, now],
  );

  store.set(name, cartId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: CART_DAYS * 24 * 60 * 60,
  });

  return cartId;
}

function revalidateStorefront(slug: string) {
  revalidatePath(`/b/${slug}`);
  revalidatePath(`/b/${slug}/cart`);
}

export async function addToCartAction(formData: FormData): Promise<void> {
  const slug = text(formData, "slug", 80);
  const productId = text(formData, "productId", 64);
  const quantity = Math.min(Math.max(Number.parseInt(text(formData, "quantity", 4), 10) || 1, 1), MAX_QUANTITY);

  const business = await businessBySlug(slug);
  if (!business || business.status !== "active") redirect("/suspended");

  const db = await getDb();
  const product = await db.first<{ id: string; name: string; price: number }>(
    `SELECT id, name, price FROM products
      WHERE id = ? AND business_id = ? AND is_active = 1 AND is_available = 1`,
    [productId, business.id],
  );
  if (!product) redirect(`/b/${business.slug}?error=unavailable#catalogue`);

  const groups = await db.all<{
    id: string;
    name: string;
    selection_type: string;
    is_required: number;
    min_select: number;
    max_select: number;
  }>(
    `SELECT id, name, selection_type, is_required, min_select, max_select
       FROM customization_groups
      WHERE product_id = ? AND business_id = ?
      ORDER BY sort_order ASC`,
    [product.id, business.id],
  );

  const chosenOptions: { id: string; name: string; price: number }[] = [];

  for (const group of groups) {
    const submitted = formData
      .getAll(`group_${group.id}`)
      .map((value) => String(value))
      .filter(Boolean);

    if (submitted.length === 0) {
      if (group.is_required === 1) {
        redirect(`/b/${business.slug}?error=required#catalogue`);
      }
      continue;
    }

    const rows = await db.all<{ id: string; name: string; price_delta: number }>(
      `SELECT id, name, price_delta FROM customization_options
        WHERE group_id = ? AND business_id = ? AND is_available = 1`,
      [group.id, business.id],
    );
    const allowed = new Map(rows.map((row) => [row.id, row]));

    const valid = submitted
      .map((id) => allowed.get(id))
      .filter((row): row is { id: string; name: string; price_delta: number } => Boolean(row));

    if (valid.length === 0) {
      redirect(`/b/${business.slug}?error=unavailable#catalogue`);
    }

    const limit = group.selection_type === "single" ? 1 : Math.max(1, Number(group.max_select) || 1);
    const picked = valid.slice(0, limit);

    const minimum = group.selection_type === "single" ? 1 : Math.max(0, Number(group.min_select) || 0);
    if (picked.length < minimum) {
      redirect(`/b/${business.slug}?error=required#catalogue`);
    }

    for (const option of picked) {
      chosenOptions.push({
        id: option.id,
        name: option.name,
        price: Number(option.price_delta),
      });
    }
  }

  const unitPrice = Number(product.price) + chosenOptions.reduce((sum, option) => sum + option.price, 0);
  const cartId = await ensureOpenCart(db, business.id);
  const now = new Date().toISOString();

  const existingItems = await db.all<{ id: string; product_id: string; quantity: number; options: string }>(
    "SELECT id, product_id, quantity, options FROM cart_items WHERE cart_id = ? AND business_id = ?",
    [cartId, business.id],
  );

  const signature = chosenOptions.map((option) => option.id).sort().join(",");
  const match = existingItems.find((item) => {
    if (item.product_id !== product.id) return false;
    try {
      const parsed = JSON.parse(item.options) as { id: string }[];
      return parsed
        .map((option) => option.id)
        .sort()
        .join(",") === signature;
    } catch {
      return false;
    }
  });

  if (match) {
    const nextQuantity = Math.min(Number(match.quantity) + quantity, MAX_QUANTITY);
    await db.run("UPDATE cart_items SET quantity = ?, unit_price = ? WHERE id = ? AND business_id = ?", [
      nextQuantity,
      unitPrice,
      match.id,
      business.id,
    ]);
  } else {
    await db.run(
      `INSERT INTO cart_items (id, business_id, cart_id, product_id, quantity, unit_price, options, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, '')`,
      [
        crypto.randomUUID(),
        business.id,
        cartId,
        product.id,
        quantity,
        unitPrice,
        JSON.stringify(chosenOptions),
      ],
    );
  }

  await db.run("UPDATE carts SET updated_at = ? WHERE id = ? AND business_id = ?", [
    now,
    cartId,
    business.id,
  ]);

  revalidateStorefront(business.slug);
  redirect(`/b/${business.slug}/cart?added=1`);
}

export async function updateCartItemAction(formData: FormData): Promise<void> {
  const slug = text(formData, "slug", 80);
  const itemId = text(formData, "id", 64);
  const requested = Number.parseInt(text(formData, "quantity", 4), 10);
  const quantity = Number.isFinite(requested) ? Math.min(Math.max(requested, 0), MAX_QUANTITY) : 1;

  const business = await businessBySlug(slug);
  if (!business) redirect("/suspended");

  const db = await getDb();
  const item = await db.first<{ id: string; cart_id: string }>(
    `SELECT ci.id, ci.cart_id FROM cart_items ci
       JOIN carts c ON c.id = ci.cart_id
      WHERE ci.id = ? AND ci.business_id = ? AND c.status = 'open'`,
    [itemId, business.id],
  );
  if (!item) redirect(`/b/${business.slug}/cart`);

  if (quantity === 0) {
    await db.run("DELETE FROM cart_items WHERE id = ? AND business_id = ?", [item.id, business.id]);
  } else {
    await db.run("UPDATE cart_items SET quantity = ? WHERE id = ? AND business_id = ?", [
      quantity,
      item.id,
      business.id,
    ]);
  }

  await db.run("UPDATE carts SET updated_at = ? WHERE id = ?", [new Date().toISOString(), item.cart_id]);
  revalidateStorefront(business.slug);
  redirect(`/b/${business.slug}/cart`);
}

export async function removeCartItemAction(formData: FormData): Promise<void> {
  const slug = text(formData, "slug", 80);
  const itemId = text(formData, "id", 64);

  const business = await businessBySlug(slug);
  if (!business) redirect("/suspended");

  const db = await getDb();
  await db.run("DELETE FROM cart_items WHERE id = ? AND business_id = ?", [itemId, business.id]);

  revalidateStorefront(business.slug);
  redirect(`/b/${business.slug}/cart`);
}

export async function clearCartAction(formData: FormData): Promise<void> {
  const slug = text(formData, "slug", 80);
  const business = await businessBySlug(slug);
  if (!business) redirect("/suspended");

  const db = await getDb();
  const cartId = await getCartId(business.id);
  if (cartId) {
    await db.run("DELETE FROM cart_items WHERE cart_id = ? AND business_id = ?", [
      cartId,
      business.id,
    ]);
  }

  revalidateStorefront(business.slug);
  redirect(`/b/${business.slug}/cart`);
}
