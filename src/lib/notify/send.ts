import 'server-only';
import { Resend } from 'resend';
import twilio from 'twilio';
import { db } from '@/lib/db';
import { site } from '@/lib/site';
import { smsText, type Message } from './templates';
import { withSavedWording } from './wording';

type Channel = 'email' | 'sms' | 'whatsapp';
type Recipient = { email?: string | null; phone?: string | null; channels: Channel[] };
type Link = { booking_id?: string; waitlist_id?: string; volunteer_id?: string; template: string };
type Sql = ReturnType<typeof db>;

/** UK mobiles to +44 format for Twilio. Anything else is refused, so texts are never sent abroad. */
export function toE164(phone: string) {
  const d = phone.replace(/\D/g, '');
  const n = d.startsWith('44') ? d : d.startsWith('0') ? `44${d.slice(1)}` : d;
  if (!/^447\d{9}$/.test(n)) throw new Error('Not a UK mobile number');
  return `+${n}`;
}

/** Sends on every channel the family chose, and logs each attempt in the messages table. */
export async function send(to: Recipient, message: Message, link: Link) {
  const sql = db();
  // Wording an admin saved in Admin > Message wording, if any
  const msg = await withSavedWording(message);
  const results: { channel: Channel; ok: boolean }[] = [];
  for (const channel of to.channels) {
    const recipient = channel === 'email' ? to.email : to.phone;
    if (!recipient) continue;
    const body = channel === 'email' ? msg.text : smsText(msg);
    const [row] = await sql`
      insert into messages (booking_id, waitlist_id, volunteer_id, template, channel, recipient, subject, body, status)
      values (${link.booking_id ?? null}, ${link.waitlist_id ?? null}, ${link.volunteer_id ?? null}, ${link.template}, ${channel}, ${recipient},
              ${channel === 'email' ? msg.subject : null}, ${body}, 'queued')
      returning id`;
    results.push({ channel, ok: await deliver(sql, row.id, channel, recipient, msg.subject, body) });
  }
  return results;
}

/**
 * Sends one logged message and records the result on its row. The row's id makes a retry safe: Resend will not
 * send the same message twice.
 */
async function deliver(sql: Sql, id: string, channel: Channel, recipient: string, subject: string, body: string) {
  // While developing locally, messages are logged but not sent, so test bookings never text or email anyone.
  // Set SEND_IN_DEV=1 in .env.local to send for real.
  if (process.env.NODE_ENV !== 'production' && process.env.SEND_IN_DEV !== '1') {
    await sql`update messages set status = 'failed', error = 'Not sent: development (set SEND_IN_DEV=1 to send)' where id = ${id}`;
    return false;
  }
  try {
    let providerId: string | undefined;
    if (channel === 'email') {
      const { data, error } = await new Resend(process.env.RESEND_API_KEY).emails.send({
        from: process.env.EMAIL_FROM!, to: recipient, subject, text: body,
        replyTo: site.contactEmail || undefined,
      }, { idempotencyKey: `message-${id}` });
      if (error) throw new Error(`${error.name}: ${error.message}`);
      providerId = data?.id;
    } else {
      const client = twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!);
      // WhatsApp messages that start a conversation must use a template approved by Meta (see README)
      const res = await client.messages.create(channel === 'sms'
        ? { from: process.env.TWILIO_SMS_FROM!, to: toE164(recipient), body }
        : { from: process.env.TWILIO_WHATSAPP_FROM!, to: `whatsapp:${toE164(recipient)}`, body });
      providerId = res.sid;
    }
    await sql`update messages set status = 'sent', sent_at = now(), provider_id = ${providerId ?? null} where id = ${id}`;
    return true;
  } catch (e) {
    await sql`update messages set status = 'failed', error = ${String(e)} where id = ${id}`;
    return false;
  }
}

const fallbackSubject = `A message from ${site.name}`;

/**
 * Sends a logged message again, word for word, as a new message linked to the first. `to` replaces the address or
 * number, for when it was mistyped. Returns whether it went.
 */
export async function resend(id: string, by: string, to?: string) {
  const sql = db();
  const [m] = await sql`
    select id, booking_id, waitlist_id, volunteer_id, template, channel::text as channel, recipient, subject, body
    from messages where id = ${id}::uuid` as {
    id: string; booking_id: string | null; waitlist_id: string | null; volunteer_id: string | null; template: string;
    channel: Channel; recipient: string; subject: string | null; body: string;
  }[];
  if (!m) return false;
  const recipient = to?.trim() || m.recipient;
  const [row] = await sql`
    insert into messages (booking_id, waitlist_id, volunteer_id, template, channel, recipient, subject, body, status, resend_of, resent_by)
    values (${m.booking_id}, ${m.waitlist_id}, ${m.volunteer_id}, ${m.template}, ${m.channel}, ${recipient},
            ${m.subject}, ${m.body}, 'queued', ${m.id}, ${by})
    returning id`;
  return deliver(sql, row.id, m.channel, recipient, m.subject || fallbackSubject, m.body);
}

/**
 * Asks Resend what happened to recent emails (delivered, bounced, ...) and records it. Also fills in subjects for
 * emails sent before subjects were kept. Returns how many were checked.
 */
export async function checkDeliveries(pages = 20) {
  const sql = db();
  const r = new Resend(process.env.RESEND_API_KEY);
  let after: string | undefined;
  let checked = 0;
  for (let i = 0; i < pages; i++) {
    const { data, error } = await r.emails.list({ limit: 100, ...(after ? { after } : {}) });
    if (error) throw new Error(`${error.name}: ${error.message}`);
    const list = data?.data ?? [];
    if (list.length) {
      const ids = list.map((e) => e.id), events = list.map((e) => e.last_event ?? ''), subjects = list.map((e) => e.subject ?? '');
      await sql`
        update messages m set delivery = nullif(x.event, ''), delivery_checked_at = now(), subject = coalesce(m.subject, nullif(x.subject, ''))
        from unnest(${ids}::text[], ${events}::text[], ${subjects}::text[]) as x(id, event, subject)
        where m.provider_id = x.id and m.channel = 'email'`;
      checked += list.length;
    }
    if (!data?.has_more || !list.length) break;
    after = list[list.length - 1].id;
  }
  return checked;
}

/**
 * Messages that did not reach anyone: not sent, or the email bounced or is stuck. Ones already sent again
 * successfully are left out, and so are the attempts to send them again, so each counts once.
 */
export const notReceived = `m.resend_of is null and (m.status = 'failed' or m.delivery in ('bounced', 'delivery_delayed'))
  and not exists (select 1 from messages r where r.resend_of = m.id and r.status <> 'failed' and coalesce(r.delivery, '') <> 'bounced')`;
