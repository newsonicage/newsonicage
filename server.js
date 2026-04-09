/* =============================================
   NEWSONIC AGE — Booking Server
   Node.js + Express + Google Calendar API
   ============================================= */

require('dotenv').config();
const express      = require('express');
const { google }   = require('googleapis');
const path         = require('path');
const fs           = require('fs');
const nodemailer   = require('nodemailer');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// ─── CONFIG ───────────────────────────────────
const PORT      = process.env.PORT      || 3000;
const TIMEZONE  = process.env.TIMEZONE  || 'America/New_York';
const CALENDAR_ID = process.env.CALENDAR_ID || 'primary';

// Support both CLIENT_ID / GOOGLE_CLIENT_ID naming conventions
const CLIENT_ID     = process.env.CLIENT_ID     || process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI  = process.env.REDIRECT_URI  || `http://localhost:${PORT}/auth/google/callback`;

// ─── TIME SLOT DEFINITIONS ────────────────────
const TIME_SLOTS = {
  ALL_DAY:      { label: 'All Day (8AM–10PM)',   startH: 8,  endH: 22 },
  EARLY_RISER:  { label: 'Early Riser (8–10AM)', startH: 8,  endH: 10 },
  MIDDAY_MOVER: { label: 'Midday Mover (1–3PM)', startH: 13, endH: 15 },
  NIGHT_OWL:    { label: 'Night Owl (8–10PM)',   startH: 20, endH: 22 },
};

// ─── TOKEN PERSISTENCE ────────────────────────
const TOKEN_FILE = path.join(__dirname, '.tokens.json');
let tokens = null;

/**
 * saveTokens — writes tokens to .tokens.json and updates the OAuth client.
 * Called both after initial auth AND on every token refresh.
 * @param {object} newTokens — token object from googleapis
 */
function saveTokens(newTokens) {
  // Merge with existing (preserves refresh_token across access_token refreshes)
  tokens = { ...(tokens || {}), ...newTokens };
  oauth2Client.setCredentials(tokens);

  fs.writeFileSync(TOKEN_FILE, JSON.stringify(tokens, null, 2), 'utf8');
  console.log('  ✅ Tokens saved to .tokens.json');
}

// ─── OAUTH2 CLIENT ────────────────────────────
const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

// Whenever googleapis auto-refreshes an expiring access_token, persist it
oauth2Client.on('tokens', (refreshed) => {
  console.log('[Auth] Access token refreshed — saving to disk');
  saveTokens(refreshed);
});

// ─── LOAD SAVED TOKENS ON STARTUP ─────────────
if (fs.existsSync(TOKEN_FILE)) {
  try {
    const raw = fs.readFileSync(TOKEN_FILE, 'utf8');
    tokens = JSON.parse(raw);
    oauth2Client.setCredentials(tokens);
    console.log('  ✅ Tokens loaded from .tokens.json — calendar ready');
  } catch (err) {
    console.warn('  ⚠  Could not parse .tokens.json:', err.message);
    tokens = null;
  }
} else {
  console.log('  ℹ  No .tokens.json found — visit /auth/google to authenticate');
}

// ─── EMAIL NOTIFICATIONS ──────────────────────
// Uses Gmail SMTP + an App Password (set in .env).
// If credentials are missing, notifications are skipped gracefully.
const GMAIL_USER = process.env.GMAIL_USER || 'newsonicage@gmail.com';
const GMAIL_PASS = process.env.GMAIL_APP_PASSWORD;

let mailer = null;
if (GMAIL_PASS && GMAIL_PASS !== 'your_16_char_app_password_here') {
  mailer = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: GMAIL_USER, pass: GMAIL_PASS },
  });
  console.log('  ✅ Email notifications enabled → ' + GMAIL_USER);
} else {
  console.log('  ℹ  Email notifications disabled — add GMAIL_APP_PASSWORD to .env to enable');
}

async function sendBookingNotification(details) {
  if (!mailer) return;
  const { clientName, clientEmail, clientPhone, contactMethod, date, timeSlot, bookingType } = details;
  const slotLabel = TIME_SLOTS[timeSlot]?.label || timeSlot;

  const html = `
    <div style="font-family:monospace;background:#04070d;color:#fff;padding:32px;max-width:560px;border:1px solid rgba(0,168,255,0.2);border-radius:6px;">
      <p style="color:#00a8ff;letter-spacing:0.2em;font-size:0.8rem;margin:0 0 4px;">NEWSONIC AGE</p>
      <h2 style="margin:0 0 20px;font-size:1.2rem;letter-spacing:-0.01em;">New Booking Request</h2>
      <table style="width:100%;border-collapse:collapse;font-size:0.85rem;line-height:2;">
        <tr><td style="color:rgba(255,255,255,0.5);padding-right:16px;">Client</td><td>${clientName}</td></tr>
        <tr><td style="color:rgba(255,255,255,0.5);">Email</td><td>${clientEmail}</td></tr>
        <tr><td style="color:rgba(255,255,255,0.5);">Phone</td><td>${clientPhone || '—'}</td></tr>
        <tr><td style="color:rgba(255,255,255,0.5);">Contact Via</td><td>${contactMethod || '—'}</td></tr>
        <tr><td style="color:rgba(255,255,255,0.5);">Date</td><td>${date}</td></tr>
        <tr><td style="color:rgba(255,255,255,0.5);">Session Type</td><td>${bookingType}</td></tr>
        <tr><td style="color:rgba(255,255,255,0.5);">Window</td><td>${slotLabel}</td></tr>
      </table>
      <p style="margin:20px 0 0;color:rgba(255,255,255,0.4);font-size:0.72rem;">
        This is an automated notification. Log in to Google Calendar to confirm or decline.
      </p>
    </div>
  `;

  try {
    await mailer.sendMail({
      from:    `"Newsonic Age Booking" <${GMAIL_USER}>`,
      to:      GMAIL_USER,
      subject: `📅 Booking Request — ${clientName} / ${date}`,
      html,
      text: `New booking request from ${clientName} (${clientEmail}, ${clientPhone})\nDate: ${date}\nType: ${bookingType}\nWindow: ${slotLabel}\nContact via: ${contactMethod}`,
    });
    console.log(`[Email] Notification sent for ${clientName} / ${date}`);
  } catch (err) {
    console.warn('[Email] Failed to send notification:', err.message);
  }
}

// ─── TIMEZONE UTILITY ─────────────────────────
// Converts local date+hour in TIMEZONE to a UTC Date.
// Uses Intl to resolve the UTC offset at noon on target date
// (handles DST, half-hour offsets, extreme offsets correctly).
function localToUTC(dateStr, hour, minute = 0) {
  const [y, mo, d] = dateStr.split('-').map(Number);

  const refUTC = new Date(Date.UTC(y, mo - 1, d, 12, 0, 0));
  const parts  = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(refUTC);

  const get = (t) => parseInt(parts.find(p => p.type === t)?.value || '0', 10);
  const localAsUTC   = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'));
  const offsetMs     = refUTC.getTime() - localAsUTC;
  const targetLocal  = Date.UTC(y, mo - 1, d, hour, minute);
  return new Date(targetLocal + offsetMs);
}

// ─── AUTH MIDDLEWARE ──────────────────────────
function requireAuth(req, res, next) {
  if (!tokens) {
    return res.status(401).json({
      error: 'Calendar not connected. Visit /auth/google to authenticate.',
    });
  }
  oauth2Client.setCredentials(tokens);
  next();
}

// ─── CORS (dev convenience) ───────────────────
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

/* ─────────────────────────────────────────────
   AUTH ROUTES
   ───────────────────────────────────────────── */

// Step 1 — Redirect to Google consent
app.get('/auth/google', (req, res) => {
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/calendar'],
    prompt: 'consent',     // always re-issue a refresh_token
  });
  console.log('[Auth] Redirecting to Google OAuth...');
  res.redirect(url);
});

// Step 2 — Google posts code here; exchange it for tokens
app.get('/auth/google/callback', async (req, res) => {
  const { code, error } = req.query;

  if (error) {
    console.error('[Auth] Google returned error:', error);
    return res.status(400).send(authPage(
      `<p style="color:#e74c3c">AUTH FAILED: ${error}</p>`
    ));
  }

  if (!code) {
    return res.status(400).send('Missing authorization code.');
  }

  try {
    console.log('[Auth] Exchanging code for tokens...');
    const { tokens: newTokens } = await oauth2Client.getToken(code);

    // Explicitly set credentials AND save to disk
    oauth2Client.setCredentials(newTokens);
    saveTokens(newTokens);  // ← guaranteed write, does not rely on event listener

    console.log('[Auth] ✅ Authentication successful — calendar connected');

    return res.send(authPage(`
      <p style="color:#00a8ff;letter-spacing:0.2em;font-size:1.1rem">CALENDAR CONNECTED</p>
      <p style="color:#888;margin-top:1rem">Authentication successful. Booking system is now live.</p>
      <p style="margin-top:1.5rem"><a href="/booking.html" style="color:#00a8ff">→ Open Booking Page</a></p>
    `));
  } catch (err) {
    console.error('[Auth] Callback error:', err.message);
    return res.status(500).send(authPage(
      `<p style="color:#e74c3c">Authentication failed: ${err.message}</p>`
    ));
  }
});

// Auth status — polled by booking.html
app.get('/auth/status', (req, res) => {
  res.json({ authenticated: !!tokens, timezone: TIMEZONE });
});

/* ─────────────────────────────────────────────
   AVAILABILITY — GET /availability
   ───────────────────────────────────────────── */
app.get('/availability', requireAuth, async (req, res) => {
  try {
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    const now        = new Date();
    const thirtyDays = new Date(now);
    thirtyDays.setDate(now.getDate() + 30);

    const response = await calendar.freebusy.query({
      requestBody: {
        timeMin:  now.toISOString(),
        timeMax:  thirtyDays.toISOString(),
        items:    [{ id: CALENDAR_ID }],
      },
    });

    const busy = response.data.calendars[CALENDAR_ID]?.busy || [];
    res.json({ busy, timezone: TIMEZONE });
  } catch (err) {
    console.error('[Availability] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/* ─────────────────────────────────────────────
   BOOKING REQUEST — POST /request-booking
   ───────────────────────────────────────────── */
app.post('/request-booking', requireAuth, async (req, res) => {
  const { date, timeSlot, bookingType, clientName, clientEmail, clientPhone, contactMethod, notes } = req.body;

  if (!date || !timeSlot || !bookingType) {
    return res.status(400).json({ error: 'date, timeSlot, and bookingType are required.' });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'date must be YYYY-MM-DD.' });
  }
  if (!TIME_SLOTS[timeSlot]) {
    return res.status(400).json({
      error: `Invalid timeSlot. Options: ${Object.keys(TIME_SLOTS).join(', ')}`,
    });
  }
  if (!['SHOOT', 'CONSULTATION'].includes(bookingType)) {
    return res.status(400).json({ error: 'bookingType must be SHOOT or CONSULTATION.' });
  }

  const todayUTC       = new Date();
  todayUTC.setUTCHours(0, 0, 0, 0);
  const requestDateUTC = new Date(`${date}T00:00:00Z`);
  if (requestDateUTC < todayUTC) {
    return res.status(400).json({ error: 'Cannot book past dates.' });
  }

  try {
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    let startUTC, endUTC;
    if (bookingType === 'SHOOT') {
      startUTC = localToUTC(date, TIME_SLOTS.ALL_DAY.startH);
      endUTC   = localToUTC(date, TIME_SLOTS.ALL_DAY.endH);
    } else {
      startUTC = localToUTC(date, TIME_SLOTS[timeSlot].startH);
      endUTC   = new Date(startUTC.getTime() + 15 * 60 * 1000);
    }

    // Double-check availability (race-condition guard)
    const check     = await calendar.freebusy.query({
      requestBody: {
        timeMin:  startUTC.toISOString(),
        timeMax:  endUTC.toISOString(),
        items:    [{ id: CALENDAR_ID }],
      },
    });
    const conflicts = check.data.calendars[CALENDAR_ID]?.busy || [];
    if (conflicts.length > 0) {
      return res.status(409).json({
        error: 'This slot was just taken. Please choose another window.',
      });
    }

    const lines = [
      'Client requested booking. Awaiting confirmation.',
      '',
      `Booking Type : ${bookingType}`,
      `Time Slot    : ${TIME_SLOTS[timeSlot].label}`,
      `Date         : ${date}`,
      `Timezone     : ${TIMEZONE}`,
    ];
    if (clientName)    lines.push(`Client Name  : ${clientName}`);
    if (clientEmail)   lines.push(`Client Email : ${clientEmail}`);
    if (clientPhone)   lines.push(`Client Phone : ${clientPhone}`);
    if (contactMethod) lines.push(`Contact Via  : ${contactMethod}`);
    if (notes)         lines.push(`Notes        : ${notes}`);

    const event = await calendar.events.insert({
      calendarId: CALENDAR_ID,
      requestBody: {
        summary:     'BOOKING REQUEST — Pending Approval',
        description: lines.join('\n'),
        start:       { dateTime: startUTC.toISOString(), timeZone: 'UTC' },
        end:         { dateTime: endUTC.toISOString(),   timeZone: 'UTC' },
        colorId:     '11',
        status:      'tentative',
      },
    });

    console.log(`[Booking] Created: ${event.data.id} — ${date} / ${timeSlot} / ${bookingType}`);

    // Fire-and-forget email notification (does not block response)
    sendBookingNotification({ clientName, clientEmail, clientPhone, contactMethod, date, timeSlot, bookingType });

    res.json({ success: true, message: 'Request sent. Awaiting confirmation.', eventId: event.data.id });
  } catch (err) {
    console.error('[Booking] Error:', err.message);
    res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

/* ─────────────────────────────────────────────
   HEALTH CHECK
   ───────────────────────────────────────────── */
app.get('/health', (req, res) => {
  res.json({ status: 'ok', authenticated: !!tokens, timezone: TIMEZONE });
});

/* ─────────────────────────────────────────────
   HELPERS
   ───────────────────────────────────────────── */
const monoStyle = 'font-family:monospace';
const pageStyle = `background:#04070d;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;${monoStyle}`;
const boxStyle  = 'text-align:center;padding:2rem;border:1px solid rgba(0,168,255,0.2);border-radius:4px;max-width:480px;width:90%';

function authPage(inner) {
  return `<!DOCTYPE html><html><body style="${pageStyle}"><div style="${boxStyle}">${inner}</div></body></html>`;
}

/* ─────────────────────────────────────────────
   START SERVER
   ───────────────────────────────────────────── */
app.listen(PORT, () => {
  console.log('\n  ╔══════════════════════════════════════╗');
  console.log('  ║     NEWSONIC AGE — Booking Server    ║');
  console.log('  ╚══════════════════════════════════════╝\n');
  console.log(`  Local:      http://localhost:${PORT}`);
  console.log(`  Booking UI: http://localhost:${PORT}/booking.html`);
  console.log(`  Auth:       http://localhost:${PORT}/auth/google`);
  console.log(`  Timezone:   ${TIMEZONE}`);
  console.log(`  Calendar:   ${CALENDAR_ID}`);
  console.log(`  Token file: ${TOKEN_FILE}\n`);

  if (!CLIENT_ID || !CLIENT_SECRET) {
    console.warn('  ⚠  CLIENT_ID or CLIENT_SECRET not set in .env\n');
  } else {
    const authed = fs.existsSync(TOKEN_FILE) ? '✅ tokens on disk' : '⚠  not authenticated yet — visit /auth/google';
    console.log(`  Auth status: ${authed}\n`);
  }
});
