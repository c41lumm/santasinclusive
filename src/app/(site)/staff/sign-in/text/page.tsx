import type { Metadata } from 'next';
import Link from 'next/link';
import { TextCodeForm } from './text-code-form';

export const metadata: Metadata = { title: 'Sign in with a text code' };

export default function SignInByText() {
  return (
    <>
      <p className="eyebrow">Grotto team</p>
      <h1 className="green" style={{ fontSize: '2rem' }}>Sign in with a text code</h1>
      <p>For helpers who joined with their mobile number. We will text you a 6-digit code.</p>
      <TextCodeForm />
      <p className="small" style={{ marginTop: 16 }}><Link href="/staff/sign-in">Sign in with email and password instead</Link></p>
    </>
  );
}
