import { addToCartAction } from "@/app/actions/cart";
import { formatMoney } from "@/lib/format";
import type { Workspace } from "@/lib/workspace";

/**
 * Public catalogue.
 *
 * Server-rendered: no JavaScript is needed to read the menu or its options, so
 * the page opens instantly on a slow phone. Cart and checkout (Phase 3) will
 * add the interactive layer on top of exactly this data.
 */

export type CatalogueProduct = {
  id: string;
  name: string;
  description: string;
  price: number;
  compare_at_price: number | null;
  image_url: string;
  category_id: string | null;
};

export type CatalogueCategory = { id: string; name: string; slug: string };

export type CatalogueGroup = {
  id: string;
  product_id: string;
  name: string;
  selection_type: string;
  is_required: number;
  min_select: number;
  max_select: number;
};

export type CatalogueOption = {
  id: string;
  group_id: string;
  name: string;
  price_delta: number;
  is_default: number;
};

type ProductWithOptions = CatalogueProduct & {
  groups: (CatalogueGroup & { options: CatalogueOption[] })[];
};

export function StorefrontCatalogue({
  products,
  categories,
  groups,
  options,
  accent,
  storeName,
  phone,
  slug,
  ws,
}: {
  products: CatalogueProduct[];
  categories: CatalogueCategory[];
  groups: CatalogueGroup[];
  options: CatalogueOption[];
  accent: string;
  storeName: string;
  phone: string | null;
  slug: string;
  ws: Workspace;
}) {
  const optionsByGroup = new Map<string, CatalogueOption[]>();
  for (const option of options) {
    const list = optionsByGroup.get(option.group_id) ?? [];
    list.push(option);
    optionsByGroup.set(option.group_id, list);
  }

  const groupsByProduct = new Map<string, (CatalogueGroup & { options: CatalogueOption[] })[]>();
  for (const group of groups) {
    const groupOptions = optionsByGroup.get(group.id) ?? [];
    if (groupOptions.length === 0) continue; // an empty group would confuse customers
    const list = groupsByProduct.get(group.product_id) ?? [];
    list.push({ ...group, options: groupOptions });
    groupsByProduct.set(group.product_id, list);
  }

  const enriched: ProductWithOptions[] = products.map((product) => ({
    ...product,
    groups: groupsByProduct.get(product.id) ?? [],
  }));

  const sections = categories
    .map((category) => ({
      id: category.id,
      name: category.name,
      slug: category.slug,
      items: enriched.filter((product) => product.category_id === category.id),
    }))
    .filter((section) => section.items.length > 0);

  const uncategorised = enriched.filter((product) => {
    if (!product.category_id) return true;
    return !categories.some((category) => category.id === product.category_id);
  });
  if (uncategorised.length > 0) {
    sections.push({
      id: "more",
      name: sections.length > 0 ? "More from " + storeName : "More",
      slug: "more",
      items: uncategorised,
    });
  }

  return (
    <section id="catalogue" className="mx-auto max-w-6xl scroll-mt-16 px-5 py-12 sm:py-16">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-[19px] font-semibold tracking-[-0.02em]">{ws.items}</h2>
          <p className="mt-1 text-[12.5px] text-muted">
            {products.length > 0
              ? `${products.length} ${products.length === 1 ? ws.item : ws.itemsLower} available`
              : `${ws.items} are being added`}
          </p>
        </div>
      </div>

      {products.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-line px-5 py-14 text-center">
          <p className="text-[13.5px] font-medium">{ws.items} coming soon</p>
          <p className="mx-auto mt-1 max-w-md text-[12.5px] leading-relaxed text-muted">
            {storeName} has not published {ws.itemsLower} yet. Call or message them to {ws.storefrontVerb}{
              " "
            }
            in the meantime.
          </p>
          {phone && (
            <a href={`tel:${phone}`} className="btn btn-ghost mt-4">
              Call {phone}
            </a>
          )}
        </div>
      ) : (
        <>
          {sections.length > 1 && (
            <nav
              aria-label={ws.categories}
              className="mt-5 flex gap-1.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none]"
            >
              {sections.map((section) => (
                <a
                  key={section.id}
                  href={`#cat-${section.slug}`}
                  className="shrink-0 rounded-full border border-line bg-white px-3 py-1.5 text-[12px] font-medium text-muted transition-colors hover:border-ink hover:text-ink"
                >
                  {section.name}
                </a>
              ))}
            </nav>
          )}

          <div className="mt-6 space-y-10">
            {sections.map((section) => (
              <div key={section.id} id={`cat-${section.slug}`} className="scroll-mt-20">
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="text-[15px] font-semibold tracking-[-0.01em]">{section.name}</h3>
                  <span className="text-[11px] text-muted">
                    {section.items.length} {section.items.length === 1 ? ws.item : ws.itemsLower}
                  </span>
                </div>
                <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {section.items.map((product) => (
                    <li
                      key={product.id}
                      className="group flex flex-col overflow-hidden rounded-xl border border-line bg-white transition-shadow hover:shadow-[0_8px_28px_-16px_rgba(11,11,15,0.28)]"
                    >
                      {product.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={product.image_url}
                          alt={product.name}
                          loading="lazy"
                          className="h-40 w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                        />
                      ) : (
                        <div
                          className="flex h-40 items-center justify-center text-[11px] font-medium uppercase tracking-[0.14em] text-muted"
                          style={{ backgroundColor: `${accent}0F` }}
                        >
                          {storeName}
                        </div>
                      )}

                      <div className="flex flex-1 flex-col p-4">
                        <p className="text-[13.5px] font-semibold leading-tight">{product.name}</p>
                        {product.description && (
                          <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-muted">
                            {product.description}
                          </p>
                        )}

                        <div className="mt-auto pt-3">
                          <div className="flex items-baseline gap-2">
                            <span className="text-[14px] font-semibold">
                              {product.groups.length > 0 ? "from " : ""}
                              {formatMoney(product.price)}
                            </span>
                            {product.compare_at_price ? (
                              <span className="text-[11.5px] text-muted line-through">
                                {formatMoney(product.compare_at_price)}
                              </span>
                            ) : null}
                          </div>

                          <form action={addToCartAction} className="mt-2.5 border-t border-line pt-2.5">
                            <input type="hidden" name="slug" value={slug} />
                            <input type="hidden" name="productId" value={product.id} />

                            {product.groups.length > 0 && (
                              <div className="space-y-2.5">
                                {product.groups.map((group) => (
                                  <fieldset key={group.id}>
                                    <legend className="text-[11px] font-semibold">
                                      {group.name}
                                      <span className="ml-1 font-normal text-muted">
                                        {group.selection_type === "single"
                                          ? group.is_required === 1
                                            ? "· choose one"
                                            : "· optional"
                                          : `· choose up to ${group.max_select}`}
                                      </span>
                                    </legend>
                                    <div className="mt-1 space-y-0.5">
                                      {group.options.map((option, index) => (
                                        <label
                                          key={option.id}
                                          className="flex items-baseline justify-between gap-2 text-[11.5px] text-muted"
                                        >
                                          <span className="flex items-baseline gap-1.5">
                                            <input
                                              type={
                                                group.selection_type === "single"
                                                  ? "radio"
                                                  : "checkbox"
                                              }
                                              name={`group_${group.id}`}
                                              value={option.id}
                                              required={
                                                group.selection_type === "single" &&
                                                group.is_required === 1 &&
                                                index === 0
                                              }
                                              defaultChecked={
                                                group.selection_type === "single" &&
                                                option.is_default === 1
                                              }
                                              className="h-3.5 w-3.5 accent-[#2f6bff]"
                                            />
                                            {option.name}
                                          </span>
                                          <span className="shrink-0 tabular-nums">
                                            {option.price_delta > 0
                                              ? `+ ${formatMoney(option.price_delta)}`
                                              : "no extra"}
                                          </span>
                                        </label>
                                      ))}
                                    </div>
                                  </fieldset>
                                ))}
                              </div>
                            )}

                            <div className="mt-2.5 flex items-center gap-2">
                              <input
                                name="quantity"
                                type="number"
                                inputMode="numeric"
                                min={1}
                                max={20}
                                defaultValue={1}
                                aria-label={`Quantity of ${product.name}`}
                                className="field w-16 px-2 py-1.5 text-center text-[12px]"
                              />
                              <button
                                type="submit"
                                className="btn flex-1 px-3 py-1.5 text-[12px] text-white"
                                style={{ backgroundColor: accent }}
                              >
                                {ws.addAction}
                              </button>
                            </div>
                          </form>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
