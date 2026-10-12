import type { Metadata } from 'next';

export const metadata: Metadata = { robots: { index: false } };

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return <div className="narrow page" style={{ maxWidth: 520 }}><div className="card card-lg">{children}</div></div>;
}
