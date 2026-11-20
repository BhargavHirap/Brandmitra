import Link from "next/link";
import { notFound } from "next/navigation";
import {
  createGroupAction,
  createOptionAction,
  deleteGroupAction,
  deleteOptionAction,
  deleteProductAction,
  updateGroupAction,
  updateOptionAction,
  updateProductAction,
} from "@/app/actions/products";
import { ProductForm } from "@/components/product-form";
import { AiCopyPanel } from "@/components/ai-copy-panel";
import { PageHeader, Panel } from "@/components/ui";
import { getAiUsage, isAiConfigured } from "@/lib/ai";
import { requireBusiness } from "@/lib/business";
import { getDb } from "@/lib/db";
import { formatMoney } from "@/lib/format";

export const dynamic = "force-dynamic";

type ProductRow = {
  id: string;
  name: string;
  category_id: string | null;
  description: string;
  price: number;
  compare_at_price: number | null;
  image_url: string;
  is_active: number;
  is_available: number;
};

type GroupRow = {
  id: string;
  name: string;
  selection_type: string;
  is_required: number;
  min_select: number;
  max_select: number;
};

type OptionRow = {
  id: string;
  group_id: string;
  name: string;
  price_delta: number;
  is_default: number;
  is_available: number;
};

const ERROR_TEXT: Record<string, string> = {
  name: "Give the product a name of at least 2 characters.",
  category: "That category does not belong to this business.",
  group: "Customisation groups need a name of at least 2 characters.",
  option: "Customisation options need a name.",
  description: "A description needs at least 10 characters.",
};

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { business } = await requireBusiness();
  const db = await getDb();
  const product = await db.first<{ name: string }>(
    "SELECT name FROM products WHERE id = ? AND business_id = ?",
    [id, business.id],
  );
  return { title: product?.name ?? "Product" };
}

export default async function EditProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; created?: string; error?: string; confirm?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const { business, planId } = await requireBusiness();
  const db = await getDb();

  const product = await db.first<ProductRow>(
    `SELECT id, name, category_id, description, price, compare_at_price, image_url,
            is_active, is_available
       FROM products WHERE id = ? AND business_id = ?`,
    [id, business.id],
  );
  if (!product) notFound();

  const [categories, groups, options] = await Promise.all([
    db.all<{ id: string; name: string }>(
      "SELECT id, name FROM product_categories WHERE business_id = ? ORDER BY sort_order ASC, name ASC",
      [business.id],
    ),
    db.all<GroupRow>(
      `SELECT id, name, selection_type, is_required, min_select, max_select
         FROM customization_groups
        WHERE product_id = ? AND business_id = ?
        ORDER BY sort_order ASC`,
      [product.id, business.id],
    ),
    db.all<OptionRow>(
      `SELECT id, group_id, name, price_delta, is_default, is_available
         FROM customization_options
        WHERE business_id = ? AND group_id IN (SELECT id FROM customization_groups WHERE product_id = ? AND business_id = ?)
        ORDER BY is_default DESC, name ASC`,
      [business.id, product.id, business.id],
    ),
  ]);

  const optionsByGroup = new Map<string, OptionRow[]>();
  for (const option of options) {
    const list = optionsByGroup.get(option.group_id) ?? [];
    list.push(option);
    optionsByGroup.set(option.group_id, list);
  }

  const aiUsage = await getAiUsage(db, business.id, planId);

  return (
    <div className="space-y-4 sm:space-y-5">
      <PageHeader
        eyebrow="Catalogue"
        title={product.name}
        description={`${formatMoney(product.price)}${product.is_active === 1 ? " · visible on your storefront" : " · hidden from customers"}`}
        actions={
          <>
            <Link href="/dashboard/products" className="btn btn-ghost text-[12.5px]">
              All products
            </Link>
            <Link
              href={`/b/${business.slug}#catalogue`}
              target="_blank"
              className="btn btn-primary text-[12.5px]"
            >
              View on storefront
            </Link>
          </>
        }
      />

      {query.created === "1" && (
        <div className="rounded-[10px] border border-success/20 bg-success/5 px-3.5 py-2.5 text-[12.5px] text-success">
          Product added. Now add customisation options below if it has sizes or extras.
        </div>
      )}
      {query.saved === "1" && (
        <div className="rounded-[10px] border border-success/20 bg-success/5 px-3.5 py-2.5 text-[12.5px] text-success">
          Saved. Your storefront is updated.
        </div>
      )}
      {query.error && ERROR_TEXT[query.error] && (
        <div className="rounded-[10px] border border-danger/20 bg-danger/5 px-3.5 py-2.5 text-[12.5px] text-danger">
          {ERROR_TEXT[query.error]}
        </div>
      )}

      <AiCopyPanel
        productId={product.id}
        configured={isAiConfigured()}
        credits={{
          used: aiUsage.used,
          limit: aiUsage.limit,
          planName: aiUsage.planName,
          monthLabel: aiUsage.monthLabel,
        }}
      />

      <ProductForm
        action={updateProductAction}
        categories={categories}
        product={product}
        submitLabel="Save product"
        cancelHref="/dashboard/products"
      />

      <div id="options" className="scroll-mt-20 space-y-4">
        <div>
          <h2 className="text-[15px] font-semibold tracking-[-0.01em]">Customisation options</h2>
          <p className="mt-1 max-w-2xl text-[12px] leading-relaxed text-muted">
            Groups like <span className="text-ink">Size</span> or{" "}
            <span className="text-ink">Add-ons</span> appear under this product on the storefront,
            with the extra price for each choice. The base price stays the price you set above.
          </p>
        </div>

        {groups.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line bg-white px-4 py-8 text-center">
            <p className="text-[13px] font-medium">No options yet</p>
            <p className="mx-auto mt-1 max-w-md text-[12px] leading-relaxed text-muted">
              A simple product is fine without options. Add a group only if customers choose
              between sizes, milk, spice level or extras.
            </p>
          </div>
        ) : (
          groups.map((group) => {
            const groupOptions = optionsByGroup.get(group.id) ?? [];
            return (
              <section key={group.id} className="card overflow-hidden">
                <div className="flex flex-wrap items-start justify-between gap-2 border-b border-line px-4 py-3">
                  <div className="min-w-0">
                    <h3 className="text-[13px] font-semibold">{group.name}</h3>
                    <p className="mt-0.5 text-[11px] text-muted">
                      {group.selection_type === "single"
                        ? "Customer picks one"
                        : `Customer picks up to ${group.max_select}`}
                      {group.is_required === 1 ? " · required" : " · optional"}
                    </p>
                  </div>
                  <span className="rounded-full border border-line px-2 py-0.5 text-[10.5px] text-muted">
                    {groupOptions.length} option{groupOptions.length === 1 ? "" : "s"}
                  </span>
                </div>

                {groupOptions.length > 0 && (
                  <ul className="divide-y divide-line">
                    {groupOptions.map((option) => (
                      <li key={option.id} className="px-4 py-2.5">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                            <span className="truncate text-[12.5px] font-medium">{option.name}</span>
                            {option.is_default === 1 && (
                              <span className="rounded border border-brand/25 bg-brand-soft px-1.5 py-px text-[9.5px] font-medium uppercase tracking-wide text-brand">
                                Default
                              </span>
                            )}
                            {option.is_available === 0 && (
                              <span className="rounded border border-line px-1.5 py-px text-[9.5px] uppercase tracking-wide text-muted">
                                Unavailable
                              </span>
                            )}
                          </div>
                          <span className="shrink-0 text-[12px] tabular-nums text-muted">
                            {option.price_delta > 0 ? `+ ${formatMoney(option.price_delta)}` : "No extra"}
                          </span>
                        </div>

                        <div className="mt-1.5 flex flex-wrap items-center gap-3">
                          <details className="min-w-0">
                            <summary className="cursor-pointer text-[11.5px] font-medium text-brand">
                              Edit option
                            </summary>
                            <form action={updateOptionAction} className="mt-2 space-y-2">
                              <input type="hidden" name="id" value={option.id} />
                              <div className="grid gap-2 sm:grid-cols-2">
                                <input
                                  name="name"
                                  defaultValue={option.name}
                                  maxLength={40}
                                  required
                                  className="field"
                                  aria-label="Option name"
                                />
                                <input
                                  name="priceDelta"
                                  type="number"
                                  inputMode="numeric"
                                  min={0}
                                  step={1}
                                  defaultValue={option.price_delta}
                                  className="field"
                                  aria-label="Extra price in rupees"
                                />
                              </div>
                              <div className="flex flex-wrap gap-4 text-[11.5px]">
                                <label className="flex items-center gap-1.5">
                                  <input
                                    type="checkbox"
                                    name="isDefault"
                                    defaultChecked={option.is_default === 1}
                                    className="h-3.5 w-3.5 accent-[#2f6bff]"
                                  />
                                  Default choice
                                </label>
                                <label className="flex items-center gap-1.5">
                                  <input
                                    type="checkbox"
                                    name="isAvailable"
                                    defaultChecked={option.is_available === 1}
                                    className="h-3.5 w-3.5 accent-[#2f6bff]"
                                  />
                                  Available
                                </label>
                              </div>
                              <button type="submit" className="btn btn-primary px-3 py-1.5 text-[12px]">
                                Save option
                              </button>
                            </form>
                          </details>
                          <form action={deleteOptionAction}>
                            <input type="hidden" name="id" value={option.id} />
                            <button
                              type="submit"
                              className="text-[11.5px] text-muted underline-offset-2 hover:text-danger hover:underline"
                            >
                              Delete
                            </button>
                          </form>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}

                <form
                  action={createOptionAction}
                  className="flex flex-wrap items-end gap-2 border-t border-line bg-canvas/40 px-4 py-3"
                >
                  <input type="hidden" name="groupId" value={group.id} />
                  <div className="min-w-[140px] flex-1">
                    <label className="label" htmlFor={`option-name-${group.id}`}>
                      New option
                    </label>
                    <input
                      id={`option-name-${group.id}`}
                      name="name"
                      required
                      maxLength={40}
                      placeholder="Large"
                      className="field"
                    />
                  </div>
                  <div className="w-[110px]">
                    <label className="label" htmlFor={`option-price-${group.id}`}>
                      Extra (₹)
                    </label>
                    <input
                      id={`option-price-${group.id}`}
                      name="priceDelta"
                      type="number"
                      inputMode="numeric"
                      min={0}
                      step={1}
                      defaultValue={0}
                      className="field"
                    />
                  </div>
                  <label className="flex items-center gap-1.5 pb-2.5 text-[11.5px]">
                    <input
                      type="checkbox"
                      name="isDefault"
                      className="h-3.5 w-3.5 accent-[#2f6bff]"
                    />
                    Default
                  </label>
                  <button type="submit" className="btn btn-ghost px-3 py-2 text-[12px]">
                    Add option
                  </button>
                </form>

                <details className="border-t border-line px-4 py-2.5">
                  <summary className="cursor-pointer text-[11.5px] font-medium text-muted">
                    Group settings
                  </summary>
                  <form action={updateGroupAction} className="mt-2 space-y-2">
                    <input type="hidden" name="id" value={group.id} />
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div>
                        <label className="label" htmlFor={`group-name-${group.id}`}>
                          Group name
                        </label>
                        <input
                          id={`group-name-${group.id}`}
                          name="name"
                          defaultValue={group.name}
                          maxLength={50}
                          required
                          className="field"
                        />
                      </div>
                      <div>
                        <label className="label" htmlFor={`group-type-${group.id}`}>
                          Selection
                        </label>
                        <select
                          id={`group-type-${group.id}`}
                          name="selectionType"
                          defaultValue={group.selection_type}
                          className="field"
                        >
                          <option value="single">Pick one</option>
                          <option value="multi">Pick multiple</option>
                        </select>
                      </div>
                      <div>
                        <label className="label" htmlFor={`group-min-${group.id}`}>
                          Minimum picks
                        </label>
                        <input
                          id={`group-min-${group.id}`}
                          name="minSelect"
                          type="number"
                          min={0}
                          max={20}
                          defaultValue={group.min_select}
                          className="field"
                        />
                      </div>
                      <div>
                        <label className="label" htmlFor={`group-max-${group.id}`}>
                          Maximum picks
                        </label>
                        <input
                          id={`group-max-${group.id}`}
                          name="maxSelect"
                          type="number"
                          min={1}
                          max={20}
                          defaultValue={group.max_select}
                          className="field"
                        />
                      </div>
                    </div>
                    <label className="flex items-center gap-1.5 text-[11.5px]">
                      <input
                        type="checkbox"
                        name="isRequired"
                        defaultChecked={group.is_required === 1}
                        className="h-3.5 w-3.5 accent-[#2f6bff]"
                      />
                      Customer must choose
                    </label>
                    <p className="text-[10.5px] text-muted">
                      Minimum and maximum only apply to “Pick multiple” groups.
                    </p>
                    <button type="submit" className="btn btn-primary px-3 py-1.5 text-[12px]">
                      Save group
                    </button>
                  </form>
                  <form action={deleteGroupAction} className="mt-2">
                    <input type="hidden" name="id" value={group.id} />
                    <button
                      type="submit"
                      className="text-[11.5px] text-muted underline-offset-2 hover:text-danger hover:underline"
                    >
                      Delete this group and its options
                    </button>
                  </form>
                </details>
              </section>
            );
          })
        )}

        <Panel title="Add a customisation group">
          <form action={createGroupAction} className="space-y-3">
            <input type="hidden" name="productId" value={product.id} />
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="sm:col-span-1">
                <label className="label" htmlFor="newGroupName">
                  Group name
                </label>
                <input
                  id="newGroupName"
                  name="name"
                  required
                  minLength={2}
                  maxLength={50}
                  placeholder="Size"
                  className="field"
                />
              </div>
              <div>
                <label className="label" htmlFor="newGroupType">
                  Selection
                </label>
                <select id="newGroupType" name="selectionType" className="field" defaultValue="single">
                  <option value="single">Pick one</option>
                  <option value="multi">Pick multiple</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="label" htmlFor="newGroupMin">
                    Min picks
                  </label>
                  <input
                    id="newGroupMin"
                    name="minSelect"
                    type="number"
                    min={0}
                    max={20}
                    defaultValue={0}
                    className="field"
                  />
                </div>
                <div>
                  <label className="label" htmlFor="newGroupMax">
                    Max picks
                  </label>
                  <input
                    id="newGroupMax"
                    name="maxSelect"
                    type="number"
                    min={1}
                    max={20}
                    defaultValue={1}
                    className="field"
                  />
                </div>
              </div>
            </div>
            <label className="flex items-center gap-1.5 text-[11.5px]">
              <input type="checkbox" name="isRequired" className="h-3.5 w-3.5 accent-[#2f6bff]" />
              Customer must choose from this group
            </label>
            <button type="submit" className="btn btn-brand text-[12.5px]">
              Add group
            </button>
          </form>
        </Panel>
      </div>

      <Panel title="Danger zone" description="Deleting a product also removes its options">
        {query.confirm === "delete" ? (
          <div className="space-y-3">
            <p className="text-[12.5px] leading-relaxed">
              Delete <span className="font-semibold">{product.name}</span> permanently? This cannot
              be undone. Past order lines keep their own recorded name and price, so your sales
              history stays correct.
            </p>
            <div className="flex flex-wrap gap-2">
              <form action={deleteProductAction}>
                <input type="hidden" name="id" value={product.id} />
                <button type="submit" className="btn text-[12.5px] text-white" style={{ backgroundColor: "#d92d20" }}>
                  Yes, delete permanently
                </button>
              </form>
              <Link href={`/dashboard/products/${product.id}`} className="btn btn-ghost text-[12.5px]">
                Keep product
              </Link>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-md text-[12px] leading-relaxed text-muted">
              To hide an item for a day, untick “Visible on the storefront” above instead — it is
              reversible.
            </p>
            <Link
              href={`/dashboard/products/${product.id}?confirm=delete`}
              className="btn btn-ghost text-[12.5px] text-danger"
            >
              Delete product
            </Link>
          </div>
        )}
      </Panel>
    </div>
  );
}
