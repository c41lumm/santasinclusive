'use client';
import { ActionForm, Choices, TextArea, TextField } from '@/components/form';
import type { FormState } from '@/lib/forms';

type Action = (prev: FormState, fd: FormData) => Promise<FormState>;
const done = (t: string) => <p role="status" className="success" style={{ margin: 0, fontWeight: 700 }}>{t}</p>;

export function NoteForm({ action }: { action: Action }) {
  return (
    <ActionForm action={action} submitLabel="Add the note" submitClass="btn btn-plain" success={done}>
      <TextArea name="note" label="Add a note" mark={false} rows={3} hint="What happened or was said, and when." />
    </ActionForm>
  );
}

export function FlagForm({ action }: { action: Action }) {
  return (
    <ActionForm action={action} submitLabel="Add flag" submitClass="btn btn-plain" success={done}>
      <TextField name="label" label="Name to recognise it by" mark={false} />
      <div className="grid-2">
        <TextField name="email" type="email" label="Email" optional />
        <TextField name="phone" type="tel" label="Mobile" optional />
      </div>
      <Choices type="radio" name="reason" legend="Reason" mark={false} choices={[
        { value: 'eligibility_concern', label: 'Eligibility concern' },
        { value: 'repeat_duplicates', label: 'Repeated duplicate bookings' },
        { value: 'other', label: 'Other' },
      ]} />
      <TextArea name="note" label="What happened" mark={false} rows={3}
        hint="What was said or done, never a guess from how someone looks." />
    </ActionForm>
  );
}
