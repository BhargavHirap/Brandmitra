import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BrandLink } from "@/components/brand";
import { StorefrontBestSellers } from "@/components/storefront-best-sellers";
import {
  StorefrontCatalogue,
  type CatalogueCategory,
  type CatalogueGroup,
  type CatalogueOption,
  type CatalogueProduct,
} from "@/components/storefront-catalogue";
import { loadCart } from "@/lib/cart";
import { getDb } from "@/lib/db";
import { industryLabel } from "@/lib/industries";
import { sentenceStart, workspaceFor } from "@/lib/workspace";

export const dynamic = "force-dynamic";

/**
 * Public storefront: /b/<slug>
 *
 * This is the only page that reads business data without a login, so it is
 * deliberately narrow: it selects one business by its public slug and only the
 * fields intended for customers. No order, customer, or staff data is exposed.
 */

type StorefrontRow = {
  id: string;
  slug: string;
  name: string;
  industry: string;
  status: string;
  tagline: string | null;
  description: string | null;
  brand_color: string | null;
  template: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  map_url: string | null;
  opening_hours: string | null;
  social_links: string | null;
};

async function loadStorefront(slug: string) {
  const db = await getDb();
  return db.first<StorefrontRow>(
    `SELECT b.id, b.slug, b.name, b.industry, b.status,
            p.tagline, p.description, p.brand_color, p.template, p.phone, p.whatsapp,
            p.email, p.address, p.city, p.map_url, p.opening_hours, p.social_links
       FROM businesses b
       LEFT JOIN business_profiles p ON p.business_id = b.id
      WHERE b.slug = ?`,
    [slug],
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const store = await loadStorefront(slug);
  if (!store) return { title: "Storefront not found" };
  const ws = workspaceFor(store.industry);
  return {
    title: `${store.name}${store.tagline ? ` — ${store.tagline}` : ""}`,
    description:
      store.description ||
      store.tagline ||
      `${sentenceStart(ws.storefrontVerb)} online from ${store.name}.`,
  };
}

function safeSocial(raw: string | null): Record<string, string> {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as Record<string, string>;
  } catch {
    return {};
  }
}

const CART_ERRORS: Record<string, string> = {
  required: "Please choose one option in each required group before adding to the cart.",
  unavailable: "That product or option is unavailable right now. Please pick another.",
};

export default async function StorefrontPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { slug } = await params;
  const { error } = await searchParams;
  const store = await loadStorefront(slug);
  if (!store) notFound();

  const accent = /^#[0-9a-fA-F]{6}$/.test(store.brand_color ?? "") ? store.brand_color! : "#2F6BFF";
  const ws = workspaceFor(store.industry);
  const db = await getDb();
  const [products, categories, groups, options] = await Promise.all([
    db.all<CatalogueProduct>(
      `SELECT id, name, description, price, compare_at_price, image_url, category_id
         FROM products
        WHERE business_id = ? AND is_active = 1 AND is_available = 1
        ORDER BY sort_order ASC, created_at ASC
        LIMIT 60`,
      [store.id],
    ),
    db.all<CatalogueCategory>(
      `SELECT id, name, slug FROM product_categories
        WHERE business_id = ? ORDER BY sort_order ASC, name ASC`,
      [store.id],
    ),
    db.all<CatalogueGroup>(
      `SELECT id, product_id, name, selection_type, is_required, min_select, max_select
         FROM customization_groups
        WHERE business_id = ? ORDER BY sort_order ASC`,
      [store.id],
    ),
    db.all<CatalogueOption>(
      `SELECT id, group_id, name, price_delta, is_default FROM customization_options
        WHERE business_id = ? AND is_available = 1 ORDER BY name ASC`,
      [store.id],
    ),
  ]);

  const categoryNames = new Map(categories.map((category) => [category.id, category.name]));
  const bestSellers = products.map((product) => ({
    ...product,
    category_name: product.category_id ? categoryNames.get(product.category_id) : undefined,
  }));

  const social = safeSocial(store.social_links);
  const socialEntries = Object.entries(social).filter(([, url]) => Boolean(url));
  const whatsappDigits = (store.whatsapp ?? "").replace(/[^\d]/g, "");
  const suspended = store.status === "suspended";
  const typeLabel = industryLabel(store.industry);

  const cart = suspended ? null : await loadCart(store.id);
  const cartError = error ? CART_ERRORS[error] : undefined;

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-line">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5">
          <div className="flex items-center gap-3">
            <span
              className="flex h-9 w-9 items-center justify-center rounded-xl text-[13px] font-semibold text-white"
              style={{ backgroundColor: accent }}
            >
              {store.name.slice(0, 1).toUpperCase()}
            </span>
            <div className="leading-tight">
              <p className="text-[14px] font-semibold tracking-[-0.01em]">{store.name}</p>
              <p className="text-[11px] text-muted">{typeLabel}</p>
            </div>
          </div>
          <nav className="flex items-center gap-3 text-[12.5px] text-muted">
            {store.phone && (
              <a href={`tel:${store.phone}`} className="hidden hover:text-ink sm:block">
                Call
              </a>
            )}
            {!suspended && (
              <Link
                href={`/b/${store.slug}/cart`}
                className="rounded-lg border border-line bg-white px-2.5 py-1.5 font-medium text-ink"
              >
                {ws.cartLabel}
                {cart && cart.itemCount > 0 ? ` (${cart.itemCount})` : ""}
              </Link>
            )}
            {whatsappDigits && !suspended && (
              <a
                href={`https://wa.me/${whatsappDigits}`}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg px-2.5 py-1.5 font-medium text-white"
                style={{ backgroundColor: accent }}
              >
                WhatsApp
              </a>
            )}
            <span className="hidden sm:block">
              <BrandLink href="/" />
            </span>
          </nav>
        </div>
      </header>

      {cartError && (
        <div className="border-b border-warning/20 bg-warning/5">
          <p className="mx-auto max-w-6xl px-5 py-2.5 text-[12.5px] text-warning">{cartError}</p>
        </div>
      )}

      {suspended ? (
        <main className="mx-auto max-w-2xl px-5 py-24 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
            Unavailable
          </p>
          <h1 className="mt-3 text-2xl font-semibold tracking-[-0.02em]">
            This storefront is temporarily offline
          </h1>
          <p className="mx-auto mt-2 max-w-md text-[13.5px] leading-relaxed text-muted">
            {store.name} is not accepting {ws.orders.toLowerCase()} right now. Please contact the
            business directly if you need to reach them.
          </p>
        </main>
      ) : (
        <main>
          <section className="relative overflow-hidden border-b border-line">
            <div
              className="pointer-events-none absolute inset-x-0 top-0 h-[280px] opacity-[0.07]"
              style={{ background: `radial-gradient(circle at 20% 0%, ${accent}, transparent 60%)` }}
            />
            <div className="relative mx-auto max-w-6xl px-5 py-16 sm:py-24">
              <p
                className="text-[11px] font-semibold uppercase tracking-[0.16em]"
                style={{ color: accent }}
              >
                {store.city ? `${store.city} · ` : ""}
                {typeLabel}
              </p>
              <h1 className="mt-3 max-w-3xl text-[34px] font-semibold leading-[1.05] tracking-[-0.03em] sm:text-[52px]">
                {store.tagline || store.name}
              </h1>
              <p className="mt-4 max-w-xl text-[14.5px] leading-relaxed text-muted">
                {store.description ||
                  `${store.name} is now on Vantra. Browse the ${ws.storefrontList.toLowerCase()} and ${ws.storefrontVerb} directly.`}
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-2.5">
                <a
                  href="#catalogue"
                  className="btn text-white"
                  style={{ backgroundColor: accent }}
                >
                  {ws.storefrontBrowseLabel}
                </a>
                {whatsappDigits && (
                  <a
                    href={`https://wa.me/${whatsappDigits}`}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-ghost"
                  >
                    Chat on WhatsApp
                  </a>
                )}
              </div>
            </div>
          </section>

          <StorefrontBestSellers
            products={bestSellers}
            storeName={store.name}
            accent={accent}
            ws={ws}
          />

          <StorefrontCatalogue
            products={products}
            categories={categories}
            groups={groups}
            options={options}
            accent={accent}
            storeName={store.name}
            phone={store.phone}
            slug={store.slug}
            ws={ws}
          />

          <section className="border-t border-line bg-canvas/60">
            <div className="mx-auto grid max-w-6xl gap-8 px-5 py-12 sm:grid-cols-3">
              <div>
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-muted">
                  Visit
                </p>
                <p className="mt-2 text-[13px] leading-relaxed">
                  {[store.address, store.city].filter(Boolean).join(", ") || "Address coming soon"}
                </p>
                {store.map_url && (
                  <a
                    href={store.map_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-block text-[12px] font-semibold hover:underline"
                    style={{ color: accent }}
                  >
                    Get directions →
                  </a>
                )}
              </div>
              <div>
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-muted">
                  Hours
                </p>
                <p className="mt-2 text-[13px] leading-relaxed">
                  {store.opening_hours || "Contact us for opening hours"}
                </p>
              </div>
              <div>
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-muted">
                  Contact
                </p>
                <ul className="mt-2 space-y-1 text-[13px]">
                  {store.phone && (
                    <li>
                      <a href={`tel:${store.phone}`} className="hover:underline">
                        {store.phone}
                      </a>
                    </li>
                  )}
                  {store.email && (
                    <li>
                      <a href={`mailto:${store.email}`} className="hover:underline">
                        {store.email}
                      </a>
                    </li>
                  )}
                  {socialEntries.map(([network, url]) => (
                    <li key={network}>
                      <a
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="capitalize hover:underline"
                      >
                        {network}
                      </a>
                    </li>
                  ))}
                  {!store.phone && !store.email && socialEntries.length === 0 && (
                    <li className="text-muted">Contact details coming soon</li>
                  )}
                </ul>
              </div>
            </div>
          </section>
        </main>
      )}

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-5 py-6 text-[11.5px] text-muted sm:flex-row">
          <p>
            © {new Date().getFullYear()} {store.name}
          </p>
          <p className="flex items-center gap-1.5">
            Powered by
            <Link href="/" className="font-semibold text-ink hover:underline">
              Vantra
            </Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
