'use client';
import { ActionForm, TextField } from '@/components/form';
import type { FormState } from '@/lib/forms';

/** "Send again" under a message, with the address or number ready to correct if it was mistyped */
export function ResendForm({ id, channel, recipient, action }: {
  id: string; channel: string; recipient: string; action: (prev: FormState, fd: FormData) => Promise<FormState>;
}) {
  const email = channel === 'email';
  return (
    <details className="resend">
      <summary>Send again</summary>
      <ActionForm action={action} submitLabel="Send again" submitClass="btn btn-sm"
        success={(t) => <p role="status" className="tag tag-green" style={{ margin: '6px 0 0' }}>{t}</p>}>
        <TextField name="to" id={`to-${id}`} label={email ? 'Email address' : 'Mobile number'} defaultValue={recipient}
          type={email ? 'email' : 'tel'} inputMode={email ? 'email' : 'tel'} autoComplete="off" spellCheck={false} mark={false}
          hint="Change it if it was mistyped." />
      </ActionForm>
    </details>
  );
}
