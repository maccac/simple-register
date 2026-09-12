/* =========================================================
   DATA — the whole "database" for the calculator.

   This is the only file you need to touch to change what the
   app sells or what it charges. No logic lives here.

   app.js reads exactly four of these:

     PRICES       sized categories -> size tier -> price
     MANUAL_TYPES dropdown options for individually priced items
     TILE_COLORS  palette, cycled across the category grid
     CATEGORIES   the tile list; each entry is { name, kind },
                  and app.js switches on that `kind`:
                    "sized"  -> size tiers from PRICES
                    "manual" -> type dropdown + price + qty
                    "custom" -> just a price, one item per add

   MANUAL_CATEGORY_NAME and CUSTOM_PRICE_CATEGORY_NAME are internal
   to this file — they only name the two non-sized tiles that
   CATEGORIES appends after the PRICES categories.

   Loaded by index.html BEFORE app.js, so everything declared
   here is already defined by the time app.js runs.
   ========================================================= */

/* =========================================================
   PRICES — edit this section whenever prices change.
   Every value below is a per-item price in dollars.
   Nothing else in the file needs to change when you update
   prices; just edit the numbers here.
   ========================================================= */
const PRICES = {
  "Lego": { "Set": 15, "Loose bricks": 0.1, "Loose others": 0.5 },
  "Action figures & Dolls": { "Large >30 cm": 5, "Med 20-30cm": 3, "Small 10cm-20cm": 2, "Tiny <10cm": 0.5 },
  "Fidget toys": { "Large >30 cm": 5, "Med 20-30cm": 3, "Small 10cm-20cm": 2, "Tiny <10cm": 0.5 },
  "Plastic Animals": { "Large >30 cm": 7, "Med 20-30cm": 5, "Small 10cm-20cm": 3, "Tiny <10cm": 1 },
  "Stationery": { "Large >30 cm": 5, "Med 20-30cm": 3, "Small 10cm-20cm": 2, "Tiny <10cm": 0.5 },
  "Vehicles": { "Large >30 cm": 10, "Med 20-30cm": 5, "Small 10cm-20cm": 2, "Tiny <10cm": 0.5 },
  "Arts and crafts": { "Set": 5, "Med 20-30cm": 3, "Small 10cm-20cm": 2, "Tiny <10cm": 0.5 },
  "Brio train": { "Set": 15, "Loose rail": 0.1, "loose other": 2, "loose train": 3 },
  "Construction and blocks": { "Set": 15, "Loose bricks": 0.1, "Loose others": 0.5 },
  "Duplo": { "Set": 15, "Loose bricks": 0.1, "Loose others": 0.5 },
  "Little People": { "Set": 15, "Loose others": 0.5 },
  "Music & sound toys": { "Set": 15, "Med 20-30cm": 5, "Small 10cm-20cm": 2, "Tiny <10cm": 0.5 },
  "plastic foods": { "Med 20-30cm": 3, "Small 10cm-20cm": 2, "Tiny <10cm": 0.5 },
  "Wooden toys": { "Set": 10, "Med 20-30cm": 3, "Small 10cm-20cm": 2, "Tiny <10cm": 0.5 },
  "Kid bags": { "Large >35 cm": 5, "Med 20-35cm": 3, "Small 10cm-20cm": 2, "Tiny <10cm": 0.5 },
  "Soft toys": { "Large >35 cm": 10, "Med 20-35cm": 5, "Small 10cm-20cm": 2, "Tiny <10cm": 0.5 }
};

/* Items priced individually (no fixed size tiers) are grouped into one
   category tile. These names become a "type" dropdown inside it, purely
   so the sale summary still shows what was actually sold. */
const MANUAL_TYPES = [
  "Balls", "Board games", "Brand New items", "Costume", "Electronics toys",
  "Kid furnitures", "Misc toys", "Other games", "Play sets", "Puzzles", "Sport toys"
];
const MANUAL_CATEGORY_NAME = "Individually Priced Items";

/* Free-form price entry: staff type an amount and add it, no type or
   size to choose. Every add is its own line at quantity 1. */
const CUSTOM_PRICE_CATEGORY_NAME = "Manual Price";

/* Tile colors, cycled across categories for visual variety */
const TILE_COLORS = ["#E8483C", "#2AA9A0", "#F5B942", "#7B6FD1", "#3D7A5C", "#D96B9C"];

const CATEGORIES = [
  ...Object.keys(PRICES).map(name => ({ name, kind: "sized" })),
  { name: MANUAL_CATEGORY_NAME, kind: "manual" },
  { name: CUSTOM_PRICE_CATEGORY_NAME, kind: "custom" }
];
