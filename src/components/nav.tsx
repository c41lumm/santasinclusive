'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

const links = [
  { href: '/#expect', label: 'What to expect' },
  { href: '/#book', label: 'Booking' },
  { href: '/#visit', label: 'Finding us' },
  { href: '/groups', label: 'Schools and groups' },
  { href: '/#help', label: 'Get involved' },
];

/**
 * When booking is closed, "Booking" and "Book a visit" are swapped for "Get an alert".
 * On phones the links fold behind a "Menu" button, with the main button kept beside the logo.
 */
export function Nav({ bookingOpen }: { bookingOpen: boolean }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [path]);
  const cta = bookingOpen
    ? <Link className="btn" href="/#book" onClick={() => setOpen(false)}>Book a visit</Link>
    : <Link className="btn" href="/#alerts" onClick={() => setOpen(false)}>Get an alert</Link>;
  return (
    <nav aria-label="Main">
      <div className="nav-bar">
        {cta}
        <button type="button" className="menu-toggle" aria-expanded={open} aria-controls="main-menu" onClick={() => setOpen((o) => !o)}>
          {open ? 'Close' : 'Menu'}
        </button>
      </div>
      <ul id="main-menu" className={open ? 'open' : undefined}>
        {links.filter((l) => bookingOpen || l.href !== '/#book').map((l) => (
          <li key={l.href}>
            <Link href={l.href} onClick={() => setOpen(false)}
              aria-current={!l.href.includes('#') && path.startsWith(l.href) ? 'page' : undefined}>{l.label}</Link>
          </li>
        ))}
        <li className="nav-cta">{cta}</li>
      </ul>
    </nav>
  );
}
