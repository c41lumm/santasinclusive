import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="content">
      <h1>We could not find that page</h1>
      <p>
        If you followed a link from one of our messages, please use the link in your most recent message, as it may have
        changed. If it still does not work, <Link href="/privacy#contact">contact us</Link> and we will help.
      </p>
      <p><Link href="/">Go to the homepage</Link></p>
    </div>
  );
}
