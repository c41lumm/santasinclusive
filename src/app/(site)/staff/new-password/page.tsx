import type { Metadata } from 'next';
import Link from 'next/link';
import { NewPasswordForm } from '../staff-forms';

export const metadata: Metadata = { title: 'Choose a password', referrer: 'no-referrer' };

export default async function NewPassword({ searchParams }: { searchParams: Promise<{ token?: string; error?: string }> }) {
  const { token, error } = await searchParams;
  return (
    <>
      <p className="eyebrow">Grotto team</p>
      <h1 className="green" style={{ fontSize: '2rem' }}>Choose a password</h1>
      {!token || error ? (
        <>
          <p>This link has expired or been used.</p>
          <Link className="btn" href="/staff/reset">Ask for a new link</Link>
        </>
      ) : <NewPasswordForm token={token} />}
    </>
  );
}
