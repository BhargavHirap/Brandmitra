import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { clearCartAction, removeCartItemAction, updateCartItemAction } from "@/app/actions/cart";
import { placeOrderAction } from "@/app/actions/orders";
import { BrandLink } from "@/components/brand";
import { loadCart } from "@/lib/cart";
import { getDb } from "@/lib/db";
import { formatMoney } from "@/lib/format";
import { sentenceStart, workspaceFor } from "@/lib/workspace";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your cart" };

/**
 * Public cart + checkout.
 *
 * The page only displays what loadCart() computed from the database. The form it
 * posts carries a name, a phone number and a note — no prices, no totals. Those
 * are recalculated during checkout, so editing this HTML changes nothing.
 */

const ERROR_TEXT: Record<string, string> = {
  empty: "Your cart is empty — add something first.",
  unavailable: "Some items are no longer available. Remove them and try again.",
  name: "Please enter the name the order should be prepared for.",
  phone: "Please enter a valid phone number with at least 10 digits.",
  closed: "This storefront is not accepting orders right now.",
};

type StoreRow = {
  id: string;
  slug: string;
  name: string;
  status: string;
  brand_color: string | null;
  phone: string | null;
  whatsapp: string | null;
  industry: string;
};

export default async function CartPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string; added?: string }>;
}) {
  const { slug } = await params;
  const { error, added } = await searchParams;

  const db = await getDb();
  const store = await db.first<StoreRow>(
    `SELECT b.id, b.slug, b.name, b.status, b.industry, p.brand_color, p.phone, p.whatsapp
       FROM businesses b
       LEFT JOIN business_profiles p ON p.business_id = b.id
      WHERE b.slug = ?`,
    [slug],
  );
  if (!store) notFound();

  const accent = /^#[0-9a-fA-F]{6}$/.test(store.brand_color ?? "") ? store.brand_color! : "#2F6BFF";
  const ws = workspaceFor(store.industry);
  const cart = store.status === "active" ? await loadCart(store.id) : null;
  const lines = cart?.lines ?? [];
  const errorMessage = error ? ERROR_TEXT[error] : undefined;

  return (
    <div className="min-h-screen bg-canvas">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-3 px-5">
          <Link href={`/b/${store.slug}`} className="flex items-center gap-2 text-[12.5px] text-muted hover:text-ink">
            ← {ws.storefrontBack}
          </Link>
          <div className="flex items-center gap-2">
            <span
              className="flex h-7 w-7 items-center justify-center rounded-lg text-[11px] font-semibold text-white"
              style={{ backgroundColor: accent }}
            >
              {store.name.slice(0, 1).toUpperCase()}
            </span>
            <span className="truncate text-[13px] font-semibold">{store.name}</span>
          </div>
          <span className="hidden sm:block">
            <BrandLink href="/" />
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 py-8 sm:py-10">
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Step 1 of 2</p>
            <h1 className="mt-1 text-[24px] font-semibold tracking-[-0.02em]">{ws.cartTitle}</h1>
          </div>
          {lines.length > 0 && (
            <form action={clearCartAction}>
              <input type="hidden" name="slug" value={store.slug} />
              <button type="submit" className="text-[11.5px] text-muted hover:text-danger hover:underline">
                Empty cart
              </button>
            </form>
          )}
        </div>

        {added === "1" && (
          <div className="mt-4 rounded-[10px] border border-success/20 bg-success/5 px-3.5 py-2.5 text-[12.5px] text-success">
                          Added to your selection.
            </div>
        )}
        {errorMessage && (
          <div className="mt-4 rounded-[10px] border border-warning/25 bg-warning/5 px-3.5 py-2.5 text-[12.5px] text-warning">
            {errorMessage}
          </div>
        )}

        {store.status !== "active" ? (
          <div className="mt-6 rounded-xl border border-line bg-white px-5 py-12 text-center">
            <p className="text-[13.5px] font-medium">This storefront is offline</p>
            <p className="mx-auto mt-1 max-w-md text-[12.5px] text-muted">
              {store.name} is not accepting {ws.orders.toLowerCase()} right now.
            </p>
          </div>
        ) : lines.length === 0 ? (
          <div className="mt-6 rounded-xl border border-dashed border-line bg-white px-5 py-14 text-center">
            <p className="text-[13.5px] font-medium">Your cart is empty</p>
            <p className="mx-auto mt-1 max-w-md text-[12.5px] leading-relaxed text-muted">
              Browse {store.name}&apos;s {ws.storefrontList.toLowerCase()} and add something you like.
            </p>
            <Link
              href={`/b/${store.slug}#catalogue`}
              className="btn mt-4 text-white"
              style={{ backgroundColor: accent }}
            >
              {ws.storefrontBrowseLabel}
            </Link>
          </div>
        ) : (
          <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_380px]">
            <ul className="card divide-y divide-line overflow-hidden">
              {lines.map((line) => (
                <li key={line.itemId} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[13.5px] font-semibold leading-tight">{line.name}</p>
                      <p className="mt-0.5 text-[11.5px] text-muted">
                        {line.options.length > 0
                          ? line.options.map((option) => option.name).join(" · ")
                          : "No options"}
                      </p>
                      <p className="mt-1 text-[11.5px] text-muted">
                        {formatMoney(line.unitPrice)} each
                      </p>
                    </div>
                    <p className="shrink-0 text-[13px] font-semibold tabular-nums">
                      {formatMoney(line.lineTotal)}
                    </p>
                  </div>

                  {!line.available && (
                    <p className="mt-2 rounded-md border border-warning/20 bg-warning/5 px-2.5 py-1.5 text-[11.5px] leading-relaxed text-warning">
                      {line.reason} Remove it to continue.
                    </p>
                  )}

                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <form action={updateCartItemAction} className="flex items-center gap-1.5">
                      <input type="hidden" name="slug" value={store.slug} />
                      <input type="hidden" name="id" value={line.itemId} />
                      <input
                        name="quantity"
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={20}
                        defaultValue={line.quantity}
                        aria-label={`Quantity of ${line.name}`}
                        className="field w-16 px-2 py-1 text-center text-[12px]"
                      />
                      <button type="submit" className="btn btn-ghost px-2.5 py-1 text-[11.5px]">
                        Update
                      </button>
                    </form>
                    <form action={removeCartItemAction}>
                      <input type="hidden" name="slug" value={store.slug} />
                      <input type="hidden" name="id" value={line.itemId} />
                      <button
                        type="submit"
                        className="text-[11.5px] text-muted underline-offset-2 hover:text-danger hover:underline"
                      >
                        Remove
                      </button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>

            <div className="space-y-3">
              <section className="card p-4">
                <h2 className="text-[13px] font-semibold">{sentenceStart(ws.order)} summary</h2>
                <dl className="mt-3 space-y-1.5 text-[12.5px]">
                  <div className="flex justify-between gap-3 text-muted">
                    <dt>{sentenceStart(ws.itemsLower)}</dt>
                    <dd className="tabular-nums">{cart?.itemCount ?? 0}</dd>
                  </div>
                  <div className="flex justify-between gap-3 text-muted">
                    <dt>Subtotal</dt>
                    <dd className="tabular-nums">{formatMoney(cart?.subtotal ?? 0)}</dd>
                  </div>
                  <div className="flex justify-between gap-3 border-t border-line pt-2 text-[14px] font-semibold">
                    <dt>Total</dt>
                    <dd className="tabular-nums">{formatMoney(cart?.subtotal ?? 0)}</dd>
                  </div>
                </dl>
                <p className="mt-2 text-[10.5px] leading-relaxed text-muted">
                  {ws.fulfilmentNote}
                </p>
              </section>

              <section className="card p-4">
                <h2 className="text-[13px] font-semibold">Your details</h2>

                {cart?.hasUnavailable ? (
                  <p className="mt-2 rounded-md border border-warning/20 bg-warning/5 px-2.5 py-2 text-[11.5px] leading-relaxed text-warning">
                    Remove the unavailable items above before placing the {ws.order}.
                  </p>
                ) : (
                  <form action={placeOrderAction} className="mt-3 space-y-3">
                    <input type="hidden" name="slug" value={store.slug} />
                    <div>
                      <label className="label" htmlFor="customerName">
                        Name
                      </label>
                      <input
                        id="customerName"
                        name="name"
                        required
                        minLength={2}
                        maxLength={80}
                        autoComplete="name"
                        className="field"
                        placeholder="Your name"
                      />
                    </div>
                    <div>
                      <label className="label" htmlFor="customerPhone">
                        Phone
                      </label>
                      <input
                        id="customerPhone"
                        name="phone"
                        required
                        inputMode="tel"
                        autoComplete="tel"
                        maxLength={20}
                        className="field"
                        placeholder="+91 98765 43210"
                      />
                      <p className="mt-1 text-[10.5px] text-muted">
                        The business uses this to contact you about the {ws.order}.
                      </p>
                    </div>
                    <div>
                      <label className="label" htmlFor="customerNote">
                        Note (optional)
                      </label>
                      <textarea
                        id="customerNote"
                        name="note"
                        rows={2}
                        maxLength={400}
                                                    className="field resize-y"
                            placeholder={ws.notePlaceholder}
                          />
                    </div>

                    <fieldset>
                      <legend className="label">Payment</legend>
                      <div className="space-y-1.5">
                        <label className="flex items-start gap-2 text-[12px]">
                          <input
                            type="radio"
                            name="paymentMethod"
                            value="cod"
                            defaultChecked
                            className="mt-0.5 h-3.5 w-3.5 accent-[#2f6bff]"
                          />
                          <span>
                            <span className="font-medium">{ws.payLaterLabel}</span>
                            <span className="block text-[10.5px] text-muted">{ws.payLaterHint}</span>
                          </span>
                        </label>
                        <label className="flex items-start gap-2 text-[12px]">
                          <input
                            type="radio"
                            name="paymentMethod"
                            value="pay_at_store"
                            className="mt-0.5 h-3.5 w-3.5 accent-[#2f6bff]"
                          />
                          <span>
                            <span className="font-medium">{ws.payAtStoreLabel}</span>
                            <span className="block text-[10.5px] text-muted">{ws.payAtStoreHint}</span>
                          </span>
                        </label>
                      </div>
                    </fieldset>

                    <button
                      type="submit"
                      className="btn w-full text-white"
                      style={{ backgroundColor: accent }}
                    >
                      {ws.checkoutAction} · {formatMoney(cart?.subtotal ?? 0)}
                    </button>
                    <p className="text-center text-[10.5px] leading-relaxed text-muted">
                      You will get a receipt number and a private link on the next screen.
                    </p>
                  </form>
                )}
              </section>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
