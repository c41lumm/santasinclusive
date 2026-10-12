import 'server-only';
import { isHuman } from '@/lib/turnstile';
import { callerIp, withinLimit } from '@/lib/rate-limit';
import { messages, problem, type FormState } from '@/lib/forms';

/**
 * The checks every public form runs before touching the database: Cloudflare Turnstile, then a limit per
 * connection. Returns the problem to show, or null to carry on.
 */
export async function checkPublicForm(fd: FormData, form: string, max = 5, windowSeconds = 60 * 60): Promise<FormState | null> {
  const ip = await callerIp();
  if (!(await isHuman(fd.get('cf-turnstile-response')?.toString(), ip))) return problem(messages.NOT_VERIFIED);
  if (!(await withinLimit(`${form}:ip:${ip ?? 'unknown'}`, max, windowSeconds))) return problem(messages.TOO_MANY);
  return null;
}
