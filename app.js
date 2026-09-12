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
// manualCart: array of { id, category, price, qty }
let manualCart = [];
let activeCategory = null;
let manualDraft = { type: MANUAL_TYPES[0], price: "", qty: 1 };

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
  if (cat.manual){
    return manualCart.filter(l => l.category === cat.name).reduce((a,l)=>a+l.qty,0);
  }
  let sum = 0;
  for (const key in sizedCart){
    if (key.startsWith(cat.name + "|")) sum += sizedCart[key] || 0;
  }
  return sum;
}

function renderGrid(){
  const grid = document.getElementById("categoryGrid");
  grid.innerHTML = "";
  CATEGORIES.forEach((cat, i) => {
    const btn = document.createElement("button");
    btn.className = "tile" + (cat.manual ? " manual" : "");
    btn.style.background = TILE_COLORS[i % TILE_COLORS.length];
    const qty = categoryQtyInCart(cat);
    btn.innerHTML = `
      ${qty > 0 ? `<span class="qty-badge">${qty}</span>` : ""}
      <span class="name">${cat.name}</span>
      <span class="meta">${cat.manual ? "Priced individually" : "Tap to choose size"}</span>
    `;
    btn.addEventListener("click", () => openCategory(cat));
    grid.appendChild(btn);
  });
}

/* =========================================================
   CATEGORY DETAIL SHEET
   ========================================================= */
function openCategory(cat){
  activeCategory = cat;
  manualDraft = { type: MANUAL_TYPES[0], price: "", qty: 1 };
  document.getElementById("detailTitle").textContent = cat.name;
  renderDetailBody();
  document.getElementById("detailOverlay").classList.add("open");
}
function closeCategory(){
  document.getElementById("detailOverlay").classList.remove("open");
  activeCategory = null;
  renderGrid();
}

function renderDetailBody(){
  const body = document.getElementById("detailBody");
  const cat = activeCategory;
  if (!cat.manual){
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
        <div class="sub-row">
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
          <div class="manual-line">
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
    lines.push({ key, label: cat, sub, qty, price, total: qty*price, type: "sized" });
  }
  for (const l of manualCart){
    lines.push({ key: l.id, label: l.type, sub: "Individually priced", qty: l.qty, price: l.price, total: l.qty*l.price, type: "manual" });
  }
  if (!lines.length){
    body.innerHTML = `<div class="empty-cart">No items added yet.<br>Tap a category to get started.</div>`;
  } else {
    body.innerHTML = lines.map(l => `
      <div class="cart-line">
        <div class="cl-info">
          <div class="cl-cat">${l.label}</div>
          <div class="cl-sub">${l.sub} &middot; ${l.qty} &times; ${fmt(l.price)}</div>
        </div>
        <div class="cl-total">${fmt(l.total)}</div>
        <button class="cl-remove" data-type="${l.type}" data-key="${l.key}">&times;</button>
      </div>
    `).join("");
    body.querySelectorAll(".cl-remove").forEach(b => {
      b.addEventListener("click", () => {
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
