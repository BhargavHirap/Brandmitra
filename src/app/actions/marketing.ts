"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  AI_ERROR_MESSAGES,
  aiModelName,
  getAiUsage,
  isAiConfigured,
  stripPriceClaims,
} from "@/lib/ai";
import { logAudit, requireBusiness } from "@/lib/business";
import { getDb } from "@/lib/db";
import {
  CAMPAIGN_CHANNELS,
  channelInfo,
  generateCampaign,
  type CampaignChannel,
  type CampaignProduct,
} from "@/lib/marketing";

/**
 * MARKETING ACTIONS.
 *
 * `generateCampaignAction` drafts text and saves nothing — the owner approves
 * separately. `saveCampaignAction` is the only write, and it re-checks the text
 * for price claims before inserting, so a tampered form post cannot store a
 * price either.
 *
 * Drafts are metered like every other AI call: one `ai.generated` audit row.
 * Approving is not an AI call, so it uses no credit; it writes its own
 * `campaign.approved` audit row with the owner as the actor.
 */

type Credits = { used: number; limit: number; planName: string; monthLabel: string };

export type CampaignState = {
  status: "idle" | "ok" | "error";
  channel: CampaignChannel;
  brief: string;
  title: string;
  body: string;
  featured: string[];
  removedPriceClaims: boolean;
  message: string;
  credits: Credits;
};

function text(formData: FormData, key: string, max: number): string {
  return String(formData.get(key) ?? "")
    .trim()
    .slice(0, max);
}

function fail(channel: CampaignChannel, credits: Credits, message: string, brief = ""): CampaignState {
  return {
    status: "error",
    channel,
    brief,
    title: "",
    body: "",
    featured: [],
    removedPriceClaims: false,
    message,
    credits,
  };
}

export async function generateCampaignAction(
  previous: CampaignState,
  formData: FormData,
): Promise<CampaignState> {
  const { business, planId } = await requireBusiness();
  const db = await getDb();
  const credits = await getAiUsage(db, business.id, planId);

  const channel = (CAMPAIGN_CHANNELS.find((item) => item.id === text(formData, "channel", 20))?.id ??
    "instagram") as CampaignChannel;
  const brief = text(formData, "brief", 240);
  const requestedIds = formData.getAll("productIds").map(String).slice(0, 10);

  if (!isAiConfigured()) {
    return fail(channel, credits, AI_ERROR_MESSAGES.not_configured, brief);
  }
  if (credits.limit <= 0) {
    return fail(channel, credits, `AI campaigns are not included in the ${credits.planName} plan.`, brief);
  }
  if (credits.used >= credits.limit) {
    return fail(
      channel,
      credits,
      `You have used all ${credits.limit} AI credits for ${credits.monthLabel} on the ${credits.planName} plan. They reset on the 1st.`,
      brief,
    );
  }

  // Names, categories and option names only — no price column is selected.
  const products = await db.all<{ id: string; name: string; category_name: string | null }>(
    `SELECT p.id, p.name, c.name AS category_name
       FROM products p
       LEFT JOIN product_categories c ON c.id = p.category_id AND c.business_id = p.business_id
      WHERE p.business_id = ? AND p.is_active = 1
      ORDER BY p.sort_order ASC, p.name ASC`,
    [business.id],
  );

  const chosen = products.filter((product) => requestedIds.includes(product.id)).slice(0, 3);
  if (requestedIds.length > 0 && chosen.length === 0) {
    return fail(channel, credits, "Those products do not belong to this business.", brief);
  }

  const optionRows = await db.all<{ product_id: string; name: string }>(
    `SELECT g.product_id AS product_id, o.name AS name
       FROM customization_options o
       JOIN customization_groups g ON g.id = o.group_id AND g.business_id = o.business_id
      WHERE o.business_id = ?
        AND g.product_id IN (SELECT id FROM products WHERE business_id = ? AND is_active = 1)
      ORDER BY o.name ASC`,
    [business.id, business.id],
  );

  const optionsByProduct = new Map<string, string[]>();
  for (const row of optionRows) {
    const list = optionsByProduct.get(row.product_id) ?? [];
    if (list.length < 6) list.push(row.name);
    optionsByProduct.set(row.product_id, list);
  }

  const [profile, facts] = await Promise.all([
    db.first<{ city: string }>("SELECT city FROM business_profiles WHERE business_id = ?", [
      business.id,
    ]),
    Promise.resolve(
      chosen.map<CampaignProduct>((product) => ({
        name: product.name,
        category: product.category_name ?? "",
        options: optionsByProduct.get(product.id) ?? [],
      })),
    ),
  ]);

  const draft = await generateCampaign({
    businessName: business.name,
    industry: business.industry,
    city: profile?.city ?? "",
    channel,
    brief,
    products: facts,
  });

  if (!draft.ok) {
    const message =
      draft.error === "rejected"
        ? "The draft only talked about prices, so it was thrown away. Campaigns never set or quote prices — try again."
        : AI_ERROR_MESSAGES[draft.error];
    return fail(channel, credits, message, brief);
  }

  await logAudit({
    businessId: business.id,
    actorUserId: null,
    action: "ai.generated",
    entity: "campaign",
    entityId: "",
    payload: {
      kind: "campaign",
      channel,
      featured: facts.map((product) => product.name),
      model: aiModelName(),
    },
  });

  return {
    status: "ok",
    channel,
    brief,
    title: draft.title,
    body: draft.body,
    featured: facts.map((product) => product.name),
    removedPriceClaims: draft.removedPriceClaims,
    message: "Draft ready. Read it, edit it if you like, then approve it — nothing is saved yet.",
    credits: { ...credits, used: credits.used + 1 },
  };
}

/** The explicit approval step: the only write in the marketing studio. */
export async function saveCampaignAction(formData: FormData): Promise<void> {
  const { user, business } = await requireBusiness();
  const db = await getDb();

  const channel = channelInfo(text(formData, "channel", 20)).id;
  const title = text(formData, "title", 80);
  const content = text(formData, "content", 800);

  if (title.length < 3) redirect("/dashboard/marketing?error=title");
  if (content.length < 30) redirect("/dashboard/marketing?error=content");

  // Defence in depth: the draft was filtered once, but the posted text is not trusted.
  const priceTitle = stripPriceClaims(title);
  const priceBody = stripPriceClaims(content);
  if (priceTitle.removed || priceBody.removed) redirect("/dashboard/marketing?error=price");

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await db.run(
    `INSERT INTO marketing_campaigns
       (id, business_id, title, channel, content, status, scheduled_at, created_at)
     VALUES (?, ?, ?, ?, ?, 'approved', NULL, ?)`,
    [id, business.id, priceTitle.text, channel, priceBody.text, now],
  );

  await logAudit({
    businessId: business.id,
    actorUserId: user.id,
    action: "campaign.approved",
    entity: "campaign",
    entityId: id,
    payload: { title: priceTitle.text, channel },
  });

  revalidatePath("/dashboard/marketing");
  redirect("/dashboard/marketing?saved=1");
}
