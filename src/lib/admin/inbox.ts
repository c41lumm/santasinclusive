import 'server-only';
import { Resend } from 'resend';
import { db } from '@/lib/db';

/** Emails sent to the grotto's own addresses. Resend receives and keeps them; inbox_state records read, replied and archived. */

const resend = () => new Resend(process.env.RESEND_API_KEY);

export type InboxItem = {
  id: string; from: string; to: string[]; subject: string; created_at: string; attachments: number;
  read_at: string | null; replied_at: string | null; replied_by: string | null; archived_at: string | null;
};
type State = { email_id: string; read_at: string | null; replied_at: string | null; replied_by: string | null; archived_at: string | null };

/** The newest received emails (up to 300), with what has been done with each */
export async function inbox(): Promise<InboxItem[]> {
  const r = resend();
  const all: InboxItem[] = [];
  let after: string | undefined;
  for (let i = 0; i < 3; i++) {
    const { data, error } = await r.emails.receiving.list({ limit: 100, ...(after ? { after } : {}) });
    if (error) throw new Error(`${error.name}: ${error.message}`);
    for (const e of data.data) {
      all.push({ id: e.id, from: e.from, to: e.received_for?.length ? e.received_for : e.to, subject: e.subject || '(no subject)',
        created_at: e.created_at, attachments: e.attachments?.length ?? 0, read_at: null, replied_at: null, replied_by: null, archived_at: null });
    }
    if (!data.has_more || !data.data.length) break;
    after = data.data[data.data.length - 1].id;
  }
  if (!all.length) return all;
  const states = await db()`
    select email_id, read_at::text as read_at, replied_at::text as replied_at, replied_by, archived_at::text as archived_at
    from inbox_state where email_id = any(${all.map((e) => e.id)}::text[])` as State[];
  const byId = new Map(states.map((s) => [s.email_id, s]));
  return all.map((e) => ({ ...e, ...(byId.get(e.id) ?? {}) }));
}

export async function inboxEmail(id: string) {
  const { data, error } = await resend().emails.receiving.get(id);
  if (error || !data) return null;
  return data;
}

export async function markRead(id: string, by: string) {
  await db()`insert into inbox_state (email_id, read_at, read_by) values (${id}, now(), ${by})
             on conflict (email_id) do update set read_at = coalesce(inbox_state.read_at, now()), read_by = coalesce(inbox_state.read_by, ${by})`;
}

export async function inboxState(id: string) {
  const [s] = await db()`select replied_at::text as replied_at, replied_by, archived_at::text as archived_at from inbox_state where email_id = ${id}` as
    { replied_at: string | null; replied_by: string | null; archived_at: string | null }[];
  return s ?? null;
}

/** A download link for an attachment. Resend's links expire, so one is fetched each time. */
export async function attachmentUrl(emailId: string, id: string) {
  const { data } = await resend().emails.receiving.attachments.get({ emailId, id });
  return data?.download_url ?? null;
}

/** "Jane Smith <jane@example.com>" → { name: "Jane Smith", address: "jane@example.com" } */
export function parseAddress(s: string) {
  const m = s.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  return m ? { name: m[1].trim(), address: m[2].trim() } : { name: '', address: s.trim() };
}
