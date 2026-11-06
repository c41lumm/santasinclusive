import 'server-only';
import { db } from '@/lib/db';
import { render, type Message, type TemplateName } from './templates';

/** Wording admins have saved, by message name (only the ones they changed) */
export async function savedWording(): Promise<Map<string, { subject: string; body: string; updated_at: string }>> {
  const rows = await db()`select name, subject, body, updated_at::text as updated_at from message_wording` as
    { name: string; subject: string; body: string; updated_at: string }[];
  return new Map(rows.map((r) => [r.name, r]));
}

/** The message with any wording an admin has saved for it. If it cannot be read, the default wording is used. */
export async function withSavedWording(msg: Message): Promise<Message> {
  if (!msg.wording) return msg;
  try {
    const [row] = await db()`select subject, body from message_wording where name = ${msg.wording.name}` as { subject: string; body: string }[];
    return row ? render(msg.wording.name as TemplateName, msg.wording.vars, row) : msg;
  } catch {
    return msg;
  }
}
