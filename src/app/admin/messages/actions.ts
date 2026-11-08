'use server';
import { revalidatePath } from 'next/cache';
import { requireStaff } from '@/lib/auth/staff';
import { optionalEmail, optionalMobile } from '@/lib/booking-schema';
import { db } from '@/lib/db';
import type { FormState } from '@/lib/forms';
import { checkDeliveries, notReceived, resend } from '@/lib/notify/send';

/** Sends one message again, to the same address or number unless a corrected one is given */
export async function resendOne(id: string, channel: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const me = await requireStaff(['admin']);
  const raw = String(fd.get('to') ?? '');
  const check = (channel === 'email' ? optionalEmail : optionalMobile).safeParse(raw);
  if (!check.success) return { errors: [{ field: `to-${id}`, message: channel === 'email' ? 'Please check the email address' : 'Please give a UK mobile number' }] };
  const [m] = await db()`select subject from messages where id = ${id}::uuid` as { subject: string | null }[];
  if (channel === 'email' && m && !m.subject) await checkDeliveries(5).catch(() => 0); // older emails: Resend still has the subject
  const ok = await resend(id, me.name, check.data);
  revalidatePath('/admin/messages');
  return ok ? { done: 'Sent again.' } : { errors: [{ message: 'It did not send. The new attempt is in the list with the reason.' }] };
}

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Sends every not-received message of one kind again, up to 100 at a time. Booking messages are skipped when
 * the booking has since been cancelled, except the cancellation message itself.
 */
export async function resendAll(template: string, channel: string, _prev: FormState, _fd: FormData): Promise<FormState> {
  const me = await requireStaff(['admin']);
  const sql = db();
  const rows = await sql`
    select m.id from messages m left join bookings b on b.id = m.booking_id
    where m.template = ${template} and m.channel::text = ${channel}
      and (b.id is null or b.status <> 'cancelled' or m.template in ('cancelled', 'admin:cancelled'))
      and ${sql.unsafe(notReceived)}
    order by m.created_at limit 100` as { id: string }[];
  // Older emails were logged without their subject; Resend still has it
  if (channel === 'email' && rows.length) await checkDeliveries(5).catch(() => 0);
  let sent = 0;
  for (const r of rows) {
    if (await resend(r.id, me.name)) sent++;
    await pause(channel === 'email' ? 250 : 100); // stay inside Resend's and Twilio's sending limits
  }
  revalidatePath('/admin/messages');
  const failed = rows.length - sent;
  if (!rows.length) return { done: 'Nothing left to send again.' };
  return failed
    ? { errors: [{ message: `${sent} sent again, ${failed} did not send. See the newest messages for why.` }] }
    : { done: `${sent} sent again.${rows.length === 100 ? ' There may be more: press again.' : ''}` };
}

/** Asks Resend which emails were delivered and which bounced */
export async function checkDelivery(_prev: FormState, _fd: FormData): Promise<FormState> {
  await requireStaff(['admin']);
  try {
    const n = await checkDeliveries();
    revalidatePath('/admin/messages');
    return { done: `Checked ${n} emails with Resend.` };
  } catch (e) {
    return { errors: [{ message: `Could not check with Resend: ${String(e)}` }] };
  }
}
