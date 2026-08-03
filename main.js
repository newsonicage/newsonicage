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

  /* ─── 3b · PROOF TRACK ───────────────────────────────────── */
  /* The client row scrolls sideways so the list can grow without the page
     growing. Trackpads and touch already do this; the strip underneath is
     for a mouse, and it disappears when there is nothing to scroll to.
     The wheel is left alone — hijacking it breaks the page scroll. */

  var track = document.getElementById('proof-track');

  if (track) {
    var controls = document.getElementById('proof-controls');
    var fill     = document.getElementById('proof-bar-fill');
    var count    = document.getElementById('proof-count');
    var prev     = document.getElementById('proof-prev');
    var next     = document.getElementById('proof-next');
    var cards    = Array.prototype.slice.call(track.children);
    var bar      = fill.parentNode;

    function step() {
      if (cards.length < 2) return track.clientWidth;
      return cards[1].offsetLeft - cards[0].offsetLeft;
    }

    function paint() {
      var max = track.scrollWidth - track.clientWidth;

      // Everything fits — there is nothing to say.
      if (max < 2) {
        controls.hidden = true;
        return;
      }
      controls.hidden = false;

      var left     = track.scrollLeft;
      var progress = Math.min(1, Math.max(0, left / max));
      var barW     = bar.clientWidth;
      var thumbW   = Math.max(32, barW * (track.clientWidth / track.scrollWidth));

      fill.style.width     = thumbW + 'px';
      fill.style.transform = 'translateX(' + (progress * (barW - thumbW)) + 'px)';

      // The leading card, so the number matches whatever is under the eye.
      // At the far end the last card is the one you have arrived at, even
      // though a whole screen of cards starts to its left.
      var lead = 0;
      if (left > max - 2) {
        lead = cards.length - 1;
      } else {
        for (var i = 0; i < cards.length; i++) {
          if (cards[i].offsetLeft - cards[0].offsetLeft >= left - 8) { lead = i; break; }
        }
      }
      count.innerHTML = '<b>' + ('0' + (lead + 1)).slice(-2) + '</b> / ' +
                        ('0' + cards.length).slice(-2);

      prev.disabled = left < 2;
      next.disabled = left > max - 2;
    }

    function nudge(dir) {
      track.scrollBy({
        left: dir * step(),
        behavior: reduceMotion ? 'auto' : 'smooth'
      });
    }

    prev.addEventListener('click', function () { nudge(-1); });
    next.addEventListener('click', function () { nudge(1); });
    track.addEventListener('scroll', paint, { passive: true });
    window.addEventListener('resize', paint);

    // Tab and the arrow keys already scroll a focused card into view — the
    // browser walks the scrollable ancestor. Nothing to add there.
    paint();
  }

  /* ─── 3c · RAIL — mark the screen you're reading ─────────── */

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
      // actually reach them.
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

      // The subject is what gets read on a phone, so it carries the two things
      // worth knowing before opening it: who it is and how much of a hurry.
      var subject = document.getElementById('in-subject');
      if (subject) {
        var urgent = intake.querySelector('input[name="urgency"]:checked');
        subject.value = 'New file — ' +
          document.getElementById('in-biz').value.trim() +
          ' (' + document.getElementById('in-name').value.trim() + ')' +
          (urgent ? ' · ' + urgent.value : '');
      }

      // Netlify Forms accepts a urlencoded POST to the page itself.
      var data = new URLSearchParams(new FormData(intake)).toString();

      function finish() {
        intake.classList.remove('open');
        Array.prototype.forEach.call(
          intake.querySelectorAll('.intake-head, .intake-base, .intake-more, .intake-foot, .intake-consent'),
          function (el) { el.hidden = true; }
        );
        var done = document.getElementById('intake-done');
        done.hidden = false;
        done.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
      }

      // Never claim the file is open unless it actually is. fetch only rejects on
      // network failure, so a 404 or 500 resolves — without the res.ok check the
      // form thanks someone whose lead was just dropped.
      function fail() {
        btn.disabled = false;
        if (label) label.textContent = 'Open my file';
        var hint = document.getElementById('intake-hint');
        if (hint) {
          hint.textContent = 'That did not go through. Try again, or call (678) 903-1255 ' +
            'and we will pick it up from there.';
          hint.classList.add('intake-failed');
        }
      }

      fetch('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: data
      })
        .then(function (res) { if (res.ok) { finish(); } else { fail(); } })
        .catch(fail);
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
