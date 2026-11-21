"use client";

import { useActionState, useEffect, useState } from "react";
import {
  importMenuAction,
  scanMenuAction,
  type MenuScanState,
} from "@/app/actions/menu-import";

/**
 * Menu photo import.
 *
 * Step 1 is a server action that reads the photo; step 2 is a plain form that
 * posts only the rows the owner kept. The photo never leaves the browser as a
 * file — it is shrunk on a canvas first, because phone photos are several
 * megabytes and a menu only needs about 1100 pixels on its longest edge.
 */

type Row = { key: string; include: boolean; name: string; price: string; category: string };

type Credits = { used: number; limit: number; planName: string; monthLabel: string };

const MAX_EDGE = 1100;

async function shrinkImage(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is unavailable in this browser.");
  context.drawImage(bitmap, 0, 0, width, height);

  return canvas.toDataURL("image/jpeg", 0.8);
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Could not read that file."));
    reader.readAsDataURL(file);
  });
}

export function MenuImport({
  configured,
  credits,
  categories,
  remainingSlots,
  planName,
}: {
  configured: boolean;
  credits: Credits;
  categories: { id: string; name: string }[];
  remainingSlots: number;
  planName: string;
}) {
  const [state, formAction, pending] = useActionState<MenuScanState, FormData>(scanMenuAction, {
    status: "idle",
    message: "",
    items: [],
    credits,
  });

  const [photo, setPhoto] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [localError, setLocalError] = useState("");

  useEffect(() => {
    if (state.status !== "ok" || state.items.length === 0) return;
    setRows(
      state.items.map((item, index) => ({
        key: `${index}-${item.name}`,
        include: true,
        name: item.name,
        price: item.price > 0 ? String(item.price) : "",
        category: item.category,
      })),
    );
  }, [state]);

  const remainingCredits = Math.max(0, state.credits.limit - state.credits.used);
  const exhausted = state.credits.limit <= 0 || remainingCredits === 0;
  const scanDisabled = pending || !photo || !configured || exhausted;

  const selected = rows.filter((row) => row.include);
  const invalidRows = selected.filter(
    (row) => row.name.trim().length < 2 || Number.parseFloat(row.price) <= 0,
  );
  const overSlots = selected.length > remainingSlots;
  const canImport = selected.length > 0 && invalidRows.length === 0 && !overSlots;

  const rowsPayload = JSON.stringify(
    selected.map((row) => ({ name: row.name, price: row.price, category: row.category })),
  );

  function updateRow(key: string, patch: Partial<Row>) {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  async function handleFile(file: File | undefined) {
    setLocalError("");
    setRows([]);
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setLocalError("Choose a photo of the menu — JPG, PNG or WebP.");
      return;
    }
    try {
      // Shrinking is an optimisation; if the browser cannot do it, send the
      // original data URL and let the server explain if it is too big.
      const dataUrl = await shrinkImage(file).catch(() => readAsDataUrl(file));
      setPhoto(dataUrl);
    } catch {
      setLocalError("That photo could not be read. Try another one, or a screenshot of the menu.");
    }
  }

  return (
    <section className="card border-brand/20 bg-gradient-to-b from-brand-soft/40 to-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-brand">
            Read a menu photo
          </p>
          <h2 className="mt-1 text-[14px] font-semibold tracking-[-0.01em]">
            Photograph your menu once instead of typing it all
          </h2>
          <p className="mt-1 max-w-xl text-[11.5px] leading-relaxed text-muted">
            The photo is read on the server and turned into a draft list with names, prices and
            categories. Nothing is added until you check the rows and press import. One scan uses
            one AI credit, however many items it finds.
          </p>
        </div>
        <span className="shrink-0 rounded-full border border-line bg-white px-2.5 py-1 text-[10.5px] font-medium text-muted">
          {remainingCredits} of {state.credits.limit} credits left
        </span>
      </div>

      {!configured && (
        <div className="mt-3 rounded-xl border border-warning/25 bg-warning/5 px-3 py-2.5 text-[11.5px] leading-relaxed text-ink">
          <p className="font-semibold">AI is not connected on this deployment.</p>
          <p className="mt-1 text-muted">
            Create a free key at <span className="text-ink">aistudio.google.com/apikey</span>, then
            add <code className="rounded bg-white px-1 py-px text-[10.5px]">GEMINI_API_KEY</code> as
            a Worker secret (or in <code className="rounded bg-white px-1 py-px text-[10.5px]">.env.local</code>)
            and restart. Until then you can still add products by hand.
          </p>
        </div>
      )}

      {configured && exhausted && (
        <p className="mt-3 rounded-xl border border-line bg-white px-3 py-2 text-[11.5px] text-muted">
          {state.credits.limit <= 0
            ? `Menu reading is not part of the ${planName} plan.`
            : `All ${state.credits.limit} credits for ${state.credits.monthLabel} are used. They reset on the 1st of next month.`}
        </p>
      )}

      <form action={formAction} className="mt-3 space-y-3">
        <input type="hidden" name="image" value={photo} />

        <div className="flex flex-wrap items-center gap-2">
          <label className="btn btn-ghost min-h-[40px] cursor-pointer text-[12.5px]">
            {photo ? "Choose another photo" : "Take or choose a photo"}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              onChange={(event) => {
                void handleFile(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
          </label>

          <button
            type="submit"
            disabled={scanDisabled}
            className="btn btn-brand min-h-[40px] text-[12.5px] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? "Reading the menu…" : photo ? "Read the menu" : "Add a photo first"}
          </button>
        </div>

        {photo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo}
            alt="The menu photo you selected"
            className="max-h-56 w-auto rounded-xl border border-line bg-white object-contain"
          />
        )}

        {localError && (
          <p className="rounded-xl border border-danger/20 bg-danger/5 px-3 py-2 text-[11.5px] leading-relaxed text-danger">
            {localError}
          </p>
        )}
      </form>

      {state.status === "error" && state.message && (
        <p className="mt-3 rounded-xl border border-danger/20 bg-danger/5 px-3 py-2 text-[11.5px] leading-relaxed text-danger">
          {state.message}
        </p>
      )}

      {rows.length > 0 && (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-[12.5px] font-semibold">{state.message}</p>
            <p className="text-[11px] text-muted">
              {selected.length} selected · {remainingSlots} product slot
              {remainingSlots === 1 ? "" : "s"} left on the {planName} plan
            </p>
          </div>

          <datalist id="menu-category-options">
            {categories.map((category) => (
              <option key={category.id} value={category.name} />
            ))}
          </datalist>

          <ul className="space-y-2">
            {rows.map((row) => (
              <li
                key={row.key}
                className={`rounded-xl border p-2.5 ${
                  row.include ? "border-line bg-white" : "border-line/70 bg-canvas/40 opacity-70"
                }`}
              >
                <div className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={row.include}
                    onChange={(event) => updateRow(row.key, { include: event.target.checked })}
                    aria-label={`Import ${row.name || "this item"}`}
                    className="mt-2 h-4 w-4 shrink-0 accent-[#2f6bff]"
                  />
                  <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-[minmax(0,1fr)_110px_minmax(0,160px)]">
                    <div>
                      <label
                        className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted"
                        htmlFor={`name-${row.key}`}
                      >
                        Item
                      </label>
                      <input
                        id={`name-${row.key}`}
                        value={row.name}
                        maxLength={90}
                        onChange={(event) => updateRow(row.key, { name: event.target.value })}
                        className="field mt-0.5 py-1.5 text-[12.5px]"
                      />
                    </div>
                    <div>
                      <label
                        className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted"
                        htmlFor={`price-${row.key}`}
                      >
                        Price (₹)
                      </label>
                      <input
                        id={`price-${row.key}`}
                        value={row.price}
                        inputMode="numeric"
                        placeholder="Needed"
                        onChange={(event) => updateRow(row.key, { price: event.target.value })}
                        className={`field mt-0.5 py-1.5 text-[12.5px] ${
                          Number.parseFloat(row.price) > 0 ? "" : "border-danger/40"
                        }`}
                      />
                    </div>
                    <div>
                      <label
                        className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted"
                        htmlFor={`category-${row.key}`}
                      >
                        Category
                      </label>
                      <input
                        id={`category-${row.key}`}
                        value={row.category}
                        list="menu-category-options"
                        maxLength={40}
                        onChange={(event) => updateRow(row.key, { category: event.target.value })}
                        className="field mt-0.5 py-1.5 text-[12.5px]"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setRows((current) => current.filter((item) => item.key !== row.key))}
                    aria-label={`Remove ${row.name || "this item"}`}
                    className="mt-1.5 shrink-0 rounded-md border border-line px-2 py-1 text-[11px] text-muted transition-colors hover:text-danger"
                  >
                    ✕
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <form action={importMenuAction} className="space-y-2">
            <input type="hidden" name="rows" value={rowsPayload} />
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="submit"
                disabled={!canImport}
                className="btn btn-brand min-h-[40px] text-[12.5px] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Import {selected.length === 0 ? "" : selected.length} product
                {selected.length === 1 ? "" : "s"}
              </button>
              <button
                type="button"
                onClick={() => setRows([])}
                className="text-[11.5px] text-muted underline-offset-2 hover:text-ink hover:underline"
              >
                Discard these rows
              </button>
            </div>

            {invalidRows.length > 0 && (
              <p className="text-[11px] leading-relaxed text-warning">
                {invalidRows.length} selected row{invalidRows.length === 1 ? " has" : "s have"} no
                usable price. Type the price from the menu, or untick the item — a product cannot be
                imported with a made-up price.
              </p>
            )}
            {overSlots && (
              <p className="text-[11px] leading-relaxed text-warning">
                Only {remainingSlots} more product{remainingSlots === 1 ? "" : "s"} fit on the{" "}
                {planName} plan. Untick some rows, or delete older products first.
              </p>
            )}
          </form>

          <p className="text-[10.5px] leading-relaxed text-muted">
            {state.credits.used} of {state.credits.limit} credits used in {state.credits.monthLabel}{" "}
            on the {state.credits.planName} plan. The photo is sent to Google&apos;s Gemini API to be
            read and is not stored by Vantra.
          </p>
        </div>
      )}
    </section>
  );
}
