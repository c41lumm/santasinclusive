import 'server-only';

/**
 * Cloudflare Turnstile: checks a public form was sent by a person, not a script.
 * The form shows the widget with NEXT_PUBLIC_TURNSTILE_SITE_KEY and passes its token here.
 * Without a secret key the check is skipped in development, but never on the live site.
 */
export async function isHuman(token: string | undefined, ip: string | null) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return process.env.NODE_ENV !== 'production';
  if (!token) return false;
  const body = new URLSearchParams({ secret, response: token });
  if (ip) body.set('remoteip', ip);
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}
