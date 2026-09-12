/* Catalogue sanity checks — no DOM, runs against data.js only.
   These guard the price list against edit slips (a typo'd price, a
   duplicated category, a tile with a kind app.js doesn't know). */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");

// data.js is a plain script (not a module) so evaluate it in a sandbox and
// read its top-level consts back out.
function loadData(){
  const src = fs.readFileSync(path.join(__dirname, "..", "public", "data.js"), "utf8");
  const ctx = {};
  vm.runInNewContext(src + "\n;__out = { PRICES, MANUAL_TYPES, TILE_COLORS, CATEGORIES };", ctx);
  return ctx.__out;
}
const { PRICES, MANUAL_TYPES, TILE_COLORS, CATEGORIES } = loadData();

describe("PRICES", () => {
  test("every category has at least one tier", () => {
    for (const [cat, tiers] of Object.entries(PRICES)){
      assert.ok(Object.keys(tiers).length > 0, `${cat} has no tiers`);
    }
  });

  test("every price is a finite number greater than 0", () => {
    for (const [cat, tiers] of Object.entries(PRICES)){
      for (const [tier, price] of Object.entries(tiers)){
        assert.equal(typeof price, "number", `${cat} / ${tier} is not a number`);
        assert.ok(Number.isFinite(price) && price > 0, `${cat} / ${tier} = ${price}`);
      }
    }
  });

  // CLAUDE.md: Pokemon was deliberately dropped after transcribing the CSV.
  // Re-transcribing the sheet wholesale brings it back — fail loudly.
  test("Pokemon stays removed", () => {
    assert.ok(!("Pokemon" in PRICES), "Pokemon is back in PRICES — see CLAUDE.md");
  });
});

describe("CATEGORIES", () => {
  test("names are unique", () => {
    const names = CATEGORIES.map(c => c.name);
    assert.equal(new Set(names).size, names.length, "duplicate category name");
  });

  test("every entry has a kind app.js understands", () => {
    for (const c of CATEGORIES){
      assert.ok(["sized", "manual", "custom"].includes(c.kind), `${c.name} has kind "${c.kind}"`);
    }
  });

  test("one sized tile per PRICES category, then one manual and one custom tile", () => {
    // Arrays created inside the vm sandbox have a different prototype, so
    // copy into this realm before a strict deep-equal.
    const sized = [...CATEGORIES.filter(c => c.kind === "sized").map(c => c.name)];
    assert.deepEqual(sized, Object.keys(PRICES));
    assert.equal(CATEGORIES.filter(c => c.kind === "manual").length, 1);
    assert.equal(CATEGORIES.filter(c => c.kind === "custom").length, 1);
  });

  test("every sized tile's name is a PRICES key", () => {
    for (const c of CATEGORIES.filter(c => c.kind === "sized")){
      assert.ok(c.name in PRICES, `${c.name} is sized but has no PRICES entry`);
    }
  });
});

describe("MANUAL_TYPES / TILE_COLORS", () => {
  test("manual types are non-empty unique strings", () => {
    assert.ok(MANUAL_TYPES.length > 0);
    assert.equal(new Set(MANUAL_TYPES).size, MANUAL_TYPES.length);
    for (const t of MANUAL_TYPES) assert.ok(typeof t === "string" && t.trim().length > 0);
  });

  test("tile colors are hex", () => {
    assert.ok(TILE_COLORS.length > 0);
    for (const c of TILE_COLORS) assert.match(c, /^#[0-9A-Fa-f]{6}$/);
  });
});
