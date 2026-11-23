import ClothingRailHero, { type RailGarment } from "@/components/ui/product-rail-gallery";
import { formatMoney } from "@/lib/format";
import type { Workspace } from "@/lib/workspace";

/**
 * BEST SELLERS — the first few photographed items in a business's catalogue,
 * shown on the same rail used across the product instead of another card grid.
 *
 * Salons and clinics get "Most booked" copy; shops get "Best sellers". Products
 * without a photo are skipped (the rail depends on cut-out images), and the
 * section removes itself entirely until at least three are ready, so a brand-new
 * catalogue simply opens on the full list.
 */

export type BestSellerProduct = {
  id: string;
  name: string;
  description: string;
  price: number;
  image_url: string;
  category_name?: string;
};

export function StorefrontBestSellers({
  products,
  storeName,
  accent,
  ws,
}: {
  products: BestSellerProduct[];
  storeName: string;
  accent: string;
  ws: Workspace;
}) {
  const photographed = products.filter((product) => product.image_url.trim().length > 0).slice(0, 8);
  if (photographed.length < 3) return null;

  const booked = ["book", "enrol", "join", "subscribe"].includes(ws.storefrontVerb);

  const items: RailGarment[] = photographed.map((product) => ({
    id: product.id,
    name: product.name,
    description: product.description || undefined,
    image: product.image_url,
    tag: formatMoney(product.price),
    details: product.category_name ? [product.category_name] : undefined,
  }));

  return (
    <section className="border-b border-line bg-background" style={{ overflowX: "clip" }}>
      <div className="mx-auto max-w-6xl px-5 pt-10 sm:pt-14">
        <ClothingRailHero
          items={items}
          hanger="none"
          eyebrow={booked ? "Most booked" : "Best sellers"}
          heading={booked ? `The ${ws.itemsLower} people keep coming back for.` : `What ${storeName}'s customers keep buying.`}
          caption={`A few favourites from ${storeName}. Turn one to the front, or lift it to look closer.`}
          action={
            <a
              href="#catalogue"
              className="rounded-full px-5 py-2.5 text-sm font-medium text-white outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
              style={{ backgroundColor: accent }}
            >
              See all {ws.itemsLower}
            </a>
          }
        />
      </div>
    </section>
  );
}
