import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { Atkinson_Hyperlegible, Fredoka } from 'next/font/google';
import { Nav } from '@/components/nav';
import { site } from '@/lib/site';
import './globals.css';

// Body text in Atkinson Hyperlegible, designed for readers with low vision; headings in Fredoka
const body = Atkinson_Hyperlegible({ subsets: ['latin'], weight: ['400', '700'], display: 'swap' });
const heading = Fredoka({ subsets: ['latin'], weight: ['500', '600', '700'], display: 'swap', variable: '--font-fredoka' });

export const metadata: Metadata = {
  title: { default: "Santa's Inclusive Grotto, Leicester", template: "%s | Santa's Inclusive Grotto" },
  description: 'A calm Christmas grotto made only for children and adults with disabilities, and the families who love them. Free, in Leicester city centre.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" className={`${body.className} ${heading.variable}`}>
      <body>
        <a className="skip-link" href="#main">Skip to main content</a>
        <header className="site-header">
          <div className="wrap">
            <Link href="/" className="logo">
              <Image src="/images/logo.png" alt="Santa's Inclusive Grotto, home" width={168} height={54} priority />
            </Link>
            <Nav />
          </div>
        </header>
        <main id="main" tabIndex={-1}>{children}</main>
        <footer className="site-footer">
          <div className="wrap">
            <div className="footer-id">
              <Image src="/images/badge.png" alt="" width={72} height={72} />
              <div>
                <p><strong>{site.name}</strong></p>
                <p className="small" style={{ color: '#fff' }}>{site.address}</p>
                <p className="small" style={{ color: '#fff' }}>Run by {site.company}.{site.companyNumber ? ` ${site.companyNumber}.` : ''}</p>
              </div>
            </div>
            <div className="footer-links">
              <p className="title">Stay in touch</p>
              <a href={site.instagram.url}>Follow us on Instagram {site.instagram.handle}</a>
              <p className="row">
                {site.contactEmail ? <><a href={`mailto:${site.contactEmail}`}>{site.contactEmail}</a><span aria-hidden="true">·</span></> : null}
                <Link href="/privacy">Privacy</Link><span aria-hidden="true">·</span>
                <Link href="/accessibility">Accessibility statement</Link>
              </p>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
