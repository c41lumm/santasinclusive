import Image from 'next/image';
import Link from 'next/link';
import { Nav } from '@/components/nav';
import { site } from '@/lib/site';

/** The public site: header with the logo and menu, and the green footer */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
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
    </>
  );
}
