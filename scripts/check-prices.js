#!/usr/bin/env node
/**
 * Published pricing lives in five places. This fails loudly when they drift.
 *
 *   1. JSON-LD OfferCatalog   index.html   <- source of truth
 *   2. Hero tiles             index.html
 *   3. Path steps             index.html
 *   4. JSON-LD FAQPage answer index.html
 *   5. llms.txt
 *
 * Run:  node scripts/check-prices.js
 * Exits non-zero on any mismatch, so it works as a pre-commit hook.
 */

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const llms = fs.readFileSync(path.join(root, 'llms.txt'), 'utf8');

const num = (s) => Number(String(s).replace(/,/g, ''));
const pair = (a, b) => `${num(a)}-${num(b)}`;

const problems = [];
const report = (surface, msg) => problems.push({ surface, msg });

// ── 1. Source of truth ───────────────────────────────────────────────
const ldRaw = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
if (!ldRaw) {
  console.error('FAIL  no JSON-LD block found in index.html');
  process.exit(1);
}

let offers;
try {
  const graph = JSON.parse(ldRaw[1])['@graph'];
  const svc = graph.find((n) => n['@type'] === 'ProfessionalService');
  offers = svc.hasOfferCatalog.itemListElement.map((o) => {
    const spec = o.priceSpecification;
    const find = (n) => spec.find((s) => s.name === n);
    return {
      name: o.name,
      setup: pair(find('Setup').minPrice, find('Setup').maxPrice),
      monthly: pair(find('Monthly').minPrice, find('Monthly').maxPrice),
    };
  });
} catch (e) {
  console.error('FAIL  could not parse the OfferCatalog:', e.message);
  process.exit(1);
}

// Every setup range and every monthly range, order-independent.
const expected = new Set(offers.flatMap((o) => [o.setup, o.monthly]));

const compare = (surface, found) => {
  const missing = [...expected].filter((p) => !found.has(p));
  const extra = [...found].filter((p) => !expected.has(p));
  missing.forEach((p) => report(surface, `missing range $${p.replace('-', '–')}`));
  extra.forEach((p) => report(surface, `has $${p.replace('-', '–')}, which is not in the OfferCatalog`));
};

// ── 2. Hero tiles ────────────────────────────────────────────────────
const tiles = new Set();
for (const m of html.matchAll(/tile-price-v">\$([\d,]+)–([\d,]+)</g)) {
  tiles.add(pair(m[1], m[2]));
}
compare('hero tiles', tiles);

// ── 3. Path steps ────────────────────────────────────────────────────
const steps = new Set();
for (const m of html.matchAll(
  /step-price">\$([\d,]+)–([\d,]+)\s*<span class="sep">\+<\/span>\s*\$([\d,]+)–([\d,]+)/g
)) {
  steps.add(pair(m[1], m[2]));
  steps.add(pair(m[3], m[4]));
}
compare('path steps', steps);

// ── 4. FAQPage answer ────────────────────────────────────────────────
const faqNode = html.match(/"text": "Every implementation[^"]*/);
const faq = new Set();
if (!faqNode) {
  report('FAQ answer', 'could not find the pricing answer');
} else {
  for (const m of faqNode[0].matchAll(/\$([\d,]+)–\$([\d,]+)/g)) {
    faq.add(pair(m[1], m[2]));
  }
  compare('FAQ answer', faq);
}

// ── 5. llms.txt ──────────────────────────────────────────────────────
const llmsSet = new Set();
for (const m of llms.matchAll(/Setup \$([\d,]+)–\$([\d,]+)\. Monthly \$([\d,]+)–\$([\d,]+)\./g)) {
  llmsSet.add(pair(m[1], m[2]));
  llmsSet.add(pair(m[3], m[4]));
}
compare('llms.txt', llmsSet);

// Any dollar figure in llms.txt that is not a published price is a leak —
// this is exactly how the unpublished $41,500 / $2,245 totals got in.
for (const m of llms.matchAll(/\$([\d,]+)/g)) {
  const v = num(m[1]);
  const known = [...expected].some((p) => p.split('-').map(Number).includes(v));
  if (!known) {
    report('llms.txt', `$${m[1]} appears here but is not a price published in index.html`);
  }
}

// ── Result ───────────────────────────────────────────────────────────
if (problems.length === 0) {
  console.log(`OK  ${offers.length} offers, prices agree across all five surfaces.`);
  offers.forEach((o) =>
    console.log(`    ${o.name.padEnd(20)} setup $${o.setup.replace('-', '–')}  monthly $${o.monthly.replace('-', '–')}`)
  );
  process.exit(0);
}

console.error(`FAIL  ${problems.length} pricing mismatch(es):\n`);
for (const p of problems) console.error(`  [${p.surface}] ${p.msg}`);
console.error('\n  The JSON-LD OfferCatalog in index.html is the source of truth.');
process.exit(1);
