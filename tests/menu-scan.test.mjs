/**
 * MENU PHOTO SCAN UNIT TEST.
 *
 * `readMenuFromImage` asks Gemini for JSON, then does not trust a single field of
 * it: names are tidied and capped, prices are turned into safe whole rupees, blank
 * categories become "Menu", duplicates disappear and the list is capped. A menu
 * photo is the owner's own data and every value becomes an editable draft, so the
 * rules in that loop are the difference between a tidy draft and a broken row.
 *
 * The model is never called: GEMINI_API_BASE points at the stub in
 * ./support/ai-stub.mjs and each test hands the scan whatever text a model might
 * have returned. Imported straight from source — Node 24 strips the types.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { MENU_MAX_ITEMS, readMenuFromImage } from "../src/lib/ai.ts";
import { answered, configured, refused, stubProvider, withEnv } from "./support/ai-stub.mjs";

const IMAGE = { mimeType: "image/jpeg", base64: "c3R1Yi1tZW51LXBob3Rv" };

/** Replies with `text` as the model's answer and runs the scan against the stub. */
async function scan(text, extraEnv = {}) {
  const stub = await stubProvider(answered(text));
  try {
    const result = await withEnv(configured(stub.base, extraEnv), () => readMenuFromImage(IMAGE));
    return { result, requests: stub.requests };
  } finally {
    await stub.close();
  }
}

const json = (value) => JSON.stringify(value);

test("a readable menu becomes items, with the photo and JSON config in the request", async () => {
  const { result, requests } = await scan(
    json({
      items: [
        { name: "  Masala   Chai ", price: 40, category: " Tea " },
        { name: "Veg Sandwich", price: 120.4, category: "Snacks" },
      ],
    }),
  );

  assert.deepEqual(result, {
    ok: true,
    items: [
      { name: "Masala Chai", price: 40, category: "Tea" },
      { name: "Veg Sandwich", price: 120, category: "Snacks" },
    ],
  });

  assert.equal(requests.length, 1, "a menu scan is one call, not a retry");
  const body = JSON.parse(requests[0].body);
  const parts = body.contents[0].parts;

  const image = parts.find((part) => part.inlineData)?.inlineData;
  assert.deepEqual(
    image,
    { mimeType: "image/jpeg", data: IMAGE.base64 },
    "the photo itself is sent, with its real mime type",
  );
  assert.equal(parts.at(-1).text.includes("menu photo"), true, "the instruction follows the photo");

  assert.equal(body.generationConfig.responseMimeType, "application/json", "JSON mode is on");
  assert.equal(body.generationConfig.temperature, 0.1, "a menu is read, not imagined");
  const schema = body.generationConfig.responseSchema;
  assert.deepEqual(schema.required, ["items"], "the schema forces the items wrapper");
  assert.deepEqual(
    schema.properties.items.items.required,
    ["name", "price", "category"],
    "the schema forces every field the parser expects",
  );
});

test("a price that is not a single positive number becomes 0 instead of a guess", async () => {
  const { result } = await scan(
    json({
      items: [
        { name: "Range Price", price: "180/200", category: "Starters" },
        { name: "Missing Price", category: "Starters" },
        { name: "Negative Price", price: -50, category: "Starters" },
        { name: "Free Item", price: 0, category: "Starters" },
        { name: "Absurd Price", price: 9_000_000_000, category: "Starters" },
      ],
    }),
  );

  assert.equal(result.ok, true);
  assert.deepEqual(
    result.items.map((item) => [item.name, item.price]),
    [
      ["Range Price", 0],
      ["Missing Price", 0],
      ["Negative Price", 0],
      ["Free Item", 0],
      ["Absurd Price", 10_000_000],
    ],
    "unusable prices are 0 so the owner fills them in, and a typo cannot exceed the cap",
  );
});

test("duplicates, unusable names and junk entries are dropped", async () => {
  const { result } = await scan(
    json({
      items: [
        { name: "Paneer Tikka", price: 260, category: "Starters" },
        { name: "paneer   tikka", price: 999, category: "Starters" },
        { name: "A", price: 10, category: "Starters" },
        { name: "   ", price: 10, category: "Starters" },
        { price: 10, category: "Starters" },
        null,
        "Coke 40",
        { name: "Coke", price: 40, category: "Drinks" },
      ],
    }),
  );

  assert.equal(result.ok, true);
  assert.deepEqual(
    result.items.map((item) => item.name),
    ["Paneer Tikka", "Coke"],
    "the first spelling wins and single letters or non-objects are never stored",
  );
  assert.equal(result.items[0].price, 260, "a duplicate must not overwrite the real price");
});

test("a missing category becomes Menu, and long text is capped", async () => {
  const longName =
    "Special Family Feast Platter With Extra Raita And Two Desserts Of The Day For The Whole Family";
  const longCategory = "Chef's Special Recommendations For The Weekend Brunch Service";

  const { result } = await scan(
    json({
      items: [
        { name: longName, price: 500, category: longCategory },
        { name: "Chai", price: 20, category: "   " },
        { name: "Samosa", price: 25 },
      ],
    }),
  );

  assert.equal(result.ok, true);
  assert.equal(result.items[0].name.length, 90, "a name is capped at 90 characters");
  assert.equal(result.items[0].category.length, 40, "a category is capped at 40 characters");
  assert.equal(result.items[1].category, "Menu", "a blank heading becomes Menu");
  assert.equal(result.items[2].category, "Menu", "a missing heading becomes Menu");
});

test("one photo can never return more than the item cap", async () => {
  const many = Array.from({ length: MENU_MAX_ITEMS + 15 }, (_, index) => ({
    name: `Dish ${index + 1}`,
    price: 100,
    category: "Menu",
  }));

  const { result } = await scan(json({ items: many }));

  assert.equal(result.ok, true);
  assert.equal(result.items.length, MENU_MAX_ITEMS);
  assert.equal(result.items.at(-1).name, `Dish ${MENU_MAX_ITEMS}`, "the first items are kept");
});

test("text that is not JSON is a provider error, not an empty menu", async () => {
  const { result } = await scan("Here are the items I found: Masala Chai, Samosa.");

  assert.deepEqual(result, { ok: false, error: "provider" });
});

test("JSON with no usable items says empty rather than importing nothing", async () => {
  assert.deepEqual(await scan(json({ items: [] })).then((r) => r.result), {
    ok: false,
    error: "empty",
  });
  assert.deepEqual(await scan(json({})).then((r) => r.result), { ok: false, error: "empty" });
  assert.deepEqual(await scan(json({ items: [{ name: "", price: 10 }] })).then((r) => r.result), {
    ok: false,
    error: "empty",
  });
});

test("a swamped provider is retried, so a scan can still succeed", async () => {
  const stub = await stubProvider((call, response, index) =>
    index === 0
      ? refused(503)(call, response)
      : answered(json({ items: [{ name: "Filter Coffee", price: 30, category: "Coffee" }] }))(
          call,
          response,
        ),
  );

  try {
    const result = await withEnv(configured(stub.base), () => readMenuFromImage(IMAGE));
    assert.deepEqual(result, {
      ok: true,
      items: [{ name: "Filter Coffee", price: 30, category: "Coffee" }],
    });
    assert.equal(stub.requests.length, 2, "the scan rides the same retry as every other AI call");
  } finally {
    await stub.close();
  }
});
