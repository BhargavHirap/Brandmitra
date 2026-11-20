import { cookies } from "next/headers";
import { getDb } from "@/lib/db";

/**
 * CART LAYER (public, no login).
 *
 * A visitor's cart is identified by a cookie holding the cart's database id.
 * The cookie name includes the business id, so a customer can hold one open cart
 * per business without the shops mixing items.
 *
 * Money rule: `loadCart` recomputes every price from the current product and
 * option rows. The cart therefore can never carry a stale or tampered price —
 * the price the customer sees is the price the database holds right now.
 */

export function cartCookieName(businessId: string): string {
  return `bm_cart_${businessId}`;
}

export type CartOption = { id: string; name: string; price: number };

export type CartLine = {
  itemId: string;
  productId: string;
  name: string;
  quantity: number;
  basePrice: number;
  options: CartOption[];
  unitPrice: number;
  lineTotal: number;
  available: boolean;
  reason: string;
};

export type CartView = {
  cartId: string | null;
  lines: CartLine[];
  subtotal: number;
  itemCount: number;
  invalidCount: number;
  hasUnavailable: boolean;
};

const EMPTY_CART: CartView = {
  cartId: null,
  lines: [],
  subtotal: 0,
  itemCount: 0,
  invalidCount: 0,
  hasUnavailable: false,
};

type StoredOption = { id?: unknown; name?: unknown; price?: unknown };

function parseOptions(raw: string): { id: string; name: string; price: number }[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry) => entry as StoredOption)
      .filter((entry) => typeof entry.id === "string")
      .map((entry) => ({
        id: entry.id as string,
        name: typeof entry.name === "string" ? entry.name : "Option",
        price: typeof entry.price === "number" ? entry.price : 0,
      }));
  } catch {
    return [];
  }
}

export async function getCartId(businessId: string): Promise<string | null> {
  const store = await cookies();
  return store.get(cartCookieName(businessId))?.value ?? null;
}

export async function loadCart(businessId: string): Promise<CartView> {
  const cartId = await getCartId(businessId);
  if (!cartId) return EMPTY_CART;

  const db = await getDb();
  const cart = await db.first<{ id: string }>(
    "SELECT id FROM carts WHERE id = ? AND business_id = ? AND status = 'open'",
    [cartId, businessId],
  );
  if (!cart) return EMPTY_CART;

  const items = await db.all<{
    item_id: string;
    product_id: string;
    quantity: number;
    options: string;
    name: string | null;
    price: number | null;
    is_active: number | null;
    is_available: number | null;
  }>(
    `SELECT ci.id AS item_id, ci.product_id, ci.quantity, ci.options,
            p.name, p.price, p.is_active, p.is_available
       FROM cart_items ci
       LEFT JOIN products p ON p.id = ci.product_id
      WHERE ci.cart_id = ? AND ci.business_id = ?
      ORDER BY ci.rowid ASC`,
    [cart.id, businessId],
  );

  if (items.length === 0) return { ...EMPTY_CART, cartId: cart.id };

  const liveOptions = await db.all<{
    id: string;
    name: string;
    price_delta: number;
    is_available: number;
  }>(
    "SELECT id, name, price_delta, is_available FROM customization_options WHERE business_id = ?",
    [businessId],
  );
  const optionMap = new Map(liveOptions.map((option) => [option.id, option]));

  const lines: CartLine[] = items.map((item) => {
    const stored = parseOptions(item.options);
    const quantity = Math.min(Math.max(Number(item.quantity) || 1, 1), 20);

    if (item.name === null || item.price === null) {
      return {
        itemId: item.item_id,
        productId: item.product_id,
        name: "Removed product",
        quantity,
        basePrice: 0,
        options: [],
        unitPrice: 0,
        lineTotal: 0,
        available: false,
        reason: "This product is no longer in the catalogue.",
      };
    }

    if (item.is_active !== 1 || item.is_available !== 1) {
      return {
        itemId: item.item_id,
        productId: item.product_id,
        name: item.name,
        quantity,
        basePrice: Number(item.price),
        options: stored,
        unitPrice: Number(item.price),
        lineTotal: Number(item.price) * quantity,
        available: false,
        reason: "This product is hidden or out of stock right now.",
      };
    }

    const options: CartOption[] = [];
    let blocked = "";
    for (const chosen of stored) {
      const live = optionMap.get(chosen.id);
      if (!live) {
        blocked = `The option “${chosen.name}” is no longer offered.`;
        continue;
      }
      if (live.is_available !== 1) {
        blocked = `The option “${live.name}” is unavailable right now.`;
        continue;
      }
      options.push({ id: live.id, name: live.name, price: Number(live.price_delta) });
    }

    const basePrice = Number(item.price);
    const unitPrice = basePrice + options.reduce((sum, option) => sum + option.price, 0);

    return {
      itemId: item.item_id,
      productId: item.product_id,
      name: item.name,
      quantity,
      basePrice,
      options,
      unitPrice,
      lineTotal: unitPrice * quantity,
      available: !blocked,
      reason: blocked,
    };
  });

  const available = lines.filter((line) => line.available);

  return {
    cartId: cart.id,
    lines,
    subtotal: available.reduce((sum, line) => sum + line.lineTotal, 0),
    itemCount: available.reduce((sum, line) => sum + line.quantity, 0),
    invalidCount: lines.length - available.length,
    hasUnavailable: lines.some((line) => !line.available),
  };
}
