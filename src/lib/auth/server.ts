import 'server-only';
import { createNeonAuth } from '@neondatabase/auth/next/server';

/**
 * Staff sign-in (Neon Auth, email and password). Families never sign in. Sign-up is turned off,
 * so staff accounts are created by an admin: see the README.
 */
export const auth = createNeonAuth({
  baseUrl: process.env.NEON_AUTH_BASE_URL!,
  cookies: { secret: process.env.NEON_AUTH_COOKIE_SECRET! },
});
