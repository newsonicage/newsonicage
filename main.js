/* =============================================
   NEWSONIC AGE — main.js
   ============================================= */

// ─── CURSOR ───
const cursor = document.getElementById('cursor');
const cursorRing = document.getElementById('cursor-ring');
let cx = 0, cy = 0, rx = 0, ry = 0;

document.addEventListener('mousemove', e => {
  cx = e.clientX;
  cy = e.clientY;
  cursor.style.left = cx + 'px';
  cursor.style.top = cy + 'px';
});

// Smooth cursor ring
function animateRing() {
  rx += (cx - rx) * 0.12;
  ry += (cy - ry) * 0.12;
  cursorRing.style.left = rx + 'px';
  cursorRing.style.top = ry + 'px';
  requestAnimationFrame(animateRing);
}
animateRing();

// Hover state for interactive elements
const hoverEls = document.querySelectorAll('a, button, .choice-tile, .price-cta, .btn-primary, .btn-secondary, .btn-cta');
hoverEls.forEach(el => {
  el.addEventListener('mouseenter', () => document.body.classList.add('cursor-hover'));
  el.addEventListener('mouseleave', () => document.body.classList.remove('cursor-hover'));
});

// Hide cursor when leaving window
document.addEventListener('mouseleave', () => {
  cursor.style.opacity = '0';
  cursorRing.style.opacity = '0';
});
document.addEventListener('mouseenter', () => {
  cursor.style.opacity = '1';
  cursorRing.style.opacity = '1';
});

// ─── PRELOADER ───
window.addEventListener('load', () => {
  const preloader = document.getElementById('preloader');
  // Min 2.2s so animation plays
  const minTime = 2200;
  const startTime = Date.now();
  const elapsed = Date.now() - startTime;
  const remaining = Math.max(0, minTime - elapsed);

  setTimeout(() => {
    preloader.classList.add('done');
    document.body.style.overflow = 'auto';
  }, minTime);
});

// Lock scroll during preload
document.body.style.overflow = 'hidden';

// ─── NAV SCROLL EFFECT ───
const nav = document.getElementById('nav');
window.addEventListener('scroll', () => {
  if (window.scrollY > 60) {
    nav.classList.add('scrolled');
  } else {
    nav.classList.remove('scrolled');
  }
});

// ─── MOBILE MENU ───
const mobileMenu = document.getElementById('mobile-menu');
let menuOpen = false;

function toggleMenu() {
  menuOpen = !menuOpen;
  mobileMenu.classList.toggle('open', menuOpen);
  document.body.style.overflow = menuOpen ? 'hidden' : 'auto';
}

function closeMenu() {
  menuOpen = false;
  mobileMenu.classList.remove('open');
  document.body.style.overflow = 'auto';
}

// ─── SMOOTH SCROLL ───
function scrollToSection(id) {
  const el = document.getElementById(id);
  if (!el) return;
  const nav   = document.getElementById('nav');
  const navH  = nav ? nav.offsetHeight : 80;
  // Compensate for nav height + section's own top padding so content
  // appears just below the nav with a small breathing gap (24px).
  const pt  = parseInt(window.getComputedStyle(el).paddingTop, 10) || 0;
  const top = el.getBoundingClientRect().top + window.scrollY + pt - navH - 24;
  window.scrollTo({ top, behavior: 'smooth' });
  closeMenu();
}

// ─── INTERSECTION OBSERVER (reveal on scroll) ───
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('in-view');
    }
  });
}, { threshold: 0.1 });

document.querySelectorAll('.reveal, .pain-item, .process-step, .price-card, .service-block, .stat-num').forEach(el => {
  revealObserver.observe(el);
});

// ─── STAT COUNTER ANIMATION ───
function animateCounter(el) {
  const target = parseInt(el.getAttribute('data-target'), 10);
  const suffix = el.getAttribute('data-suffix') || '';
  const duration = 1800;
  const start = Date.now();

  function update() {
    const elapsed = Date.now() - start;
    const progress = Math.min(elapsed / duration, 1);
    // Ease out cubic
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = Math.round(eased * target);
    el.textContent = current + suffix;
    if (progress < 1) requestAnimationFrame(update);
  }
  update();
}

const statObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting && !entry.target.classList.contains('counted')) {
      entry.target.classList.add('counted');
      animateCounter(entry.target);
    }
  });
}, { threshold: 0.5 });

document.querySelectorAll('.stat-num[data-target]').forEach(el => {
  statObserver.observe(el);
});

// ─── TERMINAL POPUP ───
const terminalOverlay = document.getElementById('terminal-overlay');
const tOutput = document.getElementById('t-output');
let terminalOpen = false;

function openTerminal(service) {
  terminalOverlay.classList.add('open');
  terminalOpen = true;
  document.body.style.overflow = 'hidden';

  // Pre-select service if passed
  if (service) {
    const sel = document.getElementById('t-service');
    if (sel) sel.value = service;
  }

  // Typewriter boot sequence
  const lines = [
    { text: '> Establishing encrypted channel...', delay: 100, class: 'dim' },
    { text: '> Connection secured. [AES-256]', delay: 700, class: 'blue-text' },
    { text: '> NEWSONIC AGE — PROJECT INTAKE v2.6', delay: 1200, class: '' },
    { text: '> Ready. Please complete the form below.', delay: 1700, class: 'dim' },
  ];

  tOutput.innerHTML = '';
  lines.forEach(line => {
    setTimeout(() => {
      const p = document.createElement('p');
      p.className = line.class;
      typeWriter(p, line.text, 30);
      tOutput.appendChild(p);
    }, line.delay);
  });
}

function closeTerminal() {
  terminalOverlay.classList.remove('open');
  terminalOpen = false;
  document.body.style.overflow = 'auto';
  // Reset form
  const form = document.getElementById('terminal-form');
  if (form) { form.reset(); form.style.display = 'flex'; }
  document.getElementById('t-success').style.display = 'none';
}

// Close on backdrop click
terminalOverlay.addEventListener('click', e => {
  if (e.target === terminalOverlay) closeTerminal();
});

// Close on ESC
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && terminalOpen) closeTerminal();
});

// Typewriter effect
function typeWriter(el, text, speed) {
  let i = 0;
  function tick() {
    if (i < text.length) {
      el.textContent += text[i];
      i++;
      setTimeout(tick, speed);
    }
  }
  tick();
}

// Form submission
function submitForm(e) {
  e.preventDefault();
  const form = e.target;
  const btn = form.querySelector('.t-submit');
  const name = form.querySelector('#t-name').value.trim();

  if (!name) {
    alert('Please enter your name.');
    return;
  }

  // Simulate submission
  btn.querySelector('span').textContent = '> TRANSMITTING...';
  btn.disabled = true;

  setTimeout(() => {
    form.style.display = 'none';
    const success = document.getElementById('t-success');
    success.style.display = 'block';

    const lines = [
      { text: `> Message received from ${name}.`, delay: 0, class: '' },
      { text: '> Routing to project team...', delay: 600, class: 'dim' },
      { text: '> TRANSMISSION COMPLETE.', delay: 1200, class: 'blue-text' },
      { text: '> We will be in touch within 24-48 hours.', delay: 1800, class: '' },
      { text: '> Thank you for choosing Newsonic Age.', delay: 2400, class: 'dim' },
    ];

    success.innerHTML = '';
    lines.forEach(line => {
      setTimeout(() => {
        const p = document.createElement('p');
        p.className = line.class;
        typeWriter(p, line.text, 25);
        success.appendChild(p);
      }, line.delay);
    });

    // Auto-close after 5s
    setTimeout(closeTerminal, 6000);
  }, 1200);
}

// ─── PARALLAX on hero ───
window.addEventListener('scroll', () => {
  const scrollY = window.scrollY;
  const heroGrid = document.querySelector('.hero-grid');
  const heroOrb = document.querySelector('.hero-orb');
  if (heroGrid) heroGrid.style.transform = `translateY(${scrollY * 0.3}px)`;
  if (heroOrb) heroOrb.style.transform = `translate(-50%, calc(-50% + ${scrollY * 0.15}px))`;
});

// ─── CHOICE TILE — subtle mouse tracking glow ───
document.querySelectorAll('.choice-tile').forEach(tile => {
  tile.addEventListener('mousemove', e => {
    const rect = tile.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    tile.style.setProperty('--mx', `${x}%`);
    tile.style.setProperty('--my', `${y}%`);
  });
});
