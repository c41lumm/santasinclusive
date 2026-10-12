'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const links = [
  { href: '/', label: 'Home' },
  { href: '/book', label: 'Book a visit' },
  { href: '/waitlist', label: 'Waitlist' },
  { href: '/groups', label: 'Schools and groups' },
  { href: '/volunteer', label: 'Volunteer' },
];

export function Nav() {
  const path = usePathname();
  return (
    <nav aria-label="Main">
      <ul>
        {links.map((l) => {
          const current = path === l.href || (l.href !== '/' && path.startsWith(`${l.href}/`));
          return <li key={l.href}><Link href={l.href} aria-current={current ? 'page' : undefined}>{l.label}</Link></li>;
        })}
      </ul>
    </nav>
  );
}
