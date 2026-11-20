/**
 * Order status rules — one place, used by the dashboard detail page and the
 * status action. A status change that is not in this graph is refused on the
 * server, so the UI can never skip "preparing" and jump straight to "delivered".
 */

export const ORDER_STATUSES = [
  "new",
  "accepted",
  "preparing",
  "ready",
  "out_for_delivery",
  "delivered",
  "cancelled",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  // "new → preparing" exists for the kitchen board: staff start cooking from the
  // ticket they see. Accepting first is optional, and every other jump is still
  // refused (for example new → ready, or new → delivered).
  new: ["accepted", "preparing", "cancelled"],
  accepted: ["preparing", "cancelled"],
  preparing: ["ready", "cancelled"],
  ready: ["out_for_delivery", "delivered", "cancelled"],
  out_for_delivery: ["delivered", "cancelled"],
  delivered: [],
  cancelled: [],
};

export function allowedTransitions(status: string): OrderStatus[] {
  return TRANSITIONS[status as OrderStatus] ?? [];
}

export const OPEN_STATUSES: OrderStatus[] = [
  "new",
  "accepted",
  "preparing",
  "ready",
  "out_for_delivery",
];

export const STATUS_LABELS: Record<string, string> = {
  new: "New",
  accepted: "Accepted",
  preparing: "Preparing",
  ready: "Ready",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export const STATUS_TONES: Record<string, string> = {
  new: "border-brand/25 bg-brand-soft text-brand",
  accepted: "border-brand/25 bg-brand-soft text-brand",
  preparing: "border-warning/25 bg-warning/5 text-warning",
  ready: "border-success/25 bg-success/5 text-success",
  out_for_delivery: "border-success/25 bg-success/5 text-success",
  delivered: "border-line bg-canvas text-muted",
  cancelled: "border-danger/20 bg-danger/5 text-danger",
};

export function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

/** The three columns of the kitchen board, and which statuses appear in each. */
export const KITCHEN_COLUMNS: {
  id: string;
  label: string;
  hint: string;
  statuses: OrderStatus[];
}[] = [
  {
    id: "incoming",
    label: "New",
    hint: "Just placed, not started",
    statuses: ["new"],
  },
  {
    id: "cooking",
    label: "Preparing",
    hint: "Accepted or in the kitchen",
    statuses: ["accepted", "preparing"],
  },
  {
    id: "ready",
    label: "Ready",
    hint: "Waiting to be handed over",
    statuses: ["ready"],
  },
];

/**
 * The one big button (or two) a kitchen ticket offers. The button label is
 * cosmetic — every target is re-checked against the transition graph on the
 * server, so a tampered form cannot skip a step.
 */
export const KITCHEN_ACTIONS: Record<string, { status: OrderStatus; label: string }[]> = {
  new: [{ status: "preparing", label: "Start preparing" }],
  accepted: [{ status: "preparing", label: "Start preparing" }],
  preparing: [{ status: "ready", label: "Mark ready" }],
  ready: [
    { status: "delivered", label: "Handed over" },
    { status: "out_for_delivery", label: "Out for delivery" },
  ],
};

/** Read the option names out of an order_items.options snapshot. */
export function optionNames(raw: string): string[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry) => (entry as { name?: unknown }).name)
      .filter((name): name is string => typeof name === "string");
  } catch {
    return [];
  }
}

export function paymentLabel(method: string): string {
  if (method === "cod") return "Cash on delivery";
  if (method === "pay_at_store") return "Pay at store";
  return method;
}
