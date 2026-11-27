import Link from "next/link";
import { BrandLink } from "@/components/brand";
import { LegalLinks } from "@/components/landing/legal-links";
import { SocialLinks } from "@/components/landing/social-links";

export const metadata = {
  title: "Terms",
  description:
    "The terms for using Vantra: your account, your content, orders between you and your customers, and what we promise.",
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
 * TERMS — short enough to read, and specific about the one thing that matters
 * legally: Vantra is the tool a business runs on, not the business. An order
 * placed on a shop page is between that shop and its customer; we host it and
 * show it, we do not sell or deliver anything ourselves.
 */
export default function TermsPage() {
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
          Terms
        </h1>
        <p className="mt-3 text-[12px] text-muted">Last updated {UPDATED}</p>
        <p className="mt-6 text-[13.5px] leading-relaxed text-muted">
          These are the terms for using Vantra. By creating an account you agree to them.
          They are written to be read once, not to be impressive.
        </p>

        <Section title="What Vantra is">
          <p>
            Vantra gives a business a website, an order desk, customer tools and an AI
            assistant. It is a tool. Every order placed on a shop page is a contract
            between that business and its own customer — the price, the quality, the
            delivery and any refund are the business&apos;s responsibility, not ours. We
            store the order and show it to the business.
          </p>
        </Section>

        <Section title="Your account">
          <ul className="list-disc space-y-2 pl-5">
            <li>Give real details when you sign up and keep them current.</li>
            <li>
              Keep your password to yourself. Anything done through your account is treated
              as done by you, so tell us at once if you think someone else has it.
            </li>
            <li>
              You may invite staff to your business. You are responsible for what they do
              inside it, and you can remove them at any time.
            </li>
            <li>One person should not run several businesses as a way around a plan limit.</li>
          </ul>
        </Section>

        <Section title="Your content">
          <p>
            Your products, photos, prices, copy and customer data belong to you. You give
            us permission to store and display them for the purpose of running your shop —
            nothing more. We do not use your catalogue or your customers to advertise
            Vantra without asking.
          </p>
          <p>
            You are responsible for having the right to the photos and text you upload, and
            for the personal data of your customers that you put into the product.
          </p>
        </Section>

        <Section title="Acceptable use">
          <p>Do not use Vantra to:</p>
          <ul className="list-disc space-y-2 pl-5">
            <li>sell anything illegal, unsafe, or prohibited where you operate;</li>
            <li>send messages to people who did not ask for them;</li>
            <li>
              attack the service, probe it for holes, or copy it to run a competing product;
            </li>
            <li>impersonate another business or person.</li>
          </ul>
          <p>
            We may suspend an account that does any of these, or that puts other businesses
            or customers at risk. Where it is reasonable to do so, we will tell you why
            first.
          </p>
        </Section>

        <Section title="Plans and payment">
          <p>
            The Free plan costs nothing and needs no card. Paid plans are billed monthly in
            Indian rupees through Razorpay, and become active only when Razorpay confirms
            the payment to us. There is no card on file: nothing renews without a payment
            you approved.
          </p>
          <p>
            Prices may change. If a price you pay changes, we will tell you before it
            applies. You can stop a paid plan at any time and keep using the Free plan.
            Amounts already paid are not refunded unless the law requires it or the service
            was not delivered.
          </p>
        </Section>

        <Section title="AI features">
          <p>
            AI text and answers can be wrong. They are a draft, not advice: read a
            description, a caption or an answer before you publish or rely on it. AI
            credits are counted against your plan and are not refunded when an answer turns
            out to be unusable — the credit counts a successful answer, not a perfect one.
          </p>
        </Section>

        <Section title="Availability">
          <p>
            We work to keep Vantra running, but a free plan comes with no uptime guarantee
            and no service credit. Maintenance, a hosting outage or a provider limit can
            make the service unavailable for a while. Your data stays in our database;
            keep your own copy of anything you cannot afford to lose.
          </p>
        </Section>

        <Section title="Ending it">
          <p>
            You can stop using Vantra whenever you like and ask us to delete your account
            and its data. We may close an account that breaks these terms, that has not been
            used for a long time, or that we are required to close by law. We will give
            notice where we can.
          </p>
        </Section>

        <Section title="Liability">
          <p>
            To the extent the law allows, we are not liable for lost profits or lost
            business, or for indirect losses, arising from your use of Vantra. Where
            liability cannot be excluded, it is limited to the amount you paid us in the
            three months before the problem. Nothing here limits liability that the law says
            cannot be limited.
          </p>
        </Section>

        <Section title="Changes and law">
          <p>
            We may change these terms; the date above changes with them, and a change that
            matters will be pointed out in the dashboard before it applies. These terms are
            governed by the laws of India, and disputes go to the courts of India.
          </p>
          <p>
            Questions go to the WhatsApp number in the footer, or open an issue on{" "}
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
