/**
 * Gate on /discovery.
 *
 * The page is an in-meeting instrument, and its source carries the pricing
 * archetypes and the operator's fit scripts. robots.txt and a noindex keep it
 * out of an index; neither stops a person who read the URL off the address bar
 * during a meeting and typed it in later. This does — the HTML never leaves
 * the edge without the cookie, so there is no source to view.
 *
 * How it is used:
 *   1. Once per device, open  /discovery?k=<DISCOVERY_KEY>
 *   2. The key is swapped for a year-long HttpOnly cookie and the URL is
 *      redirected clean, so the secret never sits in the address bar, the
 *      history, or a referrer header.
 *   3. Every later visit to /discovery just works.
 *   4. Everyone else gets a 404 that looks like the page was never there.
 *
 * Deliberately INERT until DISCOVERY_KEY is set in the Netlify environment.
 * Failing closed would mean a deploy could take the tool offline in the middle
 * of a meeting; failing open keeps today's behaviour until the key exists.
 * Which mode it is in is reported in the x-discovery-gate response header, so
 * "is this actually on?" is one curl away rather than a guess.
 */

export const config = { path: ['/discovery', '/discovery.html'] };

const COOKIE = 'nsa_discovery';
const YEAR = 60 * 60 * 24 * 365;

function readKey() {
  try {
    if (globalThis.Netlify?.env?.get) return globalThis.Netlify.env.get('DISCOVERY_KEY');
  } catch (_) { /* fall through */ }
  try {
    return globalThis.Deno?.env?.get('DISCOVERY_KEY');
  } catch (_) {
    return undefined;
  }
}

async function sha256hex(s) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

// Compare without leaking length or position through timing. Cheap, and the
// alternative is a comparison that returns early on the first wrong character.
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export default async (request, context) => {
  const secret = readKey();

  if (!secret) {
    const res = await context.next();
    res.headers.set('x-discovery-gate', 'inactive-no-key');
    return res;
  }

  const token = await sha256hex(secret);
  const url = new URL(request.url);
  const given = url.searchParams.get('k');

  // Unlock, then get the secret out of the URL immediately.
  if (given !== null && safeEqual(given, secret)) {
    url.searchParams.delete('k');
    const clean = url.pathname + (url.searchParams.toString() ? `?${url.searchParams}` : '');
    return new Response(null, {
      status: 302,
      headers: {
        location: clean,
        'set-cookie': `${COOKIE}=${token}; Path=/; Max-Age=${YEAR}; HttpOnly; Secure; SameSite=Lax`,
        'cache-control': 'no-store',
        'x-discovery-gate': 'unlocked'
      }
    });
  }

  const cookie = request.headers.get('cookie') || '';
  const match = cookie.match(/(?:^|;\s*)nsa_discovery=([a-f0-9]{64})/);

  if (match && safeEqual(match[1], token)) {
    const res = await context.next();
    // Must not be shared-cached: a cached 200 at the CDN would be handed to
    // visitors who never presented the cookie, which defeats the whole thing.
    res.headers.set('cache-control', 'private, no-store, max-age=0');
    res.headers.set('x-discovery-gate', 'ok');
    return res;
  }

  return new Response('Not Found\n', {
    status: 404,
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'no-store',
      'x-discovery-gate': 'denied'
    }
  });
};
