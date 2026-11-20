'use client';
import { useEffect, useState } from 'react';
import { ActionForm, TextField } from '@/components/form';
import { requestTextCode, signInWithCode } from '../../actions';

/** Two steps: the mobile number, then the code from the text */
export function TextCodeForm() {
  const [phone, setPhone] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  if (sentTo) {
    return (
      <>
        <div className="success" role="status"><p style={{ margin: 0 }}>If {sentTo} belongs to a helper, we have texted it a code. It can take a minute to arrive.</p></div>
        <ActionForm action={signInWithCode} submitLabel="Sign in" block>
          <input type="hidden" name="phone" value={phone} />
          <TextField name="code" label="Code from the text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} width="short" mark={false} />
        </ActionForm>
        <p className="small" style={{ marginTop: 12 }}>
          <button type="button" className="link-button" onClick={() => setSentTo(null)}>Send another code, or use a different number</button>
        </p>
      </>
    );
  }
  return (
    <ActionForm action={requestTextCode} submitLabel="Text me a code" block success={(masked) => <Sent masked={masked} onSent={setSentTo} />}>
      <TextField name="phone" type="tel" label="Your mobile number" inputMode="tel" autoComplete="tel" mark={false} width="medium"
        value={phone} onChange={(e) => setPhone(e.currentTarget.value)} />
    </ActionForm>
  );
}

/** Moves on to the code step once the text has been asked for */
function Sent({ masked, onSent }: { masked: string; onSent: (m: string) => void }) {
  useEffect(() => { onSent(masked); }, [masked, onSent]);
  return null;
}
