import 'server-only';
import { neon, type NeonQueryFunctionInTransaction, type NeonQueryPromise } from '@neondatabase/serverless';
import { auth } from '@/lib/auth/server';

/**
 * The server's own connection: scheduled jobs, the booking form, sending messages. It runs as the database
 * owner with no request role, which is_server() in the database recognises. Never use it with input that
 * decides which family's or child's details are returned, except through the database functions.
 */
export function db() {
  return neon(process.env.DATABASE_URL!);
}

type Queries = (sql: NeonQueryFunctionInTransaction<false, false>) => NeonQueryPromise<false, false>[];
type Who = { role: 'anon' } | { role: 'authenticated'; userId: string };

/**
 * Runs queries as a public visitor or a signed-in staff member, so row level security and function
 * permissions apply. The role and claims are set inside one transaction and end with it.
 */
async function asRole(who: Who, queries: Queries) {
  const claims = JSON.stringify(who.role === 'anon' ? { role: 'anon' } : { role: 'authenticated', sub: who.userId });
  const results = await db().transaction((sql) => [
    sql`select set_config('request.jwt.claims', ${claims}, true)`,
    who.role === 'anon' ? sql`set local role anon` : sql`set local role authenticated`,
    ...queries(sql),
  ]);
  return results.slice(2) as Record<string, unknown>[][];
}

/** Public pages: the time picker and the cancel, claim and confirm links */
export function asPublic(queries: Queries) {
  return asRole({ role: 'anon' }, queries);
}

/** Admin, elf app and Santa's view: the signed-in staff member, limited by their role in the staff table */
export async function asStaff(queries: Queries) {
  const { data: session } = await auth.getSession();
  if (!session?.user) throw new Error('NOT_SIGNED_IN');
  return asRole({ role: 'authenticated', userId: session.user.id }, queries);
}
