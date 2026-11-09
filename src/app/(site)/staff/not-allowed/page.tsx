import type { Metadata } from 'next';
import Link from 'next/link';
import { signOut } from '../actions';
import { ViewingAsBar } from '../../../admin/viewing-as-bar';

export const metadata: Metadata = { title: 'Not available' };

export default async function NotAllowed() {
  return (
    <>
      <ViewingAsBar />
      <h1 className="green" style={{ fontSize: '2rem' }}>This page is not available to you</h1>
      <p>Your account does not have access to this part of the admin area. If you think it should, ask the organiser to
        check your role.</p>
      <div className="btn-row">
        <Link className="btn btn-outline" href="/">Go to the homepage</Link>
        <form action={signOut}><button className="link-button" type="submit">Sign out</button></form>
      </div>
    </>
  );
}
