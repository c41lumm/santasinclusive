'use client';
import { useActionState } from 'react';
import { ActionForm, TextField } from '@/components/form';
import type { FormState } from '@/lib/forms';

type Action = (prev: FormState, fd: FormData) => Promise<FormState>;

/** One person's "Send" button in the list, with the result shown next to it */
export function SendOne({ action, name, told }: { action: Action; name: string; told: boolean }) {
  const [state, dispatch, pending] = useActionState(action, {});
  const error = state.errors?.[0]?.message;
  return (
    <form action={dispatch} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
      <button type="submit" className="btn btn-outline btn-sm" disabled={pending} aria-disabled={pending}
        aria-label={`${told ? 'Send again to' : 'Send to'} ${name}`}>
        {pending ? 'Sending…' : told ? 'Send again' : 'Send'}
      </button>
      <span role="status" className={error ? 'field-error' : 'muted'} style={{ margin: 0, fontSize: '0.9rem' }}>
        {error ?? (state.done && !pending ? state.done : '')}
      </span>
    </form>
  );
}

/** Send the alert to any email or mobile, to see exactly what people will get */
export function TestSend({ action }: { action: Action }) {
  return (
    <ActionForm action={action} submitLabel="Send test" submitClass="btn btn-outline"
      success={(t) => <div className="success"><p style={{ margin: 0 }}>{t}</p><p style={{ margin: 0 }}><a href="/admin/alerts">Send another test</a></p></div>}>
      <TextField name="to" label="Email or mobile to send the test to" width="medium" autoComplete="off" />
      <TextField name="name" label="Name to greet" optional width="medium" hint={'Shown as "Hi …" in the message, as it would be for each person.'} />
    </ActionForm>
  );
}
