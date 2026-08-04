/* =============================================
   NEWSONIC AGE — Booking Server
   Node.js + Express + Google Calendar API
   ============================================= */

require('dotenv').config();
const express      = require('express');
const cors         = require('cors');
const { google }   = require('googleapis');
const path         = require('path');
const nodemailer   = require('nodemailer');

const app = express();
app.use(cors());
app.use(express.json());

// ─── FRONTEND CONFIG — must be before express.static ──
// Serves window.API_BASE_URL to the browser from process.env.
// Registered first so a stale config.js file on disk never shadows it.
app.get('/config.js', (req, res) => {
  const apiBase = process.env.API_BASE_URL || '';
  res.setHeader('Content-Type', 'application/javascript');
  res.send(`window.API_BASE_URL = ${JSON.stringify(apiBase)};`);
});

app.use(express.static(path.join(__dirname)));

// ─── CONFIG ───────────────────────────────────
const PORT      = process.env.PORT      || 3000;
const TIMEZONE  = process.env.TIMEZONE  || 'America/New_York';
const CALENDAR_ID = process.env.CALENDAR_ID || 'primary';

// Support both CLIENT_ID / GOOGLE_CLIENT_ID naming conventions
const CLIENT_ID     = process.env.CLIENT_ID     || process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI  = process.env.REDIRECT_URI  || process.env.GOOGLE_REDIRECT_URI || `http://localhost:${PORT}/auth/google/callback`;

// ─── TIME SLOT DEFINITIONS ────────────────────
// A slot is the window the client says they are available in. It is not the
// length of the meeting — see BOOKING_TYPES for that.
const TIME_SLOTS = {
  EARLY_RISER:  { label: 'Early Riser (8–10AM)', startH: 8,  endH: 10 },
  MIDDAY_MOVER: { label: 'Midday Mover (1–3PM)', startH: 13, endH: 15 },
  NIGHT_OWL:    { label: 'Night Owl (8–10PM)',   startH: 20, endH: 22 },

  // Legacy. The retired Shoot type blocked the whole day. Kept only so a browser
  // running a cached copy of the old booking page does not get a 400 during the
  // window between this deploy and the frontend deploy. Safe to delete after that.
  ALL_DAY:      { label: 'All Day (8AM–10PM)',   startH: 8,  endH: 22, legacy: true },
};

// ─── BOOKING TYPES ────────────────────────────
// `minutes` is how much calendar time the meeting actually consumes, starting at
// the top of the chosen window. The exact arrival time is settled on approval.
const BOOKING_TYPES = {
  CALL:      { label: 'Phone Call',        minutes: 15 },
  IN_PERSON: { label: 'In-Person Meeting', minutes: 45 },

  // Legacy tokens — same reasoning as ALL_DAY above. CONSULTATION behaved
  // exactly like CALL; SHOOT consumed the entire window it was given.
  CONSULTATION: { label: 'Consultation',   minutes: 15, legacy: true },
  SHOOT:        { label: 'Shoot',          wholeWindow: true, legacy: true },
};

// ─── OAUTH2 CLIENT ────────────────────────────
const REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN;

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

// ─── INITIALIZE FROM ENV REFRESH TOKEN ────────
if (REFRESH_TOKEN) {
  oauth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });
  console.log('  ✅ Google Calendar connected via refresh token');
} else {
  console.warn('  ⚠  GOOGLE_REFRESH_TOKEN not set — calendar unavailable');
}

// ─── EMAIL NOTIFICATIONS ──────────────────────
// Uses Gmail SMTP + an App Password (set in .env).
// If credentials are missing, notifications are skipped gracefully.
const GMAIL_USER = process.env.GMAIL_USER;
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

// Escapes anything a client typed before it goes into the notification HTML.
// The recipient is Brad, not the public, but a stray `<` still mangles the table.
function esc(v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const listOf = (v) => (Array.isArray(v) ? v : v ? [v] : []);

// Consent has to be affirmative, so anything that is not an explicit yes is a no.
// A checkbox that was never ticked can arrive as false, absent, "" or "No"
// depending on how it was serialised; all four must land on the same answer.
const consented = (v) => v === true || ['yes', 'true'].includes(String(v).trim().toLowerCase());

function formatAddress(a) {
  if (!a) return '';
  const street = [a.street, a.street2].filter(Boolean).join(', ');
  const cityLine = [a.city, [a.state, a.zip].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  return [street, cityLine].filter(Boolean).join(' · ');
}

async function sendBookingNotification(details) {
  if (!mailer) return;
  const {
    clientName, clientEmail, clientPhone, date, timeSlot, bookingType, notes,
    meetingFormat, topic,
    business, website, address, teamSize, revenueBand,
    bottlenecks, urgency, systems, relationship, outsideServiceArea,
    smsConsent,
  } = details;

  const slotLabel = TIME_SLOTS[timeSlot]?.label || timeSlot;
  const typeLabel = BOOKING_TYPES[bookingType]?.label || bookingType;
  const inPerson  = bookingType === 'IN_PERSON';

  // Rows are built as [label, value] and dropped when the value is empty, so a
  // 15-minute call does not arrive wearing an in-person form's empty skeleton.
  const rows = [
    ['Client',   clientName],
    ['Email',    clientEmail],
    ['Phone',    clientPhone],
    ['Date',     date],
    ['Window',   slotLabel],
    ['Type',     typeLabel],
    ['Format',   meetingFormat],
    ['Topic',    topic],
    ['Business', business],
    ['Website',  website],
    ['Address',  formatAddress(address)],
    ['Team',     teamSize],
    ['Revenue',  revenueBand],
    ['Urgency',  urgency],
    ['In the way', listOf(bottlenecks).join(' · ')],
    ['Has today',  listOf(systems).join(' · ')],
    ['Relationship', relationship],
    ['Notes',    notes],
    ['Texts OK', consented(smsConsent) ? 'Yes — consented' : ''],
  ].filter(([, v]) => v);

  const flag = outsideServiceArea
    ? `<p style="margin:0 0 16px;padding:10px 12px;background:rgba(192,57,43,0.18);border:1px solid rgba(192,57,43,0.5);border-radius:4px;color:#e74c3c;font-size:0.78rem;">
         OUTSIDE THE USUAL SERVICE AREA — travel would need to be arranged.
       </p>`
    : '';

  const html = `
    <div style="font-family:monospace;background:#04070d;color:#fff;padding:32px;max-width:620px;border:1px solid rgba(0,168,255,0.2);border-radius:6px;">
      <p style="color:#00a8ff;letter-spacing:0.2em;font-size:0.8rem;margin:0 0 4px;">NEWSONIC AGE</p>
      <h2 style="margin:0 0 20px;font-size:1.2rem;letter-spacing:-0.01em;">
        ${inPerson ? 'In-Person Request — review before approving' : 'New Call Request'}
      </h2>
      ${flag}
      <table style="width:100%;border-collapse:collapse;font-size:0.85rem;line-height:2;">
        ${rows.map(([k, v]) =>
          `<tr><td style="color:rgba(255,255,255,0.5);padding-right:16px;vertical-align:top;white-space:nowrap;">${esc(k)}</td><td>${esc(v)}</td></tr>`
        ).join('')}
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
      subject: `${inPerson ? '🚩 In-Person' : '📅 Call'} Request — ${clientName} / ${date}`,
      html,
      text: rows.map(([k, v]) => `${k}: ${v}`).join('\n'),
    });
    console.log(`[Email] Notification sent for ${clientName} / ${date}`);
  } catch (err) {
    console.warn('[Email] Failed to send notification:', err.message);
  }
}

/* ─────────────────────────────────────────────
   SMS CONFIRMATION — Twilio

   COMPLIANCE — read before changing anything in here. The same rules that
   govern netlify/functions/submission-created.js govern this send; that file
   carries the long-form reasoning and is worth reading alongside this one.

     - Never send without explicit consent. The booking page's consent box is
       optional and unchecked by default, and making it required would be a TCPA
       violation. An unticked box arrives as absent/false, which is what gates below.
     - Keep the body shaped like the registered A2P sample and keep "Reply STOP
       to opt out" on it. Carriers compare what you send to what you registered.
     - Send through the Messaging Service, never a bare From number.

   AUTH — a Restricted API key scoped to `messages:create`, NOT the account auth
   token, and NOT the same key the Netlify function uses. One key per app so any
   one of them can be revoked alone. The ACCOUNT SID still goes in the URL path;
   an API key does not replace it there. A 401 with code 20003 means the key
   lacks the permission or was deleted — a credentials problem, not a bad message.

   Requires four env vars on Render. Until they are set this logs and does nothing.
   ───────────────────────────────────────────── */
const SMS_CALLBACK = '(678) 903-1255';

/** Digits to E.164. Returns null rather than guessing — the field is free text. */
function toE164(raw) {
  const s = String(raw || '').trim();
  if (!s) return null;
  if (/^\+[1-9]\d{7,14}$/.test(s)) return s;
  const d = s.replace(/\D/g, '');
  if (d.length === 10) return '+1' + d;
  if (d.length === 11 && d[0] === '1') return '+' + d;
  return null;
}

/** "2026-08-05" reads like a log line in a text message. "Wed, Aug 5" reads like a person. */
function friendlyDate(dateStr) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateStr || ''))) return '';
  return new Date(dateStr + 'T12:00:00Z').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC',
  });
}

/** ASCII only. A curly apostrophe or em-dash flips the whole SMS to UCS-2, which
 *  cuts the per-segment budget from 153 characters to 67. Keep the wording shaped
 *  like the registered A2P sample — carriers compare the two. */
function buildSmsBody(date) {
  const when = friendlyDate(date).replace(/[^\x20-\x7E]/g, '');
  const forWhen = when ? 'for ' + when : '';
  return ('Newsonic Age: got your booking request ' + forWhen + '. You asked us to follow up by ' +
    'text - we will confirm within one business day. Reply here or call ' + SMS_CALLBACK + '. ' +
    'Reply STOP to opt out.').replace(/\s+/g, ' ');
}

async function sendBookingSms({ clientPhone, date, smsConsent }) {
  if (!consented(smsConsent)) return;

  const to = toE164(clientPhone);
  if (!to) {
    console.warn('[SMS] skip: consent given but phone is not dialable, left as typed');
    return;
  }

  const sid       = process.env.TWILIO_ACCOUNT_SID;
  const keySid    = process.env.TWILIO_API_KEY_SID;
  const keySecret = process.env.TWILIO_API_KEY_SECRET;
  const service   = process.env.TWILIO_MESSAGING_SERVICE_SID;

  // Name the missing ones. "env vars are not set" sends you to the dashboard to
  // compare four values by eye; this tells you which one to look at.
  const missing = [
    ['TWILIO_ACCOUNT_SID', sid],
    ['TWILIO_API_KEY_SID', keySid],
    ['TWILIO_API_KEY_SECRET', keySecret],
    ['TWILIO_MESSAGING_SERVICE_SID', service],
  ].filter(([, v]) => !v).map(([k]) => k);

  if (missing.length) {
    console.error('[SMS] skip: missing Twilio env vars on this service: ' + missing.join(', '));
    return;
  }

  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${keySid}:${keySecret}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        To: to,
        MessagingServiceSid: service,
        Body: buildSmsBody(date),
      }),
    });
    const out = await res.json().catch(() => ({}));

    if (res.ok) {
      // "queued" is Twilio accepting the request, NOT proof of delivery. A carrier
      // block (A2P error 30034) lands later on the message record, which this
      // function never sees. Check Monitor → Logs → Messaging to confirm delivery.
      console.log(`[SMS] queued ${out.sid} to ${to}`);
    } else {
      console.error(`[SMS] Twilio rejected: ${res.status} code=${out.code} ${out.message || ''}`);
    }
  } catch (err) {
    console.error('[SMS] send threw:', err.message);
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
  if (!REFRESH_TOKEN) {
    return res.status(401).json({
      error: 'Calendar not connected. Set GOOGLE_REFRESH_TOKEN in environment variables.',
    });
  }
  next();
}

/* ─────────────────────────────────────────────
   ROOT
   ───────────────────────────────────────────── */
app.get('/', (req, res) => {
  res.send('Server running');
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

    oauth2Client.setCredentials(newTokens);
    console.log('[Auth] ✅ Tokens received. Copy the refresh_token below to GOOGLE_REFRESH_TOKEN:');
    console.log('[Auth] refresh_token:', newTokens.refresh_token || '(not returned — already issued)');
    console.log('[Auth] Authentication successful');

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
  res.json({ authenticated: !!REFRESH_TOKEN, timezone: TIMEZONE });
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
    // Log full Google API error so Render logs show the root cause
    const detail = err.response?.data || err.errors || err.message;
    console.error('[Availability] Error:', JSON.stringify(detail, null, 2));
    res.status(500).json({ error: err.message, detail });
  }
});

/* ─────────────────────────────────────────────
   BOOKING REQUEST — POST /request-booking
   ───────────────────────────────────────────── */
app.post('/request-booking', requireAuth, async (req, res) => {
  const {
    date, timeSlot, bookingType, clientName, clientEmail, clientPhone, notes,
    // Phone-call path
    meetingFormat, topic,
    // In-person qualification
    business, website, address, teamSize, revenueBand,
    bottlenecks, urgency, systems, relationship, outsideServiceArea,
    smsConsent,
  } = req.body;

  if (!date || !timeSlot || !bookingType) {
    return res.status(400).json({ error: 'date, timeSlot, and bookingType are required.' });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'date must be YYYY-MM-DD.' });
  }
  if (!TIME_SLOTS[timeSlot]) {
    return res.status(400).json({
      error: `Invalid timeSlot. Options: ${Object.keys(TIME_SLOTS).filter(k => !TIME_SLOTS[k].legacy).join(', ')}`,
    });
  }
  if (!BOOKING_TYPES[bookingType]) {
    return res.status(400).json({
      error: `Invalid bookingType. Options: ${Object.keys(BOOKING_TYPES).filter(k => !BOOKING_TYPES[k].legacy).join(', ')}`,
    });
  }

  // An in-person visit costs a drive. These are the answers that decide whether
  // it is worth taking, so the request is not accepted without them. The browser
  // enforces the same set; this is the copy that cannot be edited out.
  if (bookingType === 'IN_PERSON') {
    const required = {
      business, teamSize, revenueBand, urgency, relationship,
      'business address': address && address.street && address.city && address.state && address.zip,
      'at least one bottleneck': listOf(bottlenecks).length,
    };
    const blank = Object.entries(required).filter(([, v]) => !v).map(([k]) => k);
    if (blank.length) {
      return res.status(400).json({
        error: `An in-person request needs: ${blank.join(', ')}.`,
      });
    }
  }

  const todayUTC       = new Date();
  todayUTC.setUTCHours(0, 0, 0, 0);
  const requestDateUTC = new Date(`${date}T00:00:00Z`);
  if (requestDateUTC < todayUTC) {
    return res.status(400).json({ error: 'Cannot book past dates.' });
  }

  try {
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    // The meeting starts at the top of the window they chose and runs for as long
    // as its type needs. Every type must declare a duration — the old code gave
    // anything that was not SHOOT a silent 15 minutes, which is exactly how a
    // 45-minute site visit would have booked a quarter of an hour without erroring.
    const slotMeta = TIME_SLOTS[timeSlot];
    const typeMeta = BOOKING_TYPES[bookingType];

    const startUTC = localToUTC(date, slotMeta.startH);
    const endUTC   = typeMeta.wholeWindow
      ? localToUTC(date, slotMeta.endH)
      : new Date(startUTC.getTime() + typeMeta.minutes * 60 * 1000);

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

    const inPerson = bookingType === 'IN_PERSON';

    // Every field the client filled in lands in the event description, so the
    // calendar entry alone is enough to decide on. Anything blank is left out.
    const lines = [
      'Client requested booking. Awaiting confirmation.',
      '',
      `Booking Type : ${typeMeta.label}`,
      `Window       : ${slotMeta.label}`,
      `Date         : ${date}`,
      `Duration     : ${typeMeta.wholeWindow ? 'whole window' : typeMeta.minutes + ' minutes'}`,
      `Timezone     : ${TIMEZONE}`,
    ];
    if (outsideServiceArea) lines.push('', '** OUTSIDE THE USUAL SERVICE AREA **');

    const detail = [
      ['Client Name  ', clientName],
      ['Client Email ', clientEmail],
      ['Client Phone ', clientPhone],
      ['Format       ', meetingFormat],
      ['Topic        ', topic],
      ['Business     ', business],
      ['Website      ', website],
      ['Address      ', formatAddress(address)],
      ['Team Size    ', teamSize],
      ['Revenue      ', revenueBand],
      ['Urgency      ', urgency],
      ['In The Way   ', listOf(bottlenecks).join(' · ')],
      ['Has Today    ', listOf(systems).join(' · ')],
      ['Relationship ', relationship],
      ['Texts OK     ', consented(smsConsent) ? 'Yes — consented' : ''],
      ['Notes        ', notes],
    ].filter(([, v]) => v);

    if (detail.length) lines.push('', ...detail.map(([k, v]) => `${k}: ${v}`));

    const event = await calendar.events.insert({
      calendarId: CALENDAR_ID,
      requestBody: {
        summary:     inPerson
          ? `IN-PERSON REQUEST — ${business || clientName || 'Pending Approval'}`
          : `CALL REQUEST — ${clientName || 'Pending Approval'}`,
        description: lines.join('\n'),
        start:       { dateTime: startUTC.toISOString(), timeZone: 'UTC' },
        end:         { dateTime: endUTC.toISOString(),   timeZone: 'UTC' },
        location:    inPerson ? formatAddress(address) : undefined,
        colorId:     '11',
        status:      'tentative',
      },
    });

    console.log(`[Booking] Created: ${event.data.id} — ${date} / ${timeSlot} / ${bookingType}`);

    // Fire-and-forget notifications (neither blocks the response)
    sendBookingNotification({
      clientName, clientEmail, clientPhone, date, timeSlot, bookingType, notes,
      meetingFormat, topic,
      business, website, address, teamSize, revenueBand,
      bottlenecks, urgency, systems, relationship, outsideServiceArea,
      smsConsent,
    });
    sendBookingSms({ clientPhone, date, smsConsent });

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
  res.json({ status: 'ok', authenticated: !!REFRESH_TOKEN, timezone: TIMEZONE });
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
app.listen(PORT, '0.0.0.0', () => {
  console.log('\n  ╔══════════════════════════════════════╗');
  console.log('  ║     NEWSONIC AGE — Booking Server    ║');
  console.log('  ╚══════════════════════════════════════╝\n');
  console.log(`  Local:      http://localhost:${PORT}`);
  console.log(`  Booking UI: http://localhost:${PORT}/booking.html`);
  console.log(`  Timezone:   ${TIMEZONE}`);
  console.log(`  Calendar:   ${CALENDAR_ID}\n`);

  if (!CLIENT_ID || !CLIENT_SECRET) {
    console.warn('  ⚠  GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET not set in environment\n');
  }
  if (!REFRESH_TOKEN) {
    console.warn('  ⚠  GOOGLE_REFRESH_TOKEN not set — /availability will return 401\n');
  }
});
