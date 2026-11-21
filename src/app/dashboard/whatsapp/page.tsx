import Link from "next/link";
import { saveWhatsappAction } from "@/app/actions/settings";
import { PageHeader, Panel } from "@/components/ui";
import { requireBusiness } from "@/lib/business";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "WhatsApp" };

/**
 * WHATSAPP.
 *
 * Two honest halves:
 *   - a real, working click-to-chat link built from the number the owner saves,
 *     plus copy-it-yourself message templates, and
 *   - the automatic assistant, which needs Meta's WhatsApp Cloud API. That is
 *     not connected, so it says so instead of faking a chat window.
 */

const ERROR_TEXT: Record<string, string> = {
  number: "Enter a phone number with digits only, for example +91 98765 43210.",
};

const TEMPLATES = [
  {
    title: "Order ready for pickup",
    body: "Hi {{name}}, your order {{number}} is ready. Please collect it from {{business}} any time before closing. Thank you!",
  },
  {
    title: "Out for delivery",
    body: "Hi {{name}}, order {{number}} ({{total}}) is on its way and should reach you in about 20 minutes.",
  },
  {
    title: "Menu share",
    body: "Hi! Here is our live menu and prices. You can order directly from the page: {{link}}",
  },
];

export default async function WhatsappPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const { business } = await requireBusiness();
  const params = await searchParams;
  const db = await getDb();

  const profile = await db.first<{ whatsapp: string; phone: string }>(
    "SELECT whatsapp, phone FROM business_profiles WHERE business_id = ?",
    [business.id],
  );

  const number = (profile?.whatsapp || profile?.phone || "").trim();
  const digits = number.replace(/[^0-9]/g, "");
  const chatLink =
    digits.length >= 10
      ? `https://wa.me/${digits}?text=${encodeURIComponent(
          `Hi ${business.name}! I would like to order from your menu.`,
        )}`
      : null;

  return (
    <div className="space-y-4 sm:space-y-5">
      <PageHeader
        eyebrow="Grow"
        title="WhatsApp"
        description="A click-to-chat link and ready-made messages you can send yourself. The automatic assistant needs Meta's Cloud API and is not connected."
        actions={
          <Link href="/dashboard/website" className="btn btn-ghost text-[12.5px]">
            Edit contact details
          </Link>
        }
      />

      {params.saved === "1" && (
        <div className="rounded-[10px] border border-success/20 bg-success/5 px-3.5 py-2.5 text-[12.5px] text-success">
          WhatsApp number saved.
        </div>
      )}
      {params.error && ERROR_TEXT[params.error] && (
        <div className="rounded-[10px] border border-danger/20 bg-danger/5 px-3.5 py-2.5 text-[12.5px] text-danger">
          {ERROR_TEXT[params.error]}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Panel title="Your click-to-chat link" description="Works today, with no API key">
            <form action={saveWhatsappAction} className="space-y-3">
              <div>
                <label className="label" htmlFor="whatsappNumber">
                  WhatsApp number
                </label>
                <input
                  id="whatsappNumber"
                  name="whatsapp"
                  defaultValue={profile?.whatsapp ?? ""}
                  placeholder="+91 98765 43210"
                  maxLength={30}
                  className="field sm:max-w-xs"
                />
                <p className="mt-1.5 text-[11px] text-muted">
                  Shown on your storefront and used for the link below. Include the country code.
                </p>
              </div>
              <button type="submit" className="btn btn-brand text-[12.5px]">
                Save number
              </button>
            </form>

            <div className="mt-4 rounded-xl border border-line bg-canvas/50 p-3">
              {chatLink ? (
                <>
                  <p className="text-[12px] font-medium">Customers can start a chat with you here:</p>
                  <Link
                    href={chatLink}
                    target="_blank"
                    className="mt-2 block truncate text-[11.5px] font-medium text-brand hover:underline"
                  >
                    {chatLink}
                  </Link>
                  <p className="mt-1.5 text-[11px] leading-relaxed text-muted">
                    Share this link on Instagram, your print menu or a status update. The message is
                    pre-filled with your business name.
                  </p>
                </>
              ) : (
                <p className="text-[11.5px] leading-relaxed text-muted">
                  Save a number with at least 10 digits and the link appears here.
                </p>
              )}
            </div>
          </Panel>

          <Panel title="Message templates" description="Copy one, fill in the brackets, send it yourself">
            <ul className="space-y-3">
              {TEMPLATES.map((template) => (
                <li key={template.title} className="rounded-xl border border-line p-3">
                  <p className="text-[12px] font-semibold">{template.title}</p>
                  <pre className="mt-1.5 whitespace-pre-wrap break-words font-sans text-[11.5px] leading-relaxed text-muted">
                    {template.body}
                  </pre>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[11px] leading-relaxed text-muted">
              These are text you paste into WhatsApp. Vantra does not send messages — there is no
              message API connected on this deployment.
            </p>
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel title="Automatic assistant" description="Not connected">
            <span className="inline-flex rounded-full border border-line bg-canvas px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
              Not connected
            </span>
            <p className="mt-2 text-[11.5px] leading-relaxed text-muted">
              An assistant that answers “what is on the menu” and takes orders needs Meta&apos;s
              WhatsApp Cloud API. That needs, in order:
            </p>
            <ol className="mt-2 list-decimal space-y-1.5 pl-4 text-[11.5px] leading-relaxed text-muted">
              <li>A Meta Business account and business verification.</li>
              <li>A WhatsApp Business phone number with its phone-number ID.</li>
              <li>A permanent access token and a webhook URL.</li>
              <li>Approved message templates for anything outside a 24-hour window.</li>
            </ol>
            <p className="mt-2 text-[11.5px] leading-relaxed text-muted">
              None of that is configured here, so no chat window is shown and nothing is simulated. Your
              own catalogue and order tables are ready for it when those keys exist.
            </p>
          </Panel>

          <Panel title="Why no fake chat" description="The project rule">
            <p className="text-[11.5px] leading-relaxed text-muted">
              Every unbuilt feature in Vantra says it is unbuilt. A demo chat that cannot answer
              would be worse than no chat, because you would trust it with real customers.
            </p>
          </Panel>
        </div>
      </div>
    </div>
  );
}
