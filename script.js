/* ════════════════════════════════════════
   AUDIO
════════════════════════════════════════ */
const music = document.getElementById("bg-music");
const hoverSounds = [
  document.getElementById("hover-sound-1"),
  document.getElementById("hover-sound-2"),
  document.getElementById("hover-sound-3"),
];

if (music) music.volume = 0.2;
if (hoverSounds[0]) hoverSounds[0].volume = 0.15;
if (hoverSounds[1]) hoverSounds[1].volume = 0.15;
if (hoverSounds[2]) hoverSounds[2].volume = 0.55; // hover3 boosted

document.body.addEventListener("click", () => {
  if (music) music.play().catch(() => {});
}, { once: true });

/* ════════════════════════════════════════
   HOVER SOUND
════════════════════════════════════════ */
function playHover(n) {
  const s = hoverSounds[n - 1];
  if (!s) return;
  s.currentTime = 0;
  s.play().catch(() => {});
}

/* ════════════════════════════════════════
   THEME MANAGEMENT
════════════════════════════════════════ */
function setTheme(theme) {
  document.body.classList.remove("theme-dark", "theme-light");
  document.body.classList.add("theme-" + theme);
}

/* Auto-switch theme based on scroll position */
(function initThemeScroll() {
  const shopEl  = document.getElementById("shop");
  const heroEl  = document.querySelector(".hero");
  if (!shopEl || !heroEl) return;

  function onScroll() {
    const shopTop = shopEl.getBoundingClientRect().top;
    const heroBottom = heroEl.getBoundingClientRect().bottom;
    // Enter light when shop section crests the middle of the viewport
    if (shopTop <= window.innerHeight * 0.55) {
      setTheme("light");
    } else if (heroBottom > window.innerHeight * 0.25) {
      setTheme("dark");
    }
  }

  window.addEventListener("scroll", onScroll, { passive: true });
})();

/* ════════════════════════════════════════
   SHOP — scroll to sub-menu (offset for fixed header)
════════════════════════════════════════ */
function scrollToShop() {
  setTheme("light");
  const el = document.getElementById("shop");
  if (!el) return;
  const top = el.getBoundingClientRect().top + window.scrollY - 52;
  window.scrollTo({ top, behavior: "smooth" });
}

/* ════════════════════════════════════════
   EXIT SHOP — return to hero / dark mode
════════════════════════════════════════ */
function exitShop() {
  setTheme("dark");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/* ════════════════════════════════════════
   NOTIFY POPUP (Sold / Coming Soon)
════════════════════════════════════════ */
function openNotifyPopup(title) {
  document.getElementById("np-item-title").textContent = title;
  document.getElementById("np-item-field").value = title;
  document.getElementById("notify-overlay").classList.add("active");
  document.getElementById("notify-panel-wrap").classList.add("active");
}

function closeNotifyPopup() {
  document.getElementById("notify-overlay").classList.remove("active");
  document.getElementById("notify-panel-wrap").classList.remove("active");
  setTimeout(() => {
    const form = document.getElementById("notify-form");
    const success = document.getElementById("np-success");
    if (form) { form.reset(); form.style.display = ""; }
    if (success) success.classList.remove("visible");
  }, 400);
}

document.getElementById("notify-overlay").addEventListener("click", closeNotifyPopup);
document.getElementById("notify-panel-wrap").addEventListener("click", function(e) {
  if (!e.target.closest(".notify-panel")) closeNotifyPopup();
});

const notifyForm = document.getElementById("notify-form");
if (notifyForm) {
  notifyForm.addEventListener("submit", async e => {
    e.preventDefault();
    await submitNetlifyForm(e.target);
    e.target.style.display = "none";
    document.getElementById("np-success").classList.add("visible");
    setTimeout(closeNotifyPopup, 3200);
  });
}

/* ════════════════════════════════════════
   ARCHIVE POPUP
════════════════════════════════════════ */
function archiveAlert() {
  const popup = document.getElementById("archive-popup");
  const inner = document.getElementById("archive-inner");
  if (!popup || !inner) return;
  inner.classList.remove("animate");
  void inner.offsetWidth;
  inner.classList.add("animate");
  popup.classList.add("active");
}

function closeArchive() {
  document.getElementById("archive-popup").classList.remove("active");
}

/* ════════════════════════════════════════
   MUSIC LINK
════════════════════════════════════════ */
function goMusic() {
  window.open("https://too.fm/pussypoppin", "_blank");
}

/* ════════════════════════════════════════
   SETTINGS PANEL
════════════════════════════════════════ */
function openSettings() {
  document.getElementById("settings-overlay").classList.add("active");
  document.getElementById("settings-panel-wrap").classList.add("active");
}

function closeSettings() {
  document.getElementById("settings-overlay").classList.remove("active");
  document.getElementById("settings-panel-wrap").classList.remove("active");
}

document.getElementById("cog-btn").addEventListener("click", openSettings);
document.getElementById("settings-overlay").addEventListener("click", closeSettings);
document.getElementById("settings-panel-wrap").addEventListener("click", function(e) {
  if (!e.target.closest(".settings-panel")) closeSettings();
});

/* ════════════════════════════════════════
   ERROR POPUP (Start a Co-Mission)
════════════════════════════════════════ */
function showSettingsError() {
  document.getElementById("error-popup").classList.add("active");
}

function closeErrorPopup() {
  document.getElementById("error-popup").classList.remove("active");
}

document.getElementById("error-popup").addEventListener("click", closeErrorPopup);

/* ════════════════════════════════════════
   CONTACT FORM POPUP (Request Communication)
════════════════════════════════════════ */
function openContactForm() {
  closeSettings();
  document.getElementById("contact-overlay").classList.add("active");
  document.getElementById("contact-panel-wrap").classList.add("active");
}

function closeContactForm() {
  document.getElementById("contact-overlay").classList.remove("active");
  document.getElementById("contact-panel-wrap").classList.remove("active");
  // reset form after close animation
  setTimeout(() => {
    const form = document.getElementById("contact-form");
    const success = document.getElementById("contact-success");
    if (form) { form.reset(); form.style.display = ""; }
    if (success) success.classList.remove("visible");
  }, 400);
}

document.getElementById("contact-overlay").addEventListener("click", closeContactForm);
document.getElementById("contact-panel-wrap").addEventListener("click", function(e) {
  if (!e.target.closest(".contact-panel")) closeContactForm();
});

/* ════════════════════════════════════════
   CART DRAWER
════════════════════════════════════════ */
function openCart() {
  document.getElementById("cart-drawer").classList.add("active");
  document.getElementById("cart-overlay").classList.add("active");
}

function closeCart() {
  document.getElementById("cart-drawer").classList.remove("active");
  document.getElementById("cart-overlay").classList.remove("active");
}

document.getElementById("cart-btn").addEventListener("click", openCart);
document.getElementById("cart-overlay").addEventListener("click", closeCart);
document.getElementById("cart-close-btn").addEventListener("click", closeCart);

/* ════════════════════════════════════════
   ESCAPE KEY
════════════════════════════════════════ */
/* ════════════════════════════════════════
   LINKS POPUP
════════════════════════════════════════ */
function openLinkPanel() {
  document.getElementById("link-overlay").classList.add("active");
  document.getElementById("link-panel-wrap").classList.add("active");
}

function closeLinkPanel() {
  document.getElementById("link-overlay").classList.remove("active");
  document.getElementById("link-panel-wrap").classList.remove("active");
}

document.getElementById("link-btn").addEventListener("click", openLinkPanel);
document.getElementById("link-overlay").addEventListener("click", closeLinkPanel);
document.getElementById("link-panel-wrap").addEventListener("click", function(e) {
  if (!e.target.closest(".link-panel")) closeLinkPanel();
});

/* ════════════════════════════════════════
   COPY TOAST
════════════════════════════════════════ */
let toastTimer = null;
function showCopyToast(msg) {
  const toast = document.getElementById("copy-toast");
  toast.textContent = msg || "Copied!";
  toast.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("visible"), 2000);
}

function copySiteLink() {
  navigator.clipboard.writeText("https://starsinfern0.com").then(() => {
    showCopyToast("Link Copied!");
  });
}

function copyContactEmail() {
  navigator.clipboard.writeText("scratchbradley@gmail.com").then(() => {
    showCopyToast("Email Copied!");
  });
}

/* ════════════════════════════════════════
   SECRET TERMINAL POPUP (h key)
════════════════════════════════════════ */
const SECRET_LINES = [
  { t: "> UNAUTHORIZED KEYPRESS DETECTED",          cls: "st-warn",      ms: 0    },
  { t: "> INITIATING SCAN PROTOCOL...",             cls: "",             ms: 520  },
  { t: "> SCANNING OPERATIVE SIGNATURE......",      cls: "",             ms: 1100 },
  { t: "> SIG_HASH: \xB77F3A\xB7C499\xB7B2E1\xB70D44\xB7",  cls: "st-dim",  ms: 2000 },
  { t: "> CROSS-REF: STARS_DATABASE [ENCRYPTED]",   cls: "",             ms: 2560 },
  { t: "",                                           cls: "",             ms: 3060 },
  { t: "\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588  100%", cls: "st-progress", ms: 3260 },
  { t: "",                                           cls: "",             ms: 4000 },
  { t: "> THREAT LEVEL: NULL",                      cls: "st-ok",        ms: 4200 },
  { t: "> CLASSIFICATION: OPERATIVE CLASS-\u221E",  cls: "st-ok",        ms: 4760 },
  { t: "> UNRESTRICTED ACCESS: ENABLED",            cls: "st-ok",        ms: 5320 },
  { t: "",                                           cls: "",             ms: 5720 },
  { t: "> WELCOME BACK, OPERATIVE.",                cls: "st-highlight", ms: 6020 },
];

let secretTimers = [];

function generateOperativeCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 4 }, () =>
    Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("")
  ).join("-");
}

function openSecret() {
  const wrap = document.getElementById("secret-wrap");
  if (wrap.classList.contains("active")) return;

  document.getElementById("st-lines").innerHTML = "";
  const reveal = document.getElementById("st-reveal");
  reveal.style.display = "none";

  // Generate a fresh unique code each time
  const codeEl = document.getElementById("st-unique-code");
  if (codeEl) codeEl.textContent = generateOperativeCode();

  document.getElementById("secret-overlay").classList.add("active");
  wrap.classList.add("active");

  secretTimers.forEach(clearTimeout);
  secretTimers = [];

  SECRET_LINES.forEach(({ t, cls, ms }) => {
    const id = setTimeout(() => {
      const linesEl = document.getElementById("st-lines");
      if (!linesEl) return;
      const line = document.createElement("div");
      line.className = "st-line" + (cls ? " " + cls : "");
      line.textContent = t || "\u00a0";
      linesEl.appendChild(line);
      const body = linesEl.closest(".st-body");
      if (body) body.scrollTop = body.scrollHeight;
    }, ms);
    secretTimers.push(id);
  });

  secretTimers.push(setTimeout(() => {
    const r = document.getElementById("st-reveal");
    if (r) { r.style.display = ""; }
    const body = r?.closest(".st-body");
    if (body) setTimeout(() => { body.scrollTop = body.scrollHeight; }, 50);
  }, 7000));
}

function closeSecret() {
  document.getElementById("secret-overlay").classList.remove("active");
  document.getElementById("secret-wrap").classList.remove("active");
  secretTimers.forEach(clearTimeout);
  secretTimers = [];
}

document.getElementById("secret-overlay").addEventListener("click", closeSecret);
document.getElementById("secret-wrap").addEventListener("click", function(e) {
  if (!e.target.closest(".secret-terminal")) closeSecret();
});

/* ════════════════════════════════════════
   KEYBOARD NAVIGATION
════════════════════════════════════════ */
let kbFocused = null;
let kbActive  = false;

const POPUP_CONTEXTS = [
  { id: "pp-wrap",             sel: ".pp-close-btn, .pp-atc-btn, .pp-notify-btn" },
  { id: "settings-panel-wrap", sel: ".sp-pill-btn, .sp-close" },
  { id: "contact-panel-wrap",  sel: ".sp-pill-btn, .sp-close, .contact-info-item" },
  { id: "link-panel-wrap",     sel: ".link-social-btn, .link-copy-btn, .sp-close" },
  { id: "notify-panel-wrap",   sel: ".sp-pill-btn, .sp-close" },
  { id: "secret-wrap",         sel: ".st-dismiss" },
  { id: "archive-popup",       sel: ".archive-inner" },
  { id: "error-popup",         sel: ".error-inner" },
];

function isKbVisible(el) {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
}

function getKbItems() {
  for (const { id, sel } of POPUP_CONTEXTS) {
    const wrap = document.getElementById(id);
    if (wrap?.classList.contains("active")) {
      const items = Array.from(wrap.querySelectorAll(sel)).filter(isKbVisible);
      return items.length ? items : [wrap];
    }
  }
  return Array.from(document.querySelectorAll(
    ".header-logo, .header-btn, .pillar, .sm-block, .product-card"
  )).filter(isKbVisible);
}

function kbClearInline(el) {
  if (!el) return;
  if (el.classList.contains("pillar")) el.style.removeProperty("flex");
}

function kbApplyInline(el) {
  if (!el) return;
  // Pillars: force flex expansion via inline style (beats any CSS specificity)
  if (el.classList.contains("pillar")) el.style.flex = "1.7";
}

function kbSetFocus(el) {
  if (kbFocused && kbFocused !== el) {
    kbFocused.classList.remove("kb-focus");
    kbClearInline(kbFocused);
    kbFocused.dispatchEvent(new MouseEvent("mouseleave", { bubbles: true }));
  }
  kbFocused = el;
  if (el) {
    el.classList.add("kb-focus");
    kbApplyInline(el);
    el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    el.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
  }
}

function kbNavigate(dir) { // "up" | "down" | "left" | "right"
  kbActive = true;
  const items = getKbItems();
  if (!items.length) return;

  if (!kbFocused) { kbSetFocus(items[0]); return; }

  const cr  = kbFocused.getBoundingClientRect();
  const cCX = cr.left + cr.width  / 2;
  const cCY = cr.top  + cr.height / 2;

  let best = null;
  let bestScore = Infinity;

  for (const item of items) {
    if (item === kbFocused) continue;
    const r  = item.getBoundingClientRect();
    const cx = r.left + r.width  / 2;
    const cy = r.top  + r.height / 2;

    // Must be meaningfully past the near edge in the target direction
    const valid =
      dir === "down"  ? cy > cr.bottom - 10 :
      dir === "up"    ? cy < cr.top    + 10 :
      dir === "right" ? cx > cr.right  - 10 :
                        cx < cr.left   + 10;
    if (!valid) continue;

    const primary =
      dir === "down"  ? cy - cCY :
      dir === "up"    ? cCY - cy :
      dir === "right" ? cx - cCX :
                        cCX - cx;
    const perp =
      (dir === "down" || dir === "up") ? Math.abs(cx - cCX) : Math.abs(cy - cCY);

    const score = primary + perp * 1.4;
    if (score < bestScore) { bestScore = score; best = item; }
  }

  if (best) {
    kbSetFocus(best);
  } else {
    // Nothing in that direction — wrap to the opposite extreme
    const others = items.filter(i => i !== kbFocused);
    if (!others.length) return;
    const wrap =
      dir === "down"  ? others.reduce((a, b) => a.getBoundingClientRect().top    < b.getBoundingClientRect().top    ? a : b) :
      dir === "up"    ? others.reduce((a, b) => a.getBoundingClientRect().bottom > b.getBoundingClientRect().bottom ? a : b) :
      dir === "right" ? others.reduce((a, b) => a.getBoundingClientRect().left   < b.getBoundingClientRect().left   ? a : b) :
                        others.reduce((a, b) => a.getBoundingClientRect().right  > b.getBoundingClientRect().right  ? a : b);
    kbSetFocus(wrap);
  }
}

// Deactivate visual focus on mouse move
document.addEventListener("mousemove", () => {
  if (kbFocused) {
    kbFocused.classList.remove("kb-focus");
    kbClearInline(kbFocused);
    kbFocused.dispatchEvent(new MouseEvent("mouseleave", { bubbles: true }));
  }
  kbFocused = null;
  kbActive  = false;
}, { passive: true });

/* ════════════════════════════════════════
   GLOBAL KEYDOWN HANDLER
════════════════════════════════════════ */
function anyOverlayActive() {
  const ids = [
    "pp-overlay","archive-popup","settings-overlay","contact-overlay",
    "cart-overlay","notify-overlay","link-overlay","secret-overlay"
  ];
  return ids.some(id => document.getElementById(id)?.classList.contains("active"));
}

document.addEventListener("keydown", e => {
  const tag    = e.target.tagName;
  const typing = ["INPUT","TEXTAREA","SELECT"].includes(tag);

  /* ── Arrow keys: true 2D spatial navigation ── */
  if (!typing) {
    if (e.key === "ArrowDown")  { e.preventDefault(); kbNavigate("down");  return; }
    if (e.key === "ArrowUp")    { e.preventDefault(); kbNavigate("up");    return; }
    if (e.key === "ArrowRight") { e.preventDefault(); kbNavigate("right"); return; }
    if (e.key === "ArrowLeft")  { e.preventDefault(); kbNavigate("left");  return; }
  }

  /* ── Enter / Space: activate focused element ── */
  if ((e.key === "Enter" || e.key === " ") && kbFocused && kbActive && !typing) {
    e.preventDefault();
    kbFocused.click();
    return;
  }

  /* ── Escape / Home: close popup or scroll to top ── */
  if (e.key === "Escape" || e.key === "Home") {
    const wasOpen = anyOverlayActive();
    closeProductPopup();
    closeArchive();
    closeSettings();
    closeErrorPopup();
    closeContactForm();
    closeCart();
    closeNotifyPopup();
    closeLinkPanel();
    closeSecret();
    kbSetFocus(null);
    if (!wasOpen) exitShop();
    return;
  }

  /* ── Hotkeys (not while typing) — all toggle ── */
  if (typing) return;

  if (e.key === "c" || e.key === "C") {
    document.getElementById("contact-panel-wrap")?.classList.contains("active")
      ? closeContactForm() : openContactForm();
    return;
  }
  if (e.key === "s" || e.key === "S") {
    document.getElementById("settings-panel-wrap")?.classList.contains("active")
      ? closeSettings() : openSettings();
    return;
  }
  if (e.key === "h" || e.key === "H") {
    document.getElementById("secret-wrap")?.classList.contains("active")
      ? closeSecret() : openSecret();
    return;
  }
  if (e.key === "o" || e.key === "O") {
    document.getElementById("cart-drawer")?.classList.contains("active")
      ? closeCart() : openCart();
    return;
  }
});

/* ════════════════════════════════════════
   NETLIFY FORM SUBMISSION
════════════════════════════════════════ */
async function submitNetlifyForm(formEl) {
  try {
    await fetch("/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(new FormData(formEl)).toString(),
    });
  } catch (e) { /* proceeds to success state on live Netlify site */ }
}

/* contact form */
const contactForm = document.getElementById("contact-form");
if (contactForm) {
  contactForm.addEventListener("submit", async e => {
    e.preventDefault();
    await submitNetlifyForm(e.target);
    e.target.style.display = "none";
    document.getElementById("contact-success").classList.add("visible");
    setTimeout(closeContactForm, 3200);
  });
}

/* footer newsletter */
const footerForm = document.getElementById("footer-form");
if (footerForm) {
  footerForm.addEventListener("submit", async e => {
    e.preventDefault();
    await submitNetlifyForm(e.target);
    e.target.style.display = "none";
    const s = document.getElementById("footer-success");
    if (s) s.style.display = "block";
  });
}

/* ════════════════════════════════════════
   SCROLL REVEAL
════════════════════════════════════════ */
const revealObs = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.classList.add("visible");
      revealObs.unobserve(e.target);
    }
  });
}, { threshold: 0.1 });

document.querySelectorAll(".reveal").forEach(el => revealObs.observe(el));

/* ════════════════════════════════════════
   PARALLAX — pillar videos
════════════════════════════════════════ */
const videoWraps = document.querySelectorAll(".pillar-video-wrap");

window.addEventListener("scroll", () => {
  const y = window.scrollY;
  videoWraps.forEach((wrap, i) => {
    const speed = 0.10 + i * 0.025;
    wrap.style.transform = `translateY(${y * speed}px)`;
  });
}, { passive: true });

/* ════════════════════════════════════════
   TOUCH DEVICE DETECTION
   Adds "touch-device" to <html> on first touch
   so CSS can suppress hover effects on mobile.
════════════════════════════════════════ */
window.addEventListener("touchstart", function markTouch() {
  document.documentElement.classList.add("touch-device");
  window.removeEventListener("touchstart", markTouch);
}, { passive: true });

/* ════════════════════════════════════════
   FURNITURE VIDEO HOVER
   Only fires on real mouse pointer (not touch)
   to prevent flickering on mobile scroll.
════════════════════════════════════════ */
document.querySelectorAll(".furniture-product").forEach(card => {
  const video = card.querySelector(".product-hover-video");
  if (!video) return;
  card.addEventListener("pointerenter", e => {
    if (e.pointerType !== "mouse") return;
    video.play().catch(() => {});
  });
  card.addEventListener("pointerleave", e => {
    if (e.pointerType !== "mouse") return;
    video.pause();
    video.currentTime = 0;
  });
});

/* ════════════════════════════════════════
   PRODUCT DATA
════════════════════════════════════════ */
const PRODUCT_DATA = {
  "coma": {
    key: "coma", name: "CÖMA", sub: "Ö Table",
    img: "assets/product4.jpg", video: "assets/video4.mp4", available: true,
    description: "A sculptural piece at the intersection of art and function. The CÖMA Ö Table commands space with organic tension and raw material honesty.",
    specs: [{ label: "Type", value: "Ö Table" }, { label: "Material", value: "Mixed Media" }, { label: "Edition", value: "Limited" }],
  },
  "dumo-effect": {
    key: "dumo-effect", name: "DUMÖ Effect", sub: "Ö Table",
    img: "assets/product5.jpg", video: "assets/video5.mp4", available: true,
    description: "The DUMÖ Effect distorts expectation. Hovering between sculpture and furniture — each piece uniquely finished and unrepeatable.",
    specs: [{ label: "Type", value: "Ö Table" }, { label: "Material", value: "Mixed Media" }, { label: "Edition", value: "Limited" }],
  },
  "boobi-bucla6": {
    key: "boobi-bucla6", name: "BOOBI BUCLA6", sub: "Ö Table",
    img: "assets/product6.jpg", video: "assets/video6.mp4", available: true,
    description: "BOOBI BUCLA6 pushes the language of the table into new territory — bold proportions, controlled chaos, singular presence.",
    specs: [{ label: "Type", value: "Ö Table" }, { label: "Material", value: "Mixed Media" }, { label: "Edition", value: "Limited" }],
  },
  "power-of-the-p": {
    key: "power-of-the-p", name: "Power of the P", sub: "Ö Table",
    img: "assets/product7.jpg", video: "assets/video7.mp4", available: false,
    description: "A sold piece. Power of the P defined its era — bold, confrontational, and gone. Watch for its return.",
    specs: [{ label: "Type", value: "Ö Table" }, { label: "Material", value: "Mixed Media" }, { label: "Edition", value: "Sold Out" }],
  },
  "time-expire": {
    key: "time-expire", name: "Time Expire", sub: "Ö Table",
    img: "assets/product8.jpg", video: "assets/video8.mp4", available: true,
    description: "Time Expire holds urgency in still form. A piece designed to outlast the moment while marking it permanently.",
    specs: [{ label: "Type", value: "Ö Table" }, { label: "Material", value: "Mixed Media" }, { label: "Edition", value: "Limited" }],
  },
};

/* ════════════════════════════════════════
   PRODUCT POPUP
════════════════════════════════════════ */
let currentPopupKey = null;
let ppMediaMode = "img";

function openProductPopup(key) {
  const data = PRODUCT_DATA[key];
  if (!data) return;
  currentPopupKey = key;

  // Populate content
  document.getElementById("pp-img").src = data.img;
  document.getElementById("pp-img").alt = data.name;
  document.getElementById("pp-topbar-path").textContent = `STARS_SHOP // ${data.name}`;
  document.getElementById("pp-name").textContent  = data.name;
  document.getElementById("pp-sub").textContent   = data.sub;
  document.getElementById("pp-desc").textContent  = data.description;

  // Set up video
  const vid = document.getElementById("pp-vid");
  if (data.video) {
    vid.src = data.video;
    vid.style.opacity = "0";
    document.getElementById("pp-dot-vid").style.display = "";
    document.getElementById("pp-media-hint").style.display = "";
  } else {
    vid.src = "";
    document.getElementById("pp-dot-vid").style.display = "none";
    document.getElementById("pp-media-hint").style.display = "none";
  }

  // Reset to photo view
  ppMediaMode = "img";
  document.getElementById("pp-img").style.opacity = "1";
  vid.pause();
  vid.style.opacity = "0";
  document.getElementById("pp-dot-img").classList.add("active");
  document.getElementById("pp-dot-vid").classList.remove("active");

  // Availability
  const dot    = document.getElementById("pp-avail-dot");
  const label  = document.getElementById("pp-avail-label");
  const atcBtn = document.getElementById("pp-atc-btn");
  const ntfBtn = document.getElementById("pp-notify-btn");
  if (data.available) {
    dot.className      = "pp-avail-dot pp-avail-on";
    label.textContent  = "Available";
    atcBtn.style.display = "";
    ntfBtn.style.display = "none";
  } else {
    dot.className      = "pp-avail-dot pp-avail-off";
    label.textContent  = "Sold";
    atcBtn.style.display = "none";
    ntfBtn.style.display = "";
  }

  // Specs
  document.getElementById("pp-specs").innerHTML = data.specs.map(s =>
    `<li class="pp-spec-row"><span class="pp-spec-label">${s.label}</span><span class="pp-spec-value">${s.value}</span></li>`
  ).join("");

  document.getElementById("pp-overlay").classList.add("active");
  document.getElementById("pp-wrap").classList.add("active");
}

function closeProductPopup() {
  const vid = document.getElementById("pp-vid");
  if (vid) { vid.pause(); vid.src = ""; }
  document.getElementById("pp-overlay").classList.remove("active");
  document.getElementById("pp-wrap").classList.remove("active");
  currentPopupKey = null;
}

function cycleMedia() {
  const img = document.getElementById("pp-img");
  const vid = document.getElementById("pp-vid");
  if (!vid.src) return;

  if (ppMediaMode === "img") {
    img.style.opacity = "0";
    vid.style.opacity = "1";
    vid.play().catch(() => {});
    document.getElementById("pp-dot-img").classList.remove("active");
    document.getElementById("pp-dot-vid").classList.add("active");
    ppMediaMode = "vid";
  } else {
    img.style.opacity = "1";
    vid.style.opacity = "0";
    vid.pause();
    document.getElementById("pp-dot-img").classList.add("active");
    document.getElementById("pp-dot-vid").classList.remove("active");
    ppMediaMode = "img";
  }
}

function addToCartFromPopup() {
  if (!currentPopupKey) return;
  const data = PRODUCT_DATA[currentPopupKey];
  if (!data || !data.available) return;
  closeProductPopup();
  addToCart(data.key, data.name);
}

function notifyFromPopup() {
  closeProductPopup();
  openContactForm();
}

document.getElementById("pp-overlay").addEventListener("click", closeProductPopup);
document.getElementById("pp-wrap").addEventListener("click", function(e) {
  if (!e.target.closest(".pp-modal")) closeProductPopup();
});

/* ════════════════════════════════════════
   CART STATE
════════════════════════════════════════ */
let cartItems = [];

function addToCart(key, name) {
  const existing = cartItems.find(i => i.key === key);
  if (existing) {
    existing.quantity++;
  } else {
    cartItems.push({ key, name, quantity: 1 });
  }
  renderCart();
  openCart();
}

function updateQty(key, delta) {
  const item = cartItems.find(i => i.key === key);
  if (!item) return;
  item.quantity += delta;
  if (item.quantity <= 0) cartItems = cartItems.filter(i => i.key !== key);
  renderCart();
}

function removeFromCart(key) {
  cartItems = cartItems.filter(i => i.key !== key);
  renderCart();
}

function renderCart() {
  const body  = document.querySelector(".cart-drawer-body");
  const badge = document.getElementById("cart-badge");
  if (!body) return;

  const totalQty = cartItems.reduce((sum, i) => sum + i.quantity, 0);
  if (badge) badge.textContent = totalQty;

  if (!cartItems.length) {
    body.innerHTML = '<p class="cart-empty-msg">No items in cart.</p>';
    return;
  }

  const itemsHTML = cartItems.map(item => {
    const img = PRODUCT_DATA[item.key]?.img || "";
    return `
      <div class="cart-item">
        ${img ? `<img class="cart-item-thumb" src="${img}" alt="${item.name}">` : ""}
        <div class="cart-item-info">
          <div class="cart-item-name">${item.name}</div>
          <div class="cart-item-qty-row">
            <button class="cart-qty-btn" onclick="updateQty('${item.key}', -1)">−</button>
            <span class="cart-item-qty">${item.quantity}</span>
            <button class="cart-qty-btn" onclick="updateQty('${item.key}', 1)">+</button>
          </div>
        </div>
        <button class="cart-item-remove" onclick="removeFromCart('${item.key}')">✕</button>
      </div>
    `;
  }).join("");

  body.innerHTML = `
    ${itemsHTML}
    <div class="cart-footer">
      <button class="cart-checkout-btn" id="cart-checkout-btn"
              onclick="redirectToCheckout(cartItems)">
        Checkout →
      </button>
    </div>
  `;
}
