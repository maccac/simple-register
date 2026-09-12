/* Test harness: boots the real app in jsdom.

   loadApp() reads index.html from disk and lets jsdom run its two
   <script src> tags exactly as a browser would, so the tests exercise
   data.js and app.js unchanged — no test-only exports, no mocks of our
   own code. Every call returns a fresh window, so tests never share cart
   state.

   Interaction helpers deliberately go through DOM events (click, input,
   keydown) rather than calling app functions directly: if a button stops
   being wired up, the test fails the same way a real tap would. */
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { JSDOM, ResourceLoader } = require("jsdom");

// Only load resources from disk. index.html also links a Google Fonts
// stylesheet; returning an empty body for anything over http(s) keeps the
// tests offline and fast without touching index.html.
class LocalOnlyLoader extends ResourceLoader {
  fetch(url, options){
    if (url.startsWith("file:")) return super.fetch(url, options);
    return Promise.resolve(Buffer.from(""));
  }
}

const ROOT = path.resolve(__dirname, "..", "public");
const INDEX = path.join(ROOT, "index.html");

function loadApp({ confirm = () => true } = {}){
  const html = fs.readFileSync(INDEX, "utf8");
  const dom = new JSDOM(html, {
    url: pathToFileURL(INDEX).href,
    runScripts: "dangerously",   // execute the page's own <script> tags
    resources: new LocalOnlyLoader(), // ...and load data.js / app.js from disk
    pretendToBeVisual: true
  });
  const { window } = dom;

  // Capture native dialogs instead of letting jsdom log "not implemented".
  const alerts = [];
  window.alert = msg => alerts.push(msg);
  window.confirm = confirm;
  // jsdom lacks scrollIntoView and CSS.escape; flashHighlight() uses both.
  window.HTMLElement.prototype.scrollIntoView = () => {};
  if (!window.CSS) window.CSS = {};
  if (!window.CSS.escape) window.CSS.escape = s => s.replace(/(["\\])/g, "\\$1");

  // Scripts load asynchronously through the resource loader — wait for them.
  const ready = new Promise(resolve => {
    window.addEventListener("load", () => resolve());
  });

  const $ = sel => {
    const el = window.document.querySelector(sel);
    if (!el) throw new Error("no element matches " + sel);
    return el;
  };
  const $$ = sel => Array.from(window.document.querySelectorAll(sel));
  const text = sel => $(sel).textContent.trim();

  const tap = target => {
    const el = typeof target === "string" ? $(target) : target;
    el.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  };
  // Sets an input's value the way typing does: fires keydown per character
  // (so blockNonNumericKeys sees it) then a single input event with the
  // resulting value. Characters the keydown guard rejects are dropped.
  const type = (target, value) => {
    const el = typeof target === "string" ? $(target) : target;
    let accepted = "";
    for (const ch of String(value)){
      const ev = new window.KeyboardEvent("keydown", { key: ch, bubbles: true, cancelable: true });
      el.dispatchEvent(ev);
      if (!ev.defaultPrevented) accepted += ch;
    }
    el.value = accepted;
    el.dispatchEvent(new window.Event("input", { bubbles: true }));
  };
  const pressEnter = target => {
    const el = typeof target === "string" ? $(target) : target;
    el.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  };
  const isOpen = id => $("#" + id).classList.contains("open");

  // Commonly asserted state, read the way a user sees it.
  const header = () => ({ total: text("#headerTotal"), count: text("#headerCount") });
  const tile = name => $$(".tile").find(t => t.querySelector(".name").textContent === name)
    || (() => { throw new Error("no tile named " + name); })();
  const subRow = name => $$(".sub-row").find(r => r.querySelector(".sub-name").textContent === name)
    || (() => { throw new Error("no size tier named " + name); })();
  const cartLines = () => $$(".cart-line").map(l => ({
    cat: l.querySelector(".cl-cat").textContent.trim(),
    sub: l.querySelector(".cl-sub").textContent.trim(),
    total: l.querySelector(".cl-total").textContent.trim(),
    el: l
  }));

  return ready.then(() => ({
    window, document: window.document, alerts,
    $, $$, text, tap, type, pressEnter, isOpen,
    header, tile, subRow, cartLines,
    // Top-level consts in a classic script aren't window properties, so
    // read the catalogue back out with eval in the page's own scope.
    ...window.eval("({ PRICES, CATEGORIES, MANUAL_TYPES })")
  }));
}

module.exports = { loadApp, ROOT };
