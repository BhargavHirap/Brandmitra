"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logAudit, requireBusiness } from "@/lib/business";
import { cartCookieName, loadCart, type CartLine } from "@/lib/cart";
import { getDb, type Db } from "@/lib/db";
import { allowedTransitions } from "@/lib/orders";

/**
 * ORDER ACTIONS.
 *
 * Checkout is public, so everything it needs is re-derived here:
 *   - the business comes from its public slug,
 *   - every line and price comes from loadCart(), which reads live database rows,
 *   - the browser sends only a name, a phone number, a note and a payment method.
 *
 * A total posted by a tampered page is not read anywhere in this file.
 */

const PAYMENT_METHODS = ["cod", "pay_at_store"] as const;
type PaymentMethod = (typeof PAYMENT_METHODS)[number];

function text(formData: FormData, key: string, max = 300): string {
  return String(formData.get(key) ?? "")
    .trim()
    .slice(0, max);
}

function digitsOnly(value: string): string {
  return value.replace(/[^\d]/g, "").slice(0, 15);
}

async function nextOrderNumber(db: Db, businessId: string): Promise<string> {
  const row = await db.first<{ n: number }>(
    "SELECT COUNT(*) AS n FROM orders WHERE business_id = ?",
    [businessId],
  );
  let sequence = Number(row?.n ?? 0) + 1001;

  for (let attempt = 0; attempt < 60; attempt += 1) {
    const candidate = `BM-${sequence}`;
    const taken = await db.first<{ id: string }>(
      "SELECT id FROM orders WHERE business_id = ? AND order_number = ?",
      [businessId, candidate],
    );
    if (!taken) return candidate;
    sequence += 1;
  }

  return `BM-${Date.now().toString().slice(-7)}`;
}

type StockReservation = { productId: string; quantity: number };

/**
 * Takes stock for every tracked line, atomically, before the order row exists.
 *
 * Each line is one conditional UPDATE (`… AND stock_on_hand >= ?`). SQLite
 * applies writes one at a time inside the statement, so when two buyers race for
 * the last unit the second UPDATE matches no row and changes nothing: exactly
 * one of them gets it. Reading the stock first and then subtracting would be the
 * bug this replaces — both readers would see 1 and both would write 0.
 *
 * Products with no `inventory` row are not tracked and stay unlimited, which is
 * how the catalogue worked before stock existed.
 */
async function reserveStock(
  db: Db,
  businessId: string,
  lines: CartLine[],
): Promise<{ shortfall: CartLine | null; reserved: StockReservation[] }> {
  const productIds = [...new Set(lines.map((line) => line.productId))];
  if (productIds.length === 0) return { shortfall: null, reserved: [] };

  const tracked = await db.all<{ product_id: string }>(
    `SELECT product_id FROM inventory
      WHERE business_id = ? AND product_id IN (${productIds.map(() => "?").join(", ")})`,
    [businessId, ...productIds],
  );
  const trackedIds = new Set(tracked.map((row) => row.product_id));

  const now = new Date().toISOString();
  const reserved: StockReservation[] = [];

  for (const line of lines) {
    if (!trackedIds.has(line.productId)) continue;

    const changed = await db.run(
      `UPDATE inventory
          SET stock_on_hand = stock_on_hand - ?, updated_at = ?
        WHERE business_id = ? AND product_id = ? AND stock_on_hand >= ?`,
      [line.quantity, now, businessId, line.productId, line.quantity],
    );

    if (changed === 0) {
      await releaseStock(db, businessId, reserved);
      return { shortfall: line, reserved: [] };
    }

    reserved.push({ productId: line.productId, quantity: line.quantity });
  }

  // A product that just sold its last unit reads as sold out on the storefront.
  await db.run(
    `UPDATE products SET is_available = 0
      WHERE business_id = ?
        AND id IN (SELECT product_id FROM inventory WHERE business_id = ? AND stock_on_hand <= 0)`,
    [businessId, businessId],
  );

  return { shortfall: null, reserved };
}

/** Puts reserved stock back, and un-marks a product that is no longer at zero. */
async function releaseStock(
  db: Db,
  businessId: string,
  reserved: StockReservation[],
): Promise<void> {
  if (reserved.length === 0) return;

  const now = new Date().toISOString();
  const productIds = reserved.map((entry) => entry.productId);

  await db.batch([
    ...reserved.map((entry) => ({
      sql: `UPDATE inventory SET stock_on_hand = stock_on_hand + ?, updated_at = ?
             WHERE business_id = ? AND product_id = ?`,
      params: [entry.quantity, now, businessId, entry.productId],
    })),
    {
      sql: `UPDATE products SET is_available = 1
             WHERE business_id = ?
               AND id IN (${productIds.map(() => "?").join(", ")})
               AND id IN (SELECT product_id FROM inventory WHERE business_id = ? AND stock_on_hand > 0)`,
      params: [businessId, ...productIds, businessId],
    },
  ]);
}

export async function placeOrderAction(formData: FormData): Promise<void> {
  const slug = text(formData, "slug", 80);
  const name = text(formData, "name", 80);
  const phone = digitsOnly(text(formData, "phone", 20));
  const note = text(formData, "note", 400);
  const requestedMethod = text(formData, "paymentMethod", 20);
  const paymentMethod: PaymentMethod = PAYMENT_METHODS.includes(requestedMethod as PaymentMethod)
    ? (requestedMethod as PaymentMethod)
    : "cod";

  const db = await getDb();
  const business = await db.first<{ id: string; slug: string; name: string; status: string }>(
    "SELECT id, slug, name, status FROM businesses WHERE slug = ?",
    [slug],
  );
  if (!business || business.status !== "active") redirect(`/b/${slug}/cart?error=closed`);

  if (name.length < 2) redirect(`/b/${business.slug}/cart?error=name`);
  if (phone.length < 10) redirect(`/b/${business.slug}/cart?error=phone`);

  const cart = await loadCart(business.id);
  if (cart.lines.length === 0) redirect(`/b/${business.slug}/cart?error=empty`);
  if (cart.hasUnavailable) redirect(`/b/${business.slug}/cart?error=unavailable`);

  const subtotal = cart.subtotal;
  const total = subtotal;

  const now = new Date().toISOString();
  const store = await cookies();

  // The order id is derived from the cart. A double submit (or the back button)
  // therefore cannot create two orders out of one cart.
  const orderId = cart.cartId ?? crypto.randomUUID();
  const existingOrder = await db.first<{ id: string }>(
    "SELECT id FROM orders WHERE id = ? AND business_id = ?",
    [orderId, business.id],
  );
  if (existingOrder) {
    store.delete(cartCookieName(business.id));
    redirect(`/b/${business.slug}/order/${existingOrder.id}`);
  }

  // Stock is taken before the order row exists, so an order can never be written
  // for something that sold out a moment earlier. If saving the order then
  // fails — including losing the double-submit race — the reservation is handed
  // back in the catch below.
  const reservation = await reserveStock(db, business.id, cart.lines);
  if (reservation.shortfall) {
    redirect(`/b/${business.slug}/cart?error=stock`);
  }

  try {
    const orderNumber = await nextOrderNumber(db, business.id);

    const existingCustomer = await db.first<{ id: string; name: string }>(
      "SELECT id, name FROM customers WHERE business_id = ? AND phone = ?",
      [business.id, phone],
    );

    let customerId: string;
    if (existingCustomer) {
      customerId = existingCustomer.id;
      if (name && name !== existingCustomer.name) {
        await db.run("UPDATE customers SET name = ? WHERE id = ? AND business_id = ?", [
          name,
          customerId,
          business.id,
        ]);
      }
    } else {
      customerId = crypto.randomUUID();
      await db.run(
        `INSERT INTO customers (id, business_id, user_id, name, phone, email, loyalty_points, created_at)
         VALUES (?, ?, NULL, ?, ?, '', 0, ?)`,
        [customerId, business.id, name, phone, now],
      );
    }

    const branch = await db.first<{ id: string }>(
      "SELECT id FROM business_branches WHERE business_id = ? ORDER BY is_default DESC LIMIT 1",
      [business.id],
    );

    try {
      await db.run(
        `INSERT INTO orders
           (id, business_id, branch_id, customer_id, order_number, status, payment_status, payment_method,
            channel, subtotal, discount, delivery_fee, total, coupon_id, customer_note, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'new', 'pending', ?, 'web', ?, 0, 0, ?, NULL, ?, ?, ?)`,
        [
          orderId,
          business.id,
          branch?.id ?? null,
          customerId,
          orderNumber,
          paymentMethod,
          subtotal,
          total,
          note,
          now,
          now,
        ],
      );
    } catch (error) {
      // A simultaneous submit won the race: show that order instead of failing.
      const raced = await db.first<{ id: string }>(
        "SELECT id FROM orders WHERE id = ? AND business_id = ?",
        [orderId, business.id],
      );
      if (raced) {
        store.delete(cartCookieName(business.id));
        redirect(`/b/${business.slug}/order/${raced.id}`);
      }
      throw error;
    }

    for (const line of cart.lines) {
      await db.run(
        `INSERT INTO order_items
           (id, business_id, order_id, product_id, name_snapshot, quantity, unit_price, options, line_total, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '')`,
        [
          crypto.randomUUID(),
          business.id,
          orderId,
          line.productId,
          line.name,
          line.quantity,
          line.unitPrice,
          JSON.stringify(line.options),
          line.lineTotal,
        ],
      );
    }

    await logAudit({
      businessId: business.id,
      actorUserId: null,
      action: "order.created",
      entity: "order",
      entityId: orderId,
      payload: { orderNumber, total, items: cart.lines.length, channel: "web" },
    });

    if (cart.cartId) {
      await db.run(
        "UPDATE carts SET status = 'converted', updated_at = ? WHERE id = ? AND business_id = ?",
        [now, cart.cartId, business.id],
      );
    }

    store.delete(cartCookieName(business.id));
  } catch (error) {
    // Whatever stopped the order, the customer is not charged stock for it. A
    // redirect throws too, and releasing first is still correct there: the only
    // redirect in the block above shows an order that already exists.
    await releaseStock(db, business.id, reservation.reserved);
    throw error;
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/orders");
  revalidatePath("/dashboard/kitchen");
  revalidatePath(`/b/${business.slug}`);

  redirect(`/b/${business.slug}/order/${orderId}`);
}

/* ------------------------------------------------------------------ */
/* Owner side                                                          */
/* ------------------------------------------------------------------ */

export async function updateOrderStatusAction(formData: FormData): Promise<void> {
  const { user, business } = await requireBusiness();
  const db = await getDb();

  const orderId = text(formData, "id", 64);
  const nextStatus = text(formData, "status", 30);

  const order = await db.first<{ id: string; order_number: string; status: string }>(
    "SELECT id, order_number, status FROM orders WHERE id = ? AND business_id = ?",
    [orderId, business.id],
  );
  if (!order) redirect("/dashboard/orders?error=missing");

  const allowed = allowedTransitions(order.status);
  if (!allowed.includes(nextStatus as (typeof allowed)[number])) {
    redirect(`/dashboard/orders/${order.id}?error=transition`);
  }

  const now = new Date().toISOString();
  // Payment status is never inferred from a delivery status: marking an order
  // paid is a money decision and belongs to explicit reconciliation (Phase 7).
  await db.run("UPDATE orders SET status = ?, updated_at = ? WHERE id = ? AND business_id = ?", [
    nextStatus,
    now,
    order.id,
    business.id,
  ]);

  await logAudit({
    businessId: business.id,
    actorUserId: user.id,
    action: "order.status_changed",
    entity: "order",
    entityId: order.id,
    payload: { orderNumber: order.order_number, from: order.status, to: nextStatus },
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/orders");
  revalidatePath(`/dashboard/orders/${order.id}`);
  revalidatePath(`/b/${business.slug}/order/${order.id}`);
  redirect(`/dashboard/orders/${order.id}?updated=1`);
}

/**
 * The kitchen board's one-tap advance. Same rules as the order page, but it
 * returns to the board instead of the order detail page, and it only updates a
 * row that is still in the status the ticket was rendered with — a double tap
 * or a second tablet pressing the same button cannot move an order two steps.
 */
export async function kitchenAdvanceAction(formData: FormData): Promise<void> {
  const { user, business } = await requireBusiness();
  const db = await getDb();

  const orderId = text(formData, "id", 64);
  const nextStatus = text(formData, "status", 30);

  const order = await db.first<{ id: string; order_number: string; status: string }>(
    "SELECT id, order_number, status FROM orders WHERE id = ? AND business_id = ?",
    [orderId, business.id],
  );
  if (!order) redirect("/dashboard/kitchen?error=missing");

  const allowed = allowedTransitions(order.status);
  if (!allowed.includes(nextStatus as (typeof allowed)[number])) {
    redirect("/dashboard/kitchen?error=transition");
  }

  const now = new Date().toISOString();
  await db.run(
    `UPDATE orders SET status = ?, updated_at = ?
      WHERE id = ? AND business_id = ? AND status = ?`,
    [nextStatus, now, order.id, business.id, order.status],
  );

  // Re-read so a lost race (another phone advanced it first) is not reported as
  // this tablet's change.
  const after = await db.first<{ status: string }>(
    "SELECT status FROM orders WHERE id = ? AND business_id = ?",
    [order.id, business.id],
  );
  if (after?.status !== nextStatus) redirect("/dashboard/kitchen?error=stale");

  await logAudit({
    businessId: business.id,
    actorUserId: user.id,
    action: "order.status_changed",
    entity: "order",
    entityId: order.id,
    payload: { orderNumber: order.order_number, from: order.status, to: nextStatus, screen: "kitchen" },
  });

  revalidatePath("/dashboard/kitchen");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/orders");
  revalidatePath(`/dashboard/orders/${order.id}`);
  revalidatePath(`/b/${business.slug}/order/${order.id}`);
  redirect("/dashboard/kitchen");
}
