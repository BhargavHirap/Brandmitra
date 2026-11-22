import Link from "next/link";
import { createProductAction } from "@/app/actions/products";
import { ProductForm } from "@/components/product-form";
import { PageHeader } from "@/components/ui";
import { productLimitLabel, requireBusiness } from "@/lib/business";
import { getDb } from "@/lib/db";
import { workspaceFor } from "@/lib/workspace";

export const dynamic = "force-dynamic";
export const metadata = { title: "New item" };

const ERROR_TEXT: Record<string, string> = {
  name: "Give the product a name of at least 2 characters.",
  category: "That category does not belong to this business.",
  limit: "Your plan's product limit is reached. Delete an item or upgrade to add more.",
};

export default async function NewProductPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { business, planId } = await requireBusiness();
  const ws = workspaceFor(business.industry);
  const { error } = await searchParams;
  const db = await getDb();

  const [categories, totalRow, plan] = await Promise.all([
    db.all<{ id: string; name: string }>(
      "SELECT id, name FROM product_categories WHERE business_id = ? ORDER BY sort_order ASC, name ASC",
      [business.id],
    ),
    db.first<{ n: number }>("SELECT COUNT(*) AS n FROM products WHERE business_id = ?", [
      business.id,
    ]),
    db.first<{ product_limit: number; name: string }>(
      "SELECT product_limit, name FROM plans WHERE id = ?",
      [planId],
    ),
  ]);

  const total = Number(totalRow?.n ?? 0);
  const limit = Number(plan?.product_limit ?? 10);
  const atLimit = total >= limit;

  if (atLimit) {
    return (
      <div className="space-y-4">
        <PageHeader eyebrow="Catalogue" title="New product" />
        <div className="card p-5">
          <p className="text-[13.5px] font-semibold">You have reached your plan limit</p>
          <p className="mt-1.5 max-w-xl text-[12.5px] leading-relaxed text-muted">
            The {plan?.name ?? "Free"} plan allows {limit} {ws.itemsLower} and you already have{" "}
            {total}. Delete one you no longer sell, or upgrade when billing arrives in Phase 7.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/dashboard/products" className="btn btn-primary text-[12.5px]">
              Back to {ws.items}
            </Link>
            <Link href="/dashboard/products?error=limit" className="btn btn-ghost text-[12.5px]">
              Manage existing items
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Catalogue"
        title={`New ${ws.item}`}
        description={`${total} of ${productLimitLabel(limit)} ${ws.itemsLower} used on the ${plan?.name ?? "Free"} plan. Everything except the name is optional.`}
      />

      {error && ERROR_TEXT[error] && (
        <div className="rounded-[10px] border border-danger/20 bg-danger/5 px-3.5 py-2.5 text-[12.5px] text-danger">
          {ERROR_TEXT[error]}
        </div>
      )}

      <ProductForm
        action={createProductAction}
        categories={categories}
        submitLabel="Add product"
        cancelHref="/dashboard/products"
      />
    </div>
  );
}
