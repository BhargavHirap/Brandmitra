import Link from "next/link";
import { BrandLink } from "@/components/brand";
import { LegalLinks } from "@/components/landing/legal-links";
import { SocialLinks } from "@/components/landing/social-links";

export const metadata = {
  title: "Privacy",
  description:
    "What Vantra stores, why, who else sees it, and how to have it deleted. Plain language, no trackers.",
};

const UPDATED = "27 November 2026";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-line/70 py-7">
      <h2 className="text-[15px] font-semibold tracking-[-0.01em]">{title}</h2>
      <div className="mt-3 space-y-3 text-[13px] leading-relaxed text-muted">{children}</div>
    </section>
  );
}

/**
 * PRIVACY — written from what the code actually does.
 *
 * Every claim here matches a table or a third party that appears in the
 * repository. A payment processor, an app store and a customer all ask for this
 * page; a page that overstates what we do would be worse than no page.
 */
export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-canvas">
      <header className="sticky top-0 z-40 border-b border-line/70 bg-canvas/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-5">
          <BrandLink />
          <Link href="/signup" className="btn btn-primary h-9 px-4 text-[12.5px]">
            Start free
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-5 pt-14 pb-20">
        <h1 className="text-[30px] font-light leading-tight tracking-[-0.03em] sm:text-[40px]">
          Privacy
        </h1>
        <p className="mt-3 text-[12px] text-muted">Last updated {UPDATED}</p>
        <p className="mt-6 text-[13.5px] leading-relaxed text-muted">
          Vantra is a tool for running a small business: a website, orders, customers and
          an AI assistant. This page says exactly what we keep, in the same words the
          computer would use. There are no advertising trackers and no analytics cookies.
        </p>

        <Section title="What we store">
          <p>
            <strong className="font-medium text-ink">Your account:</strong> your name,
            email address, a salted hash of your password (never the password itself), and
            when you last signed in. Your session is a random token in a cookie that only
            the server can read.
          </p>
          <p>
            <strong className="font-medium text-ink">Your business:</strong> the shop
            details you type in — name, description, opening hours, contact number, social
            links, brand colour — plus your products, categories, prices, stock and staff
            accounts.
          </p>
          <p>
            <strong className="font-medium text-ink">Your customers&apos; orders:</strong>{" "}
            the name, phone number, items, options, total and status of each order placed
            on your shop page, and the private receipt link. You are the one who decides
            what to do with that data; we only store it for you.
          </p>
          <p>
            <strong className="font-medium text-ink">Security events:</strong> refused
            sign-in attempts (email, IP address, time) and rejected payment webhooks (IP,
            reason). These exist so the founders can spot an attack, are visible only to
            them, and never contain a password or a token.
          </p>
        </Section>

        <Section title="Who else sees it">
          <p>
            Only the services needed to run the product, each for one job:
          </p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong className="font-medium text-ink">Cloudflare</strong> — hosting and the
              database.
            </li>
            <li>
              <strong className="font-medium text-ink">Google (Gemini API)</strong> — only
              when you press an AI button, and only the text or photo you send with it. Your
              customers&apos; order history is not sent to it.
            </li>
            <li>
              <strong className="font-medium text-ink">Razorpay</strong> — only if you buy a
              paid plan. We never see or store your card details.
            </li>
            <li>
              <strong className="font-medium text-ink">Brevo</strong> — sends the security
              alert email to the founders.
            </li>
            <li>
              <strong className="font-medium text-ink">Meta (WhatsApp Cloud API)</strong> —
              only if the business switches WhatsApp sending on, and only the message it
              sends to a customer.
            </li>
          </ul>
          <p>We do not sell data, and we do not share it for advertising.</p>
        </Section>

        <Section title="Cookies">
          <p>
            One cookie, <code className="text-[12px] text-ink">bm_session</code>, which keeps
            you signed in. It is HttpOnly and is deleted when you sign out. Nothing else is
            set — no advertising, no cross-site tracking, no third-party scripts.
          </p>
        </Section>

        <Section title="How long we keep it">
          <p>
            Business and order data stays for as long as the account exists. Security events
            are kept for review and are not shown to anyone but the founders. Ask us and we
            will delete an account and its business data; a shop that closes stops serving
            immediately.
          </p>
        </Section>

        <Section title="Your choices">
          <p>
            You can edit or delete your products, staff and business details at any time from
            the dashboard. To have an account and all of its data removed, message us on
            WhatsApp from the number on your account and we will do it.
          </p>
        </Section>

        <Section title="Children">
          <p>
            Vantra is for businesses and is not intended for anyone under 18. We do not
            knowingly create accounts for children.
          </p>
        </Section>

        <Section title="Changes and contact">
          <p>
            If this page changes, the date above changes with it. Questions go to the
            WhatsApp number in the footer, or open an issue on{" "}
            <a
              href="https://github.com/BhargavHirap/Brandmitra/issues"
              target="_blank"
              rel="noreferrer"
              className="underline decoration-line underline-offset-4 hover:decoration-ink"
            >
              GitHub
            </a>
            .
          </p>
        </Section>
      </main>

      <footer className="border-t border-line/70">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-5 py-8 text-[11px] text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Vantra</p>
          <SocialLinks />
          <LegalLinks />
        </div>
      </footer>
    </div>
  );
}
