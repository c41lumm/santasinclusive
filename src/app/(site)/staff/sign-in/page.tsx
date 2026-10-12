import type { Metadata } from 'next';
import { SignInForm } from '../staff-forms';

export const metadata: Metadata = { title: 'Staff sign in' };

const notes: Record<string, string> = {
  password: 'Your new password is saved. Please sign in.',
  'signed-out': 'You have signed out.',
};

export default async function SignIn({ searchParams }: { searchParams: Promise<{ done?: string }> }) {
  const { done } = await searchParams;
  return (
    <>
      <p className="eyebrow">Grotto team</p>
      <h1 className="green" style={{ fontSize: '2rem' }}>Staff sign in</h1>
      {done && notes[done] ? <div className="success" role="status"><p>{notes[done]}</p></div> : null}
      <SignInForm />
    </>
  );
}
