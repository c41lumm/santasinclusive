'use server';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/server';
import { callerIp, withinLimit } from '@/lib/rate-limit';
import { messages, problem, text, type FormState } from '@/lib/forms';

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
