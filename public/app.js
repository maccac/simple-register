/* =========================================================
   UI TUNING
   ========================================================= */
// Tiers priced below this get a typed quantity box instead of +/- steppers,
// because loose bricks and rails are counted in the dozens or hundreds.
// This is a UI affordance, not catalogue data, so it lives here not data.js.
const BULK_PRICE_THRESHOLD = 1;

/* =========================================================
   STATE
   ========================================================= */
// sizedCart: { "Category|Subcategory": qty }
let sizedCart = {};
// manualCart: array of { id, category, type, price, qty } — every line from
// a non-sized tile ("manual" and "custom" kinds) lands here, so the total,
// count, cart list and "new sale" don't need to know the difference.
let manualCart = [];
let activeCategory = null;
let manualDraft = { type: MANUAL_TYPES[0], price: "", qty: 1 };
let customDraft = { price: "" };
// Set when a category sheet was opened by tapping a cart line, so Done/back
// go back to the cart instead of the grid, and the tapped line gets a flash.
let returnToCart = false;
let highlightKey = null;

const fmt = n => "$" + n.toFixed(2);

/* Keeps a number input to digits only (plus one decimal point when
   allowDecimal is true). Runs on every keystroke/paste so people can't
   type or paste negative numbers, letters, "e", "+", extra dots, etc. */
function sanitizeNumberInput(el, allowDecimal){
  let v = el.value.replace(allowDecimal ? /[^0-9.]/g : /[^0-9]/g, "");
  if (allowDecimal){
    const firstDot = v.indexOf(".");
    if (firstDot !== -1){
      v = v.slice(0, firstDot + 1) + v.slice(firstDot + 1).replace(/\./g, "");
    }
  }
  if (v !== el.value) el.value = v;
  return v;
}
// Belt-and-braces: block the specific keys number inputs otherwise allow
// through (minus, plus, "e") even though they're not digits.
function blockNonNumericKeys(e){
  if (["-", "+", "e", "E"].includes(e.key)) e.preventDefault();
}

function calcTotal(){
  let total = 0;
  for (const key in sizedCart){
    const qty = sizedCart[key];
    if (!qty) continue;
    const [cat, sub] = key.split("|");
    total += (PRICES[cat]?.[sub] || 0) * qty;
  }
  for (const line of manualCart){
    total += line.price * line.qty;
  }
  return total;
}
function calcCount(){
  let count = 0;
  for (const key in sizedCart) count += sizedCart[key] || 0;
  for (const line of manualCart) count += line.qty;
  return count;
}

function renderHeader(){
  document.getElementById("headerTotal").textContent = fmt(calcTotal());
  document.getElementById("headerCount").textContent = calcCount();
}

/* =========================================================
   CATEGORY GRID
   ========================================================= */
function categoryQtyInCart(cat){
  if (cat.kind !== "sized"){
    return manualCart.filter(l => l.category === cat.name).reduce((a,l)=>a+l.qty,0);
  }
  let sum = 0;
  for (const key in sizedCart){
    if (key.startsWith(cat.name + "|")) sum += sizedCart[key] || 0;
  }
  return sum;
}

const TILE_META = {
  sized: "Tap to choose size",
  manual: "Priced individually",
  custom: "Enter a price"
};

function renderGrid(){
  const grid = document.getElementById("categoryGrid");
  grid.innerHTML = "";
  CATEGORIES.forEach((cat, i) => {
    const btn = document.createElement("button");
    btn.className = "tile" + (cat.kind !== "sized" ? " manual" : "");
    btn.style.background = TILE_COLORS[i % TILE_COLORS.length];
    const qty = categoryQtyInCart(cat);
    btn.innerHTML = `
      ${qty > 0 ? `<span class="qty-badge">${qty}</span>` : ""}
      <span class="name">${cat.name}</span>
      <span class="meta">${TILE_META[cat.kind]}</span>
    `;
    btn.addEventListener("click", () => openCategory(cat));
    grid.appendChild(btn);
  });
}

/* =========================================================
   CATEGORY DETAIL SHEET
   ========================================================= */
function openCategory(cat, opts = {}){
  activeCategory = cat;
  returnToCart = !!opts.fromCart;
  highlightKey = opts.highlight || null;
  manualDraft = { type: MANUAL_TYPES[0], price: "", qty: 1 };
  customDraft = { price: "" };
  document.getElementById("detailTitle").textContent = cat.name;
  renderDetailBody();
  document.getElementById("detailOverlay").classList.add("open");
}
function closeCategory(){
  document.getElementById("detailOverlay").classList.remove("open");
  activeCategory = null;
  renderGrid();
  if (returnToCart){
    returnToCart = false;
    openCart();
  }
}

// After a sheet renders, flash the row the user tapped in the cart so their
// eye lands on the right tier. One-shot: cleared so stepper re-renders don't
// flash again.
function flashHighlight(body){
  if (!highlightKey) return;
  const el = body.querySelector(`[data-line="${CSS.escape(highlightKey)}"]`);
  if (el){
    el.classList.add("flash");
    el.scrollIntoView({ block: "center" });
  }
  highlightKey = null;
}

function renderDetailBody(){
  const body = document.getElementById("detailBody");
  const cat = activeCategory;
  if (cat.kind === "sized"){
    const subs = Object.keys(PRICES[cat.name]);
    body.innerHTML = subs.map(sub => {
      const key = cat.name + "|" + sub;
      const qty = sizedCart[key] || 0;
      const price = PRICES[cat.name][sub];
      // Loose bricks/rails sell in the dozens or hundreds at ~$0.10 each.
      // Tapping "+" that many times isn't workable at a counter, so any
      // tier under BULK_PRICE_THRESHOLD gets a typed box instead of a stepper.
      const control = price < BULK_PRICE_THRESHOLD
        ? `<input type="number" class="qty-input" data-key="${key}" inputmode="numeric" min="0" step="1" placeholder="0" value="${qty || ""}">`
        : `<div class="stepper">
            <button data-action="dec" data-key="${key}">&#8722;</button>
            <span class="qty-val">${qty}</span>
            <button data-action="inc" data-key="${key}">&#43;</button>
          </div>`;
      return `
        <div class="sub-row" data-line="${key}">
          <div class="sub-info">
            <div class="sub-name">${sub}</div>
            <div class="sub-price">${fmt(price)} each</div>
          </div>
          ${control}
          <div class="line-total">${fmt(price*qty)}</div>
        </div>
      `;
    }).join("");
    body.querySelectorAll("button[data-action]").forEach(b => {
      b.addEventListener("click", () => {
        const key = b.dataset.key;
        const delta = b.dataset.action === "inc" ? 1 : -1;
        const next = Math.max(0, (sizedCart[key] || 0) + delta);
        sizedCart[key] = next;
        renderDetailBody();
        renderHeader();
      });
    });
    // Typed quantities update in place. A full re-render on each keystroke
    // would destroy focus and the caret position mid-number.
    body.querySelectorAll(".qty-input").forEach(el => {
      el.addEventListener("keydown", blockNonNumericKeys);
      el.addEventListener("input", () => {
        const key = el.dataset.key;
        const raw = sanitizeNumberInput(el, false);
        const qty = raw === "" ? 0 : parseInt(raw, 10);
        sizedCart[key] = qty;
        const price = PRICES[cat.name][key.split("|")[1]];
        el.closest(".sub-row").querySelector(".line-total").textContent = fmt(price * qty);
        renderHeader();
      });
    });
  } else if (cat.kind === "custom"){
    // One price box, nothing to choose. Each add is its own line at qty 1;
    // tap Add again for the next item.
    const existingLines = manualCart.filter(l => l.category === cat.name);
    body.innerHTML = `
      <div class="manual-form">
        <div class="hint">Type the price and add it to the sale. Repeat for each item.</div>
        <div class="field" style="margin-bottom:12px;">
          <label>Price ($)</label>
          <input type="number" id="customPrice" inputmode="decimal" min="0" step="any" placeholder="e.g. 12.50" value="${customDraft.price}" autofocus>
        </div>
        <button class="add-btn" id="addCustomBtn">Add to sale</button>
      </div>
      <div class="manual-lines">
        ${existingLines.length ? existingLines.map(l => `
          <div class="manual-line" data-line="${l.id}">
            <div class="ml-info"><strong>${fmt(l.price)}</strong></div>
            <button class="remove-x" data-id="${l.id}">&times;</button>
          </div>
        `).join("") : `<div class="hint" style="margin-top:8px;">No items added yet.</div>`}
      </div>
    `;
    const priceEl = document.getElementById("customPrice");
    priceEl.addEventListener("keydown", blockNonNumericKeys);
    priceEl.addEventListener("input", e => customDraft.price = sanitizeNumberInput(e.target, true));
    const addCustom = () => {
      const price = parseFloat(sanitizeNumberInput(priceEl, true));
      if (!price || price <= 0){
        alert("Enter a price greater than 0.");
        return;
      }
      manualCart.push({ id: cat.name + "-" + Date.now() + "-" + Math.random().toString(36).slice(2,6), category: cat.name, type: cat.name, price, qty: 1 });
      customDraft = { price: "" };
      renderDetailBody();
      renderHeader();
    };
    document.getElementById("addCustomBtn").addEventListener("click", addCustom);
    // Enter on the keypad adds too, so a run of items is type → Enter → type → Enter.
    priceEl.addEventListener("keydown", e => { if (e.key === "Enter") addCustom(); });
    priceEl.focus();
    body.querySelectorAll(".remove-x").forEach(b => {
      b.addEventListener("click", () => {
        manualCart = manualCart.filter(l => l.id !== b.dataset.id);
        renderDetailBody();
        renderHeader();
      });
    });
  } else {
    const existingLines = manualCart.filter(l => l.category === cat.name);
    body.innerHTML = `
      <div class="manual-form">
        <div class="hint">Choose the item type, enter its price (typically $5–$30 depending on condition), set quantity, then add it to the sale.</div>
        <div class="field" style="margin-bottom:12px;">
          <label>Item type</label>
          <select id="manualType" class="type-select">
            ${MANUAL_TYPES.map(t => `<option value="${t}" ${t === manualDraft.type ? "selected" : ""}>${t}</option>`).join("")}
          </select>
        </div>
        <div class="field-row">
          <div class="field">
            <label>Price per item ($)</label>
            <input type="number" id="manualPrice" inputmode="decimal" min="0" step="0.5" placeholder="e.g. 10" value="${manualDraft.price}">
          </div>
          <div class="field">
            <label>Quantity</label>
            <input type="number" id="manualQty" inputmode="numeric" min="1" step="1" value="${manualDraft.qty}">
          </div>
        </div>
        <button class="add-btn" id="addManualBtn">Add to sale</button>
      </div>
      <div class="manual-lines">
        ${existingLines.length ? existingLines.map(l => `
          <div class="manual-line" data-line="${l.id}">
            <div class="ml-info"><strong>${l.type}</strong> &middot; ${l.qty} &times; ${fmt(l.price)} = ${fmt(l.qty*l.price)}</div>
            <button class="remove-x" data-id="${l.id}">&times;</button>
          </div>
        `).join("") : `<div class="hint" style="margin-top:8px;">No items added yet.</div>`}
      </div>
    `;
    const typeEl = document.getElementById("manualType");
    const priceEl = document.getElementById("manualPrice");
    const qtyEl = document.getElementById("manualQty");
    priceEl.addEventListener("keydown", blockNonNumericKeys);
    qtyEl.addEventListener("keydown", blockNonNumericKeys);
    typeEl.addEventListener("change", e => manualDraft.type = e.target.value);
    priceEl.addEventListener("input", e => manualDraft.price = sanitizeNumberInput(e.target, true));
    qtyEl.addEventListener("input", e => manualDraft.qty = sanitizeNumberInput(e.target, false));
    document.getElementById("addManualBtn").addEventListener("click", () => {
      const type = typeEl.value;
      const price = parseFloat(sanitizeNumberInput(priceEl, true));
      const qty = parseInt(sanitizeNumberInput(qtyEl, false), 10);
      if (!price || price <= 0 || !qty || qty <= 0){
        alert("Enter a price and quantity greater than 0.");
        return;
      }
      manualCart.push({ id: cat.name + "-" + Date.now() + "-" + Math.random().toString(36).slice(2,6), category: cat.name, type, price, qty });
      manualDraft = { type, price: "", qty: 1 };
      renderDetailBody();
      renderHeader();
    });
    body.querySelectorAll(".remove-x").forEach(b => {
      b.addEventListener("click", () => {
        manualCart = manualCart.filter(l => l.id !== b.dataset.id);
        renderDetailBody();
        renderHeader();
      });
    });
  }
  flashHighlight(body);
}

/* =========================================================
   CART SHEET
   ========================================================= */
function openCart(){
  renderCart();
  document.getElementById("cartOverlay").classList.add("open");
}
function closeCart(){
  document.getElementById("cartOverlay").classList.remove("open");
}
function renderCart(){
  const body = document.getElementById("cartBody");
  const lines = [];
  for (const key in sizedCart){
    const qty = sizedCart[key];
    if (!qty) continue;
    const [cat, sub] = key.split("|");
    const price = PRICES[cat][sub];
    lines.push({ key, label: cat, detail: `${sub} &middot; ${qty} &times; ${fmt(price)}`, total: qty*price, type: "sized" });
  }
  for (const l of manualCart){
    // Individually priced lines show their type as the label with the
    // category underneath; manual-price lines have no type, so the category
    // name alone is the label.
    const prefix = l.type === l.category ? "" : "Individually priced &middot; ";
    lines.push({ key: l.id, label: l.type, detail: `${prefix}${l.qty} &times; ${fmt(l.price)}`, total: l.qty*l.price, type: "manual", category: l.category });
  }
  if (!lines.length){
    body.innerHTML = `<div class="empty-cart">No items added yet.<br>Tap a category to get started.</div>`;
  } else {
    body.innerHTML = `<div class="cart-hint">Tap an item to change it.</div>` + lines.map(l => `
      <div class="cart-line" data-type="${l.type}" data-key="${l.key}" data-cat="${l.type === "sized" ? l.label : l.category}">
        <div class="cl-info">
          <div class="cl-cat">${l.label}</div>
          <div class="cl-sub">${l.detail}</div>
        </div>
        <div class="cl-total">${fmt(l.total)}</div>
        <button class="cl-remove" data-type="${l.type}" data-key="${l.key}">&times;</button>
      </div>
    `).join("");
    // Tap a line to jump to its category sheet with the tapped row flashed;
    // Done/back on that sheet returns here.
    body.querySelectorAll(".cart-line").forEach(row => {
      row.addEventListener("click", () => {
        const cat = CATEGORIES.find(c => c.name === row.dataset.cat);
        if (!cat) return;
        closeCart();
        openCategory(cat, { fromCart: true, highlight: row.dataset.key });
      });
    });
    body.querySelectorAll(".cl-remove").forEach(b => {
      b.addEventListener("click", e => {
        e.stopPropagation();
        if (b.dataset.type === "sized"){
          sizedCart[b.dataset.key] = 0;
        } else {
          manualCart = manualCart.filter(l => l.id !== b.dataset.key);
        }
        renderCart();
        renderHeader();
        renderGrid();
      });
    });
  }
  document.getElementById("cartTotal").textContent = fmt(calcTotal());
}

function startNewSale(){
  if (calcCount() > 0){
    const ok = confirm("Start a new sale? This will clear the current total.");
    if (!ok) return;
  }
  sizedCart = {};
  manualCart = [];
  renderHeader();
  renderGrid();
  renderCart();
  closeCart();
}

/* =========================================================
   WIRE UP
   ========================================================= */
document.getElementById("openCartBtn").addEventListener("click", openCart);
document.getElementById("closeCartBtn").addEventListener("click", closeCart);
document.getElementById("backBtn").addEventListener("click", closeCategory);
document.getElementById("doneBtn").addEventListener("click", closeCategory);
document.getElementById("newSaleBtn").addEventListener("click", startNewSale);

renderGrid();
renderHeader();
