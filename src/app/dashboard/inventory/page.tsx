import Link from "next/link";
import { adjustStockAction, saveStockAction } from "@/app/actions/inventory";
import { EmptyState, PageHeader, Panel, Stat } from "@/components/ui";
import { requireBusiness } from "@/lib/business";
import { getDb } from "@/lib/db";
import { formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Inventory" };

/**
 * INVENTORY.
 *
 * Stock is optional per product: a product with no inventory row is simply not
 * tracked. Once a number is saved, zero means sold out (the product is marked
 * unavailable) and a low level shows a warning before it runs out.
 */

type StockRow = {
  id: string;
  name: string;
  is_available: number;
  stock_on_hand: number | null;
  low_stock_threshold: number | null;
  updated_at: string | null;
};

const ERROR_TEXT: Record<string, string> = {
  missing: "That product no longer exists for this business.",
};

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const { business } = await requireBusiness();
  const params = await searchParams;
  const db = await getDb();

  const rows = await db.all<StockRow>(
    `SELECT p.id, p.name, p.is_available, i.stock_on_hand, i.low_stock_threshold, i.updated_at
       FROM products p
       LEFT JOIN inventory i ON i.product_id = p.id AND i.business_id = p.business_id
      WHERE p.business_id = ?
      ORDER BY p.sort_order ASC, p.name ASC`,
    [business.id],
  );

  const tracked = rows.filter((row) => row.stock_on_hand !== null);
  const out = tracked.filter((row) => Number(row.stock_on_hand) === 0);
  const low = tracked.filter(
    (row) =>
      Number(row.stock_on_hand) > 0 &&
      Number(row.stock_on_hand) <= Number(row.low_stock_threshold ?? 5),
  );
  const untracked = rows.length - tracked.length;

  return (
    <div className="space-y-4 sm:space-y-5">
      <PageHeader
        eyebrow="Operate"
        title="Inventory"
        description="Stock counts per product. Saving a count of zero marks the product sold out on the storefront; adding stock brings it back."
        actions={
          <Link href="/dashboard/products" className="btn btn-ghost text-[12.5px]">
            Products
          </Link>
        }
      />

      {params.saved === "1" && (
        <div className="rounded-[10px] border border-success/20 bg-success/5 px-3.5 py-2.5 text-[12.5px] text-success">
          Stock saved. The storefront availability is updated too.
        </div>
      )}
      {params.error && ERROR_TEXT[params.error] && (
        <div className="rounded-[10px] border border-danger/20 bg-danger/5 px-3.5 py-2.5 text-[12.5px] text-danger">
          {ERROR_TEXT[params.error]}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Tracked products" value={String(tracked.length)} hint="Counting stock" tone="brand" />
        <Stat label="Out of stock" value={String(out.length)} hint="Unavailable to customers" />
        <Stat label="Running low" value={String(low.length)} hint="At or under the threshold" />
        <Stat label="Not tracked" value={String(untracked)} hint="No count saved yet" />
      </div>

      <Panel
        title="Stock"
        description="Counts are saved per product. Leaving an item untracked is fine — it stays always available."
        padded={false}
      >
        {rows.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title="No products yet"
              description="Add products first, then come back to count what is on the shelf."
              action={
                <Link href="/dashboard/products/new" className="btn btn-brand text-[12.5px]">
                  Add a product
                </Link>
              }
            />
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((row) => {
              const quantity = row.stock_on_hand === null ? null : Number(row.stock_on_hand);
              const threshold = Number(row.low_stock_threshold ?? 5);
              const isOut = quantity === 0;
              const isLow = quantity !== null && quantity > 0 && quantity <= threshold;

              return (
                <li key={row.id} className="space-y-2 px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/dashboard/products/${row.id}`}
                      className="min-w-0 flex-1 truncate text-[13px] font-medium hover:underline"
                    >
                      {row.name}
                    </Link>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                        isOut
                          ? "border-danger/25 bg-danger/5 text-danger"
                          : isLow
                            ? "border-warning/25 bg-warning/5 text-warning"
                            : row.stock_on_hand === null
                              ? "border-line bg-canvas text-muted"
                              : "border-success/25 bg-success/5 text-success"
                      }`}
                    >
                      {isOut ? "Out of stock" : isLow ? "Low stock" : row.stock_on_hand === null ? "Not tracked" : "In stock"}
                    </span>
                    {row.is_available === 0 && (
                      <span className="rounded-full border border-line bg-white px-2 py-0.5 text-[10px] text-muted">
                        Hidden
                      </span>
                    )}
                    {row.updated_at && (
                      <span className="text-[10.5px] text-muted">
                        {formatDateTime(row.updated_at)}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-end gap-2">
                    <form action={saveStockAction} className="flex flex-wrap items-end gap-2">
                      <input type="hidden" name="productId" value={row.id} />
                      <div>
                        <label className="label" htmlFor={`qty-${row.id}`}>
                          On hand
                        </label>
                        <input
                          id={`qty-${row.id}`}
                          name="quantity"
                          type="number"
                          inputMode="numeric"
                          min={0}
                          step={1}
                          defaultValue={quantity ?? 0}
                          className="field w-24 py-1.5 text-[12.5px]"
                        />
                      </div>
                      <div>
                        <label className="label" htmlFor={`low-${row.id}`}>
                          Low alert at
                        </label>
                        <input
                          id={`low-${row.id}`}
                          name="threshold"
                          type="number"
                          inputMode="numeric"
                          min={0}
                          step={1}
                          defaultValue={threshold}
                          className="field w-24 py-1.5 text-[12.5px]"
                        />
                      </div>
                      <button type="submit" className="btn btn-primary min-h-[34px] text-[12px]">
                        Save
                      </button>
                    </form>

                    <form action={adjustStockAction} className="flex items-end gap-1.5">
                      <input type="hidden" name="productId" value={row.id} />
                      <button
                        type="submit"
                        name="delta"
                        value="-1"
                        className="btn btn-ghost min-h-[34px] px-2.5 text-[12px]"
                        aria-label={`Remove one ${row.name}`}
                      >
                        −1
                      </button>
                      <button
                        type="submit"
                        name="delta"
                        value="1"
                        className="btn btn-ghost min-h-[34px] px-2.5 text-[12px]"
                        aria-label={`Add one ${row.name}`}
                      >
                        +1
                      </button>
                      <button
                        type="submit"
                        name="delta"
                        value="10"
                        className="btn btn-ghost min-h-[34px] px-2.5 text-[12px]"
                        aria-label={`Add ten ${row.name}`}
                      >
                        +10
                      </button>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <p className="px-1 text-[11.5px] leading-relaxed text-muted">
        Stock is a count you keep, not a live reservation: two orders placed at the same moment can
        take the last unit twice. Ordering still works when a count is wrong — this page is a
        reminder, not a gate.
      </p>
    </div>
  );
}
