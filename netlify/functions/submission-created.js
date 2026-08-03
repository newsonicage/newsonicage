/**
 * Automated SMS follow-up on intake form submission.
 *
 * Netlify calls this automatically when a form submission is verified — the file
 * name IS the wiring, so do not rename it. There is no webhook to configure.
 *
 * COMPLIANCE — read before changing anything in here.
 *
 * This send is only lawful because the person ticked an optional, unchecked-by-default
 * box asking us to text them. That promise is written into the A2P 10DLC campaign
 * (CM23044f110ab62f290bdf7f7c001976a1) and onto /privacy and /terms. So:
 *
 *   - Never send without `sms_consent` present. An unticked checkbox is ABSENT from
 *     the POST, not "No" — code for absent, which is what the gate below does.
 *   - Never make that checkbox `required` on the form. Consent as a condition of
 *     submitting is a TCPA violation.
 *   - Keep the body close to registered sample #3 and keep "Reply STOP to opt out"
 *     on it. Carriers compare what you send against what you registered.
 *   - Send through the Messaging Service, never a bare `From` number. The campaign
 *     is bound to the service; a raw From can bypass it and get filtered.
 *
 * AUTH — this sends with a scoped API key, NOT the account auth token.
 *
 * The auth token grants full control of the Twilio account and cannot be revoked
 * without rotating it everywhere. An API key is scoped to what it needs and can be
 * deleted on its own. Two things about API key auth are easy to get wrong:
 *
 *   - The key SID and secret go in the Authorization header. The ACCOUNT SID still
 *     goes in the request URL path — an API key does not replace it there.
 *   - A 401 with code 20003 means the key is missing a permission (or was deleted),
 *     not that the message was bad.
 *
 * Requires four Netlify environment variables. Until they are set this function
 * runs, logs, and does nothing:
 *   TWILIO_ACCOUNT_SID          AC… — identifies the account, used in the URL
 *   TWILIO_API_KEY_SID          SK… — basic auth username
 *   TWILIO_API_KEY_SECRET       the secret shown ONCE when the key is created
 *   TWILIO_MESSAGING_SERVICE_SID
 */

const CALLBACK = '(678) 903-1255';

/** Digits to E.164. Returns null rather than guessing — the field is free text. */
function toE164(raw) {
  const s = String(raw || '').trim();
  if (!s) return null;
  if (/^\+[1-9]\d{7,14}$/.test(s)) return s;      // already E.164
  const d = s.replace(/\D/g, '');
  if (d.length === 10) return '+1' + d;            // 678 903 1255
  if (d.length === 11 && d[0] === '1') return '+' + d;
  return null;                                     // extensions, partials, intl — bail
}

/** ASCII only. A curly apostrophe or em-dash flips the whole SMS to UCS-2. */
function buildBody(business) {
  let who = String(business || '').trim().replace(/[^\x20-\x7E]/g, '');
  if (who.length > 40) who = who.slice(0, 39).trimEnd() + '.';
  const subject = who ? 'for ' + who : 'for your request';
  return 'Newsonic Age: got your file ' + subject + '. You asked us to follow up by text - ' +
         'we will reply within one business day. Reply here or call ' + CALLBACK + '. ' +
         'Reply STOP to opt out.';
}

exports.handler = async (event) => {
  // Always 200. A non-200 invites a Netlify retry, which double-texts someone if
  // Twilio already accepted the first one.
  const ok = { statusCode: 200, body: 'ok' };

  let payload;
  try {
    const body = JSON.parse(event.body || '{}');
    payload = body.payload || body;
  } catch (err) {
    console.error('[sms] unparseable event body:', err.message);
    return ok;
  }

  const data = (payload && payload.data) || {};
  const formName = payload && payload.form_name;

  if (formName !== 'intake') {
    console.log('[sms] skip: not the intake form (got "' + formName + '")');
    return ok;
  }

  // Honeypot. Netlify usually filters these before we run; do not depend on it.
  if (String(data['referral-code'] || '').trim()) {
    console.log('[sms] skip: honeypot filled');
    return ok;
  }

  if (String(data.sms_consent || '').trim().toLowerCase() !== 'yes') {
    console.log('[sms] skip: no SMS consent on this submission');
    return ok;
  }

  const to = toE164(data.phone);
  if (!to) {
    console.warn('[sms] skip: consent given but phone is not dialable, left as typed');
    return ok;
  }

  const sid = process.env.TWILIO_ACCOUNT_SID;
  const keySid = process.env.TWILIO_API_KEY_SID;
  const keySecret = process.env.TWILIO_API_KEY_SECRET;
  const service = process.env.TWILIO_MESSAGING_SERVICE_SID;

  // Name the missing ones. "env vars are not set" sends you to the dashboard to
  // compare four values by eye; this tells you which one to look at.
  const missing = [
    ['TWILIO_ACCOUNT_SID', sid],
    ['TWILIO_API_KEY_SID', keySid],
    ['TWILIO_API_KEY_SECRET', keySecret],
    ['TWILIO_MESSAGING_SERVICE_SID', service]
  ].filter(function (pair) { return !pair[1]; }).map(function (pair) { return pair[0]; });

  if (missing.length) {
    console.error('[sms] skip: missing Twilio env vars on this site: ' + missing.join(', '));
    return ok;
  }

  const form = new URLSearchParams({
    To: to,
    MessagingServiceSid: service,
    Body: buildBody(data.business)
  });

  try {
    const res = await fetch(
      'https://api.twilio.com/2010-04-01/Accounts/' + sid + '/Messages.json',
      {
        method: 'POST',
        headers: {
          Authorization: 'Basic ' + Buffer.from(keySid + ':' + keySecret).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: form
      }
    );
    const out = await res.json().catch(() => ({}));

    if (res.ok) {
      // "queued" is Twilio accepting the request, NOT proof of delivery. A carrier
      // block (A2P error 30034) lands later on the message record, which this
      // function never sees. Check Monitor → Logs → Messaging to confirm delivery.
      console.log('[sms] queued ' + out.sid + ' to ' + to);
    } else {
      // 401 code=20003 → the API key lacks the permission to create messages, or
      // was deleted. That is a credentials problem, not a message problem.
      console.error('[sms] Twilio rejected: ' + res.status + ' code=' + out.code +
        ' ' + (out.message || ''));
    }
  } catch (err) {
    console.error('[sms] send threw:', err.message);
  }

  return ok;
};
