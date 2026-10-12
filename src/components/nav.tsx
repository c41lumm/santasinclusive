'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const links = [
  { href: '/#expect', label: 'What to expect' },
  { href: '/#book', label: 'Booking' },
  { href: '/#visit', label: 'Finding us' },
  { href: '/groups', label: 'Schools and groups' },
  { href: '/#help', label: 'Get involved' },
];

/** When booking is closed, "Booking" and "Book a visit" are swapped for "Get an alert" */
export function Nav({ bookingOpen }: { bookingOpen: boolean }) {
  const path = usePathname();
  return (
    <nav aria-label="Main">
      <ul>
        {links.filter((l) => bookingOpen || l.href !== '/#book').map((l) => (
          <li key={l.href}>
            <Link href={l.href} aria-current={!l.href.includes('#') && path.startsWith(l.href) ? 'page' : undefined}>{l.label}</Link>
          </li>
        ))}
        <li>{bookingOpen ? <Link className="btn" href="/#book">Book a visit</Link> : <Link className="btn" href="/#alerts">Get an alert</Link>}</li>
      </ul>
    </nav>
  );
}
