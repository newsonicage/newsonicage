#!/usr/bin/env node
/**
 * The public site states no prices. It states outcomes instead.
 *
 * This replaces the old check-prices.js, which enforced that five surfaces
 * agreed on the same dollar figures. As of 2026-07-28 the figures are gone —
 * implementations are scoped after a no-cost Business Assessment — so the
 * check inverts: it fails when a price reappears, and it keeps the surfaces
 * that DID survive in agreement.
 *
 *   1. No dollar figures anywhere public (index.html, llms.txt)
 *   2. No price fields in the JSON-LD OfferCatalog
 *   3. Roadmap step order matches the OfferCatalog order
 *   4. Every step's progress stack lights up its own position
 *   5. Every hero tile outcome is the same sentence as its roadmap step's
 *
 * The one allowed exception is the intake form's budget dropdowns. Those are
 * qualifiers the prospect answers, not prices we publish.
 *
 * Run:  node scripts/check-public-copy.js
 * Exits non-zero on any violation, so it works as a pre-commit hook.
 */

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const llms = fs.readFileSync(path.join(root, 'llms.txt'), 'utf8');

const problems = [];
const report = (surface, msg) => problems.push({ surface, msg });

// Compare rendered copy, not markup: strip tags, entities, and the ™.
const norm = (s) =>
  s
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/[™]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

// ── 1. No published prices ───────────────────────────────────────────
// Blank out the intake budget <select> blocks first — those ranges are
// qualifiers, not published pricing.
const htmlSansBudgets = html.replace(
  /<select[^>]*name="(?:setup_budget|monthly_budget)"[\s\S]*?<\/select>/g,
  '<select></select>'
);

for (const m of htmlSansBudgets.matchAll(/\$[\d,]+/g)) {
  report('index.html', `${m[0]} appears on the page — the public site publishes no prices`);
}
for (const m of llms.matchAll(/\$[\d,]+/g)) {
  report('llms.txt', `${m[0]} appears here — the public site publishes no prices`);
}

// ── 2. Source of truth: the OfferCatalog ─────────────────────────────
const ldRaw = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
if (!ldRaw) {
  console.error('FAIL  no JSON-LD block found in index.html');
  process.exit(1);
}

let offers = [];
try {
  const graph = JSON.parse(ldRaw[1])['@graph'];
  const svc = graph.find((n) => n['@type'] === 'ProfessionalService');
  offers = svc.hasOfferCatalog.itemListElement;
} catch (e) {
  console.error('FAIL  could not parse the OfferCatalog:', e.message);
  process.exit(1);
}

const priceKeys = ['priceSpecification', 'price', 'minPrice', 'maxPrice', 'priceCurrency'];
for (const o of offers) {
  for (const k of priceKeys) {
    if (k in o) report('JSON-LD', `offer "${o.name}" still carries ${k}`);
  }
}

// ── 3. Roadmap order matches the catalog ─────────────────────────────
const steps = [...html.matchAll(
  /<div class="step[^"]*" data-step id="([^"]+)">([\s\S]*?)\n        <\/div>/g
)].map((m) => ({ id: m[1], body: m[2] }));

if (steps.length === 0) {
  report('roadmap', 'no .step blocks found — did the markup change?');
}

const stepNames = steps.map((s) => {
  const n = s.body.match(/<h3 class="step-name">([\s\S]*?)<\/h3>/);
  return n ? norm(n[1]) : `«${s.id} has no step-name»`;
});
const offerNames = offers.map((o) => norm(o.name));

if (stepNames.join(' | ') !== offerNames.join(' | ')) {
  report('roadmap', 'step order/names disagree with the OfferCatalog');
  report('roadmap', `  page:    ${stepNames.join(' → ')}`);
  report('roadmap', `  JSON-LD: ${offerNames.join(' → ')}`);
}

// ── 4. Progress stacks encode position ───────────────────────────────
// Step N of the path must light exactly N segments. Moving a step without
// reassigning these is silent and looks plausible, which is why it's checked.
steps.forEach((s, i) => {
  const lit = (s.body.match(/<div class="seg on"><\/div>/g) || []).length;
  const total = (s.body.match(/<div class="seg[^"]*"><\/div>/g) || []).length;
  if (lit !== i + 1) {
    report('roadmap', `#${s.id} is step ${i + 1} but lights ${lit} segment(s)`);
  }
  if (total !== steps.length) {
    report('roadmap', `#${s.id} has ${total} segments but there are ${steps.length} steps`);
  }
});

// ── 5. Hero tile outcomes match their step outcomes ──────────────────
const stepOutcomes = new Map();
steps.forEach((s) => {
  const o = s.body.match(/<p class="step-outcome">([\s\S]*?)<\/p>/);
  if (!o) {
    report('roadmap', `#${s.id} has no outcome line — every phase ends on one`);
    return;
  }
  stepOutcomes.set(s.id, norm(o[1]).replace(/^outcome\s*/, ''));
});

const tiles = [...html.matchAll(
  /<a class="tile[^"]*" data-panel href="#([^"]+)">([\s\S]*?)<\/a>/g
)];

if (tiles.length === 0) report('hero tiles', 'no tiles found — did the markup change?');

tiles.forEach(([, target, body]) => {
  const v = body.match(/<span class="tile-outcome-v">([\s\S]*?)<\/span>/);
  if (!v) {
    report('hero tiles', `the tile linking to #${target} has no outcome`);
    return;
  }
  const tileOutcome = norm(v[1]);
  const stepOutcome = stepOutcomes.get(target);
  if (stepOutcome === undefined) {
    report('hero tiles', `tile links to #${target}, which is not a roadmap step`);
  } else if (tileOutcome !== stepOutcome) {
    report('hero tiles', `#${target} outcome differs from its roadmap step`);
    report('hero tiles', `  tile: "${tileOutcome}"`);
    report('hero tiles', `  step: "${stepOutcome}"`);
  }
});

// ── Result ───────────────────────────────────────────────────────────
if (problems.length === 0) {
  console.log(`OK  no published prices; ${steps.length} phases in sync with ${tiles.length} tiles.`);
  steps.forEach((s, i) =>
    console.log(`    ${String(i + 1)}. ${stepNames[i].padEnd(22)} ${stepOutcomes.get(s.id) || ''}`)
  );
  process.exit(0);
}

console.error(`FAIL  ${problems.length} problem(s):\n`);
for (const p of problems) console.error(`  [${p.surface}] ${p.msg}`);
console.error('\n  The JSON-LD OfferCatalog in index.html is the source of truth for order and naming.');
process.exit(1);
