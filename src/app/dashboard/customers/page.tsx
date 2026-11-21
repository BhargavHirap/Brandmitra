import Link from "next/link";
import { EmptyState, PageHeader, Panel, Stat } from "@/components/ui";
import { requireBusiness } from "@/lib/business";
import { getDb } from "@/lib/db";
import { formatDateTime, formatMoney } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Customers" };

/**
 * CUSTOMERS.
 *
 * A customer row is created by checkout, so this page never invents people.
 * Spend and order counts are grouped from `orders`, and only rows that belong
 * to this business are ever read.
 */

type CustomerRow = {
  id: string;
  name: string;
  phone: string;
  email: string;
  created_at: string;
  orders: number;
  spent: number;
  last_order: string | null;
};

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { business } = await requireBusiness();
  const params = await searchParams;
  const db = await getDb();

  const q = (params.q ?? "").trim().slice(0, 60);
  const where = ["c.business_id = ?"];
  const bind: (string | number)[] = [business.id];
  if (q) {
    where.push("(c.name LIKE ? OR c.phone LIKE ? OR c.email LIKE ?)");
    bind.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }

  const [customers, totals, repeatRow, monthRow] = await Promise.all([
    db.all<CustomerRow>(
      `SELECT c.id, c.name, c.phone, c.email, c.created_at,
              COUNT(o.id) AS orders,
              COALESCE(SUM(CASE WHEN o.status NOT IN ('cancelled', 'rejected') THEN o.total ELSE 0 END), 0) AS spent,
              MAX(o.created_at) AS last_order
         FROM customers c
         LEFT JOIN orders o ON o.customer_id = c.id AND o.business_id = c.business_id
        WHERE ${where.join(" AND ")}
        GROUP BY c.id
        ORDER BY (last_order IS NULL), last_order DESC, c.created_at DESC
        LIMIT 300`,
      bind,
    ),
    db.first<{ n: number }>("SELECT COUNT(*) AS n FROM customers WHERE business_id = ?", [
      business.id,
    ]),
    db.first<{ n: number }>(
      `SELECT COUNT(*) AS n FROM (
         SELECT customer_id FROM orders
          WHERE business_id = ? AND customer_id IS NOT NULL
            AND status NOT IN ('cancelled', 'rejected')
          GROUP BY customer_id HAVING COUNT(*) > 1
       )`,
      [business.id],
    ),
    db.first<{ n: number }>(
      "SELECT COUNT(*) AS n FROM customers WHERE business_id = ? AND created_at >= ?",
      [
        business.id,
        new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).toISOString(),
      ],
    ),
  ]);

  const total = Number(totals?.n ?? 0);
  const repeat = Number(repeatRow?.n ?? 0);
  const newThisMonth = Number(monthRow?.n ?? 0);
  const valued = customers.filter((row) => Number(row.spent) > 0);
  const averageSpend =
    valued.length > 0
      ? Math.round(valued.reduce((sum, row) => sum + Number(row.spent), 0) / valued.length)
      : 0;

  return (
    <div className="space-y-4 sm:space-y-5">
      <PageHeader
        eyebrow="Operate"
        title="Customers"
        description="Everyone who has checked out on your storefront, with what they have spent. Created automatically from the phone number given at checkout."
        actions={
          <Link href="/dashboard/orders" className="btn btn-ghost text-[12.5px]">
            View orders
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Customers" value={String(total)} hint="All time" tone="brand" />
        <Stat label="Repeat" value={String(repeat)} hint="Ordered more than once" />
        <Stat label="New this month" value={String(newThisMonth)} hint="First order this month" />
        <Stat label="Average spend" value={formatMoney(averageSpend)} hint="Per customer with orders" />
      </div>

      <Panel padded={false}>
        <form method="get" className="flex flex-col gap-2 border-b border-line p-3 sm:flex-row sm:items-center">
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search by name, phone or email"
            aria-label="Search customers"
            className="field sm:max-w-sm"
          />
          <div className="flex gap-2">
            <button type="submit" className="btn btn-ghost text-[12.5px]">
              Search
            </button>
            {q && (
              <Link href="/dashboard/customers" className="btn btn-ghost text-[12.5px]">
                Clear
              </Link>
            )}
          </div>
        </form>

        {customers.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title={q ? "No customer matches that search" : "No customers yet"}
              description={
                q
                  ? "Try a phone number or just part of the name."
                  : "Customers are created the first time someone checks out. Share your storefront link to get the first one."
              }
              action={
                <Link href={`/b/${business.slug}`} target="_blank" className="btn btn-brand text-[12.5px]">
                  Open storefront
                </Link>
              }
            />
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {customers.map((customer) => (
              <li key={customer.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line bg-canvas text-[12px] font-semibold text-muted">
                  {(customer.name || customer.phone || "?").slice(0, 1).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium">
                    {customer.name || "Customer"}
                  </p>
                  <p className="mt-0.5 truncate text-[11.5px] text-muted">
                    {customer.phone || "No phone"}
                    {customer.email ? ` · ${customer.email}` : ""}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[12.5px] font-semibold tabular-nums">
                    {formatMoney(Number(customer.spent))}
                  </p>
                  <p className="text-[10.5px] text-muted">
                    {Number(customer.orders)} order{Number(customer.orders) === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="w-32 text-right text-[10.5px] text-muted">
                  {customer.last_order ? formatDateTime(customer.last_order) : "No orders yet"}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <p className="px-1 text-[11.5px] leading-relaxed text-muted">
        Customer details are visible only inside this dashboard. Nothing here is shared between
        businesses, and the storefront never lists your customer list.
      </p>
    </div>
  );
}
