"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { workspaceFor } from "@/lib/workspace";
import { deskFor } from "@/lib/reception";

type Item = { key: string; label: string; href: string; phase: number; ready?: boolean };

/**
 * The sidebar labels come from the business's own vocabulary, so a salon reads
 * "Services · Service groups · Appointments · Appointment board · Clients" and a
 * wholesaler reads "SKUs · Product groups · Purchase orders · Dispatch board ·
 * Buyers". The routes underneath are the same modules for everyone.
 */
function sectionsFor(industry: string, ownerTools: boolean): { group: string; items: Item[] }[] {
  const w = workspaceFor(industry);
  const desk = deskFor(industry);
  /*
   * Founder-only screens are added to the list, never hidden behind a CSS
   * class: an item that is not in this array is not in the markup, and the
   * server still refuses the page itself if somebody types the URL.
   */
  const businessItems: Item[] = [
    { key: "analytics", label: "Analytics", href: "/dashboard/analytics", phase: 3, ready: true },
    { key: "staff", label: "Staff", href: "/dashboard/staff", phase: 8, ready: true },
    { key: "settings", label: "Settings", href: "/dashboard/settings", phase: 7, ready: true },
    { key: "subscription", label: "Subscription", href: "/dashboard/subscription", phase: 7, ready: true },
  ];
  if (ownerTools) {
    businessItems.push({
      key: "security",
      label: "Security log",
      href: "/dashboard/security",
      phase: 7,
      ready: true,
    });
  }
  return [
    {
      group: "Workspace",
      items: [
        { key: "overview", label: "Overview", href: "/dashboard", phase: 1, ready: true },
        { key: "website", label: "My website", href: "/dashboard/website", phase: 1, ready: true },
      ],
    },
    {
      group: "Operate",
      items: [
        { key: "products", label: w.items, href: "/dashboard/products", phase: 2, ready: true },
        { key: "categories", label: w.categories, href: "/dashboard/categories", phase: 2, ready: true },
        { key: "orders", label: w.orders, href: "/dashboard/orders", phase: 3, ready: true },
        { key: "receptionist", label: desk.title, href: "/dashboard/receptionist", phase: 3, ready: true },
        { key: "board", label: w.board, href: "/dashboard/kitchen", phase: 4, ready: true },
        { key: "customers", label: w.customers, href: "/dashboard/customers", phase: 3, ready: true },
        { key: "inventory", label: "Inventory", href: "/dashboard/inventory", phase: 8, ready: true },
      ],
    },
    {
      group: "Grow with AI",
      items: [
        { key: "whatsapp", label: "WhatsApp assistant", href: "/dashboard/whatsapp", phase: 6, ready: true },
        { key: "marketing", label: "AI marketing studio", href: "/dashboard/marketing", phase: 5, ready: true },
        { key: "agent", label: "AI business agent", href: "/dashboard/agent", phase: 5, ready: true },
      ],
    },
    { group: "Business", items: businessItems },
  ];
}

export function DashboardNav({
  planId,
  industry,
  variant,
  ownerTools = false,
}: {
  planId: string;
  industry: string;
  variant: "desktop" | "mobile";
  ownerTools?: boolean;
}) {
  const pathname = usePathname();
  const sections = sectionsFor(industry, ownerTools);
  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === href : pathname.startsWith(href);

  if (variant === "mobile") {
    return (
      <nav className="flex gap-1.5 overflow-x-auto pb-1 lg:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {sections.flatMap((section) => section.items).map((item) => {
          const active = isActive(item.href);
          if (!item.ready) {
            return (
              <span
                key={item.key}
                className="shrink-0 rounded-full border border-line bg-white px-3 py-1.5 text-[12px] text-muted/60"
                title={`Planned for Phase ${item.phase}`}
              >
                {item.label} · P{item.phase}
              </span>
            );
          }
          return (
            <Link
              key={item.key}
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
        {sections.map((section) => (
          <div key={section.group}>
            <p className="px-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted/70">
              {section.group}
            </p>
            <ul className="mt-2 space-y-0.5">
              {section.items.map((item) => {
                const active = isActive(item.href);
                return (
                  <li key={item.key}>
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
