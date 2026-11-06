'use server';
import { revalidatePath } from 'next/cache';
import { requireStaff } from '@/lib/auth/staff';
import { asStaff } from '@/lib/db';
import { isUuid } from '@/lib/admin/data';
import { send } from '@/lib/notify/send';
import { templates } from '@/lib/notify/templates';
import { withSavedWording } from '@/lib/notify/wording';
import { z } from 'zod';
import { ukMobile } from '@/lib/booking-schema';
import { problem, text, type FormState } from '@/lib/forms';

/** Early alerts: message everyone who asked, once, now that booking is open */
export async function sendEarlyAlerts(_prev: FormState, _fd: FormData): Promise<FormState> {
  await requireStaff(['admin']);
  const [[season], alerts] = await asStaff((sql) => [
    sql`select booking_open from seasons where last_day >= (now() at time zone 'Europe/London')::date order by year limit 1`,
    sql`select id, name, contact from early_alerts where notified_at is null order by created_at`,
  ]) as unknown as [[{ booking_open: boolean } | undefined], { id: string; name: string; contact: string }[]];
  if (!season?.booking_open) return problem('Open booking first (on Visit times), so the link in the alert works.');
  let sent = 0, failed = 0;
  for (const a of alerts) {
    const isEmail = a.contact.includes('@');
    const results = await send({ email: isEmail ? a.contact : null, phone: isEmail ? null : a.contact, channels: [isEmail ? 'email' : 'sms'] },
      templates.bookingOpen(a.name.split(' ')[0]), { template: 'bookingOpen' });
    if (results.some((r) => r.ok)) {
      sent++;
      await asStaff((sql) => [sql`update early_alerts set notified_at = now() where id = ${a.id}::uuid`]);
    } else failed++;
  }
  revalidatePath('/admin/alerts');
  return { done: `Sent to ${sent}.${failed ? ` ${failed} could not be sent: they are still on the list, so you can try again later (see Messages for why).` : ''}` };
}

/** Early alerts: send the booking-open message to one person on the list (again, if they were already told) */
export async function sendEarlyAlertTo(id: string, _prev: FormState, _fd: FormData): Promise<FormState> {
  await requireStaff(['admin']);
  if (!isUuid(id)) return problem('Could not find this person. Please reload the page.');
  const [[season], [a]] = await asStaff((sql) => [
    sql`select booking_open from seasons where last_day >= (now() at time zone 'Europe/London')::date order by year limit 1`,
    sql`select id, name, contact from early_alerts where id = ${id}::uuid`,
  ]) as unknown as [[{ booking_open: boolean } | undefined], [{ id: string; name: string; contact: string } | undefined]];
  if (!a) return problem('Could not find this person. Please reload the page.');
  if (!season?.booking_open) return problem('Open booking first (on Visit times), so the link in the alert works.');
  const isEmail = a.contact.includes('@');
  const results = await send({ email: isEmail ? a.contact : null, phone: isEmail ? null : a.contact, channels: [isEmail ? 'email' : 'sms'] },
    templates.bookingOpen(a.name.split(' ')[0]), { template: 'bookingOpen' });
  if (!results.some((r) => r.ok)) return problem('Not sent. See Messages for why.');
  await asStaff((sql) => [sql`update early_alerts set notified_at = now() where id = ${a.id}::uuid`]);
  revalidatePath('/admin/alerts');
  return { done: 'Sent' };
}

const testContact = z.string().trim().min(1, 'Give an email address or UK mobile number')
  .refine((s) => s.includes('@') ? z.string().email().safeParse(s).success : ukMobile.safeParse(s).success,
    'Give an email address, or a UK mobile number starting 07');

/** Early alerts: send the booking-open message to any email or mobile, to check it. Nobody on the list is marked as told. */
export async function sendTestEarlyAlert(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireStaff(['admin']);
  const parsed = testContact.safeParse(text(fd, 'to') ?? '');
  if (!parsed.success) return problem(parsed.error.issues[0].message, 'to');
  const to = parsed.data;
  const isEmail = to.includes('@');
  const msg = await withSavedWording(templates.bookingOpen(text(fd, 'name')?.trim().split(' ')[0] || 'there'));
  const results = await send({ email: isEmail ? to : null, phone: isEmail ? null : ukMobile.parse(to), channels: [isEmail ? 'email' : 'sms'] },
    { subject: `[Test] ${msg.subject}`, text: msg.text, sms: msg.sms }, { template: 'bookingOpenTest' });
  if (!results.some((r) => r.ok)) return problem('The test was not sent. See Messages for why.', 'to');
  return { done: `Test sent to ${to}. It should arrive within a minute; check spam if not.` };
}

const volunteerStatuses =['applied', 'chat_booked', 'checks_done', 'approved', 'declined'] as const;
export async function setVolunteerStatus(id: string, status: (typeof volunteerStatuses)[number]) {
  await requireStaff(['admin']);
  if (!isUuid(id) || !volunteerStatuses.includes(status)) return;
  await asStaff((sql) => [sql`
    update volunteers set status = ${status}, checks_confirmed_at = case when ${status} in ('checks_done', 'approved') then coalesce(checks_confirmed_at, now()) else checks_confirmed_at end
    where id = ${id}::uuid`]);
  revalidatePath('/admin/volunteers');
  revalidatePath('/admin/rota');
}

const sponsorStatuses = ['pending', 'invoiced', 'paid', 'cancelled'] as const;
export async function setSponsorStatus(id: string, status: (typeof sponsorStatuses)[number]) {
  await requireStaff(['admin']);
  if (!isUuid(id) || !sponsorStatuses.includes(status)) return;
  await asStaff((sql) => [sql`update sponsorships set status = ${status} where id = ${id}::uuid`]);
  revalidatePath('/admin/sponsorship');
}

export async function removeFromWaitlist(id: string) {
  await requireStaff(['admin']);
  if (!isUuid(id)) return;
  await asStaff((sql) => [sql`update waitlist_entries set status = 'removed' where id = ${id}::uuid and status = 'waiting'`]);
  revalidatePath('/admin/waitlist');
}

const groupStatuses = ['new', 'offered', 'booked', 'declined'] as const;
export async function setGroupStatus(id: string, status: (typeof groupStatuses)[number]) {
  await requireStaff(['admin']);
  if (!isUuid(id) || !groupStatuses.includes(status)) return;
  await asStaff((sql) => [sql`update group_enquiries set status = ${status} where id = ${id}::uuid`]);
  revalidatePath('/admin/groups');
  revalidatePath('/admin');
}
