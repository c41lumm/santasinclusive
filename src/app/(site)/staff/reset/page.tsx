import type { Metadata } from 'next';
import Link from 'next/link';
import { ResetForm } from '../staff-forms';

export const metadata: Metadata = { title: 'Set your password' };

export default function Reset() {
  return (
    <>
      <p className="eyebrow">Grotto team</p>
      <h1 className="green" style={{ fontSize: '2rem' }}>Set or reset your password</h1>
      <p>New to the team, or forgotten your password? We will email you a link to choose one.</p>
      <ResetForm />
      <p style={{ marginTop: 16, marginBottom: 0 }}><Link href="/staff/sign-in">Back to sign in</Link></p>
    </>
  );
}
