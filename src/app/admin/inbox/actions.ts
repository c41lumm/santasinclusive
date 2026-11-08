'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { Resend } from 'resend';
import { requireStaff } from '@/lib/auth/staff';
import { inboxEmail, parseAddress } from '@/lib/admin/inbox';
import { db } from '@/lib/db';
import type { FormState } from '@/lib/forms';
import { site } from '@/lib/site';

const when = (t: string) => new Date(t).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' });

/** The grotto's address the email was sent to, so the reply comes from the same one (hey@, elf@ ...) */
function ourAddress(to: string[]) {
  const from = parseAddress(process.env.EMAIL_FROM ?? '').address;
  const domain = from.split('@')[1]?.toLowerCase();
  const mine = to.map((t) => parseAddress(t).address).find((a) => domain && a.toLowerCase().endsWith(`@${domain}`));
  return mine ?? from;
}

/** Replies to a received email, quoting it underneath, and logs the reply in Messages */
export async function replyToEmail(id: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const me = await requireStaff(['admin']);
  const reply = String(fd.get('reply') ?? '').trim();
  if (!reply) return { errors: [{ field: 'reply', message: 'Please write your reply' }] };
  if (reply.length > 10000) return { errors: [{ field: 'reply', message: 'Please keep your reply under 10,000 characters' }] };
  const e = await inboxEmail(id);
  if (!e) return { errors: [{ message: 'That email could not be found in Resend.' }] };

  const to = e.reply_to?.[0] || e.from;
  const recipient = parseAddress(to).address;
  const subject = /^re:/i.test(e.subject ?? '') ? e.subject : `Re: ${e.subject || 'your email'}`;
  const quoted = (e.text ?? '').trim().split('\n').map((l) => `> ${l}`).join('\n');
  const body = `${reply}\n\n${quoted ? `On ${when(e.created_at)}, ${e.from} wrote:\n${quoted}\n` : ''}`;
  const from = `${site.name} <${ourAddress(e.received_for?.length ? e.received_for : e.to)}>`;

  const sql = db();
  const [row] = await sql`
    insert into messages (template, channel, recipient, subject, body, status, inbox_email_id, resent_by)
    values ('inbox:reply', 'email', ${recipient}, ${subject}, ${body}, 'queued', ${id}, ${me.name}) returning id`;
  if (process.env.NODE_ENV !== 'production' && process.env.SEND_IN_DEV !== '1') {
    await sql`update messages set status = 'failed', error = 'Not sent: development (set SEND_IN_DEV=1 to send)' where id = ${row.id}`;
    revalidatePath(`/admin/inbox/${id}`);
    return { errors: [{ message: 'Not sent: the development site never sends email. Your reply is saved in Messages.' }] };
  }
  const { data, error } = await new Resend(process.env.RESEND_API_KEY).emails.send({
    from, to: recipient, subject, text: body,
    headers: e.message_id ? { 'In-Reply-To': e.message_id, References: e.message_id } : undefined,
  }, { idempotencyKey: `message-${row.id}` });
  if (error) {
    await sql`update messages set status = 'failed', error = ${`${error.name}: ${error.message}`} where id = ${row.id}`;
    revalidatePath(`/admin/inbox/${id}`);
    return { errors: [{ message: `Your reply did not send: ${error.message}` }] };
  }
  await sql`update messages set status = 'sent', sent_at = now(), provider_id = ${data?.id ?? null} where id = ${row.id}`;
  await sql`insert into inbox_state (email_id, read_at, read_by, replied_at, replied_by) values (${id}, now(), ${me.name}, now(), ${me.name})
            on conflict (email_id) do update set replied_at = now(), replied_by = ${me.name}`;
  revalidatePath('/admin/inbox');
  revalidatePath(`/admin/inbox/${id}`);
  return { done: `Reply sent to ${recipient}.` };
}

/** Moves an email out of the Inbox list, or back */
export async function setArchived(id: string, archived: boolean) {
  const me = await requireStaff(['admin']);
  await db()`insert into inbox_state (email_id, read_at, read_by, archived_at) values (${id}, now(), ${me.name}, ${archived ? new Date() : null})
             on conflict (email_id) do update set archived_at = ${archived ? new Date() : null}`;
  revalidatePath('/admin/inbox');
  redirect(archived ? '/admin/inbox' : `/admin/inbox/${id}`);
}
