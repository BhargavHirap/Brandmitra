import Link from "next/link";

/**
 * Small shared building blocks for dashboard pages.
 * Keeping them here means every screen has identical spacing and type scale.
 */

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-muted">
            {eyebrow}
          </p>
        )}
        <h1 className="mt-1 text-[22px] font-semibold leading-tight tracking-[-0.02em] sm:text-[26px]">
          {title}
        </h1>
        {description && (
          <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-muted">{description}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "brand";
}) {
  return (
    <div className="card p-4">
      <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted">{label}</p>
      <p
        className={`mt-2 text-[24px] font-semibold leading-none tracking-[-0.02em] ${
          tone === "brand" ? "text-brand" : "text-ink"
        }`}
      >
        {value}
      </p>
      {hint && <p className="mt-1.5 text-[11.5px] text-muted">{hint}</p>}
    </div>
  );
}

export function Panel({
  title,
  description,
  action,
  children,
  className = "",
  padded = true,
}: {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <section className={`card ${className}`}>
      {(title || action) && (
        <div className="flex items-start justify-between gap-3 border-b border-line px-4 py-3.5">
          <div className="min-w-0">
            {title && <h2 className="text-[13.5px] font-semibold tracking-[-0.01em]">{title}</h2>}
            {description && <p className="mt-0.5 text-[11.5px] text-muted">{description}</p>}
          </div>
          {action}
        </div>
      )}
      <div className={padded ? "p-4" : ""}>{children}</div>
    </section>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-line bg-canvas/50 px-4 py-8 text-center">
      <p className="text-[13px] font-medium">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-[12px] leading-relaxed text-muted">{description}</p>
      {action && <div className="mt-3 flex justify-center">{action}</div>}
    </div>
  );
}

export function PhaseNotice({
  phase,
  title,
  description,
}: {
  phase: number;
  title: string;
  description: string;
}) {
  return (
    <div className="card flex flex-col gap-3 border-brand/25 bg-brand-soft/40 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-brand">
          Planned · Phase {phase}
        </p>
        <p className="mt-1 text-[13px] font-semibold">{title}</p>
        <p className="mt-1 max-w-xl text-[12px] leading-relaxed text-muted">{description}</p>
      </div>
      <Link href="/dashboard" className="btn btn-ghost shrink-0 px-3 py-1.5 text-[12px]">
        Back to overview
      </Link>
    </div>
  );
}
