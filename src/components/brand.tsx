import Link from "next/link";

export function LogoMark({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-[9px] bg-ink text-white ${className}`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none">
        <path d="M6 18V6h6a4 4 0 0 1 0 8H6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <circle cx="17.5" cy="7" r="1.6" fill="#2f6bff" />
      </svg>
    </span>
  );
}

export function BrandLink({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2.5">
      <LogoMark />
      <span className="text-[15px] font-semibold tracking-[-0.01em]">brandmitra</span>
    </Link>
  );
}
