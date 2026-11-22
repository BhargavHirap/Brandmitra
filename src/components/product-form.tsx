import Link from "next/link";

/**
 * Shared product create/edit form.
 *
 * A plain HTML form posting to a server action: no client JavaScript needed,
 * which keeps it fast on a phone and impossible to bypass validation (every
 * rule is re-checked in src/app/actions/products.ts).
 */

export type ProductFormValues = {
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

export function ProductForm({
  action,
  categories,
  product,
  submitLabel,
  cancelHref,
}: {
  action: (formData: FormData) => Promise<void>;
  categories: { id: string; name: string }[];
  product?: ProductFormValues;
  submitLabel: string;
  cancelHref: string;
}) {
  return (
    <form action={action} className="card p-4">
      {product && <input type="hidden" name="id" value={product.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label" htmlFor="productName">
            Product name
          </label>
          <input
            id="productName"
            name="name"
            required
            minLength={2}
            maxLength={90}
            defaultValue={product?.name ?? ""}
            placeholder="Cappuccino"
            className="field"
          />
        </div>

        <div>
          <label className="label" htmlFor="productPrice">
            Price (₹)
          </label>
          <input
            id="productPrice"
            name="price"
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            required
            defaultValue={product?.price ?? ""}
            placeholder="180"
            className="field"
          />
          <p className="mt-1.5 text-[11px] text-muted">Whole rupees, no decimals.</p>
        </div>

        <div>
          <label className="label" htmlFor="productCompareAt">
            Compare-at price (₹)
          </label>
          <input
            id="productCompareAt"
            name="compareAtPrice"
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            defaultValue={product?.compare_at_price ?? ""}
            placeholder="Optional — shows as a struck-through price"
            className="field"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="label" htmlFor="productCategory">
            Category
          </label>
          <select
            id="productCategory"
            name="categoryId"
            defaultValue={product?.category_id ?? ""}
            className="field"
          >
            <option value="">Uncategorised</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-[11px] text-muted">
            Categories are the tabs on your storefront.{" "}
            <Link href="/dashboard/categories" className="font-medium text-brand hover:underline">
              Manage categories
            </Link>
          </p>
        </div>

        <div className="sm:col-span-2">
          <label className="label" htmlFor="productDescription">
            Description
          </label>
          <textarea
            id="productDescription"
            name="description"
            rows={4}
            maxLength={600}
            defaultValue={product?.description ?? ""}
            placeholder="Double shot espresso with steamed milk and a fine foam."
            className="field resize-y"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="label" htmlFor="productImage">
            Image URL
          </label>
          <input
            id="productImage"
            name="imageUrl"
            type="url"
            maxLength={500}
            defaultValue={product?.image_url ?? ""}
            placeholder="https://images.example.com/cappuccino.jpg"
            className="field"
          />
          <p className="mt-1.5 text-[11px] text-muted">
            Paste a public https image link. Direct uploads need storage, which arrives with the
            paid plans.
          </p>
        </div>

        <div className="sm:col-span-2 flex flex-col gap-2 rounded-xl border border-line bg-canvas/50 p-3">
          <label className="flex items-start gap-2.5 text-[12.5px]">
            <input
              type="checkbox"
              name="isActive"
              defaultChecked={product ? product.is_active === 1 : true}
              className="mt-0.5 h-4 w-4 accent-[#2f6bff]"
            />
            <span>
              <span className="font-medium">Visible on the storefront</span>
              <span className="block text-[11px] text-muted">
                Unchecked items stay saved in your dashboard but disappear from the public page.
              </span>
            </span>
          </label>
          <label className="flex items-start gap-2.5 text-[12.5px]">
            <input
              type="checkbox"
              name="isAvailable"
              defaultChecked={product ? product.is_available === 1 : true}
              className="mt-0.5 h-4 w-4 accent-[#2f6bff]"
            />
            <span>
              <span className="font-medium">In stock right now</span>
              <span className="block text-[11px] text-muted">
                Use this for sold-out items — they are hidden from customers without deleting them.
              </span>
            </span>
          </label>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-line pt-3.5">
        <Link href={cancelHref} className="btn btn-ghost text-[12.5px]">
          Cancel
        </Link>
        <button type="submit" className="btn btn-brand text-[12.5px]">
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
