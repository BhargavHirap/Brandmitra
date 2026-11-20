import Link from "next/link";
import { EmptyState, PageHeader, Panel, Stat } from "@/components/ui";
import { requireBusiness } from "@/lib/business";
import { getDb } from "@/lib/db";
import { formatDateTime, formatMoney } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Overview" };

/**
 * Phase 1 overview.
 *
 * Every number on this page comes from the database for THIS business only
 * (business.id comes from the logged-in user's membership row). There is no
 * placeholder analytics: a brand-new business correctly shows zeros.
 */

type Totals = { orders: number; revenue: number };

const DAY_MS = 24 * 60 * 60 * 1000;

function utcDayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

const AUDIT_LABELS: Record<string, string> = {
  "business.created": "Business created",
  "storefront.updated": "Storefront details updated",
  "product.created": "Product added",
  "product.updated": "Product updated",
  "product.deleted": "Product deleted",
  "product.options.updated": "Customisation options updated",
  "category.created": "Category added",
  "category.updated": "Category renamed",
  "category.deleted": "Category deleted",
  "order.created": "New order received",
  "order.status_changed": "Order status updated",
  "ai.generated": "AI content generated",
  "ai.refused": "AI refused a request",
  "campaign.approved": "Marketing campaign approved",
};

export default async function DashboardOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string }>;
}) {
  const { business, planId, role } = await requireBusiness();
  const { welcome } = await searchParams;
  const db = await getDb();

  const now = new Date();
  const startOfToday = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const chartStart = new Date(startOfToday.getTime() - 6 * DAY_MS);

  const [lifetime, today, month, pending, completed, productCount, customerCount] =
    await Promise.all([
      db.first<Totals>(
        `SELECT COUNT(*) AS orders, COALESCE(SUM(total), 0) AS revenue
           FROM orders WHERE business_id = ? AND status NOT IN ('rejected', 'cancelled')`,
        [business.id],
      ),
      db.first<Totals>(
        `SELECT COUNT(*) AS orders, COALESCE(SUM(total), 0) AS revenue
           FROM orders WHERE business_id = ? AND created_at >= ?
             AND status NOT IN ('rejected', 'cancelled')`,
        [business.id, startOfToday.toISOString()],
      ),
      db.first<Totals>(
        `SELECT COUNT(*) AS orders, COALESCE(SUM(total), 0) AS revenue
           FROM orders WHERE business_id = ? AND created_at >= ?
             AND status NOT IN ('rejected', 'cancelled')`,
        [business.id, startOfMonth.toISOString()],
      ),
      db.first<{ n: number }>(
        `SELECT COUNT(*) AS n FROM orders
          WHERE business_id = ?
            AND status IN ('new', 'accepted', 'preparing', 'ready', 'out_for_delivery')`,
        [business.id],
      ),
      db.first<{ n: number }>(
        `SELECT COUNT(*) AS n FROM orders WHERE business_id = ? AND status = 'delivered'`,
        [business.id],
      ),
      db.first<{ n: number }>(
        "SELECT COUNT(*) AS n FROM products WHERE business_id = ? AND is_active = 1",
        [business.id],
      ),
      db.first<{ n: number }>("SELECT COUNT(*) AS n FROM customers WHERE business_id = ?", [
        business.id,
      ]),
    ]);

  const [plan, profile, recentAudit, dailyRows, topProducts] = await Promise.all([
    db.first<{ name: string; product_limit: number; ai_credits: number }>(
      "SELECT name, product_limit, ai_credits FROM plans WHERE id = ?",
      [planId],
    ),
    db.first<{ description: string; tagline: string; phone: string; template: string }>(
      "SELECT description, tagline, phone, template FROM business_profiles WHERE business_id = ?",
      [business.id],
    ),
    db.all<{ action: string; entity: string; actor_type: string; created_at: string }>(
      `SELECT action, entity, actor_type, created_at FROM audit_logs
        WHERE business_id = ? ORDER BY created_at DESC LIMIT 6`,
      [business.id],
    ),
    db.all<{ day: string; orders: number; revenue: number }>(
      `SELECT substr(created_at, 1, 10) AS day, COUNT(*) AS orders, COALESCE(SUM(total), 0) AS revenue
         FROM orders
        WHERE business_id = ? AND created_at >= ? AND status NOT IN ('rejected', 'cancelled')
        GROUP BY day`,
      [business.id, chartStart.toISOString()],
    ),
    db.all<{ name: string; qty: number; revenue: number }>(
      `SELECT name_snapshot AS name, SUM(quantity) AS qty, SUM(line_total) AS revenue
         FROM order_items WHERE business_id = ?
        GROUP BY name_snapshot ORDER BY qty DESC LIMIT 5`,
      [business.id],
    ),
  ]);

  const totals: Totals = {
    orders: Number(lifetime?.orders ?? 0),
    revenue: Number(lifetime?.revenue ?? 0),
  };
  const todayTotals: Totals = {
    orders: Number(today?.orders ?? 0),
    revenue: Number(today?.revenue ?? 0),
  };
  const monthTotals: Totals = {
    orders: Number(month?.orders ?? 0),
    revenue: Number(month?.revenue ?? 0),
  };

  const products = Number(productCount?.n ?? 0);
  const productLimit = Number(plan?.product_limit ?? 10);
  const customers = Number(customerCount?.n ?? 0);
  const pendingOrders = Number(pending?.n ?? 0);
  const completedOrders = Number(completed?.n ?? 0);

  // Build a complete 7-day series so empty days still render as bars.
  const byDay = new Map(dailyRows.map((row) => [row.day, row]));
  const series = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(chartStart.getTime() + index * DAY_MS);
    const key = utcDayKey(date);
    const row = byDay.get(key);
    return {
      key,
      label: new Intl.DateTimeFormat("en-IN", { weekday: "short", timeZone: "UTC" }).format(date),
      revenue: Number(row?.revenue ?? 0),
      orders: Number(row?.orders ?? 0),
    };
  });
  const maxRevenue = Math.max(...series.map((point) => point.revenue), 1);

  const checklist = [
    {
      label: "Business profile created",
      done: true,
      detail: `Public at /b/${business.slug}`,
    },
    {
      label: "Storefront details filled in",
      done: Boolean(profile?.description),
      detail: profile?.description
        ? "Description, contact details and theme saved"
        : "Add a description, contact details and brand colour",
      href: "/dashboard/website",
      cta: "Edit storefront",
    },
    {
      label: "First product added",
      done: products > 0,
      detail:
        products > 0
          ? `${products} active product${products === 1 ? "" : "s"}`
          : "Add your first product and it appears on your storefront",
    },
    {
      label: "First order received",
      done: totals.orders > 0,
      detail:
        totals.orders > 0
          ? `${totals.orders} order${totals.orders === 1 ? "" : "s"} recorded`
          : "Share your storefront link — checkout is live",
    },
  ];
  const completedSteps = checklist.filter((step) => step.done).length;

  return (
    <div className="space-y-4 sm:space-y-5">
      <PageHeader
        eyebrow={`${business.industry} · ${role}`}
        title={welcome ? `Welcome, ${business.name}` : "Overview"}
        description={
          welcome
            ? "Your workspace is live. Finish the setup checklist and your storefront is ready for its first order."
            : "A live snapshot of this business. Every figure is read from your own database rows."
        }
        actions={
          <>
            <Link href={`/b/${business.slug}`} target="_blank" className="btn btn-ghost text-[12.5px]">
              View storefront
            </Link>
            <Link href="/dashboard/website" className="btn btn-primary text-[12.5px]">
              Edit storefront
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Total revenue"
          value={formatMoney(totals.revenue)}
          hint={`${totals.orders} order${totals.orders === 1 ? "" : "s"} all time`}
          tone="brand"
        />
        <Stat label="Today" value={formatMoney(todayTotals.revenue)} hint={`${todayTotals.orders} orders today`} />
        <Stat
          label="This month"
          value={formatMoney(monthTotals.revenue)}
          hint={`${monthTotals.orders} orders this month`}
        />
        <Stat label="Pending orders" value={String(pendingOrders)} hint={`${completedOrders} delivered`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel
          title="Last 7 days"
          description="Revenue per day, from your orders table"
          className="lg:col-span-2"
          action={<span className="text-[11px] text-muted">Peak {formatMoney(maxRevenue)}</span>}
        >
          <div className="flex h-[156px] items-end gap-2 sm:gap-3">
            {series.map((point) => {
              const height = Math.round((point.revenue / maxRevenue) * 100);
              return (
                <div key={point.key} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                  <div className="flex h-[120px] w-full items-end">
                    <div
                      className="w-full rounded-t-[4px] bg-ink transition-[height] duration-500"
                      style={{ height: `${Math.max(point.revenue > 0 ? 6 : 2, height)}%` }}
                      title={`${point.label}: ${formatMoney(point.revenue)} · ${point.orders} orders`}
                    />
                  </div>
                  <span className="text-[10.5px] text-muted">{point.label}</span>
                </div>
              );
            })}
          </div>
          {totals.orders === 0 && (
            <p className="mt-2 text-[11.5px] text-muted">
              No orders yet — the chart fills automatically once checkout goes live in Phase 3.
            </p>
          )}
        </Panel>

        <Panel
          title="Setup checklist"
          description={`${completedSteps} of ${checklist.length} complete`}
        >
          <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-canvas">
            <div
              className="h-full rounded-full bg-brand transition-[width] duration-500"
              style={{ width: `${(completedSteps / checklist.length) * 100}%` }}
            />
          </div>
          <ul className="space-y-2.5">
            {checklist.map((step) => (
              <li key={step.label} className="flex gap-2.5">
                <span
                  className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[9px] ${
                    step.done
                      ? "border-success bg-success text-white"
                      : "border-line bg-white text-transparent"
                  }`}
                  aria-hidden
                >
                  ✓
                </span>
                <div className="min-w-0">
                  <p className="text-[12.5px] font-medium leading-tight">{step.label}</p>
                  <p className="mt-0.5 text-[11px] leading-snug text-muted">{step.detail}</p>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-3 border-t border-line pt-3">
            <Link
              href="/dashboard/website"
              className="text-[12px] font-semibold text-brand hover:underline"
            >
              Continue setup →
            </Link>
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Stat label="Products" value={`${products}`} hint={`Limit ${productLimit} on ${plan?.name ?? "Free"}`} />
            <Stat label="Customers" value={`${customers}`} hint="Created at first order" />
            <Stat
              label="AI credits"
              value={String(plan?.ai_credits ?? 0)}
              hint="Monthly allowance"
            />
          </div>

          <Panel title="Top products" description="Ranked by units sold" padded={false}>
            {topProducts.length === 0 ? (
              <div className="p-4">
                <EmptyState
                  title="No sales data yet"
                  description="Once orders arrive, your best sellers will be ranked here automatically."
                />
              </div>
            ) : (
              <ul className="divide-y divide-line">
                {topProducts.map((product, index) => (
                  <li key={product.name} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="w-4 text-[11px] tabular-nums text-muted">{index + 1}</span>
                    <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium">
                      {product.name}
                    </span>
                    <span className="text-[11.5px] text-muted">{product.qty} sold</span>
                    <span className="w-20 text-right text-[12px] font-semibold tabular-nums">
                      {formatMoney(Number(product.revenue))}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel
            title="Recent activity"
            description="Audit trail for this business"
            padded={false}
          >
            {recentAudit.length === 0 ? (
              <p className="px-4 py-4 text-[12px] text-muted">No activity recorded yet.</p>
            ) : (
              <ul className="divide-y divide-line">
                {recentAudit.map((entry, index) => (
                  <li key={`${entry.created_at}-${index}`} className="px-4 py-2.5">
                    <p className="text-[12px] font-medium leading-tight">
                      {AUDIT_LABELS[entry.action] ?? entry.action}
                    </p>
                    <p className="mt-0.5 text-[10.5px] text-muted">
                      {entry.actor_type === "ai" ? "AI agent · " : ""}
                      {formatDateTime(entry.created_at)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <div className="card overflow-hidden">
            <div className="bg-ink p-4 text-white">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/50">
                AI business agent
              </p>
              <p className="mt-2 text-[13px] font-medium leading-snug">
                “How many orders did I receive today?”
              </p>
              <div className="mt-3 rounded-lg bg-white/10 px-3 py-2 text-[11.5px] text-white/80">
                {todayTotals.orders > 0
                  ? `You received ${todayTotals.orders} order${todayTotals.orders === 1 ? "" : "s"} today, worth ${formatMoney(todayTotals.revenue)}.`
                  : "No orders yet today."}
              </div>
              <p className="mt-3 text-[10.5px] leading-relaxed text-white/45">
                The read-only agent is live. It answers from fixed reports on your own data and
                cannot change a price or any other record.
              </p>
              <Link
                href="/dashboard/agent"
                className="mt-2 inline-block text-[11px] font-semibold text-white/85 underline underline-offset-2 hover:text-white"
              >
                Ask the agent →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
