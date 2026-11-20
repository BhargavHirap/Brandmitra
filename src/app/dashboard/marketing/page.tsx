import { EmptyState, PageHeader, Panel } from "@/components/ui";
import { MarketingStudio } from "@/components/marketing-studio";
import { getAiUsage, isAiConfigured } from "@/lib/ai";
import { requireBusiness } from "@/lib/business";
import { getDb } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { CAMPAIGN_CHANNELS, listCampaigns } from "@/lib/marketing";

export const dynamic = "force-dynamic";
export const metadata = { title: "AI marketing studio" };

const ERROR_TEXT: Record<string, string> = {
  title: "A campaign needs a title of at least 3 characters.",
  content: "A campaign needs a message of at least 30 characters.",
  price:
    "That message mentioned pricing, so it was not saved. Campaigns never set or quote prices — edit the draft and approve it again.",
};

/**
 * Phase 5, part 3 — the marketing studio.
 *
 * The page shows drafts and approved campaigns; only an explicit approval in the
 * studio panel writes a `marketing_campaigns` row.
 */

export default async function MarketingPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const query = await searchParams;
  const { business, planId } = await requireBusiness();
  const db = await getDb();

  const [aiUsage, products, campaigns] = await Promise.all([
    getAiUsage(db, business.id, planId),
    db.all<{ id: string; name: string }>(
      `SELECT id, name FROM products
        WHERE business_id = ? AND is_active = 1
        ORDER BY sort_order ASC, name ASC`,
      [business.id],
    ),
    listCampaigns(db, business.id),
  ]);

  return (
    <div className="space-y-4 sm:space-y-5">
      <PageHeader
        eyebrow="Grow with AI"
        title="AI marketing studio"
        description="Draft an Instagram post or a WhatsApp message from your own catalogue. Nothing is saved until you approve it, and nothing is published for you."
      />

      {query.saved === "1" && (
        <div className="rounded-[10px] border border-success/20 bg-success/5 px-3.5 py-2.5 text-[12.5px] text-success">
          Campaign approved and saved. Copy the text into Instagram or WhatsApp when you are ready.
        </div>
      )}
      {query.error && ERROR_TEXT[query.error] && (
        <div className="rounded-[10px] border border-danger/20 bg-danger/5 px-3.5 py-2.5 text-[12.5px] text-danger">
          {ERROR_TEXT[query.error]}
        </div>
      )}

      <MarketingStudio
        businessName={business.name}
        configured={isAiConfigured()}
        credits={{
          used: aiUsage.used,
          limit: aiUsage.limit,
          planName: aiUsage.planName,
          monthLabel: aiUsage.monthLabel,
        }}
        products={products.map((product) => ({ id: String(product.id), name: String(product.name) }))}
        channels={CAMPAIGN_CHANNELS.map(({ id, label, note }) => ({ id, label, note }))}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel
          title="Approved campaigns"
          description="Saved by you, newest first — ten most recent"
          className="lg:col-span-2"
          padded={false}
        >
          {campaigns.length === 0 ? (
            <div className="p-4">
              <EmptyState
                title="No approved campaigns yet"
                description="Draft one above, read it, then approve it. Drafts that you discard are never stored."
              />
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {campaigns.map((campaign) => (
                <li key={campaign.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[12.5px] font-semibold">{campaign.title}</p>
                    <span className="rounded-full border border-line px-2 py-0.5 text-[9.5px] uppercase tracking-wide text-muted">
                      {CAMPAIGN_CHANNELS.find((item) => item.id === campaign.channel)?.label ??
                        campaign.channel}
                    </span>
                    <span className="ml-auto text-[10.5px] text-muted">
                      {formatDateTime(campaign.created_at)}
                    </span>
                  </div>
                  <p className="mt-1.5 whitespace-pre-wrap text-[11.5px] leading-relaxed text-muted">
                    {campaign.content}
                  </p>
                  <p className="mt-1.5 text-[10px] uppercase tracking-[0.08em] text-muted/80">
                    {campaign.status}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <div className="space-y-4">
          <Panel title="How approval works">
            <ul className="space-y-2.5 text-[11.5px] leading-relaxed text-muted">
              <li>
                <span className="font-semibold text-ink">A draft is not a campaign.</span> It lives
                in the browser until you approve it — leaving the page throws it away.
              </li>
              <li>
                <span className="font-semibold text-ink">One click writes one row.</span> Approval
                inserts into <code className="rounded bg-canvas px-1 py-px text-[10.5px]">marketing_campaigns</code>{" "}
                with status <span className="text-ink">approved</span> and logs it under your name
                in the audit trail.
              </li>
              <li>
                <span className="font-semibold text-ink">Nothing is published.</span> There is no
                Instagram or WhatsApp connection yet, so the studio never claims a post went out.
                You copy the text yourself.
              </li>
              <li>
                <span className="font-semibold text-ink">Prices are filtered twice.</span> The model
                never receives a price, and any sentence about money is removed again on the server
                before a campaign can be saved.
              </li>
              <li>
                <span className="font-semibold text-ink">Credits.</span> One credit per draft;
                approving or discarding a draft is free.
              </li>
            </ul>
          </Panel>
        </div>
      </div>
    </div>
  );
}
