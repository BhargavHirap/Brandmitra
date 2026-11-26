import { EmptyState, PageHeader, Panel, Stat } from "@/components/ui";
import { requireBusiness } from "@/lib/business";
import { firstRow, getDb, rowsOf } from "@/lib/db";
import { formatMoney } from "@/lib/format";
import { statusLabel } from "@/lib/orders";

export const dynamic = "force-dynamic";
export const metadata = { title: "Analytics" };

/**
 * ANALYTICS.
 *
 * Read-only. Every number is a GROUP BY over this business's own rows — no
 * estimates, no sample data, no third-party tracker. A new shop correctly sees
 * zeros and empty states.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const VALID = "status NOT IN ('cancelled', 'rejected')";

export default async function AnalyticsPage() {
  const { business } = await requireBusiness();
  const db = await getDb();

  const now = new Date();
  const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const start7 = new Date(startOfToday.getTime() - 6 * DAY_MS);
  const start30 = new Date(startOfToday.getTime() - 29 * DAY_MS);

  /*
   * One round trip for the whole report.
   *
   * These ten aggregates used to be ten separate statements, which on D1 means
   * ten separate HTTP requests even though each one finishes in microseconds.
   * They all read the same tables for the same business, so they travel together.
   */
  const report = await db.batch([
    {
      sql: `SELECT COUNT(*) AS orders, COALESCE(SUM(total), 0) AS revenue, COALESCE(AVG(total), 0) AS avg
              FROM orders WHERE business_id = ? AND ${VALID}`,
      params: [business.id],
    },
    {
      sql: `SELECT COUNT(*) AS orders, COALESCE(SUM(total), 0) AS revenue
              FROM orders WHERE business_id = ? AND created_at >= ? AND ${VALID}`,
      params: [business.id, start7.toISOString()],
    },
    {
      sql: `SELECT COUNT(*) AS orders, COALESCE(SUM(total), 0) AS revenue, COALESCE(AVG(total), 0) AS avg
              FROM orders WHERE business_id = ? AND created_at >= ? AND ${VALID}`,
      params: [business.id, start30.toISOString()],
    },
    {
      sql: `SELECT COUNT(*) AS orders, COALESCE(SUM(total), 0) AS revenue
              FROM orders WHERE business_id = ? AND created_at >= ? AND ${VALID}`,
      params: [business.id, startOfToday.toISOString()],
    },
    {
      sql: `SELECT substr(created_at, 1, 10) AS day, COUNT(*) AS orders,
                   COALESCE(SUM(total), 0) AS revenue
              FROM orders
             WHERE business_id = ? AND created_at >= ? AND ${VALID}
             GROUP BY day`,
      params: [business.id, start30.toISOString()],
    },
    {
      sql: `SELECT i.name_snapshot AS name, SUM(i.quantity) AS qty, SUM(i.line_total) AS revenue
              FROM order_items i
              JOIN orders o ON o.id = i.order_id AND o.business_id = i.business_id
             WHERE i.business_id = ? AND o.created_at >= ?
               AND o.status NOT IN ('cancelled', 'rejected')
             GROUP BY i.name_snapshot
             ORDER BY revenue DESC
             LIMIT 8`,
      params: [business.id, start30.toISOString()],
    },
    {
      sql: `SELECT channel, COUNT(*) AS orders, COALESCE(SUM(total), 0) AS revenue
              FROM orders
             WHERE business_id = ? AND created_at >= ? AND ${VALID}
             GROUP BY channel
             ORDER BY revenue DESC`,
      params: [business.id, start30.toISOString()],
    },
    {
      sql: "SELECT status, COUNT(*) AS n FROM orders WHERE business_id = ? GROUP BY status",
      params: [business.id],
    },
    {
      sql: `SELECT COUNT(*) AS n FROM (
              SELECT customer_id FROM orders
               WHERE business_id = ? AND customer_id IS NOT NULL AND ${VALID}
               GROUP BY customer_id HAVING COUNT(*) > 1
            )`,
      params: [business.id],
    },
    {
      sql: "SELECT COUNT(*) AS n FROM customers WHERE business_id = ? AND created_at >= ?",
      params: [business.id, startOfMonth.toISOString()],
    },
  ]);

  const allTime = firstRow<{ orders: number; revenue: number; avg: number }>(report[0]);
  const d7 = firstRow<{ orders: number; revenue: number }>(report[1]);
  const d30 = firstRow<{ orders: number; revenue: number; avg: number }>(report[2]);
  const today = firstRow<{ orders: number; revenue: number }>(report[3]);
  const seriesRows = rowsOf<{ day: string; orders: number; revenue: number }>(report[4]);
  const topProducts = rowsOf<{ name: string; qty: number; revenue: number }>(report[5]);
  const channels = rowsOf<{ channel: string; orders: number; revenue: number }>(report[6]);
  const statusRows = rowsOf<{ status: string; n: number }>(report[7]);
  const repeat = firstRow<{ n: number }>(report[8]);
  const newCustomers = firstRow<{ n: number }>(report[9]);

  const byDay = new Map(seriesRows.map((row) => [row.day, row]));
  const series = Array.from({ length: 30 }, (_, index) => {
    const date = new Date(start30.getTime() + index * DAY_MS);
    const key = date.toISOString().slice(0, 10);
    const row = byDay.get(key);
    return {
      key,
      label: new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "UTC" }).format(date),
      revenue: Number(row?.revenue ?? 0),
      orders: Number(row?.orders ?? 0),
    };
  });
  const maxRevenue = Math.max(...series.map((point) => point.revenue), 1);

  const totalRevenue30 = Number(d30?.revenue ?? 0);
  const orders30 = Number(d30?.orders ?? 0);
  const channelTotal = channels.reduce((sum, row) => sum + Number(row.revenue), 0);
  const statusTotal = statusRows.reduce((sum, row) => sum + Number(row.n), 0);

  return (
    <div className="space-y-4 sm:space-y-5">
      <PageHeader
        eyebrow="Business"
        title="Analytics"
        description="Revenue, orders and best sellers from your own order tables. Dates are UTC, the same clock the dashboard uses everywhere."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Last 30 days"
          value={formatMoney(totalRevenue30)}
          hint={`${orders30} order${orders30 === 1 ? "" : "s"}`}
          tone="brand"
        />
        <Stat
          label="Average order"
          value={formatMoney(Math.round(Number(d30?.avg ?? 0)))}
          hint="Last 30 days"
        />
        <Stat
          label="All time"
          value={formatMoney(Number(allTime?.revenue ?? 0))}
          hint={`${Number(allTime?.orders ?? 0)} orders`}
        />
        <Stat
          label="Repeat customers"
          value={String(Number(repeat?.n ?? 0))}
          hint="More than one order"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel
          title="Revenue, last 30 days"
          className="lg:col-span-2"
          description={`Today: ${formatMoney(Number(today?.revenue ?? 0))} · Last 7 days: ${formatMoney(Number(d7?.revenue ?? 0))}`}
          action={<span className="text-[11px] text-muted">Peak {formatMoney(maxRevenue)}</span>}
        >
          <div className="flex h-[150px] items-end gap-[3px]">
            {series.map((point) => (
              <div key={point.key} className="flex h-full min-w-0 flex-1 items-end">
                <div
                  className="w-full rounded-t-[2px] bg-ink"
                  style={{
                    height: `${Math.max(point.revenue > 0 ? 5 : 2, Math.round((point.revenue / maxRevenue) * 100))}%`,
                  }}
                  title={`${point.label}: ${formatMoney(point.revenue)} · ${point.orders} orders`}
                />
              </div>
            ))}
          </div>
          <div className="mt-2 flex justify-between text-[10.5px] text-muted">
            <span>{series[0]?.label}</span>
            <span>{series[series.length - 1]?.label}</span>
          </div>
        </Panel>

        <Panel title="New customers" description="Created during checkout">
          <p className="text-[26px] font-semibold leading-none tracking-[-0.02em]">
            {Number(newCustomers?.n ?? 0)}
          </p>
          <p className="mt-1.5 text-[11.5px] text-muted">This month, so far</p>
          <p className="mt-3 text-[11px] leading-relaxed text-muted">
            A customer row is created the first time someone checks out with a phone number. Repeat
            customers are those with more than one order.
          </p>
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Best sellers" description="Last 30 days, by revenue" padded={false}>
          {topProducts.length === 0 ? (
            <div className="p-4">
              <EmptyState
                title="No sales in the last 30 days"
                description="Best sellers appear here once orders start arriving."
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
                  <span className="text-[11px] text-muted">{Number(product.qty)} sold</span>
                  <span className="w-20 text-right text-[12px] font-semibold tabular-nums">
                    {formatMoney(Number(product.revenue))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <div className="space-y-4">
          <Panel title="Where orders come from" description="Last 30 days">
            {channels.length === 0 ? (
              <p className="text-[12px] text-muted">No orders yet.</p>
            ) : (
              <ul className="space-y-2.5">
                {channels.map((channel) => {
                  const share = channelTotal > 0 ? Math.round((Number(channel.revenue) / channelTotal) * 100) : 0;
                  return (
                    <li key={channel.channel}>
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-[12px] font-medium capitalize">{channel.channel}</span>
                        <span className="text-[11px] text-muted">
                          {Number(channel.orders)} orders · {formatMoney(Number(channel.revenue))}
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-canvas">
                        <div className="h-full rounded-full bg-brand" style={{ width: `${share}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          <Panel title="Orders by status" description="All time">
            {statusTotal === 0 ? (
              <p className="text-[12px] text-muted">No orders yet.</p>
            ) : (
              <ul className="grid grid-cols-2 gap-2">
                {statusRows
                  .slice()
                  .sort((a, b) => Number(b.n) - Number(a.n))
                  .map((row) => (
                    <li key={row.status} className="rounded-lg border border-line px-2.5 py-1.5">
                      <p className="text-[10.5px] uppercase tracking-[0.06em] text-muted">
                        {statusLabel(row.status)}
                      </p>
                      <p className="text-[13px] font-semibold tabular-nums">{Number(row.n)}</p>
                    </li>
                  ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>

      <p className="px-1 text-[11.5px] leading-relaxed text-muted">
        Cancelled and rejected orders are left out of every revenue figure. Order totals are the
        snapshots stored at checkout, so changing a product price later never rewrites history.
      </p>
    </div>
  );
}
