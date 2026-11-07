'use client';
import Link from 'next/link';
import { useState } from 'react';
import { ActionForm, Choices, Select, TextArea, TextField } from '@/components/form';
import { volunteerDayTypes, volunteerWeeks } from '@/lib/options';
import type { FormState } from '@/lib/forms';
import { roleChoices, roleLabel } from '@/lib/helper-roles';

export type Helper = { user_id: string; name: string; email: string | null; role: string; created_at: string; added_by: string | null; locked: boolean };
type Action = (prev: FormState, fd: FormData) => Promise<FormState>;

const added = (t: string) => new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/London' });

export function HelpersPanel({ helpers, add, setRole, remove }: {
  helpers: Helper[]; add: Action;
  setRole: (userId: string, fd: FormData) => Promise<void>; remove: (userId: string) => Promise<void>;
}) {
  const [adding, setAdding] = useState(false);
  return (
    <section className="a-panel" aria-labelledby="helpers-h">
      <div className="admin-head" style={{ marginBottom: 12 }}>
        <div>
          <h2 id="helpers-h" style={{ margin: 0 }}>Helpers</h2>
          <p className="muted" style={{ margin: 0 }}>Everyone who can sign in to the admin, and what they can do.</p>
        </div>
        {!adding ? <button type="button" className="btn btn-sm" onClick={() => setAdding(true)}>Add a helper</button> : null}
      </div>

      {adding ? (
        <div className="card-pale" style={{ borderRadius: 16, padding: '16px 20px', marginBottom: 20 }}>
          <h3 style={{ marginTop: 0 }}>Add a helper</h3>
          <ActionForm action={add} submitLabel="Add helper"
            secondary={<button type="button" className="btn btn-plain" onClick={() => setAdding(false)}>Cancel</button>}
            success={(d) => (
              <div className="success">
                <p style={{ fontWeight: 700 }}>{d}</p>
                <p style={{ margin: 0 }}>They choose their own password from that email, then sign in at the Helper login link at the bottom of the website.</p>
                <p style={{ margin: '8px 0 0' }}><button type="button" className="link-button" onClick={() => { setAdding(false); }}>Done</button></p>
              </div>
            )}>
            <div className="grid-2">
              <TextField name="name" label="Their name" autoComplete="off" autoCapitalize="words" />
              <TextField name="email" type="email" label="Their email address" autoComplete="off" autoCapitalize="none" spellCheck={false} />
            </div>
            <Select name="role" label="What do they do?" placeholder="Choose one" options={roleChoices.map((c) => ({ value: c.value, label: `${c.label}: ${c.hint}` }))} />
            <TextField name="phone" type="tel" label="Mobile number" optional inputMode="tel" autoComplete="off" width="medium"
              hint="So the rota can text them their shifts. Santas, elves and lead elves go straight onto the Helper rota." />
            <Choices type="checkbox" name="weeks" legend="When could they help?" layout="grid" optional
              hint="Leave these blank if they can help any day." choices={volunteerWeeks.map((w) => ({ value: w, label: w }))} />
            <Choices type="checkbox" name="day_types" legend="Which days suit them?" layout="grid" optional
              choices={volunteerDayTypes.map((d) => ({ value: d, label: d }))} />
            <TextArea name="note" label="Note" optional rows={3} maxLength={1000}
              hint="Anything to remember when planning the rota, for example “Saturdays only” or “not 12 December”." />
          </ActionForm>
        </div>
      ) : null}

      <div style={{ overflowX: 'auto' }}>
        <table className="simple-table">
          <thead><tr><th scope="col">Name</th><th scope="col">What they do</th><th scope="col">Added</th><th scope="col"><span className="visually-hidden">Remove</span></th></tr></thead>
          <tbody>
            {helpers.map((h) => (
              <tr key={h.user_id}>
                <td><Link href={`/admin/helpers/${h.user_id}`} style={{ fontWeight: 700 }}>{h.name}</Link>{h.email ? <><br /><span className="small">{h.email}</span></> : null}</td>
                <td>
                  {h.locked ? roleLabel(h.role) : (
                    <form action={setRole.bind(null, h.user_id)}>
                      <label className="visually-hidden" htmlFor={`role-${h.user_id}`}>What {h.name} does</label>
                      <select id={`role-${h.user_id}`} name="role" defaultValue={h.role} onChange={(e) => e.currentTarget.form?.requestSubmit()}>
                        {roleChoices.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                      </select>
                    </form>
                  )}
                </td>
                <td className="small">{added(h.created_at)}{h.added_by ? <><br />by {h.added_by}</> : null}</td>
                <td style={{ textAlign: 'right' }}>
                  {h.locked ? null : (
                    <form action={remove.bind(null, h.user_id)}
                      onSubmit={(e) => { if (!confirm(`Remove ${h.name}? They will be signed out and will not be able to sign in to the admin.`)) e.preventDefault(); }}>
                      <button type="submit" className="link-button danger" aria-label={`Remove ${h.name}`}>Remove</button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
