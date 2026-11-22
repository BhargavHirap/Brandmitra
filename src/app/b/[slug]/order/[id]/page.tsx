import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BrandLink } from "@/components/brand";
import { getDb } from "@/lib/db";
import { formatDateTime, formatMoney } from "@/lib/format";
import { STATUS_TONES } from "@/lib/orders";
import { sentenceStart, storefrontStatus, workspaceFor } from "@/lib/workspace";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your receipt" };

/**
 * Customer receipt.
 *
 * The URL uses the order's UUID, not the human order number, so a customer cannot
 * browse other people's orders by guessing BM-1001, BM-1002…
 */

type OrderRow = {
  id: string;
  order_number: string;
  status: string;
  payment_status: string;
  payment_method: string;
  subtotal: number;
  total: number;
  customer_note: string;
  created_at: string;
  customer_name: string | null;
  customer_phone: string | null;
  brand_color: string | null;
  store_name: string;
  store_slug: string;
  store_industry: string;
  store_phone: string | null;
  store_whatsapp: string | null;
  opening_hours: string | null;
};

type ItemRow = {
  id: string;
  name_snapshot: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  options: string;
};

function optionNames(raw: string): string[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry) => (entry as { name?: unknown }).name)
      .filter((name): name is string => typeof name === "string");
  } catch {
    return [];
  }
}

export default async function OrderReceiptPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  const db = await getDb();

  const order = await db.first<OrderRow>(
    `SELECT o.id, o.order_number, o.status, o.payment_status, o.payment_method,
            o.subtotal, o.total, o.customer_note, o.created_at,
            c.name AS customer_name, c.phone AS customer_phone,
            p.brand_color, p.opening_hours, p.phone AS store_phone, p.whatsapp AS store_whatsapp,
            b.name AS store_name, b.slug AS store_slug, b.industry AS store_industry
       FROM orders o
       JOIN businesses b ON b.id = o.business_id
       LEFT JOIN business_profiles p ON p.business_id = b.id
       LEFT JOIN customers c ON c.id = o.customer_id
      WHERE o.id = ? AND b.slug = ?`,
    [id, slug],
  );
  if (!order) notFound();

  const items = await db.all<ItemRow>(
    `SELECT id, name_snapshot, quantity, unit_price, line_total, options
       FROM order_items WHERE order_id = ? AND business_id = (
         SELECT id FROM businesses WHERE slug = ?
       ) ORDER BY rowid ASC`,
    [order.id, slug],
  );

  const accent = /^#[0-9a-fA-F]{6}$/.test(order.brand_color ?? "") ? order.brand_color! : "#2F6BFF";
  const ws = workspaceFor(order.store_industry);

  return (
    <div className="min-h-screen bg-canvas">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between gap-3 px-5">
          <Link href={`/b/${order.store_slug}`} className="text-[12.5px] text-muted hover:text-ink">
            ← {ws.storefrontBack}
          </Link>
          <div className="flex items-center gap-2">
            <span
              className="flex h-7 w-7 items-center justify-center rounded-lg text-[11px] font-semibold text-white"
              style={{ backgroundColor: accent }}
            >
              {order.store_name.slice(0, 1).toUpperCase()}
            </span>
            <span className="truncate text-[13px] font-semibold">{order.store_name}</span>
          </div>
          <span className="hidden sm:block">
            <BrandLink href="/" />
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-8 sm:py-10">
        <div className="rounded-xl border border-success/25 bg-success/5 px-4 py-3.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-success">
            {ws.receiptTitle}
          </p>
          <p className="mt-1 text-[15px] font-semibold">
            {order.order_number} · {formatMoney(order.total)}
          </p>
          <p className="mt-1 text-[12px] leading-relaxed text-success/90">
            {order.store_name} has received your {ws.order}. Keep this page bookmarked to check its
            status.
          </p>
        </div>

        <section className="card mt-4 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
            <div>
              <h1 className="text-[14px] font-semibold">Your {ws.itemsLower}</h1>
              <p className="mt-0.5 text-[11px] text-muted">{formatDateTime(order.created_at)}</p>
            </div>
            <span
              className={`rounded-full border px-2.5 py-1 text-[10.5px] font-medium ${
                STATUS_TONES[order.status] ?? "border-line bg-canvas text-muted"
              }`}
            >
              {storefrontStatus(order.status, ws)}
            </span>
          </div>

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
            <div className="flex justify-between gap-3 text-[14px] font-semibold">
              <dt>Total</dt>
              <dd className="tabular-nums">{formatMoney(order.total)}</dd>
            </div>
            <div className="flex justify-between gap-3 text-[11.5px] text-muted">
              <dt>Payment</dt>
              <dd>
                {order.payment_method === "cod" ? ws.payLaterLabel : ws.payAtStoreLabel} ·{" "}
                {order.payment_status === "paid" ? "Paid" : "Payment due"}
              </dd>
            </div>
          </dl>
        </section>

        <section className="card mt-4 p-4">
          <h2 className="text-[13px] font-semibold">Your details</h2>
          <p className="mt-2 text-[12.5px]">
            {order.customer_name || "Customer"}
            {order.customer_phone ? ` · ${order.customer_phone}` : ""}
          </p>
          {order.customer_note && (
            <p className="mt-1.5 rounded-md bg-canvas px-2.5 py-2 text-[11.5px] leading-relaxed text-muted">
              “{order.customer_note}”
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {order.store_phone && (
              <a href={`tel:${order.store_phone}`} className="btn btn-ghost text-[12px]">
                Call the business
              </a>
            )}
            <Link href={`/b/${order.store_slug}#catalogue`} className="btn btn-ghost text-[12px]">
              {sentenceStart(ws.storefrontVerb)} something else
            </Link>
          </div>
          {order.opening_hours && (
            <p className="mt-3 text-[11px] text-muted">Hours: {order.opening_hours}</p>
          )}
        </section>

        <p className="mt-4 px-1 text-[11px] leading-relaxed text-muted">
          This link is private to your order. Do not share it — it shows the items and phone number
          on this order.
        </p>
      </main>
    </div>
  );
}
