import 'server-only';
import { createCipheriv, createDecipheriv, createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

/**
 * Text-code sign-in for helpers who only have a mobile. Their sign-in account has a placeholder email on our own
 * domain and a long random password nobody knows, kept here encrypted with a key from the server's cookie secret.
 * A correct code from a text lets the server sign them in with it.
 */
const key = () => createHash('sha256').update(`phone-sign-in:${process.env.NEON_AUTH_COOKIE_SECRET ?? ''}`).digest();

export function encryptSecret(plain: string) {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return [iv, c.getAuthTag(), data].map((b) => b.toString('base64url')).join('.');
}

export function decryptSecret(sealed: string) {
  const [iv, tag, data] = sealed.split('.').map((s) => Buffer.from(s, 'base64url'));
  const d = createDecipheriv('aes-256-gcm', key(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(data), d.final()]).toString('utf8');
}

/** UK mobile to 447..., or null */
export function phoneNorm(phone: string) {
  const d = phone.replace(/\D/g, '');
  const n = d.startsWith('44') ? d : d.startsWith('0') ? `44${d.slice(1)}` : d;
  return /^447\d{9}$/.test(n) ? n : null;
}

/** The hidden email a mobile-only helper's account uses, on our own domain so mail to it is never sent elsewhere */
export function placeholderEmail(norm: string) {
  const domain = (process.env.EMAIL_FROM ?? '').match(/@([^>\s]+)/)?.[1] ?? 'santasinclusivegrotto.co.uk';
  return `mobile-${norm}@helpers.${domain}`;
}
export const isPlaceholderEmail = (email: string | null | undefined) => !!email && /^mobile-447\d{9}@helpers\./.test(email);

export const newCode = () => String(randomInt(0, 1_000_000)).padStart(6, '0');
export const hashCode = (code: string) => createHash('sha256').update(`code:${key().toString('hex')}:${code}`).digest('hex');
export function sameHash(a: string, b: string) {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
