#!/usr/bin/env node
/**
 * Stamp style.css and main.js with a content hash in index.html.
 *
 * Cloudflare serves both with `Cache-Control: public, max-age=14400`, so a
 * returning visitor keeps its cached copy for four hours without asking the
 * server — while `/` is `max-age=0, must-revalidate` and is always fresh.
 * That combination ships new HTML against old JS. It is not theoretical: the
 * hidden `subject` field went live while the browser was still running a
 * main.js that had never heard of it, and the notification subject silently
 * fell back to its static default.
 *
 * A changed query string is a different cache key for both the browser and the
 * CDN, so `?v=<hash>` propagates immediately with no dashboard purge.
 *
 * Run:  node scripts/stamp-assets.js        (rewrites index.html)
 *       node scripts/stamp-assets.js --check  (exit 1 if stale — used by npm test)
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.join(__dirname, '..');
const indexPath = path.join(root, 'index.html');

const ASSETS = [
  { file: 'style.css', pattern: /(href=")(style\.css)(?:\?v=[a-f0-9]+)?(")/ },
  { file: 'main.js', pattern: /(src=")(main\.js)(?:\?v=[a-f0-9]+)?(")/ },
];

const hashOf = (file) =>
  crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex').slice(0, 10);

const check = process.argv.includes('--check');
let html = fs.readFileSync(indexPath, 'utf8');
const stale = [];
let changed = false;

for (const { file, pattern } of ASSETS) {
  const want = hashOf(file);
  const found = html.match(pattern);
  if (!found) {
    stale.push(`${file} is not referenced in index.html the way this script expects`);
    continue;
  }
  const current = (found[0].match(/\?v=([a-f0-9]+)/) || [])[1];
  if (current !== want) {
    stale.push(`${file} changed but index.html still asks for ?v=${current || '(none)'} — want ?v=${want}`);
    html = html.replace(pattern, `$1$2?v=${want}$3`);
    changed = true;
  }
}

if (check) {
  if (stale.length) {
    console.error('FAIL  asset stamps are stale:\n');
    stale.forEach((s) => console.error(`  ${s}`));
    console.error('\n  Run `npm run stamp` — otherwise returning visitors run cached JS/CSS');
    console.error('  against fresh HTML for up to four hours after deploy.');
    process.exit(1);
  }
  console.log('OK  style.css and main.js stamps match their contents.');
  process.exit(0);
}

if (changed) {
  fs.writeFileSync(indexPath, html);
  stale.forEach((s) => console.log(`  updated: ${s}`));
  console.log('OK  index.html re-stamped.');
} else {
  console.log('OK  nothing to do; stamps already current.');
}
