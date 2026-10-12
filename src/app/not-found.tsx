import Link from 'next/link';
import { site } from '@/lib/site';

export default function NotFound() {
  return (
    <div className="narrow page"><div className="card card-lg">
      <h1 className="green" style={{ fontSize: '2rem' }}>We could not find that page</h1>
      <p>
        If you followed a link from one of our messages, please use the link in your most recent message, as it may have
        changed.{site.contactEmail ? <> If it still does not work, email <a href={`mailto:${site.contactEmail}`}>{site.contactEmail}</a> and we will help.</> : null}
      </p>
      <Link className="btn" href="/">Go to the homepage</Link>
    </div></div>
  );
}
