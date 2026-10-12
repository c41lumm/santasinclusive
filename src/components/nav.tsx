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

export function Nav() {
  const path = usePathname();
  return (
    <nav aria-label="Main">
      <ul>
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} aria-current={!l.href.includes('#') && path.startsWith(l.href) ? 'page' : undefined}>{l.label}</Link>
          </li>
        ))}
        <li><Link className="btn" href="/#book">Book a visit</Link></li>
      </ul>
    </nav>
  );
}
