import Link from "next/link";
import {
  createCategoryAction,
  deleteCategoryAction,
  moveCategoryAction,
  renameCategoryAction,
} from "@/app/actions/products";
import { PageHeader, Panel } from "@/components/ui";
import { requireBusiness } from "@/lib/business";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Categories" };

type CategoryRow = { id: string; name: string; slug: string; n: number };

const ERROR_TEXT: Record<string, string> = {
  name: "Category names need at least 2 characters.",
  duplicate: "You already have a category with that name.",
  missing: "That category no longer exists for this business.",
};

export default async function CategoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; deleted?: string; error?: string }>;
}) {
  const { business } = await requireBusiness();
  const params = await searchParams;
  const db = await getDb();

  const categories = await db.all<CategoryRow>(
    `SELECT c.id, c.name, c.slug,
            (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id) AS n
       FROM product_categories c
      WHERE c.business_id = ?
      ORDER BY c.sort_order ASC, c.name ASC`,
    [business.id],
  );

  return (
    <div className="space-y-4 sm:space-y-5">
      <PageHeader
        eyebrow="Catalogue"
        title="Categories"
        description="Categories become the tabs on your storefront. Order them the way a customer browses your catalogue."
        actions={
          <>
            <Link href="/dashboard/products" className="btn btn-ghost text-[12.5px]">
              Products
            </Link>
            <Link href="/dashboard/products/new" className="btn btn-brand text-[12.5px]">
              Add product
            </Link>
          </>
        }
      />

      {params.saved === "1" && (
        <div className="rounded-[10px] border border-success/20 bg-success/5 px-3.5 py-2.5 text-[12.5px] text-success">
          Saved. Your storefront tabs are updated.
        </div>
      )}
      {params.deleted === "1" && (
        <div className="rounded-[10px] border border-line bg-white px-3.5 py-2.5 text-[12.5px] text-muted">
          Category deleted. Its products are still in your catalogue under “No category”.
        </div>
      )}
      {params.error && ERROR_TEXT[params.error] && (
        <div className="rounded-[10px] border border-danger/20 bg-danger/5 px-3.5 py-2.5 text-[12.5px] text-danger">
          {ERROR_TEXT[params.error]}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Panel
            title="Your categories"
            description={`${categories.length} categor${categories.length === 1 ? "y" : "ies"}`}
            padded={false}
          >
            {categories.length === 0 ? (
              <div className="p-4">
                <p className="text-[13px] font-medium">No categories yet</p>
                <p className="mt-1 text-[12px] leading-relaxed text-muted">
                  Add one on the right, for example “Haircuts”, “Bulk cases” or “Combos”. Products without
                  a category still appear on the storefront, just after the grouped ones.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-line">
                {categories.map((category, index) => (
                  <li key={category.id} className="px-3 py-3 sm:px-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <form action={moveCategoryAction} className="flex shrink-0 gap-1">
                        <input type="hidden" name="id" value={category.id} />
                        <button
                          type="submit"
                          name="direction"
                          value="up"
                          disabled={index === 0}
                          aria-label={`Move ${category.name} up`}
                          className="h-7 w-7 rounded-md border border-line text-[11px] text-muted transition-colors hover:bg-canvas disabled:opacity-30"
                        >
                          ↑
                        </button>
                        <button
                          type="submit"
                          name="direction"
                          value="down"
                          disabled={index === categories.length - 1}
                          aria-label={`Move ${category.name} down`}
                          className="h-7 w-7 rounded-md border border-line text-[11px] text-muted transition-colors hover:bg-canvas disabled:opacity-30"
                        >
                          ↓
                        </button>
                      </form>

                      <form
                        action={renameCategoryAction}
                        className="flex min-w-0 flex-1 flex-wrap items-center gap-2"
                      >
                        <input type="hidden" name="id" value={category.id} />
                        <input
                          name="name"
                          defaultValue={category.name}
                          maxLength={40}
                          required
                          className="field min-w-[120px] flex-1 py-1.5"
                          aria-label={`Rename ${category.name}`}
                        />
                        <button type="submit" className="btn btn-ghost shrink-0 px-2.5 py-1 text-[11.5px]">
                          Rename
                        </button>
                      </form>

                      <span className="shrink-0 rounded-full border border-line px-2 py-0.5 text-[10.5px] text-muted">
                        {Number(category.n)} product{Number(category.n) === 1 ? "" : "s"}
                      </span>

                      <form action={deleteCategoryAction} className="shrink-0">
                        <input type="hidden" name="id" value={category.id} />
                        <button
                          type="submit"
                          className="text-[11.5px] text-muted underline-offset-2 hover:text-danger hover:underline"
                        >
                          Delete
                        </button>
                      </form>
                    </div>
                    <p className="mt-1.5 pl-0.5 text-[10.5px] text-muted">/b/{business.slug}#{category.slug}</p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel title="Add a category">
            <form action={createCategoryAction} className="space-y-3">
              <div>
                <label className="label" htmlFor="categoryName">
                  Name
                </label>
                <input
                  id="categoryName"
                  name="name"
                  required
                  minLength={2}
                  maxLength={40}
                  placeholder="Coffee"
                  className="field"
                />
              </div>
              <button type="submit" className="btn btn-brand w-full text-[12.5px]">
                Add category
              </button>
            </form>
          </Panel>

          <Panel title="How it behaves">
            <ul className="space-y-2 text-[12px] leading-relaxed text-muted">
              <li>Renaming keeps every product attached.</li>
              <li>Deleting keeps the products — they move to “No category”.</li>
              <li>Empty categories are hidden from customers automatically.</li>
            </ul>
          </Panel>
        </div>
      </div>
    </div>
  );
}
