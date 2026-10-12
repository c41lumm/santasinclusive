import { redirect } from 'next/navigation';

/** Booking starts on the homepage, as in the design; this keeps older links working */
export default async function Book({ searchParams }: { searchParams: Promise<{ day?: string }> }) {
  const { day } = await searchParams;
  redirect(day && /^\d{4}-\d{2}-\d{2}$/.test(day) ? `/?day=${day}#book` : '/#book');
}
