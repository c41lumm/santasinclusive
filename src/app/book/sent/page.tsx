import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Check your messages' };

const names: Record<string, string> = { email: 'email', sms: 'texts', whatsapp: 'WhatsApp' };

/** The same page whatever happened, so it never reveals whether someone had already booked */
export default async function Sent({ searchParams }: { searchParams: Promise<{ via?: string }> }) {
  const { via = '' } = await searchParams;
  const where = via.split(',').map((c) => names[c]).filter(Boolean);
  const list = where.length > 1 ? `${where.slice(0, -1).join(', ')} and ${where.at(-1)}` : where[0] ?? 'messages';
  return (
    <div className="content">
      <ol className="steps" aria-label="Booking steps">
        <li>1. Choose a time</li>
        <li>2. Who is coming</li>
        <li aria-current="step">3. Check your messages</li>
      </ol>
      <div className="success" role="status">
        <h1>Thank you. Please check your {list}.</h1>
        <p>We have sent the details of your visit, with your own link to look at or change it.</p>
      </div>
      <h2>What happens next</h2>
      <ol>
        <li>Use the link in our message to tell Santa about your visitors. It takes about five minutes and makes a big difference.</li>
        <li>We will remind you a week before, and ask you to confirm two days before.</li>
        <li>If you need to change or cancel, use the same link. Your time then goes to a family on the waitlist.</li>
      </ol>
      <p>
        Nothing arrived after 15 minutes? Check your spam folder. If it is still not there, please{' '}
        <Link href="/privacy#contact">contact us</Link>.
      </p>
    </div>
  );
}
