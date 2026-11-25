"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logAudit, requireBusiness } from "@/lib/business";
import { getDb } from "@/lib/db";
import {
  createRazorpayPlan,
  createRazorpaySubscription,
  isRazorpayConfigured,
  razorpayConfig,
} from "@/lib/razorpay";

/**
 * BUYING A PLAN.
 *
 * A business owner taps "Pay ₹499 / month", we ask Razorpay for a subscription,
 * remember which business and which plan it belongs to, and send them to
 * Razorpay's own secure page. Nothing is charged here and no card detail ever
 * reaches this app.
 *
 * The plan is *not* changed on this click. It changes when Razorpay's webhook
 * says the subscription is actually active (see src/app/api/razorpay/webhook).
 * That way a cancelled checkout buys nothing, and refreshing the browser cannot
 * unlock a paid plan.
 */

function back(reason: string): never {
  redirect(`/dashboard/subscription?billing=${reason}`);
}

export async function startSubscriptionAction(formData: FormData): Promise<void> {
  const { user, business, role } = await requireBusiness();

  // Founders switch instantly and never pay.
  if (user.isPlatformAdmin) redirect("/dashboard/subscription");
  if (role !== "owner" && role !== "manager") back("role");

  const target = String(formData.get("planId") ?? "").trim().slice(0, 40);
  if (!target) back("unavailable");

  if (!isRazorpayConfigured()) back("unconfigured");

  const db = await getDb();
  const plan = await db.first<{ id: string; name: string; price_inr: number }>(
    "SELECT id, name, price_inr FROM plans WHERE id = ? AND is_active = 1",
    [target],
  );

  // Free plans are not bought, and a plan with no price cannot be billed.
  if (!plan || plan.price_inr <= 0) back("unavailable");

  const config = razorpayConfig();

  try {
    // One Razorpay plan per Vantra plan, created on first purchase and reused.
    const cached = await db.first<{ razorpay_plan_id: string }>(
      "SELECT razorpay_plan_id FROM razorpay_plans WHERE plan_id = ?",
      [plan.id],
    );

    let razorpayPlanId = cached?.razorpay_plan_id ?? "";

    if (!razorpayPlanId) {
      razorpayPlanId = await createRazorpayPlan(config, {
        planId: plan.id,
        name: plan.name,
        amountInPaise: plan.price_inr * 100,
      });
      await db.run(
        "INSERT OR REPLACE INTO razorpay_plans (plan_id, razorpay_plan_id, created_at) VALUES (?, ?, ?)",
        [plan.id, razorpayPlanId, new Date().toISOString()],
      );
    }

    const subscription = await createRazorpaySubscription(config, {
      razorpayPlanId,
      businessId: business.id,
      planId: plan.id,
    });

    await db.run(
      "INSERT INTO razorpay_checkouts (id, business_id, plan_id, status, created_at) VALUES (?, ?, ?, 'created', ?)",
      [subscription.id, business.id, plan.id, new Date().toISOString()],
    );

    await logAudit({
      businessId: business.id,
      actorUserId: user.id,
      action: "subscription.checkout_started",
      entity: "subscription",
      entityId: subscription.id,
      payload: { plan: plan.id, amount: plan.price_inr },
    });

    revalidatePath("/dashboard/subscription");
    redirect(subscription.short_url);
  } catch (error) {
    // A redirect thrown above must not be swallowed as a payment failure.
    if (error instanceof Error && error.message.includes("NEXT_REDIRECT")) throw error;

    await logAudit({
      businessId: business.id,
      actorUserId: user.id,
      action: "subscription.checkout_failed",
      entity: "subscription",
      entityId: plan.id,
      payload: { message: error instanceof Error ? error.message : "unknown" },
    });
    back("error");
  }
}
