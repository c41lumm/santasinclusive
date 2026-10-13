import type { Metadata } from 'next';
import { requireStaff } from '@/lib/auth/staff';
import { signOut } from '../(site)/staff/actions';
import { AdminNav, type NavItem } from './admin-nav';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: { default: 'Grotto admin', template: '%s | Grotto admin' }, robots: { index: false } };

// Lead elves run the day (bookings, toys, rota); the rest is admin-only, and the database enforces the same
const adminOnly = new Set(['/admin/checks', '/admin/times', '/admin/waitlist', '/admin/groups', '/admin/alerts', '/admin/messages', '/admin/volunteers', '/admin/sponsorship']);
const items: NavItem[] = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/bookings', label: 'Bookings' },
  { href: '/admin/checks', label: 'Checks' },
  { href: '/admin/times', label: 'Visit times' },
  { href: '/admin/waitlist', label: 'Waitlist' },
  { href: '/admin/groups', label: 'Group enquiries' },
  { href: '/admin/alerts', label: 'Early alerts' },
  { href: '/admin/messages', label: 'Messages' },
  { href: '/admin/toys', label: 'Toy stock' },
  { href: '/admin/rota', label: 'Staff rota' },
  { href: '/admin/volunteers', label: 'Volunteers' },
  { href: '/admin/sponsorship', label: 'Sponsorship' },
];

/** The admin area: admins and lead elves. Pages marked admin-only check that again themselves. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const me = await requireStaff(['admin', 'lead_elf']);
  const visible = items.filter((i) => me.role === 'admin' || !adminOnly.has(i.href));
  return (
    <div className="admin">
      <a className="skip-link" href="#admin-main">Skip to main content</a>
      <aside className="admin-side">
        <p className="brand">Grotto admin</p>
        <p className="sub">Santa&apos;s Inclusive Grotto</p>
        <AdminNav items={visible} />
        <div className="me">
          <p style={{ margin: 0 }}>Signed in as {me.name}</p>
          <form action={signOut}><button type="submit" className="link-button">Sign out</button></form>
        </div>
      </aside>
      <main id="admin-main" className="admin-main" tabIndex={-1}>{children}</main>
    </div>
  );
}
