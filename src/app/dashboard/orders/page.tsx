import Link from "next/link";
import { EmptyState, PageHeader, Panel, Stat } from "@/components/ui";
import { requireBusiness } from "@/lib/business";
import { getDb } from "@/lib/db";
import { formatDateTime, formatMoney } from "@/lib/format";
import { OPEN_STATUSES, ORDER_STATUSES, STATUS_TONES, statusLabel } from "@/lib/orders";

export const dynamic = "force-dynamic";
export const metadata = { title: "Orders" };

type OrderRow = {
  id: string;
  order_number: string;
  status: string;
  total: number;
  created_at: string;
  payment_method: string;
  customer_name: string | null;
  customer_phone: string | null;
  item_count: number;
};

const FILTERS = ["all", ...ORDER_STATUSES] as const;

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; error?: string }>;
}) {
  const { business } = await requireBusiness();
  const params = await searchParams;
  const db = await getDb();

  const requested = (params.status ?? "all").toLowerCase();
  const filter = FILTERS.includes(requested as (typeof FILTERS)[number]) ? requested : "all";

  const [orders, statusCounts, totals] = await Promise.all([
    db.all<OrderRow>(
      `SELECT o.id, o.order_number, o.status, o.total, o.created_at, o.payment_method,
              c.name AS customer_name, c.phone AS customer_phone,
              (SELECT COALESCE(SUM(i.quantity), 0) FROM order_items i WHERE i.order_id = o.id) AS item_count
         FROM orders o
         LEFT JOIN customers c ON c.id = o.customer_id
        WHERE o.business_id = ?${filter === "all" ? "" : " AND o.status = ?"}
        ORDER BY o.created_at DESC
        LIMIT 200`,
      filter === "all" ? [business.id] : [business.id, filter],
    ),
    db.all<{ status: string; n: number }>(
      "SELECT status, COUNT(*) AS n FROM orders WHERE business_id = ? GROUP BY status",
      [business.id],
    ),
    db.first<{ orders: number; revenue: number }>(
      `SELECT COUNT(*) AS orders, COALESCE(SUM(total), 0) AS revenue
         FROM orders WHERE business_id = ? AND status NOT IN ('cancelled', 'rejected')`,
      [business.id],
    ),
  ]);

  const counts = new Map(statusCounts.map((row) => [row.status, Number(row.n)]));
  const allCount = statusCounts.reduce((sum, row) => sum + Number(row.n), 0);
  const openCount = OPEN_STATUSES.reduce((sum, status) => sum + (counts.get(status) ?? 0), 0);

  return (
    <div className="space-y-4 sm:space-y-5">
      <PageHeader
        eyebrow="Operate"
        title="Orders"
        description="Every order placed on your storefront, with the exact items, options and prices recorded at checkout."
        actions={
          <Link href={`/b/${business.slug}`} target="_blank" className="btn btn-ghost text-[12.5px]">
            View storefront
          </Link>
        }
      />

      {params.error === "missing" && (
        <div className="rounded-[10px] border border-danger/20 bg-danger/5 px-3.5 py-2.5 text-[12.5px] text-danger">
          That order no longer exists for this business.
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Open orders" value={String(openCount)} hint="Not yet delivered" tone="brand" />
        <Stat label="All orders" value={String(allCount)} hint="Including cancelled" />
        <Stat
          label="Revenue"
          value={formatMoney(Number(totals?.revenue ?? 0))}
          hint={`${Number(totals?.orders ?? 0)} paid or pending orders`}
        />
        <Stat label="New" value={String(counts.get("new") ?? 0)} hint="Waiting for you to accept" />
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none]">
        {FILTERS.map((status) => {
          const active = filter === status;
          const count = status === "all" ? allCount : counts.get(status) ?? 0;
          return (
            <Link
              key={status}
              href={status === "all" ? "/dashboard/orders" : `/dashboard/orders?status=${status}`}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-[12px] transition-colors ${
                active
                  ? "border-ink bg-ink font-medium text-white"
                  : "border-line bg-white text-muted hover:text-ink"
              }`}
            >
              {status === "all" ? "All" : statusLabel(status)} · {count}
            </Link>
          );
        })}
      </div>

      <Panel padded={false}>
        {orders.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title={filter === "all" ? "No orders yet" : `No ${statusLabel(filter).toLowerCase()} orders`}
              description={
                filter === "all"
                  ? "Share your storefront link. Orders placed at checkout appear here instantly, with the items and options the customer chose."
                  : "Try another filter, or share your storefront to get the first order."
              }
              action={
                <Link
                  href={`/b/${business.slug}`}
                  target="_blank"
                  className="btn btn-brand text-[12.5px]"
                >
                  Open storefront
                </Link>
              }
            />
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {orders.map((order) => (
              <li key={order.id}>
                <Link
                  href={`/dashboard/orders/${order.id}`}
                  className="flex flex-wrap items-center gap-3 px-4 py-3 transition-colors hover:bg-canvas/60"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[13px] font-semibold">{order.order_number}</span>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                          STATUS_TONES[order.status] ?? "border-line bg-canvas text-muted"
                        }`}
                      >
                        {statusLabel(order.status)}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-[11.5px] text-muted">
                      {order.customer_name || "Customer"}
                      {order.customer_phone ? ` · ${order.customer_phone}` : ""} ·{" "}
                      {Number(order.item_count)} item{Number(order.item_count) === 1 ? "" : "s"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[13px] font-semibold tabular-nums">{formatMoney(order.total)}</p>
                    <p className="text-[10.5px] text-muted">{formatDateTime(order.created_at)}</p>
                  </div>
                  <span className="text-[11px] font-medium text-brand">Open →</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <p className="px-1 text-[11.5px] leading-relaxed text-muted">
        Order totals are calculated on the server from the live product and option prices, then
        stored as a snapshot. Changing a price later never rewrites an existing order.
      </p>
    </div>
  );
}
