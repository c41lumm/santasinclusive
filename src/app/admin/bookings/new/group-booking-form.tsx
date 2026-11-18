'use client';
import { ActionForm, Select, TextArea, TextField } from '@/components/form';
import type { FormState } from '@/lib/forms';

export type GroupPrefill = { group_name?: string; contact_name?: string; email?: string; phone?: string; group_size?: number;
  group_staff?: number; age_range?: string; notes?: string };

/** Booking a school or group: who they are, how many, and how many back-to-back times to hold */
export function GroupBookingForm({ action, times, prefill }: {
  action: (prev: FormState, fd: FormData) => Promise<FormState>; times: { value: string; label: string }[]; prefill?: GroupPrefill;
}) {
  const p = prefill ?? {};
  return (
    <ActionForm action={action} submitLabel="Book this group">
      <TextField name="group_name" label="School or group name" defaultValue={p.group_name} autoComplete="off" />
      <div className="grid-2">
        <TextField name="contact_name" label="Contact name" defaultValue={p.contact_name} autoComplete="off" autoCapitalize="words" />
        <TextField name="email" type="email" label="Contact email" defaultValue={p.email} autoComplete="off" autoCapitalize="none" spellCheck={false} />
      </div>
      <TextField name="phone" type="tel" label="Contact phone" optional defaultValue={p.phone} autoComplete="off" inputMode="tel" width="medium" />
      <div className="grid-2">
        <TextField name="group_size" label="Children or young people visiting" defaultValue={p.group_size?.toString()} inputMode="numeric" width="short" />
        <TextField name="group_staff" label="Staff and carers" optional defaultValue={p.group_staff?.toString()} inputMode="numeric" width="short" />
      </div>
      <TextField name="age_range" label="Ages" optional defaultValue={p.age_range} width="medium" hint="For example 5 to 11." />
      <Select name="times" label="How long do they need?" options={times} defaultValue="1"
        hint="Back-to-back times from the time you chose. Each one must be free." />
      <TextArea name="notes" label="Anything we should know" optional rows={4} maxLength={2000} defaultValue={p.notes}
        hint="Needs, access, arrival plans. Only the team sees this." />
      <div className="agree" style={{ margin: '8px 0 16px' }}>
        <input type="checkbox" id="send_email" name="send_email" defaultChecked aria-describedby="send_email-hint" />
        <label htmlFor="send_email">Email the group a confirmation
          <span id="send_email-hint" className="hint" style={{ marginTop: 4 }}>The date, time and reference, with directions. Change the wording in Message wording.</span></label>
      </div>
    </ActionForm>
  );
}
