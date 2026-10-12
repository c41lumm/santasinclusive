import 'server-only';
import { createHash } from 'node:crypto';
import { headers } from 'next/headers';
import { db } from '@/lib/db';

/** The visitor's IP address, as Vercel passes it on */
export async function callerIp() {
  const h = await headers();
  return h.get('x-real-ip') ?? h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
}

/** Keys are hashed so the rate_limits table never holds an IP address, email or phone number */
const hashed = (key: string) => createHash('sha256').update(key).digest('hex');

/** Counts one request. True if it is within the limit; false if over it or the check could not run. */
export async function withinLimit(key: string, max: number, windowSeconds: number) {
  try {
    const [row] = await db()`select rate_limit_ok(${hashed(key)}, ${max}, ${windowSeconds}) as ok`;
    return row?.ok === true;
  } catch {
    return false;
  }
}
