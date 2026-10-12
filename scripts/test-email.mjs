// Sends one test email with the Resend settings in .env.local, to check they work.
// Usage: npm run test:email -- you@example.com
import { Resend } from 'resend';

const to = process.argv[2] ?? '';
if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) {
  console.error('Give an email address, for example: npm run test:email -- you@example.com');
  process.exit(1);
}
const { RESEND_API_KEY: key, EMAIL_FROM: from } = process.env;
const missing = Object.entries({ RESEND_API_KEY: key, EMAIL_FROM: from }).filter(([, v]) => !v).map(([k]) => k);
if (missing.length) {
  console.error(`Add these to .env.local first: ${missing.join(', ')}`);
  process.exit(1);
}
const { data, error } = await new Resend(key).emails.send({
  from, to, subject: "Test from Santa's Inclusive Grotto",
  text: "Test from Santa's Inclusive Grotto: emails are working.",
});
if (error) {
  console.error(`Resend said: ${error.name}: ${error.message}`);
  process.exit(1);
}
console.log(`Sent (id ${data.id}). It should arrive within a minute; check spam if not.`);
