import Link from "next/link";

/** A dead link is a dead end unless it offers the two things people wanted. */
export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-5 py-16">
      <div className="w-full max-w-[360px] text-center">
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">404</p>
        <h1 className="mt-3 text-[26px] font-light leading-tight tracking-[-0.03em]">
          There is nothing at this address.
        </h1>
        <p className="mt-3 text-[12.5px] leading-relaxed text-muted">
          The link may be old, or the business may have renamed its storefront.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <Link href="/" className="btn btn-primary h-11 w-full text-[13px]">
            Back to home
          </Link>
          <Link href="/login" className="btn btn-ghost h-11 w-full text-[13px]">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
