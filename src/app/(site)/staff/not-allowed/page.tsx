import type { Metadata } from 'next';
import Link from 'next/link';
import { signOut } from '../actions';
import { ViewingAsBar } from '../../../admin/viewing-as-bar';
import { viewingAs } from '@/lib/auth/staff';

export const metadata: Metadata = { title: 'Not available' };

export default async function NotAllowed() {
  const viewing = await viewingAs();
  return (
    <>
      <ViewingAsBar />
      <h1 className="green" style={{ fontSize: '2rem' }}>This page is not available to you</h1>
      <p>Your account does not have access to this part of the admin area. If you think it should, ask the organiser to
        check your role.</p>
      {viewing ? <p className="notice">This is what this helper sees when they sign in: elves and Santas do not have their own pages yet.</p> : null}
      <div className="btn-row">
        <Link className="btn btn-outline" href="/">Go to the homepage</Link>
        <form action={signOut}><button className="link-button" type="submit">Sign out</button></form>
      </div>
    </>
  );
}
