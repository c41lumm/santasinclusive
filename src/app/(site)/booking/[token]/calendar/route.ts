import { getBooking } from '@/lib/public-data';
import { site } from '@/lib/site';

/** "Add to calendar": an .ics file for the visit, which phones and email apps open in their calendar */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const b = await getBooking(token);
  if (!b || !['confirmed', 'pending_review'].includes(b.status)) return new Response('Not found', { status: 404 });
  const url = `${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/booking/${token}`;
  const esc = (s: string) => s.replace(/[\\,;]/g, (c) => `\\${c}`);
  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Santas Inclusive Grotto//Booking//EN', 'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${b.reference}@santasinclusivegrotto`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '')}`,
    `DTSTART:${b.starts_utc}`, `DTEND:${b.ends_utc}`,
    `SUMMARY:${esc("Visit to Santa's Inclusive Grotto")}`,
    `LOCATION:${esc(site.address)}`,
    `DESCRIPTION:${esc(`Reference ${b.reference}. See or change your booking: ${url}`)}`,
    'END:VEVENT', 'END:VCALENDAR', '',
  ].join('\r\n');
  return new Response(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="santa-visit-${b.reference}.ics"`,
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
    },
  });
}
