'use client';
import Link from 'next/link';
import { ActionForm, TextField } from '@/components/form';
import { requestReset, setNewPassword, signIn } from './actions';

export function SignInForm() {
  return (
    <ActionForm action={signIn} submitLabel="Sign in" block>
      <TextField name="email" type="email" label="Email address" autoComplete="username" mark={false} />
      <TextField name="password" type="password" label="Password" autoComplete="current-password" mark={false} />
      <p style={{ margin: '0 0 8px' }}><Link href="/staff/reset">Set or reset your password</Link></p>
    </ActionForm>
  );
}

export function ResetForm() {
  return (
    <ActionForm action={requestReset} submitLabel="Email me a link" block
      success={(email) => (
        <div className="success" style={{ margin: 0 }}>
          <p>If {email} has a staff account, we have emailed it a link to set a new password. The link works once and expires
            soon. Check your spam folder if it does not arrive.</p>
        </div>
      )}>
      <TextField name="email" type="email" label="Email address" autoComplete="username" mark={false} />
    </ActionForm>
  );
}

export function NewPasswordForm({ token }: { token: string }) {
  return (
    <ActionForm action={setNewPassword} submitLabel="Save my new password" block>
      <input type="hidden" name="token" value={token} />
      <TextField name="password" type="password" label="New password" autoComplete="new-password" mark={false}
        hint="At least 10 characters. A few random words together is easy to remember and hard to guess." />
      <TextField name="confirm" type="password" label="Type it again" autoComplete="new-password" mark={false} />
    </ActionForm>
  );
}
