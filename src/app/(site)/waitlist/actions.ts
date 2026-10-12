'use server';
import { redirect } from 'next/navigation';
import { asPublic } from '@/lib/db';
import { isToken } from '@/lib/public-data';
import { dbCode, messages, problem, type FormState } from '@/lib/forms';

export async function leaveWaitlist(token: string, _prev: FormState, _fd: FormData): Promise<FormState> {
  if (!isToken(token)) return problem(messages.NOT_FOUND);
  try {
    await asPublic((sql) => [sql`select leave_waitlist(${token}::uuid)`]);
  } catch (e) {
    return problem(messages[dbCode(e)]);
  }
  redirect(`/waitlist/leave/${token}?done=1`);
}
