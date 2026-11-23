import Link from "next/link";

/**
 * Real destinations only. These are the founders' own accounts and the number
 * the business answers on — no guessed handles, no dead links in the footer.
 * Anything else social stays out until there is a real account behind it.
 */

const INSTAGRAM = ["nomore.niceness", "_ayush.s.kale_", "vaishnavi.hirap"];

const WHATSAPP_DIGITS = "919324173304";

export function SocialLinks() {
  return (
    <nav aria-label="Social" className="flex flex-wrap items-center gap-x-4 gap-y-2">
      {INSTAGRAM.map((handle) => (
        <a
          key={handle}
          href={`https://instagram.com/${handle}`}
          target="_blank"
          rel="noreferrer"
          aria-label={`Instagram — @${handle}`}
          className="hover:text-ink"
        >
          @{handle}
        </a>
      ))}
      <a
        href={`https://wa.me/${WHATSAPP_DIGITS}`}
        target="_blank"
        rel="noreferrer"
        aria-label="WhatsApp — +91 93241 73304"
        className="hover:text-ink"
      >
        WhatsApp
      </a>
    </nav>
  );
}

export function FooterLinks({ pageHref, pageLabel }: { pageHref: string; pageLabel: string }) {
  return (
    <nav className="flex items-center gap-4">
      <Link href={pageHref} className="hover:text-ink">
        {pageLabel}
      </Link>
      <a
        href="https://github.com/BhargavHirap/Brandmitra"
        target="_blank"
        rel="noreferrer"
        className="hover:text-ink"
      >
        GitHub
      </a>
      <Link href="/login" className="hover:text-ink">
        Sign in
      </Link>
    </nav>
  );
}
