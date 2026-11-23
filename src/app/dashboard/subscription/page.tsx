import Link from "next/link";
import { switchPlanAction } from "@/app/actions/business";
import { PageHeader, Panel } from "@/components/ui";
import { getAiUsage } from "@/lib/ai";
import { productLimitLabel, requireBusiness, staffLimitLabel } from "@/lib/business";
import { getDb } from "@/lib/db";
import { formatMoney } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Subscription" };

/**
 * SUBSCRIPTION.
 *
 * The plan, the limits and real usage against them. Plan changes cannot be
 * bought: no payment provider is connected, so the buttons are disabled and say
 * why. Founders are the exception — they can switch the business to any plan for
 * demos, and the switch is a real row update rather than a badge.
 */

type PlanRow = {
  id: string;
  name: string;
  price_inr: number;
  product_limit: number;
  staff_limit: number;
  ai_credits: number;
  features: string;
  sort_order: number;
};

function parseFeatures(raw: string): string[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    return [];
  }
}

function Bar({
  used,
  limit,
  label,
  limitLabel,
}: {
  used: number;
  limit: number;
  label: string;
  limitLabel?: string;
}) {
  const percent = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 100;
  const full = limit > 0 && used >= limit;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11.5px] font-medium">{label}</span>
        <span className={`text-[11px] ${full ? "text-danger" : "text-muted"}`}>
          {used} of {limitLabel ?? limit}
        </span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-canvas">
        <div
          className={`h-full rounded-full ${full ? "bg-danger" : "bg-brand"}`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

export default async function SubscriptionPage() {
  const { business, planId, user } = await requireBusiness();
  const isFounder = user.isPlatformAdmin;
  const db = await getDb();

  const [subscription, plans, productRow, staffRow, credits] = await Promise.all([
    db.first<{ plan_id: string; status: string; current_period_end: string | null; created_at: string }>(
      "SELECT plan_id, status, current_period_end, created_at FROM subscriptions WHERE business_id = ?",
      [business.id],
    ),
    db.all<PlanRow>(
      `SELECT id, name, price_inr, product_limit, staff_limit, ai_credits, features, sort_order
         FROM plans WHERE is_active = 1 ORDER BY sort_order ASC`,
      [],
    ),
    db.first<{ n: number }>("SELECT COUNT(*) AS n FROM products WHERE business_id = ?", [
      business.id,
    ]),
    db.first<{ n: number }>("SELECT COUNT(*) AS n FROM business_members WHERE business_id = ?", [
      business.id,
    ]),
    getAiUsage(db, business.id, planId),
  ]);

  const current = plans.find((plan) => plan.id === planId);
  const status = subscription?.status ?? "active";
  const products = Number(productRow?.n ?? 0);
  const staff = Number(staffRow?.n ?? 0);

  return (
    <div className="space-y-4 sm:space-y-5">
      <PageHeader
        eyebrow="Business"
        title="Subscription"
        description={
          isFounder
            ? "What your plan allows and what you are using right now. As a founder you can switch to any plan instantly while showing the product."
            : "What your plan allows, and what you are using right now. Changing plans needs a payment provider, which is not connected yet."
        }
        actions={
          <Link href="/dashboard/settings" className="btn btn-ghost text-[12.5px]">
            Settings
          </Link>
        }
      />

      <div className="card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-muted">
              Current plan
            </p>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-[20px] font-semibold tracking-[-0.02em]">
              {current?.name ?? planId}
              {isFounder && (
                <span className="rounded-full border border-brand/25 bg-brand-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-brand">
                  Founder access
                </span>
              )}
            </p>
            <p className="mt-1 text-[12px] text-muted">
              {isFounder
                ? "Founder access — every screen of this business, every plan's features, nothing to pay"
                : current && current.price_inr > 0
                  ? `${formatMoney(current.price_inr)} per month`
                  : "Free — no card, no expiry"}
              {" · "}
              <span className="capitalize">{status}</span>
            </p>
          </div>
          <span className="rounded-full border border-line bg-white px-2.5 py-1 text-[10.5px] text-muted">
            {credits.monthLabel}
          </span>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Bar
            used={products}
            limit={Number(current?.product_limit ?? 10)}
            label="Products"
            limitLabel={productLimitLabel(Number(current?.product_limit ?? 10))}
          />
          <Bar
            used={staff}
            limit={Number(current?.staff_limit ?? 1)}
            label="Team seats"
            limitLabel={staffLimitLabel(Number(current?.staff_limit ?? 1))}
          />
          <Bar used={credits.used} limit={credits.limit} label="AI credits this month" />
        </div>
      </div>

      <Panel
        title="Plans"
        description={
          isFounder
            ? "Prices in rupees per month. Founders can switch into any plan; everyone else sees the buttons disabled until payments exist."
            : "Prices in rupees per month. Buttons stay disabled until payments exist."
        }
        padded={false}
      >
        <ul className="divide-y divide-line sm:grid sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-3">
          {plans.map((plan) => {
            const isCurrent = plan.id === planId;
            return (
              <li key={plan.id} className="border-b border-line p-4 last:border-b-0 sm:border-r">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-[13.5px] font-semibold">{plan.name}</p>
                  {isCurrent && (
                    <span className="rounded-full border border-brand/25 bg-brand-soft px-2 py-0.5 text-[10px] font-medium text-brand">
                      Current
                    </span>
                  )}
                </div>
                <p className="mt-1 text-[18px] font-semibold tabular-nums">
                  {plan.price_inr === 0 ? "Free" : formatMoney(plan.price_inr)}
                  {plan.price_inr > 0 && (
                    <span className="ml-1 text-[11px] font-normal text-muted">/month</span>
                  )}
                </p>
                <ul className="mt-3 space-y-1.5 text-[11.5px] leading-relaxed text-muted">
                  <li>{productLimitLabel(plan.product_limit)} products</li>
                  <li>{staffLimitLabel(plan.staff_limit)} team seats</li>
                  <li>{plan.ai_credits} AI credits a month</li>
                  {parseFeatures(plan.features).map((feature) => (
                    <li key={feature}>{feature}</li>
                  ))}
                </ul>
                {isFounder ? (
                  <form action={switchPlanAction} className="mt-3">
                    <input type="hidden" name="planId" value={plan.id} />
                    <button
                      type="submit"
                      disabled={isCurrent}
                      className={`w-full rounded-[10px] px-3 py-2 text-[12px] font-semibold transition-colors ${
                        isCurrent
                          ? "cursor-default border border-line bg-white text-muted"
                          : "bg-brand text-white hover:bg-brand-600"
                      }`}
                    >
                      {isCurrent ? "Your current plan" : `Switch to ${plan.name}`}
                    </button>
                  </form>
                ) : (
                  <button
                    type="button"
                    disabled
                    className="btn btn-ghost mt-3 w-full cursor-not-allowed text-[12px] opacity-60"
                    title="No payment provider is connected on this deployment"
                  >
                    {isCurrent ? "Your current plan" : "Payments not connected"}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title={isFounder ? "How founder switching works" : "Why the buttons are disabled"}>
          <p className="text-[12px] leading-relaxed text-muted">
            Charging a card needs a payment provider with a business account and a verified webhook.
            None is configured here, so no plan can be bought and no card details are ever collected.
            The limits above are still enforced on the server, so the plan you are on behaves exactly
            as described.
          </p>
          {isFounder && (
            <p className="mt-2 text-[12px] leading-relaxed text-muted">
              Switching here changes this business&apos;s real plan row, so the AI credit allowance and the
              feature lists move with it. No money changes hands and no card is stored. Only founder
              accounts see these buttons.
            </p>
          )}
          <p className="mt-2 text-[12px] leading-relaxed text-muted">
            Until then, the Free plan is fully usable: unlimited products, unlimited team seats and 20
            AI credits a month. No plan caps the size of a team.
          </p>
          {isFounder && (
            <p className="mt-2 text-[12px] leading-relaxed text-muted">
              You are signed in as a founder, so this business has every feature switched on. That flag
              is set in the database by <code>npm run grant:founders</code> — there is no button for it,
              and it adds nothing outside the business you already belong to.
            </p>
          )}
        </Panel>

        <Panel title="What counts against a limit">
          <ul className="space-y-2 text-[11.5px] leading-relaxed text-muted">
            <li>
              <span className="font-semibold text-ink">Products</span> — every row in your catalogue,
              visible or hidden. Deleting one frees a slot.
            </li>
            <li>
              <span className="font-semibold text-ink">Team seats</span> — members, including the
              owner. No plan limits them; the counter is there so you can see who is in.
            </li>
            <li>
              <span className="font-semibold text-ink">AI credits</span> — one per successful draft or
              menu scan, counted from the audit log. They reset on the 1st (UTC).
            </li>
          </ul>
        </Panel>
      </div>
    </div>
  );
}
