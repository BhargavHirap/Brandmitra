import Link from "next/link";

/**
 * The public-facing pages every visitor is entitled to find: what it costs,
 * what we store, and the terms of using it. Kept in one component so the
 * landing page and the showcase footer cannot drift apart.
 */
export function LegalLinks() {
  return (
    <nav aria-label="Company" className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <Link href="/pricing" className="hover:text-ink">
        Pricing
      </Link>
      <Link href="/privacy" className="hover:text-ink">
        Privacy
      </Link>
      <Link href="/terms" className="hover:text-ink">
        Terms
      </Link>
    </nav>
  );
}
