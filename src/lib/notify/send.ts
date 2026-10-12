import 'server-only';
import sgMail from '@sendgrid/mail';
import twilio from 'twilio';
import { serviceClient } from '@/lib/supabase/server';

type Channel = 'email' | 'sms' | 'whatsapp';
type Recipient = { email?: string | null; phone?: string | null; channels: Channel[] };
type Message = { subject: string; text: string };
type Link = { booking_id?: string; waitlist_id?: string; template: string };

/** UK numbers to +44 format for Twilio */
export function toE164(phone: string) {
  const d = phone.replace(/\D/g, '');
  if (d.startsWith('44')) return `+${d}`;
  if (d.startsWith('0')) return `+44${d.slice(1)}`;
  return `+${d}`;
}

/** Sends on every channel the family chose, and logs each attempt in the messages table. */
export async function send(to: Recipient, msg: Message, link: Link) {
  const db = serviceClient();
  const results: { channel: Channel; ok: boolean }[] = [];
  for (const channel of to.channels) {
    const recipient = channel === 'email' ? to.email : to.phone;
    if (!recipient) continue;
    const { data: row } = await db.from('messages')
      .insert({ ...link, channel, recipient, body: msg.text, status: 'queued' }).select('id').single();
    try {
      let providerId: string | undefined;
      if (channel === 'email') {
        sgMail.setApiKey(process.env.SENDGRID_API_KEY!);
        const [res] = await sgMail.send({ to: recipient, from: process.env.EMAIL_FROM!, subject: msg.subject, text: msg.text });
        providerId = res.headers['x-message-id'] as string | undefined;
      } else {
        const client = twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!);
        // WhatsApp messages that start a conversation must use a template approved by Meta (see README)
        const res = await client.messages.create(channel === 'sms'
          ? { from: process.env.TWILIO_SMS_FROM!, to: toE164(recipient), body: msg.text }
          : { from: process.env.TWILIO_WHATSAPP_FROM!, to: `whatsapp:${toE164(recipient)}`, body: msg.text });
        providerId = res.sid;
      }
      await db.from('messages').update({ status: 'sent', sent_at: new Date().toISOString(), provider_id: providerId }).eq('id', row?.id);
      results.push({ channel, ok: true });
    } catch (e) {
      await db.from('messages').update({ status: 'failed', error: String(e) }).eq('id', row?.id);
      results.push({ channel, ok: false });
    }
  }
  return results;
}
