# Berzerko — Sale Calculator

Point-of-sale calculator for Berzerko, a toy re-sale store. Staff use it on a
phone at checkout: tap categories, build a cart, read the total. No accounts,
no order history, no server.

## Structure

```
public/       the app — 4 static files, no build step. Deploy = copy this folder.
  index.html  markup
  styles.css  styling
  data.js     prices and categories (the only file to edit to change what's sold)
  app.js      logic
test/         jsdom tests
scripts/      serve.js — dev server that prints a LAN URL for a phone
```

Plain HTML/CSS/JS. `package.json` exists only for the tests; nothing in it ships.

## Pricing

All in `public/data.js`. Three kinds of category tile:

- **Sized** — `PRICES` maps category → size tier → price (e.g. Lego: Set $15,
  Loose bricks $0.10). Staff pick a quantity per tier.
- **Individually Priced Items** — one tile; staff pick a type from
  `MANUAL_TYPES` and enter a price and quantity.
- **Manual Price** — one tile; staff just type a price. Each add is one item.

To change a price, edit `PRICES`.

## Build and test

There is no build. `npm install` once, then:

| | |
|---|---|
| `npm test` | syntax-check + test suite (~1s). CI runs this on every push. |
| `npm run serve` | serve `public/` on :8080 |

Tests boot the real `public/index.html` in jsdom and drive it through DOM
events, so `app.js` needs no test-only changes. Copy an existing test in
`test/app.test.js` to add one.
