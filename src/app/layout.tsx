import type { Metadata } from 'next';
import Link from 'next/link';
import { Atkinson_Hyperlegible } from 'next/font/google';
import { Nav } from '@/components/nav';
import './globals.css';

// Designed for readers with low vision
const font = Atkinson_Hyperlegible({ subsets: ['latin'], weight: ['400', '700'], display: 'swap' });

export const metadata: Metadata = {
  title: { default: "Santa's Inclusive Grotto, Leicester", template: "%s | Santa's Inclusive Grotto" },
  description: 'A calm, unhurried visit to Santa for children and adults with disabilities and their families, in Leicester.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" className={font.className}>
      <body>
        <a className="skip-link" href="#main">Skip to main content</a>
        <header className="site-header">
          <div className="wrap">
            <Link href="/" className="site-name">
              <Star /> Santa&apos;s Inclusive Grotto
            </Link>
            <Nav />
          </div>
        </header>
        <main id="main" tabIndex={-1}>
          <div className="wrap">{children}</div>
        </main>
        <footer className="site-footer">
          <div className="wrap">
            <div>
              <p><strong>Santa&apos;s Inclusive Grotto</strong><br />20 Freeschool Lane, Leicester LE1 4FY</p>
              <p>For children and adults with disabilities, and their families.</p>
            </div>
            <ul>
              <li><Link href="/groups">Schools and groups</Link></li>
              <li><Link href="/volunteer">Volunteer</Link></li>
              <li><Link href="/support">Sponsor a gift</Link></li>
              <li><Link href="/privacy">Privacy</Link></li>
            </ul>
          </div>
        </footer>
      </body>
    </html>
  );
}

function Star() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="var(--gold)" d="M12 2l2.9 6.6 7.1.7-5.4 4.8 1.6 7-6.2-3.7-6.2 3.7 1.6-7L2 9.3l7.1-.7z" />
    </svg>
  );
}
