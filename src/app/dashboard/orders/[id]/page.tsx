import Link from "next/link";
import { notFound } from "next/navigation";
import { updateOrderStatusAction } from "@/app/actions/orders";
import { PageHeader, Panel } from "@/components/ui";
import { requireBusiness } from "@/lib/business";
import { getDb } from "@/lib/db";
import { formatDateTime, formatMoney } from "@/lib/format";
import {
  allowedTransitions,
  optionNames,
  paymentLabel,
  STATUS_TONES,
  statusLabel,
} from "@/lib/orders";

export const dynamic = "force-dynamic";

type OrderRow = {
  id: string;
  order_number: string;
  status: string;
  payment_status: string;
  payment_method: string;
  channel: string;
  subtotal: number;
  discount: number;
  delivery_fee: number;
  total: number;
  customer_note: string;
  created_at: string;
  updated_at: string;
  customer_name: string | null;
  customer_phone: string | null;
  branch_name: string | null;
};

type ItemRow = {
  id: string;
  name_snapshot: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  options: string;
  notes: string;
};

const ACTION_LABELS: Record<string, string> = {
  accepted: "Accept order",
  preparing: "Start preparing",
  ready: "Mark ready",
  out_for_delivery: "Out for delivery",
  delivered: "Mark delivered",
  cancelled: "Cancel order",
};

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { business } = await requireBusiness();
  const db = await getDb();
  const order = await db.first<{ order_number: string }>(
    "SELECT order_number FROM orders WHERE id = ? AND business_id = ?",
    [id, business.id],
  );
  return { title: order?.order_number ?? "Order" };
}

export default async function OrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ updated?: string; error?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const { business } = await requireBusiness();
  const db = await getDb();

  const order = await db.first<OrderRow>(
    `SELECT o.id, o.order_number, o.status, o.payment_status, o.payment_method, o.channel,
            o.subtotal, o.discount, o.delivery_fee, o.total, o.customer_note,
            o.created_at, o.updated_at,
            c.name AS customer_name, c.phone AS customer_phone,
            br.name AS branch_name
       FROM orders o
       LEFT JOIN customers c ON c.id = o.customer_id
       LEFT JOIN business_branches br ON br.id = o.branch_id
      WHERE o.id = ? AND o.business_id = ?`,
    [id, business.id],
  );
  if (!order) notFound();

  const items = await db.all<ItemRow>(
    `SELECT id, name_snapshot, quantity, unit_price, line_total, options, notes
       FROM order_items WHERE order_id = ? AND business_id = ? ORDER BY rowid ASC`,
    [order.id, business.id],
  );

  const transitions = allowedTransitions(order.status);
  const tone = STATUS_TONES[order.status] ?? "border-line bg-canvas text-muted";

  return (
    <div className="space-y-4 sm:space-y-5">
      <PageHeader
        eyebrow="Order"
        title={order.order_number}
        description={`${order.channel === "web" ? "Placed on your storefront" : order.channel} · ${formatDateTime(order.created_at)}`}
        actions={
          <>
            <Link href="/dashboard/orders" className="btn btn-ghost text-[12.5px]">
              All orders
            </Link>
            <Link
              href={`/b/${business.slug}/order/${order.id}`}
              target="_blank"
              className="btn btn-primary text-[12.5px]"
            >
              Customer receipt
            </Link>
          </>
        }
      />

      {query.updated === "1" && (
        <div className="rounded-[10px] border border-success/20 bg-success/5 px-3.5 py-2.5 text-[12.5px] text-success">
          Order status updated. The customer&apos;s receipt shows it immediately.
        </div>
      )}
      {query.error === "transition" && (
        <div className="rounded-[10px] border border-danger/20 bg-danger/5 px-3.5 py-2.5 text-[12.5px] text-danger">
          That status change is not allowed from “{statusLabel(order.status)}”.
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Panel
            title="Items"
            description={`${items.reduce((sum, item) => sum + Number(item.quantity), 0)} item(s)`}
            padded={false}
          >
            <ul className="divide-y divide-line">
              {items.map((item) => {
                const chosen = optionNames(item.options);
                return (
                  <li key={item.id} className="flex items-start justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium leading-tight">
                        {item.quantity} × {item.name_snapshot}
                      </p>
                      {chosen.length > 0 && (
                        <p className="mt-0.5 text-[11px] text-muted">{chosen.join(" · ")}</p>
                      )}
                      {item.notes && <p className="mt-0.5 text-[11px] text-muted">{item.notes}</p>}
                      <p className="mt-0.5 text-[11px] text-muted">
                        {formatMoney(item.unit_price)} each
                      </p>
                    </div>
                    <p className="shrink-0 text-[12.5px] font-semibold tabular-nums">
                      {formatMoney(item.line_total)}
                    </p>
                  </li>
                );
              })}
            </ul>
            <dl className="space-y-1.5 border-t border-line px-4 py-3 text-[12.5px]">
              <div className="flex justify-between gap-3 text-muted">
                <dt>Subtotal</dt>
                <dd className="tabular-nums">{formatMoney(order.subtotal)}</dd>
              </div>
              {Number(order.discount) > 0 && (
                <div className="flex justify-between gap-3 text-muted">
                  <dt>Discount</dt>
                  <dd className="tabular-nums">− {formatMoney(order.discount)}</dd>
                </div>
              )}
              {Number(order.delivery_fee) > 0 && (
                <div className="flex justify-between gap-3 text-muted">
                  <dt>Delivery</dt>
                  <dd className="tabular-nums">{formatMoney(order.delivery_fee)}</dd>
                </div>
              )}
              <div className="flex justify-between gap-3 border-t border-line pt-2 text-[14px] font-semibold">
                <dt>Total</dt>
                <dd className="tabular-nums">{formatMoney(order.total)}</dd>
              </div>
            </dl>
          </Panel>

          <Panel title="Customer">
            <dl className="grid gap-3 text-[12.5px] sm:grid-cols-2">
              <div>
                <dt className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted">
                  Name
                </dt>
                <dd className="mt-1">{order.customer_name || "—"}</dd>
              </div>
              <div>
                <dt className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted">
                  Phone
                </dt>
                <dd className="mt-1">
                  {order.customer_phone ? (
                    <a href={`tel:${order.customer_phone}`} className="text-brand hover:underline">
                      {order.customer_phone}
                    </a>
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted">
                  Payment
                </dt>
                <dd className="mt-1">
                  {paymentLabel(order.payment_method)} ·{" "}
                  {order.payment_status === "paid" ? "Paid" : "Pending"}
                </dd>
              </div>
              <div>
                <dt className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted">
                  Branch
                </dt>
                <dd className="mt-1">{order.branch_name ?? "Main branch"}</dd>
              </div>
            </dl>
            {order.customer_note && (
              <div className="mt-3 rounded-lg border border-line bg-canvas/50 px-3 py-2 text-[12px] leading-relaxed">
                <span className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted">
                  Note
                </span>
                <p className="mt-1">{order.customer_note}</p>
              </div>
            )}
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel title="Status">
            <div className="flex items-center justify-between gap-2">
              <span className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${tone}`}>
                {statusLabel(order.status)}
              </span>
              <span className="text-[10.5px] text-muted">
                Updated {formatDateTime(order.updated_at)}
              </span>
            </div>

            {transitions.length === 0 ? (
              <p className="mt-3 text-[12px] leading-relaxed text-muted">
                This order is closed. No further status changes are possible.
              </p>
            ) : (
              <div className="mt-3 space-y-2">
                {transitions.map((next) => (
                  <form key={next} action={updateOrderStatusAction}>
                    <input type="hidden" name="id" value={order.id} />
                    <input type="hidden" name="status" value={next} />
                    <button
                      type="submit"
                      className={`btn w-full text-[12.5px] ${
                        next === "cancelled"
                          ? "btn-ghost text-danger"
                          : "btn-primary"
                      }`}
                    >
                      {ACTION_LABELS[next] ?? next}
                    </button>
                  </form>
                ))}
              </div>
            )}

            <p className="mt-3 border-t border-line pt-3 text-[10.5px] leading-relaxed text-muted">
              Only these next steps are allowed, and the server enforces the same list.
            </p>
          </Panel>

          <Panel title="What the customer sees">
            <p className="text-[12px] leading-relaxed text-muted">
              The receipt link shows the items, total and current status. Status changes appear
              there as soon as you make them.
            </p>
            <Link
              href={`/b/${business.slug}/order/${order.id}`}
              target="_blank"
              className="mt-2 inline-block text-[12px] font-semibold text-brand hover:underline"
            >
              Open customer receipt →
            </Link>
          </Panel>
        </div>
      </div>
    </div>
  );
}
