import { NextResponse } from 'next/server';
import { requireStaff } from '@/lib/auth/staff';
import { attachmentUrl } from '@/lib/admin/inbox';

/** Sends an admin to a fresh download link for an attachment (Resend's links expire) */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string; aid: string }> }) {
  await requireStaff(['admin']);
  const { id, aid } = await params;
  const url = await attachmentUrl(id, aid);
  return url ? NextResponse.redirect(url) : new NextResponse('That attachment could not be found.', { status: 404 });
}
