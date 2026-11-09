import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireStaff } from '@/lib/auth/staff';
import { bookingSummary, isUuid } from '@/lib/admin/data';
import { db } from '@/lib/db';
import { visitWhen } from '@/lib/dates';
import { updateContact } from '../../actions';
import { ContactForm } from './contact-form';

export const metadata: Metadata = { title: 'Contact details' };

/** Change a booking's contact name, email, mobile and how they hear from us */
export default async function Contact({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff(['admin', 'lead_elf']);
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const b = await bookingSummary(id);
  if (!b) notFound();
  const [h] = await db()`
    select h.contact_name, h.email::text as email, h.phone, h.channels::text[] as channels
    from bookings bk join households h on h.id = bk.household_id where bk.id = ${id}::uuid` as
    { contact_name: string; email: string | null; phone: string | null; channels: string[] }[];
  const back = `/admin/bookings?day=${b.day}&sel=${id}`;
  return (
    <>
      <div className="admin-head">
        <div>
          <h1>Contact details</h1>
          <p>{b.names ?? b.contact_name ?? 'This booking'}, {visitWhen(b.day, b.t)}</p>
        </div>
        <Link className="btn btn-outline" href={back}>Back to bookings</Link>
      </div>
      <div className="a-panel" style={{ maxWidth: 620 }}>
        {h ? (
          <ContactForm action={updateContact.bind(null, id)} back={back} h={h} />
        ) : <p style={{ margin: 0 }}>This booking no longer has contact details. They are removed after the season ends.</p>}
      </div>
    </>
  );
}
