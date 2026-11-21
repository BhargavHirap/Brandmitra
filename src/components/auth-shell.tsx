import Link from "next/link";
import { BrandLink, LogoMark } from "@/components/brand";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <div className="relative hidden flex-col justify-between bg-ink p-10 text-white lg:flex">
        <BrandLink href="/" />
        <div className="max-w-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand">
            The AI operating system
          </p>
          <h2 className="mt-4 text-3xl font-semibold leading-tight tracking-[-0.02em]">
            One account. A storefront, an order desk and an AI team.
          </h2>
          <p className="mt-4 text-[13.5px] leading-relaxed text-white/55">
            Your data is isolated per business at the database layer. No plugins, no
            spreadsheets, no third-party storefront builder to glue together.
          </p>
          <div className="mt-8 space-y-3">
            {[
              "Generated storefront at /b/your-business",
              "Orders, kitchen display and analytics",
              "AI agent that reads your real numbers",
            ].map((item) => (
              <div key={item} className="flex items-center gap-3 text-[13px] text-white/70">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/10">
                  <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none">
                    <path d="M2.5 6.5 5 9l4.5-5.5" stroke="#7aa2ff" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                </span>
                {item}
              </div>
            ))}
          </div>
        </div>
        <p className="text-[11px] text-white/35">© {new Date().getFullYear()} Vantra</p>
      </div>

      <div className="flex flex-col justify-center bg-white px-5 py-12 sm:px-12">
        <div className="mx-auto w-full max-w-sm">
          <div className="lg:hidden">
            <BrandLink href="/" />
          </div>
          <div className="mt-8 lg:mt-0">
            <div className="flex items-center gap-2">
              <LogoMark className="h-6 w-6 lg:hidden" />
              <h1 className="text-2xl font-semibold tracking-[-0.02em]">{title}</h1>
            </div>
            <p className="mt-2 text-[13.5px] text-muted">{subtitle}</p>
          </div>
          <div className="mt-7">{children}</div>
          <div className="mt-6 text-[13px] text-muted">{footer}</div>
          <p className="mt-10 text-[11px] leading-relaxed text-muted/80">
            By continuing you agree to Vantra&apos;s terms of service and privacy policy.
          </p>
        </div>
      </div>
    </div>
  );
}

export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <div className="mb-4 rounded-[10px] border border-danger/20 bg-danger/5 px-3 py-2 text-[12.5px] text-danger">
      {message}
    </div>
  );
}

export function AuthFooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="font-semibold text-ink underline decoration-line underline-offset-4 hover:decoration-ink">
      {children}
    </Link>
  );
}
