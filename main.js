/* =============================================================
   NEWSONIC AGE — main.js

   Four things happen here:
     1. the cursor (unchanged in geometry and behaviour)
     2. reveal-on-scroll
     3. panel focus — pointer or arrow key, one panel at a time
     4. the hover sound pool
   ============================================================= */

(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer  = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* ─── 1 · CURSOR ─────────────────────────────────────────── */

  var cursor = document.getElementById('cursor');
  var ring   = document.getElementById('cursor-ring');

  if (cursor && ring && finePointer) {
    var cx = 0, cy = 0, rx = 0, ry = 0;

    document.addEventListener('mousemove', function (e) {
      cx = e.clientX;
      cy = e.clientY;
      cursor.style.left = cx + 'px';
      cursor.style.top  = cy + 'px';
    });

    (function animateRing() {
      rx += (cx - rx) * 0.12;
      ry += (cy - ry) * 0.12;
      ring.style.left = rx + 'px';
      ring.style.top  = ry + 'px';
      requestAnimationFrame(animateRing);
    })();

    document.addEventListener('mouseleave', function () {
      cursor.style.opacity = '0';
      ring.style.opacity   = '0';
    });
    document.addEventListener('mouseenter', function () {
      cursor.style.opacity = '1';
      ring.style.opacity   = '1';
    });

    // Delegated, so anything added later still swells the cursor.
    var HOVER_SELECTOR = 'a, button, [data-panel], [data-step], .trade, .rail-cta, ' +
                         '.chip, .seg-o, .fld-i, .proof-card';
    document.addEventListener('mouseover', function (e) {
      if (e.target.closest && e.target.closest(HOVER_SELECTOR)) {
        document.body.classList.add('cursor-hover');
      }
    });
    document.addEventListener('mouseout', function (e) {
      if (e.target.closest && e.target.closest(HOVER_SELECTOR)) {
        var to = e.relatedTarget;
        if (!to || !to.closest || !to.closest(HOVER_SELECTOR)) {
          document.body.classList.remove('cursor-hover');
        }
      }
    });
  }

  /* ─── 2 · REVEAL ON SCROLL ───────────────────────────────── */

  var revealTargets = document.querySelectorAll('.reveal, [data-step]');

  if (!('IntersectionObserver' in window) || reduceMotion) {
    revealTargets.forEach(function (el) { el.classList.add('in-view'); });
  } else {
    var revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });

    revealTargets.forEach(function (el) { revealObserver.observe(el); });
  }

  /* ─── 3 · PANEL FOCUS ────────────────────────────────────── */
  /* The page navigates like a console: arrow keys move between
     panels once focus is already inside one. Tab order is left
     alone — only real controls sit in it.                      */

  var panels = Array.prototype.slice.call(
    document.querySelectorAll('[data-panel], [data-step]')
  );

  panels.forEach(function (panel) {
    // Non-interactive panels can be focused programmatically but
    // never appear in the tab sequence.
    if (!panel.hasAttribute('tabindex') &&
        panel.tagName !== 'A' && panel.tagName !== 'BUTTON') {
      panel.setAttribute('tabindex', '-1');
    }
    panel.addEventListener('focus', function () { panel.classList.add('is-focused'); });
    panel.addEventListener('blur',  function () { panel.classList.remove('is-focused'); });
  });

  function centerOf(el) {
    var r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  // Nearest panel in a direction, weighting off-axis drift so the
  // move feels like a grid rather than a straight-line scan.
  function nextPanel(from, dx, dy) {
    var origin = centerOf(from);
    var best = null, bestScore = Infinity;

    panels.forEach(function (candidate) {
      if (candidate === from) return;
      var c = centerOf(candidate);
      var vx = c.x - origin.x;
      var vy = c.y - origin.y;
      var along  = vx * dx + vy * dy;
      if (along <= 8) return;                       // not in that direction
      var offAxis = Math.abs(vx * dy - vy * dx);
      var score   = along + offAxis * 2.2;
      if (score < bestScore) { bestScore = score; best = candidate; }
    });

    return best;
  }

  // Whichever input the visitor last used owns the focus state, so two
  // panels are never lit at once.
  var kbdNav = false;
  function setKbdNav(on) {
    if (kbdNav === on) return;
    kbdNav = on;
    document.body.classList.toggle('kbd-nav', on);
  }
  document.addEventListener('mousemove', function () { setKbdNav(false); }, { passive: true });

  var DIRECTIONS = {
    ArrowUp:    [0, -1],
    ArrowDown:  [0,  1],
    ArrowLeft:  [-1, 0],
    ArrowRight: [1,  0]
  };

  document.addEventListener('keydown', function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;

    var direction = DIRECTIONS[e.key];
    if (!direction) return;

    var active = document.activeElement;
    if (!active || !active.closest) return;

    var current = active.closest('[data-panel], [data-step]');
    if (!current) return;   // focus isn't in the grid — leave scrolling alone

    var target = nextPanel(current, direction[0], direction[1]);
    if (!target) return;

    e.preventDefault();
    setKbdNav(true);
    target.focus({ preventScroll: true });
    target.scrollIntoView({
      behavior: reduceMotion ? 'auto' : 'smooth',
      block: 'center'
    });
  });

  /* ─── 3b · RAIL — mark the screen you're reading ─────────── */

  var railLinks = {};
  document.querySelectorAll('.rail-nav a').forEach(function (a) {
    var id = a.getAttribute('href');
    if (id && id.charAt(0) === '#') railLinks[id.slice(1)] = a;
  });

  if ('IntersectionObserver' in window && Object.keys(railLinks).length) {
    var railObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var link = railLinks[entry.target.id];
        if (!link) return;
        if (entry.isIntersecting) {
          link.style.color = 'var(--blue)';
          link.setAttribute('aria-current', 'true');
        } else {
          link.style.color = '';
          link.removeAttribute('aria-current');
        }
      });
    }, { rootMargin: '-45% 0px -45% 0px' });

    Object.keys(railLinks).forEach(function (id) {
      var section = document.getElementById(id);
      if (section) railObserver.observe(section);
    });
  }

  /* ─── 4 · INTAKE ─────────────────────────────────────────── */
  /* Two fields until you touch one. Then the rest opens — this is
     onboarding for someone already decided, not a qualification gate. */

  var intake = document.getElementById('intake');

  if (intake) {
    var opened = false;

    function openIntake() {
      if (opened) return;
      opened = true;
      intake.classList.add('open');
      var hint = document.getElementById('intake-hint');
      if (hint) {
        hint.textContent = 'Name, business, email, and a number are required. Everything else just gets us further ahead.';
      }
    }

    intake.addEventListener('focusin', openIntake);
    intake.addEventListener('input', function (e) {
      openIntake();
      if (e.target.classList) e.target.classList.remove('invalid');
    });
    // Arriving from the header button should show the whole thing.
    if (window.location.hash === '#intake') openIntake();
    document.querySelectorAll('a[href="#intake"]').forEach(function (a) {
      a.addEventListener('click', function () {
        openIntake();
        var first = document.getElementById('in-name');
        if (first) setTimeout(function () { first.focus({ preventScroll: true }); }, 500);
      });
    });

    intake.addEventListener('submit', function (e) {
      e.preventDefault();

      openIntake();

      // Whoever fills this out is already serious — we ask for enough to
      // actually call them back.
      var required = [
        { el: document.getElementById('in-name'),  ok: function (v) { return v.trim().length > 1; } },
        { el: document.getElementById('in-email'), ok: function (v, el) { return el.checkValidity() && v.trim() !== ''; } },
        { el: document.getElementById('in-biz'),   ok: function (v) { return v.trim().length > 1; } },
        { el: document.getElementById('in-phone'), ok: function (v) { return (v.match(/\d/g) || []).length >= 10; } }
      ];

      var firstBad = null;
      required.forEach(function (f) {
        var good = f.ok(f.el.value, f.el);
        f.el.classList.toggle('invalid', !good);
        if (!good && !firstBad) firstBad = f.el;
      });

      if (firstBad) {
        firstBad.focus();
        firstBad.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
        return;
      }

      var btn = intake.querySelector('.intake-go');
      var label = intake.querySelector('.intake-go-label');
      btn.disabled = true;
      if (label) label.textContent = 'Opening…';

      // Netlify Forms accepts a urlencoded POST to the page itself.
      var data = new URLSearchParams(new FormData(intake)).toString();

      function finish() {
        intake.classList.remove('open');
        Array.prototype.forEach.call(
          intake.querySelectorAll('.intake-head, .intake-base, .intake-more, .intake-foot'),
          function (el) { el.hidden = true; }
        );
        var done = document.getElementById('intake-done');
        done.hidden = false;
        done.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
      }

      fetch('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: data
      }).then(finish).catch(finish);
    });
  }

  /* ─── 5 · HOVER SOUND ────────────────────────────────────── */

  if (finePointer) {
    var pool = ['assets/hover1.mp3', 'assets/hover2.mp3', 'assets/hover3.mp3'].map(function (src) {
      var a = new Audio(src);
      a.volume  = 0.12;
      a.preload = 'auto';
      return a;
    });
    var lastPlay = 0;

    document.addEventListener('mouseover', function (e) {
      if (!e.target.closest) return;
      if (!e.target.closest('[data-panel], [data-step], .trade, .rail-nav a, .rail-cta, .chip, .seg-o')) return;

      var now = Date.now();
      if (now - lastPlay < 90) return;
      lastPlay = now;

      var clip = pool[Math.floor(Math.random() * pool.length)];
      clip.currentTime = 0;
      clip.play().catch(function () {});
    }, { passive: true });
  }

})();
