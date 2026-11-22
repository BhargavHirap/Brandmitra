import Link from "next/link";
import { updateStorefrontAction } from "@/app/actions/business";
import { ColorField } from "@/components/color-field";
import { PageHeader, Panel } from "@/components/ui";
import { TEMPLATES, requireBusiness } from "@/lib/business";
import { getDb } from "@/lib/db";
import { industryLabel } from "@/lib/industries";

export const dynamic = "force-dynamic";
export const metadata = { title: "My website" };

function parseSocial(raw: string | null): Record<string, string> {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as Record<string, string>;
  } catch {
    return {};
  }
}

export default async function WebsiteSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const { business } = await requireBusiness();
  const { saved } = await searchParams;
  const db = await getDb();

  const profile = await db.first<{
    tagline: string;
    description: string;
    brand_color: string;
    template: string;
    phone: string;
    whatsapp: string;
    email: string;
    address: string;
    city: string;
    map_url: string;
    opening_hours: string;
    social_links: string;
    country: string;
  }>(
    `SELECT tagline, description, brand_color, template, phone, whatsapp, email,
            address, city, map_url, opening_hours, social_links, country
       FROM business_profiles WHERE business_id = ?`,
    [business.id],
  );

  const social = parseSocial(profile?.social_links ?? null);

  return (
    <div className="space-y-4 sm:space-y-5">
      <PageHeader
        eyebrow="Website builder"
        title="My website"
        description="Your storefront is generated from these details. Changes go live the moment you save — no code, no separate publishing step."
        actions={
          <Link
            href={`/b/${business.slug}`}
            target="_blank"
            className="btn btn-primary text-[12.5px]"
          >
            Open storefront
          </Link>
        }
      />

      {saved === "1" && (
        <div className="rounded-[10px] border border-success/20 bg-success/5 px-3.5 py-2.5 text-[12.5px] text-success">
          Saved. Your public page at /b/{business.slug} is updated.
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <form action={updateStorefrontAction} className="space-y-4">
            <Panel title="Brand" description="Name and address are permanent in Phase 1">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="storefrontName">
                    Business name
                  </label>
                  <input
                    id="storefrontName"
                    className="field bg-canvas/60"
                    value={business.name}
                    readOnly
                  />
                </div>
                <div>
                  <label className="label" htmlFor="storefrontSlug">
                    Storefront address
                  </label>
                  <input
                    id="storefrontSlug"
                    className="field bg-canvas/60"
                    value={`/b/${business.slug}`}
                    readOnly
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="label" htmlFor="tagline">
                    Tagline
                  </label>
                  <input
                    id="tagline"
                    name="tagline"
                    defaultValue={profile?.tagline ?? ""}
                    placeholder="Slow-roasted coffee and fresh bakes, every morning."
                    className="field"
                    maxLength={120}
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="label" htmlFor="description">
                    About your business
                  </label>
                  <textarea
                    id="description"
                    name="description"
                    defaultValue={profile?.description ?? ""}
                    rows={5}
                    maxLength={1200}
                    placeholder="What you sell, what makes you different, and why customers should visit."
                    className="field resize-y"
                  />
                  <p className="mt-1.5 text-[11px] text-muted">
                    Shown in the hero and about section of your storefront.
                  </p>
                </div>

                <div>
                  <label className="label" htmlFor="brandColor">
                    Brand colour
                  </label>
                  <ColorField defaultValue={profile?.brand_color ?? "#2F6BFF"} />
                </div>

                <div>
                  <label className="label" htmlFor="template">
                    Template
                  </label>
                  <select
                    id="template"
                    name="template"
                    defaultValue={profile?.template ?? "aurora"}
                    className="field"
                  >
                    {TEMPLATES.map((template) => (
                      <option key={template.value} value={template.value}>
                        {template.label} — {template.note}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </Panel>

            <Panel title="Contact & location" description="Shown to customers on your page">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="phone">
                    Phone
                  </label>
                  <input
                    id="phone"
                    name="phone"
                    defaultValue={profile?.phone ?? ""}
                    placeholder="+91 98765 43210"
                    className="field"
                    maxLength={30}
                  />
                </div>
                <div>
                  <label className="label" htmlFor="whatsapp">
                    WhatsApp number
                  </label>
                  <input
                    id="whatsapp"
                    name="whatsapp"
                    defaultValue={profile?.whatsapp ?? ""}
                    placeholder="+91 98765 43210"
                    className="field"
                    maxLength={30}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="label" htmlFor="email">
                    Public email
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    defaultValue={profile?.email ?? ""}
                    className="field"
                    maxLength={160}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="label" htmlFor="address">
                    Street address
                  </label>
                  <input
                    id="address"
                    name="address"
                    defaultValue={profile?.address ?? ""}
                    className="field"
                    maxLength={240}
                  />
                </div>
                <div>
                  <label className="label" htmlFor="city">
                    City
                  </label>
                  <input
                    id="city"
                    name="city"
                    defaultValue={profile?.city ?? ""}
                    className="field"
                    maxLength={80}
                  />
                </div>
                <div>
                  <label className="label" htmlFor="openingHours">
                    Opening hours
                  </label>
                  <input
                    id="openingHours"
                    name="openingHours"
                    defaultValue={profile?.opening_hours ?? ""}
                    placeholder="Mon–Sun · 9:00 AM – 11:00 PM"
                    className="field"
                    maxLength={200}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="label" htmlFor="mapUrl">
                    Google Maps link
                  </label>
                  <input
                    id="mapUrl"
                    name="mapUrl"
                    type="url"
                    defaultValue={profile?.map_url ?? ""}
                    placeholder="https://maps.app.goo.gl/..."
                    className="field"
                    maxLength={300}
                  />
                  <p className="mt-1.5 text-[11px] text-muted">
                    Paste a Google Maps share link. It becomes a “Get directions” button.
                  </p>
                </div>
              </div>
            </Panel>

            <Panel title="Social links" description="Optional — leave blank to hide">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="instagram">
                    Instagram
                  </label>
                  <input
                    id="instagram"
                    name="instagram"
                    type="url"
                    defaultValue={social.instagram ?? ""}
                    placeholder="https://instagram.com/yourbusiness"
                    className="field"
                    maxLength={120}
                  />
                </div>
                <div>
                  <label className="label" htmlFor="facebook">
                    Facebook
                  </label>
                  <input
                    id="facebook"
                    name="facebook"
                    type="url"
                    defaultValue={social.facebook ?? ""}
                    placeholder="https://facebook.com/yourbusiness"
                    className="field"
                    maxLength={120}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="label" htmlFor="website">
                    Other website
                  </label>
                  <input
                    id="website"
                    name="website"
                    type="url"
                    defaultValue={social.website ?? ""}
                    className="field"
                    maxLength={120}
                  />
                </div>
              </div>
            </Panel>

            <div className="flex items-center justify-between gap-3">
              <p className="text-[11.5px] text-muted">
                Only this business can read or change these details.
              </p>
              <button type="submit" className="btn btn-brand">
                Save changes
              </button>
            </div>
          </form>
        </div>

        <div className="space-y-4">
          <Panel title="What's next">
            <ul className="space-y-3 text-[12px] leading-relaxed text-muted">
              <li>
                <span className="font-semibold text-ink">Products</span> — your catalogue,
                categories and customisation options are live. Manage them under{" "}
                <Link href="/dashboard/products" className="font-medium text-brand hover:underline">
                  Products
                </Link>
                .
              </li>
              <li>
                <span className="font-semibold text-ink">Phase 3</span> — cart, checkout and order
                tracking on the storefront.
              </li>
              <li>
                <span className="font-semibold text-ink">Phase 7</span> — custom domains. Until
                then every business shares the <span className="text-ink">/b/&lt;slug&gt;</span>{" "}
                address.
              </li>
            </ul>
          </Panel>

          <Panel title="Template preview" description="Colours update the live page">
            <div
              className="rounded-xl border border-line p-4"
              style={{ borderLeft: `4px solid ${profile?.brand_color ?? "#2F6BFF"}` }}
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
                {industryLabel(business.industry)}
              </p>
              <p className="mt-1 text-[15px] font-semibold">{business.name}</p>
              <p className="mt-1 text-[11.5px] leading-relaxed text-muted">
                {profile?.tagline || "Your tagline appears here."}
              </p>
              <span
                className="mt-3 inline-flex rounded-md px-2 py-1 text-[10.5px] font-medium text-white"
                style={{ backgroundColor: profile?.brand_color ?? "#2F6BFF" }}
              >
                Order now
              </span>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
