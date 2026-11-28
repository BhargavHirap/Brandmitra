import { getDb } from "@/lib/db";

/**
 * THE DEMO SHOP.
 *
 * The landing page offers visitors a storefront they can actually order from,
 * with no account: /demo opens a real café built from the same tables every
 * paying business uses. Nothing is faked — the catalogue, the cart, the stock
 * check, the order row and the receipt link are the production code paths, so
 * what a visitor tries is exactly what they get after signing up.
 *
 * The rows are written on the first visit rather than in SEED_SQL, because the
 * schema (and its seed) only runs once per database: on the deployment that is
 * already live, adding lines to the seed would never reach it. Creating them on
 * demand works the same way locally and in production, and every insert is
 * idempotent so ten visitors at once still make one shop.
 *
 * The shop is owned by an account nobody can sign in to (the password hash is
 * not a hash), so it never appears in a real dashboard and cannot be edited by
 * anyone through the app. Orders placed here simply accumulate on that row.
 */

export const DEMO_SLUG = "demo";
export const DEMO_BUSINESS_ID = "demo-store";
export const DEMO_OWNER_ID = "demo-store-owner";

const DEMO_EMAIL = "demo-owner@vantra.invalid";

/** True for the business rows that make up the public demo shop. */
export function isDemoBusiness(ownerUserId: string | null | undefined): boolean {
  return ownerUserId === DEMO_OWNER_ID;
}

type SeedProduct = {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  categoryId: string;
  sort: number;
  /** A photo in /public, so the storefront's best-seller rail has something to show. */
  image: string;
};

const CATEGORIES = [
  { id: "demo-cat-drinks", name: "Chai & coffee", slug: "chai-coffee", sort: 1 },
  { id: "demo-cat-food", name: "Something to eat", slug: "something-to-eat", sort: 2 },
  { id: "demo-cat-sweet", name: "Sweet things", slug: "sweet-things", sort: 3 },
];

const PRODUCTS: SeedProduct[] = [
  {
    id: "demo-product-chai",
    name: "Masala chai",
    slug: "masala-chai",
    description: "Assam leaf simmered with ginger, cardamom and a lot of milk.",
    price: 60,
    categoryId: "demo-cat-drinks",
    sort: 1,
    image: "/demo/masala-chai.jpg",
  },
  {
    id: "demo-product-filter-coffee",
    name: "Filter coffee",
    slug: "filter-coffee",
    description: "Fresh-ground beans, strong and served in a steel tumbler.",
    price: 80,
    categoryId: "demo-cat-drinks",
    sort: 2,
    image: "/demo/filter-coffee.jpg",
  },
  {
    id: "demo-product-cold-coffee",
    name: "Cold coffee",
    slug: "cold-coffee",
    description: "Blended with ice cream, no sugar syrup anywhere near it.",
    price: 160,
    categoryId: "demo-cat-drinks",
    sort: 3,
    image: "/demo/cold-coffee.jpg",
  },
  {
    id: "demo-product-sandwich",
    name: "Paneer tikka sandwich",
    slug: "paneer-tikka-sandwich",
    description: "Grilled on sourdough with mint chutney and quick-pickled onion.",
    price: 180,
    categoryId: "demo-cat-food",
    sort: 1,
    image: "/demo/paneer-tikka-sandwich.jpg",
  },
  {
    id: "demo-product-garlic-bread",
    name: "Cheese garlic bread",
    slug: "cheese-garlic-bread",
    description: "Four slices, a lot of garlic butter, more cheese than is sensible.",
    price: 150,
    categoryId: "demo-cat-food",
    sort: 2,
    image: "/demo/cheese-garlic-bread.jpg",
  },
  {
    id: "demo-product-brownie",
    name: "Chocolate brownie",
    slug: "chocolate-brownie",
    description: "Dark chocolate, baked slightly under so the middle stays soft.",
    price: 120,
    categoryId: "demo-cat-sweet",
    sort: 1,
    image: "/demo/chocolate-brownie.jpg",
  },
];

/** The two choices the chai shows off: one required, one optional. */
const GROUPS = [
  {
    id: "demo-group-size",
    productId: "demo-product-chai",
    name: "Size",
    required: 1,
    sort: 1,
  },
  {
    id: "demo-group-sugar",
    productId: "demo-product-chai",
    name: "Sugar",
    required: 0,
    sort: 2,
  },
];

const OPTIONS = [
  { id: "demo-opt-small", groupId: "demo-group-size", name: "Small", delta: 0, isDefault: 1 },
  { id: "demo-opt-large", groupId: "demo-group-size", name: "Large", delta: 30, isDefault: 0 },
  { id: "demo-opt-sugar-normal", groupId: "demo-group-sugar", name: "Normal", delta: 0, isDefault: 1 },
  { id: "demo-opt-sugar-less", groupId: "demo-group-sugar", name: "Less", delta: 0, isDefault: 0 },
  { id: "demo-opt-sugar-none", groupId: "demo-group-sugar", name: "None", delta: 0, isDefault: 0 },
];

let pending: Promise<void> | null = null;

/**
 * Makes sure the demo shop exists, once per isolate.
 *
 * A visit that finds the shop already there costs one indexed read and nothing
 * else. If the write fails the promise is dropped, so the next visit tries again
 * instead of serving an error until the worker is recycled.
 */
export function ensureDemoStore(): Promise<void> {
  if (!pending) {
    pending = seedDemoStore().catch((error) => {
      pending = null;
      throw error;
    });
  }
  return pending;
}

async function seedDemoStore(): Promise<void> {
  const db = await getDb();

  const existing = await db.first<{ id: string }>(
    "SELECT id FROM businesses WHERE id = ? OR slug = ?",
    [DEMO_BUSINESS_ID, DEMO_SLUG],
  );
  if (existing) {
    // A demo shop seeded before the photos existed would never see them: the
    // seed only ever runs on an empty database. Fill in any blank picture so the
    // shop that is already live gains the rail too, without overwriting an
    // image somebody has since set.
    await db.batch(
      PRODUCTS.map((product) => ({
        sql: `UPDATE products SET image_url = ?
               WHERE id = ? AND business_id = ? AND image_url = ''`,
        params: [product.image, product.id, DEMO_BUSINESS_ID],
      })),
    );
    return;
  }

  const now = new Date().toISOString();

  await db.batch([
    {
      sql: `INSERT OR IGNORE INTO users (id, email, password_hash, full_name, is_platform_admin, created_at)
            VALUES (?, ?, ?, ?, 0, ?)`,
      params: [DEMO_OWNER_ID, DEMO_EMAIL, "demo-account-cannot-sign-in", "Demo shop", now],
    },
    {
      sql: `INSERT INTO businesses (id, slug, name, industry, status, owner_user_id, created_at)
            VALUES (?, ?, ?, 'cafe', 'active', ?, ?)`,
      params: [DEMO_BUSINESS_ID, DEMO_SLUG, "Kettle & Co.", DEMO_OWNER_ID, now],
    },
    {
      sql: `INSERT INTO business_profiles
              (business_id, tagline, description, logo_url, brand_color, template, currency,
               phone, whatsapp, email, address, city, country, map_url, opening_hours, social_links, updated_at)
            VALUES (?, ?, ?, '', ?, 'aurora', 'INR', '', '', '', ?, 'Pune', 'India', '', ?, '{}', ?)`,
      params: [
        DEMO_BUSINESS_ID,
        "Slow coffee, warm chai, baked this morning.",
        "A small neighbourhood café in Koregaon Park. Order ahead and pick it up at the counter — the chai is always fresh, and the brownies rarely last past six.",
        "#8C5A2B",
        "Lane 7, Koregaon Park",
        "7:30 am – 10:30 pm, every day",
        now,
      ],
    },
    {
      sql: `INSERT INTO business_branches (id, business_id, name, address, phone, is_default, created_at)
            VALUES (?, ?, ?, ?, '', 1, ?)`,
      params: ["demo-branch", DEMO_BUSINESS_ID, "Koregaon Park", "Lane 7, Koregaon Park", now],
    },
    ...CATEGORIES.map((category) => ({
      sql: `INSERT INTO product_categories (id, business_id, name, slug, sort_order, created_at)
            VALUES (?, ?, ?, ?, ?, ?)`,
      params: [category.id, DEMO_BUSINESS_ID, category.name, category.slug, category.sort, now],
    })),
    ...PRODUCTS.map((product) => ({
      sql: `INSERT INTO products
              (id, business_id, category_id, name, slug, description, price, compare_at_price,
               image_url, is_active, is_available, sort_order, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, 1, 1, ?, ?)`,
      params: [
        product.id,
        DEMO_BUSINESS_ID,
        product.categoryId,
        product.name,
        product.slug,
        product.description,
        product.price,
        product.image,
        product.sort,
        now,
      ],
    })),
    ...GROUPS.map((group) => ({
      sql: `INSERT INTO customization_groups
              (id, business_id, product_id, name, selection_type, is_required, min_select, max_select, sort_order)
            VALUES (?, ?, ?, ?, 'single', ?, ?, 1, ?)`,
      params: [
        group.id,
        DEMO_BUSINESS_ID,
        group.productId,
        group.name,
        group.required,
        group.required,
        group.sort,
      ],
    })),
    ...OPTIONS.map((option) => ({
      sql: `INSERT INTO customization_options
              (id, business_id, group_id, name, price_delta, is_default, is_available)
            VALUES (?, ?, ?, ?, ?, ?, 1)`,
      params: [
        option.id,
        DEMO_BUSINESS_ID,
        option.groupId,
        option.name,
        option.delta,
        option.isDefault,
      ],
    })),
  ]);
}
