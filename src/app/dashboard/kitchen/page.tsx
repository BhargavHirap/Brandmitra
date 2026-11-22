import Link from "next/link";
import { kitchenAdvanceAction } from "@/app/actions/orders";
import { KitchenAutoRefresh } from "@/components/kitchen-refresh";
import { PageHeader } from "@/components/ui";
import { requireBusiness } from "@/lib/business";
import { getDb } from "@/lib/db";
import { formatDateTime, formatMoney } from "@/lib/format";
import {
  KITCHEN_ACTIONS,
  KITCHEN_COLUMNS,
  optionNames,
  paymentLabel,
  statusLabel,
  STATUS_TONES,
} from "@/lib/orders";
import { workspaceFor, type Workspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";
export const metadata = { title: "Fulfilment board" };

/**
 * PHASE 4 — KITCHEN DISPLAY
 *
 * A screen for the person cooking, not for the owner. Three columns (New,
 * Preparing, Ready), one giant button per ticket, and a page that refreshes
 * itself so a ticket placed on a customer's phone appears here without anyone
 * touching the tablet.
 *
 * Everything is read through `requireBusiness()`, so this board only ever shows
 * this business's orders. The status buttons post to the same transition graph
 * the order page uses — the UI is bigger, the rules are identical.
 */

/** The button wording follows the business's own vocabulary. */
function actionLabel(status: string, ws: Workspace): string {
  if (status === "preparing") return ws.startAction;
  if (status === "ready") return ws.readyAction;
  if (status === "delivered") return ws.handoverAction;
  if (status === "out_for_delivery") return "Out for delivery";
  return "Advance";
}

type TicketRow = {
  id: string;
  order_number: string;
  status: string;
  total: number;
  payment_method: string;
  created_at: string;
  customer_name: string | null;
  customer_phone: string | null;
  customer_note: string;
};

type ItemRow = {
  order_id: string;
  name_snapshot: string;
  quantity: number;
  options: string;
};

function minutesSince(iso: string): number {
  const started = new Date(iso).getTime();
  if (Number.isNaN(started)) return 0;
  return Math.max(0, Math.floor((Date.now() - started) / 60000));
}

function elapsedLabel(minutes: number): string {
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h ago` : `${hours}h ${rest}m ago`;
}

/** Waiting tickets get louder as they get older. */
function ageTone(minutes: number): string {
  if (minutes >= 30) return "border-danger/25 bg-danger/5 text-danger";
  if (minutes >= 15) return "border-warning/25 bg-warning/5 text-warning";
  return "border-line bg-canvas text-muted";
}

function cardsFor(items: ItemRow[]): Map<string, ItemRow[]> {
  const grouped = new Map<string, ItemRow[]>();
  for (const item of items) {
    const list = grouped.get(item.order_id) ?? [];
    list.push(item);
    grouped.set(item.order_id, list);
  }
  return grouped;
}

export default async function KitchenPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { business } = await requireBusiness();
  const ws = workspaceFor(business.industry);
  const { error } = await searchParams;
  const db = await getDb();

  const [tickets, items] = await Promise.all([
    db.all<TicketRow>(
      `SELECT o.id, o.order_number, o.status, o.total, o.payment_method, o.created_at,
              o.customer_note, c.name AS customer_name, c.phone AS customer_phone
         FROM orders o
         LEFT JOIN customers c ON c.id = o.customer_id
        WHERE o.business_id = ? AND o.status IN ('new', 'accepted', 'preparing', 'ready')
        ORDER BY o.created_at ASC`,
      [business.id],
    ),
    db.all<ItemRow>(
      `SELECT i.order_id, i.name_snapshot, i.quantity, i.options
         FROM order_items i
         JOIN orders o ON o.id = i.order_id AND o.business_id = ?
        WHERE o.status IN ('new', 'accepted', 'preparing', 'ready')
        ORDER BY i.rowid ASC`,
      [business.id],
    ),
  ]);

  const itemsByOrder = cardsFor(items);
  const activeCount = tickets.length;

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Operate"
        title={ws.board}
        description={ws.boardIntro}
        actions={
          <>
            <Link href="/dashboard/orders" className="btn btn-ghost text-[12.5px]">
              {ws.orders}
            </Link>
            <Link
              href={`/b/${business.slug}`}
              target="_blank"
              className="btn btn-primary text-[12.5px]"
            >
              View storefront
            </Link>
          </>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-white px-3 py-2.5">
        <div className="flex items-baseline gap-2">
          <span className="text-[13px] font-semibold">
            {activeCount === 0
              ? ws.boardEmpty
              : `${activeCount} ${activeCount === 1 ? ws.order : ws.orders.toLowerCase()} on the board`}
          </span>
          <span className="text-[11px] text-muted">Auto-refreshes — no need to reload</span>
        </div>
        <KitchenAutoRefresh seconds={10} />
      </div>

      {error === "transition" && (
        <div className="rounded-[10px] border border-danger/20 bg-danger/5 px-3.5 py-2.5 text-[12.5px] text-danger">
          That move is not allowed from its current status. The board below is up to
          date.
        </div>
      )}
      {error === "stale" && (
        <div className="rounded-[10px] border border-warning/25 bg-warning/5 px-3.5 py-2.5 text-[12.5px] text-warning">
          Someone else moved that ticket first. Check the board — it now shows the current status.
        </div>
      )}
      {error === "missing" && (
        <div className="rounded-[10px] border border-danger/20 bg-danger/5 px-3.5 py-2.5 text-[12.5px] text-danger">
          That order no longer exists for this business.
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-3">
        {KITCHEN_COLUMNS.map((column, columnIndex) => {
          const rows = tickets.filter((ticket) => (column.statuses as string[]).includes(ticket.status));

          return (
            <section key={column.id} className="rounded-2xl border border-line bg-canvas/40">
              <header className="flex items-center justify-between gap-2 border-b border-line px-3 py-2.5">
                <div className="min-w-0">
                  <h2 className="text-[13px] font-semibold tracking-[-0.01em]">
                    {ws.columnLabels[columnIndex]}
                  </h2>
                  <p className="text-[10.5px] text-muted">{ws.columnHints[columnIndex]}</p>
                </div>
                <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-ink px-2 text-[12px] font-semibold tabular-nums text-white">
                  {rows.length}
                </span>
              </header>

              <div className="space-y-2.5 p-2.5">
                {rows.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-line bg-white/60 px-3 py-8 text-center">
                    <p className="text-[12.5px] font-medium text-muted">Nothing here</p>
                    <p className="mt-1 text-[11px] text-muted/80">
                      {ws.columnEmpty[columnIndex]}
                    </p>
                  </div>
                ) : (
                  rows.map((ticket) => {
                    const minutes = minutesSince(ticket.created_at);
                    const lines = itemsByOrder.get(ticket.id) ?? [];
                    const actions = KITCHEN_ACTIONS[ticket.status] ?? [];
                    const visible = ws.allowDispatch
                      ? actions
                      : actions.filter((action) => action.status !== "out_for_delivery");
                    const [primary, secondary] = visible;
                    const tone =
                      STATUS_TONES[ticket.status] ?? "border-line bg-canvas text-muted";

                    return (
                      <article
                        key={ticket.id}
                        className="rounded-xl border border-line bg-white p-3 shadow-[0_1px_0_rgba(11,11,15,0.04)]"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-[17px] font-semibold leading-none tracking-[-0.01em] tabular-nums">
                              {ticket.order_number}
                            </p>
                            <p className="mt-1 text-[11px] text-muted">
                              {formatDateTime(ticket.created_at)}
                            </p>
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-1">
                            <span
                              className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${tone}`}
                            >
                              {statusLabel(ticket.status)}
                            </span>
                            <span
                              className={`rounded-full border px-2 py-0.5 text-[10px] font-medium tabular-nums ${ageTone(minutes)}`}
                            >
                              {elapsedLabel(minutes)}
                            </span>
                          </div>
                        </div>

                        <ul className="mt-3 space-y-1.5 border-t border-line pt-2.5">
                          {lines.length === 0 ? (
                            <li className="text-[11.5px] text-muted">No items recorded.</li>
                          ) : (
                            lines.map((line, index) => {
                              const chosen = optionNames(line.options);
                              return (
                                <li key={`${line.name_snapshot}-${index}`} className="flex gap-2">
                                  <span className="mt-px flex h-5 min-w-5 shrink-0 items-center justify-center rounded-md bg-canvas px-1 text-[11px] font-semibold tabular-nums">
                                    {line.quantity}
                                  </span>
                                  <div className="min-w-0">
                                    <p className="text-[13px] font-medium leading-tight">
                                      {line.name_snapshot}
                                    </p>
                                    {chosen.length > 0 && (
                                      <p className="mt-0.5 text-[11px] leading-snug text-muted">
                                        {chosen.join(" · ")}
                                      </p>
                                    )}
                                  </div>
                                </li>
                              );
                            })
                          )}
                        </ul>

                        {ticket.customer_note && (
                          <div className="mt-2.5 rounded-lg border border-warning/25 bg-warning/5 px-2.5 py-1.5">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-warning">
                              Note
                            </p>
                            <p className="mt-0.5 text-[12px] leading-snug">{ticket.customer_note}</p>
                          </div>
                        )}

                        <div className="mt-2.5 flex items-center justify-between gap-2 text-[11px] text-muted">
                          <span className="truncate">
                            {paymentLabel(ticket.payment_method)}
                            {ticket.customer_name ? ` · ${ticket.customer_name}` : ""}
                          </span>
                          <span className="shrink-0 font-semibold tabular-nums text-ink">
                            {formatMoney(ticket.total)}
                          </span>
                        </div>

                        {primary && (
                          <form action={kitchenAdvanceAction} className="mt-2.5">
                            <input type="hidden" name="id" value={ticket.id} />
                            <input type="hidden" name="status" value={primary.status} />
                            <button
                              type="submit"
                              className="btn btn-primary min-h-[52px] w-full text-[14.5px] font-semibold"
                            >
                              {actionLabel(primary.status, ws)}
                            </button>
                          </form>
                        )}

                        {secondary && (
                          <form action={kitchenAdvanceAction} className="mt-1.5">
                            <input type="hidden" name="id" value={ticket.id} />
                            <input type="hidden" name="status" value={secondary.status} />
                            <button
                              type="submit"
                              className="btn btn-ghost min-h-[46px] w-full text-[13px] font-medium"
                            >
                              {actionLabel(secondary.status, ws)}
                            </button>
                          </form>
                        )}

                        <Link
                          href={`/dashboard/orders/${ticket.id}`}
                          className="mt-2 block py-1 text-center text-[11px] font-medium text-muted hover:text-ink"
                        >
                          Open full {ws.order}
                        </Link>
                      </article>
                    );
                  })
                )}
              </div>
            </section>
          );
        })}
      </div>

      <p className="px-1 text-[11.5px] leading-relaxed text-muted">
        The board is sorted oldest first and refreshes every 10 seconds. Buttons follow the same
        status rules as the full {ws.order} page: you cannot skip a step, and only finished work can
        be closed.
      </p>
    </div>
  );
}
