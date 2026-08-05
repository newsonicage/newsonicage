/**
 * Gate on /discovery.
 *
 * The page carries the pricing archetypes and the operator's fit scripts in
 * its source. A noindex and a robots refusal keep it out of an index; neither
 * stops someone who read the URL off the address bar during a meeting. This
 * does — without the cookie the real HTML never leaves the edge.
 *
 * Two ways in, both ending in the same year-long cookie:
 *
 *   Passcode  — the 404 is real, but the words "Not Found" are a button. Click
 *               them (or just start typing digits) and a keypad appears. The
 *               code is POSTed back here and checked against DISCOVERY_PASSCODE
 *               server-side. It is never sent to the browser, so view-source on
 *               the 404 reveals nothing but the keypad markup.
 *   Link      — /discovery?k=<DISCOVERY_KEY> for a device where typing is
 *               awkward, and as the way back in if the passcode is ever
 *               changed while locked out.
 *
 * On success the key or code is swapped for a cookie holding a SHA-256 of the
 * secret, and the URL is redirected clean so nothing lands in history.
 * Rotating either env var revokes every device that used it.
 *
 * Deliberately INERT until at least one of the two env vars is set. Failing
 * closed would let a deploy take the tool offline in the middle of a meeting.
 * The x-discovery-gate response header always reports the live mode.
 *
 * On the passcode's strength: four digits is 10,000 combinations. A wrong
 * guess costs a deliberate ~1.2s here, so grinding the whole space takes hours
 * and makes noise, and an attacker has to know the path exists and that the
 * 404 is clickable before any of that starts. Good enough for pricing copy;
 * lengthen DISCOVERY_PASSCODE if it ever guards more than that — the code
 * takes any length, no edit needed.
 */

export const config = { path: ['/discovery', '/discovery.html'] };

const COOKIE = 'nsa_discovery';
const YEAR = 60 * 60 * 24 * 365;
const WRONG_DELAY_MS = 1200;

function env(name) {
  try {
    if (globalThis.Netlify?.env?.get) return globalThis.Netlify.env.get(name);
  } catch (_) { /* fall through */ }
  try {
    return globalThis.Deno?.env?.get(name);
  } catch (_) {
    return undefined;
  }
}

async function sha256hex(s) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

// Constant time, so a wrong guess can't be narrowed down by how fast it failed.
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

const cookieHeader = token =>
  `${COOKIE}=${token}; Path=/; Max-Age=${YEAR}; HttpOnly; Secure; SameSite=Lax`;

/* The decoy. A genuine 404 that happens to be interactive. Nothing secret is
   in here — it holds no code, no hash, and none of the real page. */
function notFoundPage() {
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow,noarchive">
<title>Not Found</title>
<style>
  :root{--blue:#00A8FF;--ink:#0E1A2B;--dim:#54637A;--faint:#95A2B4;--line:#E1E9F1;--warn:#E0533B}
  *{margin:0;padding:0;box-sizing:border-box}
  body{
    min-height:100vh;display:flex;align-items:center;justify-content:center;
    background:#fff;color:var(--ink);
    font:400 16px/1.5 'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;
    padding:24px;-webkit-font-smoothing:antialiased;
  }
  .w{width:100%;max-width:300px;text-align:center}
  h1{font-size:26px;font-weight:700;letter-spacing:-.3px;cursor:default;user-select:none;
     -webkit-user-select:none;-webkit-tap-highlight-color:transparent}
  p.s{color:var(--dim);font-size:15px;margin-top:8px}
  #pad{display:none;margin-top:30px}
  body.open #pad{display:block}
  body.open h1{font-size:19px;color:var(--faint);font-weight:600}
  body.open p.s{display:none}
  .dots{display:flex;gap:12px;justify-content:center;margin-bottom:22px}
  .dot{width:13px;height:13px;border-radius:50%;border:1.5px solid var(--line);transition:.15s}
  .dot.f{background:var(--blue);border-color:var(--blue)}
  .keys{display:grid;grid-template-columns:repeat(3,1fr);gap:9px}
  .keys button{
    font:600 20px/1 inherit;color:var(--ink);background:#fff;border:1px solid var(--line);
    border-radius:9px;padding:15px 0;cursor:pointer;transition:.12s;
    -webkit-tap-highlight-color:transparent;
  }
  .keys button:hover{border-color:var(--blue);color:var(--blue)}
  .keys button:active{background:#EAF6FF;transform:scale(.96)}
  .keys button.ghost{border-color:transparent;font-size:14px;color:var(--faint);font-weight:500}
  .keys button.ghost:hover{color:var(--ink)}
  .err{color:var(--warn);font-size:13px;height:16px;margin-top:14px;opacity:0;transition:.15s}
  .err.on{opacity:1}
  body.shake #pad{animation:sh .34s}
  @keyframes sh{10%,90%{transform:translateX(-2px)}30%,70%{transform:translateX(4px)}50%{transform:translateX(-4px)}}
  body.busy .keys{opacity:.45;pointer-events:none}
  @media(prefers-color-scheme:dark){
    body{background:#04070D;color:#fff}
    h1{color:#fff}
    .dot{border-color:rgba(255,255,255,.22)}
    .keys button{background:transparent;color:#fff;border-color:rgba(255,255,255,.16)}
    .keys button:active{background:rgba(0,168,255,.14)}
  }
</style>
</head><body>
<div class="w">
  <h1 id="t" tabindex="0" role="button" aria-label="Not Found">Not Found</h1>
  <p class="s">The requested URL was not found on this server.</p>
  <div id="pad">
    <div class="dots" id="dots"></div>
    <div class="keys">
      ${[1,2,3,4,5,6,7,8,9].map(n => `<button data-d="${n}">${n}</button>`).join('')}
      <button class="ghost" data-x="c">clear</button>
      <button data-d="0">0</button>
      <button class="ghost" data-x="b">&#9003;</button>
    </div>
    <div class="err" id="err"></div>
  </div>
</div>
<script>
(function(){
  var buf='', busy=false;
  var body=document.body, dots=document.getElementById('dots'), err=document.getElementById('err');
  // Length is not known to the client — the server decides. Render a dot per
  // digit typed, with four as the resting shape.
  function draw(){
    var n=Math.max(4,buf.length), h='';
    for(var i=0;i<n;i++) h+='<span class="dot'+(i<buf.length?' f':'')+'"></span>';
    dots.innerHTML=h;
  }
  function open(){ if(!body.classList.contains('open')){ body.classList.add('open'); draw(); } }
  function fail(m){
    body.classList.add('shake'); setTimeout(function(){ body.classList.remove('shake'); },340);
    err.textContent=m||'Try again'; err.classList.add('on');
    buf=''; draw();
  }
  async function submit(){
    busy=true; body.classList.add('busy'); err.classList.remove('on');
    try{
      var r=await fetch(location.pathname,{
        method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({code:buf}),
        credentials:'same-origin'
      });
      if(r.ok){ location.replace(location.pathname); return; }
      fail(r.status===429?'Slow down':'Try again');
    }catch(e){ fail('No connection'); }
    busy=false; body.classList.remove('busy');
  }
  function push(d){
    if(busy) return;
    open(); err.classList.remove('on');
    buf+=d; draw();
    if(buf.length>=4) submit();     // 4 is the common case; longer codes use Enter
  }
  document.getElementById('t').addEventListener('click',open);
  document.getElementById('t').addEventListener('keydown',function(e){
    if(e.key==='Enter'||e.key===' '){ e.preventDefault(); open(); }
  });
  document.querySelectorAll('[data-d]').forEach(function(b){
    b.addEventListener('click',function(){ push(b.dataset.d); });
  });
  document.querySelectorAll('[data-x]').forEach(function(b){
    b.addEventListener('click',function(){
      if(busy) return;
      buf = b.dataset.x==='c' ? '' : buf.slice(0,-1);
      err.classList.remove('on'); draw();
    });
  });
  // Typing a digit anywhere opens the pad too — faster than finding the words.
  document.addEventListener('keydown',function(e){
    if(busy) return;
    if(e.key>='0'&&e.key<='9'){ push(e.key); }
    else if(e.key==='Backspace'){ open(); buf=buf.slice(0,-1); draw(); }
    else if(e.key==='Enter'&&buf.length){ submit(); }
    else if(e.key==='Escape'){ buf=''; draw(); }
  });
})();
</script>
</body></html>`;
}

const deny = (mode, body, status) => new Response(body ?? 'Not Found\n', {
  status: status ?? 404,
  headers: {
    'content-type': body ? 'text/html; charset=utf-8' : 'text/plain; charset=utf-8',
    'cache-control': 'no-store',
    'x-robots-tag': 'noindex, nofollow, noarchive',
    'x-discovery-gate': mode
  }
});

export default async (request, context) => {
  const key = env('DISCOVERY_KEY');
  const passcode = env('DISCOVERY_PASSCODE');

  if (!key && !passcode) {
    const res = await context.next();
    res.headers.set('x-discovery-gate', 'inactive-no-key');
    return res;
  }

  // Any secret that is set can mint the cookie, so a cookie is valid if it
  // matches any of them. Rotating one does not lock out the other.
  const tokens = [];
  if (key) tokens.push(await sha256hex(key));
  if (passcode) tokens.push(await sha256hex(passcode));

  const url = new URL(request.url);

  /* ── keypad submission ── */
  if (request.method === 'POST') {
    let given = '';
    try {
      const b = await request.json();
      given = typeof b?.code === 'string' ? b.code : '';
    } catch (_) { /* malformed body falls through to the reject */ }

    if (passcode && safeEqual(given, passcode)) {
      return new Response(null, {
        status: 204,
        headers: {
          'set-cookie': cookieHeader(await sha256hex(passcode)),
          'cache-control': 'no-store',
          'x-discovery-gate': 'unlocked-passcode'
        }
      });
    }
    // Cheap, stateless brake on grinding the code space.
    await sleep(WRONG_DELAY_MS);
    return deny('wrong-passcode', null, 401);
  }

  /* ── link unlock ── */
  const given = url.searchParams.get('k');
  if (key && given !== null && safeEqual(given, key)) {
    url.searchParams.delete('k');
    const clean = url.pathname + (url.searchParams.toString() ? `?${url.searchParams}` : '');
    return new Response(null, {
      status: 302,
      headers: {
        location: clean,
        'set-cookie': cookieHeader(await sha256hex(key)),
        'cache-control': 'no-store',
        'x-discovery-gate': 'unlocked-link'
      }
    });
  }

  /* ── returning visitor ── */
  const cookie = request.headers.get('cookie') || '';
  const match = cookie.match(/(?:^|;\s*)nsa_discovery=([a-f0-9]{64})/);
  if (match && tokens.some(t => safeEqual(match[1], t))) {
    const res = await context.next();
    // Never shared-cacheable: a cached 200 at the CDN would be served to
    // people who never presented the cookie.
    res.headers.set('cache-control', 'private, no-store, max-age=0');
    res.headers.set('x-discovery-gate', 'ok');
    return res;
  }

  return deny('denied', passcode ? notFoundPage() : null);
};
