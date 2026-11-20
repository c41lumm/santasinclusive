'use server';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/server';
import { callerIp, withinLimit } from '@/lib/rate-limit';
import { messages, problem, text, type FormState } from '@/lib/forms';
import { db } from '@/lib/db';
import { decryptSecret, hashCode, newCode, phoneNorm, placeholderEmail, sameHash } from '@/lib/auth/phone';
import { send } from '@/lib/notify/send';

async function origin() {
  const h = await headers();
  return process.env.NEXT_PUBLIC_SITE_URL || `${h.get('x-forwarded-proto') ?? 'http'}://${h.get('host')}`;
}

export async function signIn(_prev: FormState, fd: FormData): Promise<FormState> {
  const email = text(fd, 'email')?.trim().toLowerCase() ?? '';
  const password = text(fd, 'password') ?? '';
  if (!email || !password) return problem('Please give your email address and password');
  // Slows down anyone trying to guess passwords
  if (!(await withinLimit(`signin:${await callerIp()}`, 10, 15 * 60))) return problem(messages.TOO_MANY);
  const { error } = await auth.signIn.email({ email, password });
  if (error) return problem('That email address and password do not match. Check them, or set a new password below.');
  redirect('/admin');
}

/** Always says the same thing, so it never reveals whether someone has a staff account */
export async function requestReset(_prev: FormState, fd: FormData): Promise<FormState> {
  const email = text(fd, 'email')?.trim().toLowerCase() ?? '';
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return problem('Please give your email address', 'email');
  if (!(await withinLimit(`reset:${await callerIp()}`, 5, 60 * 60))) return problem(messages.TOO_MANY);
  await auth.requestPasswordReset({ email, redirectTo: `${await origin()}/staff/new-password` });
  return { done: email };
}

export async function setNewPassword(_prev: FormState, fd: FormData): Promise<FormState> {
  const token = text(fd, 'token') ?? '';
  const password = text(fd, 'password') ?? '';
  if (!token) return problem('This link is not complete. Please ask for a new one.');
  if (password.length < 10) return problem('Please choose a password of at least 10 characters', 'password');
  if (password !== text(fd, 'confirm')) return problem('The two passwords do not match', 'confirm');
  const { error } = await auth.resetPassword({ newPassword: password, token });
  if (error) return problem('This link has expired or been used. Please ask for a new one.');
  redirect('/staff/sign-in?done=password');
}

export async function signOut() {
  await auth.signOut();
  redirect('/staff/sign-in?done=signed-out');
}

/**
 * "Text me a code": for helpers who sign in with their mobile. Always answers the same way, so it never reveals
 * whether a number belongs to a helper.
 */
export async function requestTextCode(_prev: FormState, fd: FormData): Promise<FormState> {
  const norm = phoneNorm(text(fd, 'phone') ?? '');
  if (!norm) return problem('Please give your UK mobile number, starting 07', 'phone');
  const ip = await callerIp();
  if (!(await withinLimit(`textcode:ip:${ip}`, 6, 15 * 60)) || !(await withinLimit(`textcode:phone:${norm}`, 3, 15 * 60))) {
    return problem(messages.TOO_MANY);
  }
  const sql = db();
  const [who] = await sql`select p.user_id from phone_sign_ins p join staff s on s.user_id = p.user_id where p.phone_norm = ${norm}` as { user_id: string }[];
  if (who) {
    const code = newCode();
    await sql`insert into sign_in_codes (user_id, code_hash, expires_at) values (${who.user_id}::uuid, ${hashCode(code)}, now() + interval '10 minutes')`;
    const msg = `Your Santa's Inclusive Grotto sign-in code is ${code}. It works for 10 minutes. If you did not ask for it, you can ignore this text.`;
    await send({ phone: `+${norm}`, channels: ['sms'] }, { subject: 'Sign-in code', text: msg },
      { template: 'signInCode', logBody: 'Sign-in code (hidden for security)' });
  }
  return { done: `07${norm.slice(3, 6)} ${norm.slice(6)}` };
}

/** Checks the texted code and signs them in. Five wrong tries and the code stops working. */
export async function signInWithCode(_prev: FormState, fd: FormData): Promise<FormState> {
  const norm = phoneNorm(text(fd, 'phone') ?? '');
  const code = (text(fd, 'code') ?? '').replace(/\D/g, '');
  const wrong = problem('That code is not right, or it has expired. Check the text, or ask for a new code.', 'code');
  if (!norm || code.length !== 6) return wrong;
  if (!(await withinLimit(`textcode:check:${await callerIp()}`, 20, 15 * 60))) return problem(messages.TOO_MANY);
  const sql = db();
  const [c] = await sql`
    select c.id, c.code_hash, c.attempts, p.user_id, p.secret from sign_in_codes c join phone_sign_ins p on p.user_id = c.user_id
    where p.phone_norm = ${norm} and c.used_at is null and c.expires_at > now() order by c.created_at desc limit 1` as
    { id: string; code_hash: string; attempts: number; user_id: string; secret: string }[];
  if (!c || c.attempts >= 5) return wrong;
  if (!sameHash(c.code_hash, hashCode(code))) {
    await sql`update sign_in_codes set attempts = attempts + 1 where id = ${c.id}::uuid`;
    return wrong;
  }
  await sql`update sign_in_codes set used_at = now() where id = ${c.id}::uuid`;
  const { error } = await auth.signIn.email({ email: placeholderEmail(norm), password: decryptSecret(c.secret) });
  if (error) return problem('Sorry, we could not sign you in. Please ask an organiser to check your account.');
  redirect('/admin');
}
