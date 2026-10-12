// Sends one test text with the Twilio settings in .env.local, to check they work.
// Usage: npm run test:text -- 07700900123
import twilio from 'twilio';

const to = process.argv[2] ?? '';
const digits = to.replace(/\D/g, '');
const e164 = digits.startsWith('44') ? `+${digits}` : digits.startsWith('0') ? `+44${digits.slice(1)}` : '';
if (!/^\+447\d{9}$/.test(e164)) {
  console.error('Give a UK mobile number, for example: npm run test:text -- 07700900123');
  process.exit(1);
}
const { TWILIO_ACCOUNT_SID: sid, TWILIO_AUTH_TOKEN: token, TWILIO_SMS_FROM: from } = process.env;
const missing = Object.entries({ TWILIO_ACCOUNT_SID: sid, TWILIO_AUTH_TOKEN: token, TWILIO_SMS_FROM: from })
  .filter(([, v]) => !v).map(([k]) => k);
if (missing.length) {
  console.error(`Add these to .env.local first: ${missing.join(', ')}`);
  process.exit(1);
}
try {
  const msg = await twilio(sid, token).messages.create({
    from, to: e164, body: "Test from Santa's Inclusive Grotto: texts are working.",
  });
  console.log(`Sent (status: ${msg.status}). It should arrive within a minute.`);
} catch (e) {
  console.error(`Twilio said: ${e.message}${e.code ? ` (code ${e.code}, see https://www.twilio.com/docs/api/errors/${e.code})` : ''}`);
  process.exit(1);
}
