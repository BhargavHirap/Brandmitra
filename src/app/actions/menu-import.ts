"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  AI_ERROR_MESSAGES,
  getAiUsage,
  isAiConfigured,
  MENU_MAX_ITEMS,
  readMenuFromImage,
  type MenuItem,
} from "@/lib/ai";
import { logAudit, requireBusiness, slugify } from "@/lib/business";
import { getDb, type Db } from "@/lib/db";
import { AI_RATE_LIMITS, checkRateLimit, rateLimitMessage } from "@/lib/rate-limit";

/**
 * MENU PHOTO IMPORT.
 *
 * Two separate steps, on purpose:
 *
 *   1. `scanMenuAction` sends one photo to Gemini and returns a draft list. It
 *      writes nothing except a single `ai.generated` audit row (one credit).
 *   2. `importMenuAction` takes the rows the owner *kept and edited* and inserts
 *      them. Every value is re-validated here, because the browser is not a
 *      source of truth: prices, lengths, category ownership and the plan's
 *      product limit are all checked again.
 *
 * The business id always comes from requireBusiness(), never from the form.
 */

type Credits = { used: number; limit: number; planName: string; monthLabel: string };

export type MenuScanState = {
  status: "idle" | "ok" | "error";
  message: string;
  items: MenuItem[];
  credits: Credits;
};

const MAX_PRICE = 10_000_000;
/** ~2.8 MB of image data. The browser shrinks photos before sending them. */
const MAX_IMAGE_BASE64 = 3_800_000;

function clampPrice(value: unknown): number {
  const n =
    typeof value === "number"
      ? value
      : Number.parseFloat(String(value ?? "").replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(Math.round(n), MAX_PRICE);
}

function clean(value: unknown, max: number): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function fail(credits: Credits, message: string): MenuScanState {
  return { status: "error", message, items: [], credits };
}

/** Step 1 — read the photo. Nothing is saved to the catalogue here. */
export async function scanMenuAction(
  _previous: MenuScanState,
  formData: FormData,
): Promise<MenuScanState> {
  const { user, business, planId } = await requireBusiness();
  const db = await getDb();
  const credits = await getAiUsage(db, business.id, planId);

  const image = String(formData.get("image") ?? "").trim();
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(image);
  if (!match) {
    return fail(credits, "Choose a photo of your menu first. JPG, PNG and WebP work.");
  }

  const [, mimeType, base64] = match;
  if (base64.length > MAX_IMAGE_BASE64) {
    return fail(
      credits,
      "That photo is still too large. Take it again from a little further away, or use a screenshot.",
    );
  }

  if (!isAiConfigured()) return fail(credits, AI_ERROR_MESSAGES.not_configured);

  if (credits.limit <= 0) {
    return fail(credits, `Reading a menu is not included in the ${credits.planName} plan.`);
  }
  if (credits.used >= credits.limit) {
    return fail(
      credits,
      `You have used all ${credits.limit} AI credits for ${credits.monthLabel} on the ${credits.planName} plan. They reset on the 1st.`,
    );
  }

  // A photo is the largest request this app sends to the model, so it has the
  // tightest burst fence of the AI actions.
  const burst = await checkRateLimit(AI_RATE_LIMITS.menuScan, user.id, db);
  if (!burst.allowed) {
    return fail(credits, rateLimitMessage(burst, AI_RATE_LIMITS.menuScan.label));
  }

  const result = await readMenuFromImage({ mimeType, base64 });
  if (!result.ok) return fail(credits, AI_ERROR_MESSAGES[result.error]);

  await logAudit({
    businessId: business.id,
    actorUserId: null,
    actorType: "ai",
    action: "ai.generated",
    entity: "menu",
    // No image and no OCR text stored: an audit trail, not a transcript.
    payload: {
      kind: "menu_scan",
      items: result.items.length,
      model: process.env.GEMINI_MODEL?.trim() || "gemini-3.8-flash",
    },
  });

  return {
    status: "ok",
    message: `Found ${result.items.length} item${result.items.length === 1 ? "" : "s"}. Fix anything that looks wrong, then import the ones you want.`,
    items: result.items,
    credits: { ...credits, used: credits.used + 1 },
  };
}

/* ------------------------------------------------------------------ */
/* Step 2 — import the rows the owner kept                             */
/* ------------------------------------------------------------------ */

async function uniqueProductSlug(db: Db, businessId: string, base: string): Promise<string> {
  const root = slugify(base) || "item";
  let candidate = root;
  for (let attempt = 2; attempt < 200; attempt += 1) {
    const taken = await db.first<{ id: string }>(
      "SELECT id FROM products WHERE business_id = ? AND slug = ?",
      [businessId, candidate],
    );
    if (!taken) return candidate;
    candidate = `${root}-${attempt}`;
  }
  return `${root}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Finds the category by name or creates it once, so ten items in one section share a row. */
async function categoryFor(
  db: Db,
  businessId: string,
  rawName: string,
  cache: Map<string, string>,
): Promise<string | null> {
  const name = clean(rawName, 40);
  if (name.length < 2) return null;

  const key = name.toLowerCase();
  const cached = cache.get(key);
  if (cached) return cached;

  const existing = await db.first<{ id: string }>(
    "SELECT id FROM product_categories WHERE business_id = ? AND lower(name) = lower(?)",
    [businessId, name],
  );
  if (existing) {
    cache.set(key, existing.id);
    return existing.id;
  }

  const root = slugify(name) || "category";
  let slug = root;
  for (let attempt = 2; attempt < 200; attempt += 1) {
    const taken = await db.first<{ id: string }>(
      "SELECT id FROM product_categories WHERE business_id = ? AND slug = ?",
      [businessId, slug],
    );
    if (!taken) break;
    slug = `${root}-${attempt}`;
  }

  const sortRow = await db.first<{ m: number | null }>(
    "SELECT MAX(sort_order) AS m FROM product_categories WHERE business_id = ?",
    [businessId],
  );

  const id = crypto.randomUUID();
  await db.run(
    `INSERT INTO product_categories (id, business_id, name, slug, sort_order, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, businessId, name, slug, Number(sortRow?.m ?? 0) + 1, new Date().toISOString()],
  );

  cache.set(key, id);
  return id;
}

export async function importMenuAction(formData: FormData): Promise<void> {
  const { user, business, planId } = await requireBusiness();
  const db = await getDb();

  const raw = String(formData.get("rows") ?? "");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    redirect("/dashboard/products/import?error=rows");
  }
  if (!Array.isArray(parsed)) redirect("/dashboard/products/import?error=rows");

  const rows = parsed
    .slice(0, MENU_MAX_ITEMS)
    .map((row) => {
      const record = (row ?? {}) as Record<string, unknown>;
      return {
        name: clean(record.name, 90),
        price: clampPrice(record.price),
        category: clean(record.category, 40),
      };
    })
    .filter((row) => row.name.length >= 2 && row.price > 0);

  if (rows.length === 0) redirect("/dashboard/products/import?error=empty");

  const [plan, countRow] = await Promise.all([
    db.first<{ product_limit: number }>("SELECT product_limit FROM plans WHERE id = ?", [planId]),
    db.first<{ n: number }>("SELECT COUNT(*) AS n FROM products WHERE business_id = ?", [
      business.id,
    ]),
  ]);

  const limit = Number(plan?.product_limit ?? 10);
  const remaining = Math.max(0, limit - Number(countRow?.n ?? 0));
  if (remaining === 0) redirect("/dashboard/products/import?error=limit");

  const toImport = rows.slice(0, remaining);
  const skipped = rows.length - toImport.length;

  const sortRow = await db.first<{ m: number | null }>(
    "SELECT MAX(sort_order) AS m FROM products WHERE business_id = ?",
    [business.id],
  );
  let order = Number(sortRow?.m ?? 0);

  const categoryCache = new Map<string, string>();
  const now = new Date().toISOString();

  for (const row of toImport) {
    const categoryId = row.category ? await categoryFor(db, business.id, row.category, categoryCache) : null;
    order += 1;
    await db.run(
      `INSERT INTO products
         (id, business_id, category_id, name, slug, description, price, compare_at_price,
          image_url, is_active, is_available, sort_order, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        crypto.randomUUID(),
        business.id,
        categoryId,
        row.name,
        await uniqueProductSlug(db, business.id, row.name),
        "",
        row.price,
        null,
        "",
        1,
        1,
        order,
        now,
      ],
    );
  }

  await logAudit({
    businessId: business.id,
    actorUserId: user.id,
    action: "product.created",
    entity: "menu",
    payload: {
      source: "menu_import",
      count: toImport.length,
      names: toImport.slice(0, 10).map((row) => row.name),
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/products");
  revalidatePath("/dashboard/categories");
  revalidatePath(`/b/${business.slug}`);

  redirect(
    `/dashboard/products?imported=${toImport.length}${skipped > 0 ? `&skipped=${skipped}` : ""}`,
  );
}
