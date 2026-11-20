"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  AI_ERROR_MESSAGES,
  generateProductCopy,
  getAiUsage,
  isAiConfigured,
  type AiCopyKind,
} from "@/lib/ai";
import { logAudit, requireBusiness } from "@/lib/business";
import { getDb } from "@/lib/db";

/**
 * AI COPY ACTIONS.
 *
 * The owner triggers every call; nothing runs in the background. Three rules:
 *
 *   1. **The model never sees a price.** The query below selects a product name,
 *      a description, a category name and option names — no price columns at all.
 *   2. **The model never writes to the database.** Generation returns text to the
 *      browser; saving is a separate, explicit button press.
 *   3. **Every successful call is metered** by writing one `ai.generated` audit
 *      row, counted against `plans.ai_credits` per calendar month.
 *
 * The business id always comes from requireBusiness(), never from the form.
 */

type Credits = { used: number; limit: number; planName: string; monthLabel: string };

export type AiCopyState = {
  status: "idle" | "ok" | "error";
  kind: AiCopyKind;
  text: string;
  message: string;
  removedPriceClaims: boolean;
  credits: Credits;
};

function text(formData: FormData, key: string, max = 600): string {
  return String(formData.get(key) ?? "")
    .trim()
    .slice(0, max);
}

function fail(kind: AiCopyKind, credits: Credits, message: string): AiCopyState {
  return { status: "error", kind, text: "", message, removedPriceClaims: false, credits };
}

export async function generateProductCopyAction(
  previous: AiCopyState,
  formData: FormData,
): Promise<AiCopyState> {
  const { business, planId } = await requireBusiness();
  const db = await getDb();

  const requestedKind = text(formData, "kind", 20) === "caption" ? "caption" : "description";
  const kind = requestedKind as AiCopyKind;
  const productId = text(formData, "productId", 64);

  const credits = await getAiUsage(db, business.id, planId);

  const product = await db.first<{
    id: string;
    name: string;
    description: string;
    category_name: string | null;
  }>(
    `SELECT p.id, p.name, p.description, c.name AS category_name
       FROM products p
       LEFT JOIN product_categories c ON c.id = p.category_id AND c.business_id = p.business_id
      WHERE p.id = ? AND p.business_id = ?`,
    [productId, business.id],
  );
  if (!product) return fail(kind, credits, "That product does not belong to this business.");

  if (!isAiConfigured()) return fail(kind, credits, AI_ERROR_MESSAGES.not_configured);

  if (credits.limit <= 0) {
    return fail(kind, credits, `AI copy is not included in the ${credits.planName} plan.`);
  }
  if (credits.used >= credits.limit) {
    return fail(
      kind,
      credits,
      `You have used all ${credits.limit} AI credits for ${credits.monthLabel} on the ${credits.planName} plan. They reset on the 1st.`,
    );
  }

  // Option names only — deliberately no price_delta column.
  const options = await db.all<{ group_name: string; option_name: string }>(
    `SELECT g.name AS group_name, o.name AS option_name
       FROM customization_options o
       JOIN customization_groups g ON g.id = o.group_id AND g.business_id = o.business_id
      WHERE o.business_id = ? AND g.product_id = ?
      ORDER BY g.sort_order ASC, o.name ASC`,
    [business.id, product.id],
  );

  const facts = {
    businessName: business.name,
    industry: business.industry,
    productName: product.name,
    categoryName: product.category_name ?? "",
    options: options.map((option) => `${option.group_name}: ${option.option_name}`).slice(0, 20),
    existingDescription: product.description,
  };

  const result = await generateProductCopy(kind, facts);
  if (!result.ok) {
    return fail(kind, credits, AI_ERROR_MESSAGES[result.error]);
  }

  await logAudit({
    businessId: business.id,
    actorUserId: null,
    action: "ai.generated",
    entity: "product",
    entityId: product.id,
    // No prompt text and no customer data: an audit trail, not a transcript.
    payload: { kind, product: product.name, model: process.env.GEMINI_MODEL?.trim() || "gemini-3.8-flash" },
  });

  return {
    status: "ok",
    kind,
    text: result.text,
    message:
      kind === "description"
        ? "Draft ready. Edit it if you like, then save it as the description."
        : "Caption ready. Copy it into Instagram — it is not saved anywhere.",
    removedPriceClaims: result.removedPriceClaims,
    credits: { ...credits, used: credits.used + 1 },
  };
}

/** The explicit "use this" step. Writes the description column only. */
export async function saveProductDescriptionAction(formData: FormData): Promise<void> {
  const { user, business } = await requireBusiness();
  const db = await getDb();

  const productId = text(formData, "id", 64);
  const description = text(formData, "description", 600);

  const product = await db.first<{ id: string; name: string }>(
    "SELECT id, name FROM products WHERE id = ? AND business_id = ?",
    [productId, business.id],
  );
  if (!product) redirect("/dashboard/products?error=missing");
  if (description.length < 10) redirect(`/dashboard/products/${product.id}?error=description`);

  await db.run(
    "UPDATE products SET description = ? WHERE id = ? AND business_id = ?",
    [description, product.id, business.id],
  );

  await logAudit({
    businessId: business.id,
    actorUserId: user.id,
    action: "product.updated",
    entity: "product",
    entityId: product.id,
    payload: { name: product.name, field: "description", source: "ai" },
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/products");
  revalidatePath(`/dashboard/products/${product.id}`);
  revalidatePath(`/b/${business.slug}`);
  redirect(`/dashboard/products/${product.id}?saved=1`);
}
