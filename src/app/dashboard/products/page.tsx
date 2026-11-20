import Link from "next/link";
import { toggleProductAction } from "@/app/actions/products";
import { EmptyState, PageHeader, Panel } from "@/components/ui";
import { requireBusiness } from "@/lib/business";
import { getDb } from "@/lib/db";
import { formatMoney } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Products" };

type ListRow = {
  id: string;
  name: string;
  price: number;
  compare_at_price: number | null;
  image_url: string;
  is_active: number;
  is_available: number;
  category_name: string | null;
  option_groups: number;
};

type CategoryRow = { id: string; name: string; n: number };

const ERROR_TEXT: Record<string, string> = {
  limit: "You have reached the product limit for your plan. Remove an item or upgrade to add more.",
  missing: "That product no longer exists for this business.",
};

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    category?: string;
    saved?: string;
    deleted?: string;
    error?: string;
  }>;
}) {
  const { business, planId } = await requireBusiness();
  const params = await searchParams;
  const db = await getDb();

  const q = (params.q ?? "").trim().slice(0, 60);
  const categoryFilter = (params.category ?? "").trim().slice(0, 64);

  const where = ["p.business_id = ?"];
  const bind: (string | number)[] = [business.id];
  if (q) {
    where.push("p.name LIKE ?");
    bind.push(`%${q}%`);
  }
  if (categoryFilter) {
    where.push("p.category_id = ?");
    bind.push(categoryFilter);
  }

  const [products, categories, totalRow, activeRow, plan] = await Promise.all([
    db.all<ListRow>(
      `SELECT p.id, p.name, p.price, p.compare_at_price, p.image_url,
              p.is_active, p.is_available, c.name AS category_name,
              (SELECT COUNT(*) FROM customization_groups g WHERE g.product_id = p.id) AS option_groups
         FROM products p
         LEFT JOIN product_categories c ON c.id = p.category_id
        WHERE ${where.join(" AND ")}
        ORDER BY COALESCE(c.sort_order, 9999) ASC, p.sort_order ASC, p.created_at ASC
        LIMIT 300`,
      bind,
    ),
    db.all<CategoryRow>(
      `SELECT c.id, c.name,
              (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id) AS n
         FROM product_categories c
        WHERE c.business_id = ?
        ORDER BY c.sort_order ASC, c.name ASC`,
      [business.id],
    ),
    db.first<{ n: number }>("SELECT COUNT(*) AS n FROM products WHERE business_id = ?", [
      business.id,
    ]),
    db.first<{ n: number }>(
      "SELECT COUNT(*) AS n FROM products WHERE business_id = ? AND is_active = 1",
      [business.id],
    ),
    db.first<{ product_limit: number; name: string }>(
      "SELECT product_limit, name FROM plans WHERE id = ?",
      [planId],
    ),
  ]);

  const total = Number(totalRow?.n ?? 0);
  const active = Number(activeRow?.n ?? 0);
  const limit = Number(plan?.product_limit ?? 10);
  const filtered = Boolean(q || categoryFilter);

  return (
    <div className="space-y-4 sm:space-y-5">
      <PageHeader
        eyebrow="Catalogue"
        title="Products"
        description="Everything you sell, with prices and customisation options. Changes appear on your storefront immediately."
        actions={
          <>
            <Link href="/dashboard/categories" className="btn btn-ghost text-[12.5px]">
              Categories
            </Link>
            <Link href="/dashboard/products/new" className="btn btn-brand text-[12.5px]">
              Add product
            </Link>
          </>
        }
      />

      {params.saved === "1" && (
        <div className="rounded-[10px] border border-success/20 bg-success/5 px-3.5 py-2.5 text-[12.5px] text-success">
          Saved. Your storefront is updated.
        </div>
      )}
      {params.deleted === "1" && (
        <div className="rounded-[10px] border border-line bg-white px-3.5 py-2.5 text-[12.5px] text-muted">
          Product deleted. Your other items are untouched.
        </div>
      )}
      {params.error && ERROR_TEXT[params.error] && (
        <div className="rounded-[10px] border border-danger/20 bg-danger/5 px-3.5 py-2.5 text-[12.5px] text-danger">
          {ERROR_TEXT[params.error]}
        </div>
      )}

      <div className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-[12.5px] font-semibold">
            {total} of {limit} products used
          </p>
          <p className="mt-0.5 text-[11.5px] text-muted">
            {active} visible on the storefront · {total - active} hidden · {plan?.name ?? "Free"} plan
          </p>
        </div>
        <div className="sm:w-56">
          <div className="h-1.5 overflow-hidden rounded-full bg-canvas">
            <div
              className="h-full rounded-full bg-brand"
              style={{ width: `${Math.min(100, Math.round((total / Math.max(limit, 1)) * 100))}%` }}
            />
          </div>
        </div>
      </div>

      <Panel padded={false}>
        <form
          method="get"
          className="flex flex-col gap-2 border-b border-line p-3 sm:flex-row sm:items-center"
        >
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search products"
            className="field sm:max-w-xs"
            aria-label="Search products"
          />
          <select
            name="category"
            defaultValue={categoryFilter}
            className="field sm:max-w-[200px]"
            aria-label="Filter by category"
          >
            <option value="">All categories</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <button type="submit" className="btn btn-ghost text-[12.5px]">
              Filter
            </button>
            {filtered && (
              <Link href="/dashboard/products" className="btn btn-ghost text-[12.5px]">
                Clear
              </Link>
            )}
          </div>
        </form>

        {products.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title={filtered ? "No products match this filter" : "Your catalogue is empty"}
              description={
                filtered
                  ? "Try a different search term or clear the category filter."
                  : "Add your first product — a name, a price and an optional photo. Customers see it on your storefront right away."
              }
              action={
                filtered ? (
                  <Link href="/dashboard/products" className="btn btn-ghost text-[12.5px]">
                    Clear filters
                  </Link>
                ) : (
                  <Link href="/dashboard/products/new" className="btn btn-brand text-[12.5px]">
                    Add your first product
                  </Link>
                )
              }
            />
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {products.map((product) => (
              <li key={product.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                {product.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={product.image_url}
                    alt=""
                    className="h-11 w-11 shrink-0 rounded-lg border border-line object-cover"
                  />
                ) : (
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-line bg-canvas text-[12px] font-semibold text-muted">
                    {product.name.slice(0, 1).toUpperCase()}
                  </span>
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Link
                      href={`/dashboard/products/${product.id}`}
                      className="truncate text-[13px] font-medium hover:underline"
                    >
                      {product.name}
                    </Link>
                    {product.is_available === 0 && (
                      <span className="rounded border border-warning/25 bg-warning/5 px-1.5 py-px text-[9.5px] font-medium uppercase tracking-wide text-warning">
                        Sold out
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-[11px] text-muted">
                    {product.category_name ?? "No category"}
                    {Number(product.option_groups) > 0
                      ? ` · ${product.option_groups} customisation group${Number(product.option_groups) === 1 ? "" : "s"}`
                      : ""}
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-[13px] font-semibold tabular-nums">
                    {formatMoney(product.price)}
                  </p>
                  {product.compare_at_price ? (
                    <p className="text-[10.5px] text-muted line-through tabular-nums">
                      {formatMoney(product.compare_at_price)}
                    </p>
                  ) : null}
                </div>

                <form action={toggleProductAction} className="shrink-0">
                  <input type="hidden" name="id" value={product.id} />
                  <input type="hidden" name="field" value="active" />
                  <button
                    type="submit"
                    title={
                      product.is_active === 1
                        ? "Visible on the storefront — click to hide"
                        : "Hidden — click to show"
                    }
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                      product.is_active === 1
                        ? "border-success/25 bg-success/5 text-success"
                        : "border-line bg-white text-muted"
                    }`}
                  >
                    {product.is_active === 1 ? "Live" : "Hidden"}
                  </button>
                </form>

                <Link
                  href={`/dashboard/products/${product.id}`}
                  className="btn btn-ghost shrink-0 px-2.5 py-1 text-[12px]"
                >
                  Edit
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <p className="px-1 text-[11.5px] leading-relaxed text-muted">
        Product limits come from your plan and are checked again on the server, so a limit cannot
        be bypassed from the browser.
      </p>
    </div>
  );
}
