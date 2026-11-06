'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { requireStaff } from '@/lib/auth/staff';
import { asStaff } from '@/lib/db';
import { ukMobile } from '@/lib/booking-schema';
import { send } from '@/lib/notify/send';
import { isTemplateName, render, sampleVars, wordingProblems } from '@/lib/notify/templates';
import { problem, text, type FormState } from '@/lib/forms';

const draft = (fd: FormData) => ({ subject: (text(fd, 'subject') ?? '').trim(), body: (text(fd, 'body') ?? '').replace(/\r\n/g, '\n').trim() });

/** Save new wording for one message. It is used from the next message sent. */
export async function saveWording(name: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const me = await requireStaff(['admin']);
  if (!isTemplateName(name)) return problem('Could not find this message. Please go back and try again.');
  const { subject, body } = draft(fd);
  const problems = wordingProblems(name, subject, body);
  if (problems.length) return { errors: problems };
  await asStaff((sql) => [sql`
    insert into message_wording (name, subject, body, updated_by) values (${name}, ${subject}, ${body}, ${me.name})
    on conflict (name) do update set subject = excluded.subject, body = excluded.body, updated_at = now(), updated_by = excluded.updated_by`]);
  revalidatePath('/admin', 'layout');
  return { done: 'Saved. The next message sent will use this wording.' };
}

/** Go back to the original wording */
export async function resetWording(name: string) {
  await requireStaff(['admin']);
  if (!isTemplateName(name)) return;
  await asStaff((sql) => [sql`delete from message_wording where name = ${name}`]);
  revalidatePath('/admin', 'layout');
  redirect(`/admin/wording/${name}?reset=${Date.now()}`);
}

const testContact = z.string().trim().min(1, 'Give an email address or UK mobile number')
  .refine((s) => (s.includes('@') ? z.string().email().safeParse(s).success : ukMobile.safeParse(s).success),
    'Give an email address, or a UK mobile number starting 07');

/** Send the wording on screen (saved or not) with example details, to check how it looks */
export async function sendTestWording(name: string, _prev: FormState, fd: FormData): Promise<FormState> {
  await requireStaff(['admin']);
  if (!isTemplateName(name)) return problem('Could not find this message. Please go back and try again.');
  const parsed = testContact.safeParse(text(fd, 'to') ?? '');
  if (!parsed.success) return problem(parsed.error.issues[0].message, 'to');
  const { subject, body } = draft(fd);
  const problems = wordingProblems(name, subject, body);
  if (problems.length) return problem(`Fix the wording first: ${problems[0].message}`);
  const to = parsed.data;
  const isEmail = to.includes('@');
  const msg = render(name, sampleVars(name), { subject, body });
  const results = await send({ email: isEmail ? to : null, phone: isEmail ? null : ukMobile.parse(to), channels: [isEmail ? 'email' : 'sms'] },
    { subject: `[Test] ${msg.subject}`, text: msg.text }, { template: `${name}Test` });
  if (!results.some((r) => r.ok)) return problem('The test was not sent. See Messages for why.', 'to');
  return { done: `Test sent to ${to}, with example details filled in. Check spam if it does not arrive within a minute.` };
}
