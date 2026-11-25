/**
 * Vantra database schema — single source of truth.
 *
 * The same SQL runs on:
 *   - Cloudflare D1 (production / deployment)
 *   - local SQLite via node:sqlite (your computer / this preview)
 * because both are SQLite. No dialect differences to worry about.
 *
 * Rules followed in this file:
 *   1. Every table that stores business data has a business_id column.
 *      That column is how tenant isolation is enforced (see src/lib/business.ts).
 *   2. All DDL is idempotent (IF NOT EXISTS), so it can be applied repeatedly.
 *   3. No SQL comments inside SCHEMA_SQL: statements are split on ";".
 *
 * Regenerate a .sql file for `wrangler d1 execute` with: npm run db:sql
 */

export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL DEFAULT '',
  is_platform_admin INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS password_resets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_password_resets_user ON password_resets(user_id);

CREATE TABLE IF NOT EXISTS businesses (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  industry TEXT NOT NULL DEFAULT 'restaurant',
  status TEXT NOT NULL DEFAULT 'active',
  owner_user_id TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_businesses_owner ON businesses(owner_user_id);

CREATE TABLE IF NOT EXISTS business_profiles (
  business_id TEXT PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
  tagline TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  logo_url TEXT NOT NULL DEFAULT '',
  brand_color TEXT NOT NULL DEFAULT '#2F6BFF',
  template TEXT NOT NULL DEFAULT 'aurora',
  currency TEXT NOT NULL DEFAULT 'INR',
  phone TEXT NOT NULL DEFAULT '',
  whatsapp TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  country TEXT NOT NULL DEFAULT 'India',
  map_url TEXT NOT NULL DEFAULT '',
  opening_hours TEXT NOT NULL DEFAULT '',
  social_links TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS business_members (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'staff',
  created_at TEXT NOT NULL,
  UNIQUE (business_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_members_user ON business_members(user_id);

CREATE TABLE IF NOT EXISTS business_branches (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_branches_business ON business_branches(business_id);

CREATE TABLE IF NOT EXISTS plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  price_inr INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'INR',
  interval TEXT NOT NULL DEFAULT 'month',
  product_limit INTEGER NOT NULL DEFAULT 10,
  staff_limit INTEGER NOT NULL DEFAULT 1,
  ai_credits INTEGER NOT NULL DEFAULT 0,
  features TEXT NOT NULL DEFAULT '[]',
  is_active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL UNIQUE REFERENCES businesses(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL REFERENCES plans(id),
  status TEXT NOT NULL DEFAULT 'active',
  current_period_end TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS razorpay_plans (
  plan_id TEXT PRIMARY KEY REFERENCES plans(id) ON DELETE CASCADE,
  razorpay_plan_id TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS razorpay_checkouts (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL REFERENCES plans(id),
  status TEXT NOT NULL DEFAULT 'created',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_razorpay_checkouts_business ON razorpay_checkouts(business_id);

CREATE TABLE IF NOT EXISTS product_categories (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  UNIQUE (business_id, slug)
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  category_id TEXT REFERENCES product_categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price INTEGER NOT NULL DEFAULT 0,
  compare_at_price INTEGER,
  image_url TEXT NOT NULL DEFAULT '',
  is_active INTEGER NOT NULL DEFAULT 1,
  is_available INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  UNIQUE (business_id, slug)
);
CREATE INDEX IF NOT EXISTS idx_products_business ON products(business_id);

CREATE TABLE IF NOT EXISTS product_variants (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price_delta INTEGER NOT NULL DEFAULT 0,
  is_default INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_variants_product ON product_variants(product_id);

CREATE TABLE IF NOT EXISTS customization_groups (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  selection_type TEXT NOT NULL DEFAULT 'single',
  is_required INTEGER NOT NULL DEFAULT 0,
  min_select INTEGER NOT NULL DEFAULT 0,
  max_select INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_cgroups_product ON customization_groups(product_id);

CREATE TABLE IF NOT EXISTS customization_options (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  group_id TEXT NOT NULL REFERENCES customization_groups(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price_delta INTEGER NOT NULL DEFAULT 0,
  is_default INTEGER NOT NULL DEFAULT 0,
  is_available INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_coptions_group ON customization_options(group_id);

CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  name TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  loyalty_points INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  UNIQUE (business_id, phone)
);
CREATE INDEX IF NOT EXISTS idx_customers_business ON customers(business_id);

CREATE TABLE IF NOT EXISTS carts (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  customer_id TEXT REFERENCES customers(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'open',
  channel TEXT NOT NULL DEFAULT 'web',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_carts_business ON carts(business_id);

CREATE TABLE IF NOT EXISTS cart_items (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  cart_id TEXT NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price INTEGER NOT NULL DEFAULT 0,
  options TEXT NOT NULL DEFAULT '[]',
  notes TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_cart_items_cart ON cart_items(cart_id);

CREATE TABLE IF NOT EXISTS coupons (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  discount_type TEXT NOT NULL DEFAULT 'percent',
  discount_value INTEGER NOT NULL DEFAULT 0,
  min_order_value INTEGER NOT NULL DEFAULT 0,
  max_uses INTEGER,
  used_count INTEGER NOT NULL DEFAULT 0,
  starts_at TEXT,
  ends_at TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  UNIQUE (business_id, code)
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  branch_id TEXT REFERENCES business_branches(id) ON DELETE SET NULL,
  customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
  order_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  payment_status TEXT NOT NULL DEFAULT 'pending',
  payment_method TEXT NOT NULL DEFAULT 'cod',
  channel TEXT NOT NULL DEFAULT 'web',
  subtotal INTEGER NOT NULL DEFAULT 0,
  discount INTEGER NOT NULL DEFAULT 0,
  delivery_fee INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL DEFAULT 0,
  coupon_id TEXT REFERENCES coupons(id) ON DELETE SET NULL,
  customer_note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (business_id, order_number)
);
CREATE INDEX IF NOT EXISTS idx_orders_business_created ON orders(business_id, created_at);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(business_id, status);

CREATE TABLE IF NOT EXISTS order_items (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id TEXT REFERENCES products(id) ON DELETE SET NULL,
  name_snapshot TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price INTEGER NOT NULL DEFAULT 0,
  options TEXT NOT NULL DEFAULT '[]',
  line_total INTEGER NOT NULL DEFAULT 0,
  notes TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  order_id TEXT REFERENCES orders(id) ON DELETE SET NULL,
  provider TEXT NOT NULL DEFAULT 'manual',
  provider_payment_id TEXT NOT NULL DEFAULT '',
  amount INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_payments_business ON payments(business_id);

CREATE TABLE IF NOT EXISTS inventory (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  stock_on_hand INTEGER NOT NULL DEFAULT 0,
  low_stock_threshold INTEGER NOT NULL DEFAULT 5,
  updated_at TEXT NOT NULL,
  UNIQUE (business_id, product_id)
);

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
  channel TEXT NOT NULL DEFAULT 'whatsapp',
  external_id TEXT NOT NULL DEFAULT '',
  state TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'open',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_conversations_business ON conversations(business_id, channel);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at);

CREATE TABLE IF NOT EXISTS marketing_campaigns (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'instagram',
  content TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft',
  scheduled_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_campaigns_business ON marketing_campaigns(business_id);

CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  product_id TEXT REFERENCES products(id) ON DELETE CASCADE,
  customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
  rating INTEGER NOT NULL DEFAULT 5,
  comment TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_reviews_business ON reviews(business_id);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'info',
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_notifications_business ON notifications(business_id, is_read);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  business_id TEXT REFERENCES businesses(id) ON DELETE CASCADE,
  actor_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  actor_type TEXT NOT NULL DEFAULT 'user',
  action TEXT NOT NULL,
  entity TEXT NOT NULL DEFAULT '',
  entity_id TEXT NOT NULL DEFAULT '',
  payload TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_business ON audit_logs(business_id, created_at);

CREATE TABLE IF NOT EXISTS desk_settings (
  business_id TEXT PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
  greeting TEXT NOT NULL DEFAULT '',
  languages TEXT NOT NULL DEFAULT 'Hindi, Hinglish, English',
  opens_at TEXT NOT NULL DEFAULT '10:00',
  closes_at TEXT NOT NULL DEFAULT '20:00',
  closed_days TEXT NOT NULL DEFAULT '0',
  slot_minutes INTEGER NOT NULL DEFAULT 30,
  escalation_phone TEXT NOT NULL DEFAULT '',
  followup_hours INTEGER NOT NULL DEFAULT 2,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS desk_calls (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  outcome TEXT NOT NULL DEFAULT 'missed',
  language TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  appointment_id TEXT,
  value_inr INTEGER NOT NULL DEFAULT 0,
  follow_up_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_desk_calls_business ON desk_calls(business_id, created_at);

CREATE TABLE IF NOT EXISTS desk_appointments (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  call_id TEXT,
  customer_name TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  service TEXT NOT NULL DEFAULT '',
  starts_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'booked',
  source TEXT NOT NULL DEFAULT 'phone',
  notes TEXT NOT NULL DEFAULT '',
  value_inr INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_desk_appts_business ON desk_appointments(business_id, starts_at);

CREATE TABLE IF NOT EXISTS desk_messaging (
  business_id TEXT PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
  auto_send INTEGER NOT NULL DEFAULT 0,
  reminder_hours_before INTEGER NOT NULL DEFAULT 24,
  phone_number_id TEXT NOT NULL DEFAULT '',
  display_number TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS desk_messages (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  appointment_id TEXT,
  kind TEXT NOT NULL DEFAULT 'confirmation',
  to_phone TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  language TEXT NOT NULL DEFAULT 'hinglish',
  params TEXT NOT NULL DEFAULT '[]',
  send_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  attempts INTEGER NOT NULL DEFAULT 0,
  provider_id TEXT NOT NULL DEFAULT '',
  error TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  sent_at TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_desk_messages_once ON desk_messages(business_id, appointment_id, kind);
CREATE INDEX IF NOT EXISTS idx_desk_messages_due ON desk_messages(status, send_at);
`;

export const SEED_SQL = `
INSERT OR IGNORE INTO plans (id, name, price_inr, currency, interval, product_limit, staff_limit, ai_credits, features, is_active, sort_order) VALUES
  ('free', 'Free', 0, 'INR', 'month', 1000000, 1000000, 20, '["1 business website","Unlimited products","Unlimited team seats","Order dashboard","20 AI credits / month"]', 1, 1);

INSERT OR IGNORE INTO plans (id, name, price_inr, currency, interval, product_limit, staff_limit, ai_credits, features, is_active, sort_order) VALUES
  ('starter', 'Starter', 499, 'INR', 'month', 1000000, 1000000, 200, '["Unlimited products","Unlimited team seats","Website customisation","Order analytics","Basic marketing tools"]', 1, 2);

INSERT OR IGNORE INTO plans (id, name, price_inr, currency, interval, product_limit, staff_limit, ai_credits, features, is_active, sort_order) VALUES
  ('growth', 'Growth', 1499, 'INR', 'month', 1000000, 1000000, 1000, '["WhatsApp AI assistant","AI marketing studio","Customer management","Advanced analytics"]', 1, 3);

INSERT OR IGNORE INTO plans (id, name, price_inr, currency, interval, product_limit, staff_limit, ai_credits, features, is_active, sort_order) VALUES
  ('pro', 'Pro', 2999, 'INR', 'month', 1000000, 1000000, 5000, '["AI business agent","Multi-branch","Staff management","Automation"]', 1, 4);

INSERT OR IGNORE INTO plans (id, name, price_inr, currency, interval, product_limit, staff_limit, ai_credits, features, is_active, sort_order) VALUES
  ('enterprise', 'Enterprise', 9999, 'INR', 'month', 1000000, 1000000, 25000, '["Custom integrations","Advanced permissions","Custom domain","Priority support"]', 1, 5);

-- No plan caps how many products a business can list. The stored value is a
-- ceiling far above real use and the screens print "Unlimited". These lines
-- also move databases created when the Free plan allowed 10 products.
UPDATE plans SET product_limit = 1000000 WHERE product_limit < 1000000;
UPDATE plans SET features = REPLACE(features, 'Up to 10 products', 'Unlimited products');
UPDATE plans SET features = REPLACE(features, 'Up to 100 products', 'Unlimited products');

-- No plan caps how many people can work in the business either. These lines
-- also move databases created when Free allowed 1 seat and Enterprise 200.
UPDATE plans SET staff_limit = 1000000 WHERE staff_limit < 1000000;
UPDATE plans SET features = REPLACE(features, '"1 team seat"', '"Unlimited team seats"');
UPDATE plans SET features = REPLACE(features, '"3 team seats"', '"Unlimited team seats"');
UPDATE plans SET features = REPLACE(features, '"10 team seats"', '"Unlimited team seats"');
UPDATE plans SET features = REPLACE(features, '"25 team seats"', '"Unlimited team seats"');
UPDATE plans SET features = REPLACE(features, '"200 team seats"', '"Unlimited team seats"');
`;

/** Split a multi-statement SQL string into individual statements. */
export function splitSql(sql: string): string[] {
  return sql
    .split(";\n")
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0)
    .map((statement) => (statement.endsWith(";") ? statement : `${statement};`));
}
