import { NextResponse, type NextRequest } from 'next/server';
import { auth } from '@/lib/auth/server';

// The admin area needs a signed-in staff member. Which pages each role can see is checked on the page itself.
const protect = auth.middleware({ loginUrl: '/staff/sign-in' });

export default function proxy(req: NextRequest) {
  // Development-only shortcut for testing (see src/lib/auth/staff.ts); never applies to a production build
  if (process.env.NODE_ENV === 'development' && process.env.DEV_STAFF_USER_ID) return NextResponse.next();
  return protect(req);
}

export const config = { matcher: ['/admin/:path*'] };
