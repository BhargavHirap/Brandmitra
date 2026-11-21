import Link from "next/link";
import { MenuImport } from "@/components/menu-import";
import { PageHeader, Panel } from "@/components/ui";
import { MENU_MAX_ITEMS, getAiUsage, isAiConfigured } from "@/lib/ai";
import { productLimitLabel, requireBusiness } from "@/lib/business";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Import a menu" };

const ERROR_TEXT: Record<string, string> = {
  rows: "Those rows could not be read. Read the photo again and re-check the list.",
  empty: "Nothing was imported — every item needs a name and a price above zero.",
  limit: "Your plan's product limit is reached. Delete an item, or upgrade when billing arrives.",
};

export default async function ImportMenuPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { business, planId } = await requireBusiness();
  const { error } = await searchParams;
  const db = await getDb();

  const [categoryRows, totalRow, plan, credits] = await Promise.all([
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
    getAiUsage(db, business.id, planId),
  ]);

  // Plain copies, not database rows: a client component cannot receive objects
  // with a null prototype (the local node:sqlite driver returns those).
  const categories = categoryRows.map((category) => ({
    id: String(category.id),
    name: String(category.name),
  }));

  const total = Number(totalRow?.n ?? 0);
  const limit = Number(plan?.product_limit ?? 10);
  // One photo can only produce MENU_MAX_ITEMS rows, so that is the largest
  // number worth showing even when the plan itself has no product cap.
  const remainingSlots = Math.max(0, Math.min(limit - total, MENU_MAX_ITEMS));

  return (
    <div className="space-y-4 sm:space-y-5">
      <PageHeader
        eyebrow="Catalogue"
        title="Import a menu photo"
        description="Photograph your printed menu and Vantra drafts the items, prices and categories for you. You check the list before anything appears on your storefront."
        actions={
          <Link href="/dashboard/products" className="btn btn-ghost text-[12.5px]">
            Back to products
          </Link>
        }
      />

      {error && ERROR_TEXT[error] && (
        <div className="rounded-[10px] border border-danger/20 bg-danger/5 px-3.5 py-2.5 text-[12.5px] text-danger">
          {ERROR_TEXT[error]}
        </div>
      )}

      <MenuImport
        configured={isAiConfigured()}
        credits={credits}
        categories={categories}
        remainingSlots={remainingSlots}
        planName={plan?.name ?? "Free"}
      />

      <Panel title="How the import behaves">
        <ul className="space-y-2 text-[12px] leading-relaxed text-muted">
          <li>
            One credit per photo, not per item. The plan you are on is {plan?.name ?? "Free"}, with{" "}
            {credits.limit} credits a month and room for {remainingSlots} more products on the{" "}
            {productLimitLabel(limit) === "Unlimited" ? "unlimited" : productLimitLabel(limit)}{" "}
            plan.
          </li>
          <li>
            Names are copied from the photo. Regional dish names are kept; prices are whole rupees
            with no decimals, the same rule as the product form.
          </li>
          <li>
            A category is created only when it does not exist yet, so items photographed under
            “Starters” join the Starters tab you already have.
          </li>
          <li>
            Every row is editable — including removing it — and an item with no readable price is
            never imported with an invented one.
          </li>
          <li>
            Items arrive visible and in stock, with no description or photo. Open each one afterwards
            to add those, or let “Write with AI” draft the description.
          </li>
        </ul>
      </Panel>
    </div>
  );
}
