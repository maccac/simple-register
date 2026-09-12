/* Behaviour tests — drive the real index.html + app.js through the DOM.

   Each test boots a fresh app (see helpers.js) and asserts what a user
   would see: the header total/count, what's in the cart sheet, which
   overlay is open. Nothing here reaches into app.js internals, so
   refactors that keep the behaviour keep the tests green. */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { loadApp } = require("./helpers");

const MANUAL_TILE = "Individually Priced Items";
const CUSTOM_TILE = "Manual Price";

// Shortcuts used across several describes.
function addCustom(app, price){
  app.type("#customPrice", price);
  app.tap("#addCustomBtn");
}
function addManual(app, { type, price, qty }){
  if (type){
    const sel = app.$("#manualType");
    sel.value = type;
    sel.dispatchEvent(new app.window.Event("change", { bubbles: true }));
  }
  app.type("#manualPrice", price);
  if (qty !== undefined) app.type("#manualQty", qty);
  app.tap("#addManualBtn");
}

describe("category grid", () => {
  test("renders one tile per category with the right meta text", async () => {
    const app = await loadApp();
    const tiles = app.$$(".tile");
    assert.equal(tiles.length, app.CATEGORIES.length);
    assert.equal(app.tile("Lego").querySelector(".meta").textContent, "Tap to choose size");
    assert.equal(app.tile(MANUAL_TILE).querySelector(".meta").textContent, "Priced individually");
    assert.equal(app.tile(CUSTOM_TILE).querySelector(".meta").textContent, "Enter a price");
  });

  test("starts with an empty sale", async () => {
    const app = await loadApp();
    assert.deepEqual(app.header(), { total: "$0.00", count: "0" });
    assert.equal(app.$$(".qty-badge").length, 0);
  });

  test("tile badge shows the category's quantity after closing the sheet", async () => {
    const app = await loadApp();
    app.tap(app.tile("Lego"));
    app.tap(app.subRow("Set").querySelector("[data-action=inc]"));
    app.tap(app.subRow("Set").querySelector("[data-action=inc]"));
    app.tap("#doneBtn");
    assert.equal(app.tile("Lego").querySelector(".qty-badge").textContent, "2");
  });
});

describe("sized categories (steppers)", () => {
  test("+ adds one at the tier price, − takes it away", async () => {
    const app = await loadApp();
    app.tap(app.tile("Lego"));
    app.tap(app.subRow("Set").querySelector("[data-action=inc]"));
    assert.deepEqual(app.header(), { total: "$15.00", count: "1" });
    app.tap(app.subRow("Set").querySelector("[data-action=inc]"));
    assert.deepEqual(app.header(), { total: "$30.00", count: "2" });
    app.tap(app.subRow("Set").querySelector("[data-action=dec]"));
    assert.deepEqual(app.header(), { total: "$15.00", count: "1" });
  });

  test("− never goes below zero", async () => {
    const app = await loadApp();
    app.tap(app.tile("Lego"));
    app.tap(app.subRow("Set").querySelector("[data-action=dec]"));
    assert.deepEqual(app.header(), { total: "$0.00", count: "0" });
    assert.equal(app.subRow("Set").querySelector(".qty-input").value, "");
  });

  test("line total on the row matches price × qty", async () => {
    const app = await loadApp();
    app.tap(app.tile("Soft toys"));
    app.tap(app.subRow("Large >35 cm").querySelector("[data-action=inc]"));
    app.tap(app.subRow("Large >35 cm").querySelector("[data-action=inc]"));
    assert.equal(app.subRow("Large >35 cm").querySelector(".line-total").textContent, "$20.00");
  });
});

describe("sized categories (typed quantity)", () => {
  test("every tier has +/- buttons and a typed box", async () => {
    const app = await loadApp();
    app.tap(app.tile("Lego"));
    for (const row of app.$$(".sub-row")){
      assert.ok(row.querySelector("[data-action=inc]") && row.querySelector("[data-action=dec]"), "missing +/-");
      assert.ok(row.querySelector(".qty-input"), "missing typed box");
    }
  });

  test("+ and − update the typed box without replacing it", async () => {
    const app = await loadApp();
    app.tap(app.tile("Lego"));
    const box = app.subRow("Set").querySelector(".qty-input");
    app.type(box, "5");
    app.tap(app.subRow("Set").querySelector("[data-action=inc]"));
    assert.equal(box.value, "6");
    assert.equal(app.subRow("Set").querySelector(".qty-input"), box, "box was re-rendered");
    app.tap(app.subRow("Set").querySelector("[data-action=dec]"));
    app.tap(app.subRow("Set").querySelector("[data-action=dec]"));
    assert.equal(box.value, "4");
    assert.deepEqual(app.header(), { total: "$60.00", count: "4" });
  });

  test("typing a quantity updates the line and the header in place", async () => {
    const app = await loadApp();
    app.tap(app.tile("Lego"));
    const box = app.subRow("Loose bricks").querySelector(".qty-input");
    app.type(box, "25");
    assert.equal(app.subRow("Loose bricks").querySelector(".line-total").textContent, "$2.50");
    assert.deepEqual(app.header(), { total: "$2.50", count: "25" });
    // Focus must survive typing — a full re-render would have replaced the input.
    assert.equal(app.subRow("Loose bricks").querySelector(".qty-input"), box);
  });

  test("rejects minus, plus, e and decimals", async () => {
    const app = await loadApp();
    app.tap(app.tile("Lego"));
    const box = app.subRow("Loose bricks").querySelector(".qty-input");
    app.type(box, "-1e2+.5");
    assert.equal(box.value, "125");
    assert.deepEqual(app.header(), { total: "$12.50", count: "125" });
  });

  test("clearing the box goes back to zero", async () => {
    const app = await loadApp();
    app.tap(app.tile("Lego"));
    const box = app.subRow("Loose bricks").querySelector(".qty-input");
    app.type(box, "10");
    app.type(box, "");
    assert.deepEqual(app.header(), { total: "$0.00", count: "0" });
  });
});

describe("quantity cap", () => {
  test("a stepper stops at 999", async () => {
    const app = await loadApp();
    app.tap(app.tile("Lego"));
    const inc = () => app.tap(app.subRow("Set").querySelector("[data-action=inc]"));
    for (let i = 0; i < 1005; i++) inc();
    assert.equal(app.subRow("Set").querySelector(".qty-input").value, "999");
    assert.deepEqual(app.header(), { total: "$14985.00", count: "999" });
  });

  test("a bulk box clamps what was typed to 999 and shows it", async () => {
    const app = await loadApp();
    app.tap(app.tile("Lego"));
    const box = app.subRow("Loose bricks").querySelector(".qty-input");
    app.type(box, "5000");
    assert.equal(box.value, "999");
    assert.deepEqual(app.header(), { total: "$99.90", count: "999" });
  });

  test("an individually priced quantity clamps to 999", async () => {
    const app = await loadApp();
    app.tap(app.tile(MANUAL_TILE));
    addManual(app, { price: "1", qty: "1000" });
    assert.deepEqual(app.header(), { total: "$999.00", count: "999" });
  });

  test("999 itself is allowed", async () => {
    const app = await loadApp();
    app.tap(app.tile("Lego"));
    app.type(app.subRow("Loose bricks").querySelector(".qty-input"), "999");
    assert.deepEqual(app.header(), { total: "$99.90", count: "999" });
  });
});

describe("individually priced items", () => {
  test("adds a line with the chosen type, price and quantity", async () => {
    const app = await loadApp();
    app.tap(app.tile(MANUAL_TILE));
    addManual(app, { type: "Puzzles", price: "12", qty: "2" });
    assert.deepEqual(app.header(), { total: "$24.00", count: "2" });
    const line = app.$(".manual-line .ml-info");
    assert.match(line.textContent, /Puzzles/);
    assert.match(line.textContent, /2 × \$12\.00 = \$24\.00/);
  });

  test("form resets to an empty price and qty 1 after adding", async () => {
    const app = await loadApp();
    app.tap(app.tile(MANUAL_TILE));
    addManual(app, { price: "5", qty: "3" });
    assert.equal(app.$("#manualPrice").value, "");
    assert.equal(app.$("#manualQty").value, "1");
  });

  test("rejects a zero or missing price", async () => {
    const app = await loadApp();
    app.tap(app.tile(MANUAL_TILE));
    addManual(app, { price: "0" });
    addManual(app, { price: "" });
    assert.equal(app.alerts.length, 2);
    assert.deepEqual(app.header(), { total: "$0.00", count: "0" });
  });

  test("× on a line removes it", async () => {
    const app = await loadApp();
    app.tap(app.tile(MANUAL_TILE));
    addManual(app, { price: "5" });
    addManual(app, { price: "7" });
    assert.deepEqual(app.header(), { total: "$12.00", count: "2" });
    app.tap(app.$$(".remove-x")[0]);
    assert.deepEqual(app.header(), { total: "$7.00", count: "1" });
  });
});

describe("manual price", () => {
  test("sheet is just a price box and an add button", async () => {
    const app = await loadApp();
    app.tap(app.tile(CUSTOM_TILE));
    assert.ok(app.$("#customPrice"));
    assert.ok(app.$("#addCustomBtn"));
    assert.equal(app.$$("#detailBody select").length, 0, "no type dropdown");
    assert.equal(app.$$("#detailBody input").length, 1, "no quantity field");
    assert.equal(app.document.activeElement, app.$("#customPrice"), "price box is focused");
  });

  test("each add is its own line at quantity 1", async () => {
    const app = await loadApp();
    app.tap(app.tile(CUSTOM_TILE));
    addCustom(app, "12.50");
    addCustom(app, "3");
    addCustom(app, "0.75");
    assert.deepEqual(app.header(), { total: "$16.25", count: "3" });
    assert.deepEqual(app.$$(".manual-line .ml-info").map(e => e.textContent), ["$12.50", "$3.00", "$0.75"]);
  });

  test("the same price twice is two separate lines", async () => {
    const app = await loadApp();
    app.tap(app.tile(CUSTOM_TILE));
    addCustom(app, "5");
    addCustom(app, "5");
    assert.equal(app.$$(".manual-line").length, 2);
    assert.deepEqual(app.header(), { total: "$10.00", count: "2" });
  });

  test("Enter adds and clears the box for the next item", async () => {
    const app = await loadApp();
    app.tap(app.tile(CUSTOM_TILE));
    app.type("#customPrice", "8");
    app.pressEnter("#customPrice");
    assert.deepEqual(app.header(), { total: "$8.00", count: "1" });
    assert.equal(app.$("#customPrice").value, "");
    assert.equal(app.document.activeElement, app.$("#customPrice"), "focus returns to the price box");
  });

  test("accepts any decimal, not just half-dollar steps", async () => {
    const app = await loadApp();
    app.tap(app.tile(CUSTOM_TILE));
    assert.equal(app.$("#customPrice").getAttribute("step"), "any");
    addCustom(app, "4.37");
    assert.deepEqual(app.header(), { total: "$4.37", count: "1" });
  });

  test("rejects empty, zero, and non-numeric input", async () => {
    const app = await loadApp();
    app.tap(app.tile(CUSTOM_TILE));
    addCustom(app, "");
    addCustom(app, "0");
    addCustom(app, "-e+");
    assert.equal(app.alerts.length, 3);
    assert.deepEqual(app.header(), { total: "$0.00", count: "0" });
  });

  test("× on a line removes just that line", async () => {
    const app = await loadApp();
    app.tap(app.tile(CUSTOM_TILE));
    addCustom(app, "10");
    addCustom(app, "20");
    app.tap(app.$$(".remove-x")[0]);
    assert.deepEqual(app.header(), { total: "$20.00", count: "1" });
  });

  test("does not touch the individually priced tile", async () => {
    const app = await loadApp();
    app.tap(app.tile(CUSTOM_TILE));
    addCustom(app, "10");
    app.tap("#doneBtn");
    assert.equal(app.tile(CUSTOM_TILE).querySelector(".qty-badge").textContent, "1");
    assert.equal(app.tile(MANUAL_TILE).querySelector(".qty-badge"), null);
  });
});

describe("cart sheet", () => {
  test("opens from the header pill and lists every line with the right labels", async () => {
    const app = await loadApp();
    app.tap(app.tile("Lego"));
    app.tap(app.subRow("Set").querySelector("[data-action=inc]"));
    app.tap("#doneBtn");
    app.tap(app.tile(MANUAL_TILE));
    addManual(app, { type: "Balls", price: "10" });
    app.tap("#doneBtn");
    app.tap(app.tile(CUSTOM_TILE));
    addCustom(app, "12.50");
    app.tap("#doneBtn");

    app.tap("#openCartBtn");
    assert.ok(app.isOpen("cartOverlay"));
    const lines = app.cartLines().map(({ cat, sub, total }) => ({ cat, sub, total }));
    assert.deepEqual(lines, [
      { cat: "Lego",         sub: "Set · 1 × $15.00",                  total: "$15.00" },
      { cat: "Balls",        sub: "Individually priced · 1 × $10.00",  total: "$10.00" },
      { cat: CUSTOM_TILE,    sub: "1 × $12.50",                        total: "$12.50" }
    ]);
    assert.equal(app.text("#cartTotal"), "$37.50");
  });

  test("shows an empty message when nothing is added", async () => {
    const app = await loadApp();
    app.tap("#openCartBtn");
    assert.ok(app.$(".empty-cart"));
    assert.equal(app.$$(".cart-line").length, 0);
  });

  test("× removes a line without opening its sheet", async () => {
    const app = await loadApp();
    app.tap(app.tile(CUSTOM_TILE));
    addCustom(app, "10");
    addCustom(app, "20");
    app.tap("#doneBtn");
    app.tap("#openCartBtn");
    app.tap(app.cartLines()[0].el.querySelector(".cl-remove"));
    assert.ok(app.isOpen("cartOverlay"), "cart stays open");
    assert.ok(!app.isOpen("detailOverlay"), "× must not also open the category sheet");
    assert.equal(app.cartLines().length, 1);
    assert.deepEqual(app.header(), { total: "$20.00", count: "1" });
  });

  test("keep shopping closes the cart", async () => {
    const app = await loadApp();
    app.tap("#openCartBtn");
    app.tap("#closeCartBtn");
    assert.ok(!app.isOpen("cartOverlay"));
  });
});

describe("editing from the cart", () => {
  test("tapping a sized line opens its category with the tier flashed", async () => {
    const app = await loadApp();
    app.tap(app.tile("Soft toys"));
    app.tap(app.subRow("Med 20-35cm").querySelector("[data-action=inc]"));
    app.tap("#doneBtn");
    app.tap("#openCartBtn");
    app.tap(app.cartLines()[0].el);

    assert.ok(!app.isOpen("cartOverlay"));
    assert.ok(app.isOpen("detailOverlay"));
    assert.equal(app.text("#detailTitle"), "Soft toys");
    assert.ok(app.subRow("Med 20-35cm").classList.contains("flash"), "tapped tier is flashed");
    assert.ok(!app.subRow("Large >35 cm").classList.contains("flash"), "other tiers are not");
  });

  test("tapping a manual-price line opens that sheet with the line flashed", async () => {
    const app = await loadApp();
    app.tap(app.tile(CUSTOM_TILE));
    addCustom(app, "10");
    addCustom(app, "20");
    app.tap("#doneBtn");
    app.tap("#openCartBtn");
    app.tap(app.cartLines()[1].el);
    assert.equal(app.text("#detailTitle"), CUSTOM_TILE);
    const flashed = app.$$(".manual-line.flash");
    assert.equal(flashed.length, 1);
    assert.equal(flashed[0].querySelector(".ml-info").textContent, "$20.00");
  });

  test("the flash is one-shot — reopening the tile normally does not flash", async () => {
    const app = await loadApp();
    app.tap(app.tile("Lego"));
    app.tap(app.subRow("Set").querySelector("[data-action=inc]"));
    app.tap("#doneBtn");
    app.tap("#openCartBtn");
    app.tap(app.cartLines()[0].el);
    assert.equal(app.$$(".flash").length, 1);
    app.tap("#doneBtn");
    app.tap("#closeCartBtn");
    app.tap(app.tile("Lego"));
    assert.equal(app.$$(".flash").length, 0);
  });

  test("Done returns to the cart with the edit reflected", async () => {
    const app = await loadApp();
    app.tap(app.tile("Lego"));
    app.tap(app.subRow("Set").querySelector("[data-action=inc]"));
    app.tap("#doneBtn");
    app.tap("#openCartBtn");
    app.tap(app.cartLines()[0].el);
    app.tap(app.subRow("Set").querySelector("[data-action=inc]"));
    app.tap("#doneBtn");

    assert.ok(app.isOpen("cartOverlay"), "back in the cart");
    assert.ok(!app.isOpen("detailOverlay"));
    assert.equal(app.cartLines()[0].sub, "Set · 2 × $15.00");
    assert.equal(app.text("#cartTotal"), "$30.00");
  });

  test("back arrow also returns to the cart", async () => {
    const app = await loadApp();
    app.tap(app.tile(CUSTOM_TILE));
    addCustom(app, "10");
    app.tap("#doneBtn");
    app.tap("#openCartBtn");
    app.tap(app.cartLines()[0].el);
    app.tap("#backBtn");
    assert.ok(app.isOpen("cartOverlay"));
  });

  test("opening a tile normally still returns to the grid, not the cart", async () => {
    const app = await loadApp();
    // Do one cart round-trip first so a stale flag would show up.
    app.tap(app.tile(CUSTOM_TILE));
    addCustom(app, "10");
    app.tap("#doneBtn");
    app.tap("#openCartBtn");
    app.tap(app.cartLines()[0].el);
    app.tap("#doneBtn");
    app.tap("#closeCartBtn");

    app.tap(app.tile("Lego"));
    app.tap("#doneBtn");
    assert.ok(!app.isOpen("cartOverlay"), "normal Done must not reopen the cart");
    assert.ok(!app.isOpen("detailOverlay"));
  });
});

describe("start new sale", () => {
  test("clears everything after confirming", async () => {
    const app = await loadApp({ confirm: () => true });
    app.tap(app.tile("Lego"));
    app.tap(app.subRow("Set").querySelector("[data-action=inc]"));
    app.tap("#doneBtn");
    app.tap(app.tile(CUSTOM_TILE));
    addCustom(app, "10");
    app.tap("#doneBtn");
    app.tap("#openCartBtn");
    app.tap("#newSaleBtn");

    assert.deepEqual(app.header(), { total: "$0.00", count: "0" });
    assert.ok(!app.isOpen("cartOverlay"));
    assert.equal(app.$$(".qty-badge").length, 0);
  });

  test("keeps the sale if the confirm is cancelled", async () => {
    const app = await loadApp({ confirm: () => false });
    app.tap(app.tile(CUSTOM_TILE));
    addCustom(app, "10");
    app.tap("#doneBtn");
    app.tap("#openCartBtn");
    app.tap("#newSaleBtn");
    assert.deepEqual(app.header(), { total: "$10.00", count: "1" });
    assert.ok(app.isOpen("cartOverlay"));
  });

  test("does not ask when the sale is already empty", async () => {
    let asked = 0;
    const app = await loadApp({ confirm: () => { asked++; return true; } });
    app.tap("#openCartBtn");
    app.tap("#newSaleBtn");
    assert.equal(asked, 0);
  });
});
