'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export type NavItem = { href: string; label: string };

export function AdminNav({ items }: { items: NavItem[] }) {
  const path = usePathname();
  return (
    <nav aria-label="Admin">
      {items.map((i) => {
        const current = i.href === '/admin' ? path === '/admin' : path.startsWith(i.href);
        return <Link key={i.href} href={i.href} aria-current={current ? 'page' : undefined}>{i.label}</Link>;
      })}
    </nav>
  );
}
