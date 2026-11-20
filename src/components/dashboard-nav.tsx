"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Item = { label: string; href: string; phase: number; ready?: boolean };

const SECTIONS: { group: string; items: Item[] }[] = [
  {
    group: "Workspace",
    items: [
      { label: "Overview", href: "/dashboard", phase: 1, ready: true },
      { label: "My website", href: "/dashboard/website", phase: 1, ready: true },
    ],
  },
  {
    group: "Operate",
    items: [
      { label: "Products", href: "/dashboard/products", phase: 2, ready: true },
      { label: "Categories", href: "/dashboard/categories", phase: 2, ready: true },
      { label: "Orders", href: "/dashboard/orders", phase: 3, ready: true },
      { label: "Kitchen display", href: "/dashboard/kitchen", phase: 4, ready: true },
      { label: "Customers", href: "/dashboard/customers", phase: 3 },
      { label: "Inventory", href: "/dashboard/inventory", phase: 8 },
    ],
  },
  {
    group: "Grow with AI",
    items: [
      { label: "WhatsApp assistant", href: "/dashboard/whatsapp", phase: 6 },
      { label: "AI marketing studio", href: "/dashboard/marketing", phase: 5, ready: true },
      { label: "AI business agent", href: "/dashboard/agent", phase: 5, ready: true },
    ],
  },
  {
    group: "Business",
    items: [
      { label: "Analytics", href: "/dashboard/analytics", phase: 3 },
      { label: "Staff", href: "/dashboard/staff", phase: 8 },
      { label: "Settings", href: "/dashboard/settings", phase: 7 },
      { label: "Subscription", href: "/dashboard/subscription", phase: 7 },
    ],
  },
];

export function DashboardNav({
  planId,
  variant,
}: {
  planId: string;
  variant: "desktop" | "mobile";
}) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === href : pathname.startsWith(href);

  if (variant === "mobile") {
    return (
      <nav className="flex gap-1.5 overflow-x-auto pb-1 lg:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {SECTIONS.flatMap((section) => section.items).map((item) => {
          const active = isActive(item.href);
          if (!item.ready) {
            return (
              <span
                key={item.label}
                className="shrink-0 rounded-full border border-line bg-white px-3 py-1.5 text-[12px] text-muted/60"
                title={`Planned for Phase ${item.phase}`}
              >
                {item.label} · P{item.phase}
              </span>
            );
          }
          return (
            <Link
              key={item.label}
              href={item.href}
              className={`shrink-0 rounded-full px-3 py-1.5 text-[12px] transition-colors ${
                active ? "bg-ink font-medium text-white" : "border border-line bg-white text-muted"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <>
      {/* Desktop sidebar */}
      <nav className="hidden flex-col gap-6 lg:flex">
        {SECTIONS.map((section) => (
          <div key={section.group}>
            <p className="px-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted/70">
              {section.group}
            </p>
            <ul className="mt-2 space-y-0.5">
              {section.items.map((item) => {
                const active = isActive(item.href);
                return (
                  <li key={item.label}>
                    {!item.ready ? (
                      <div
                        className="flex cursor-default items-center justify-between rounded-lg px-2.5 py-[7px] text-[13px] text-muted/60"
                        title={`Planned for Phase ${item.phase}`}
                      >
                        <span>{item.label}</span>
                        <span className="rounded border border-line px-1 py-px text-[9px] font-medium tracking-wide">
                          P{item.phase}
                        </span>
                      </div>
                    ) : (
                      <Link
                        href={item.href}
                        className={`flex items-center justify-between rounded-lg px-2.5 py-[7px] text-[13px] transition-colors ${
                          active
                            ? "bg-canvas font-semibold text-ink"
                            : "text-muted hover:bg-canvas/70 hover:text-ink"
                        }`}
                      >
                        <span>{item.label}</span>
                        {active && <span className="h-1.5 w-1.5 rounded-full bg-brand" />}
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
        <div className="rounded-xl border border-line bg-gradient-to-b from-white to-canvas p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">Plan</p>
          <p className="mt-1 text-[13px] font-semibold capitalize">{planId}</p>
          <p className="mt-1 text-[11px] leading-relaxed text-muted">
            Billing and plan changes arrive in Phase 7.
          </p>
        </div>
      </nav>
    </>
  );
}
