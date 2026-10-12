import 'server-only';
import { checkBotId } from 'botid/server';
import { callerIp, withinLimit } from '@/lib/rate-limit';
import { messages, problem, type FormState } from '@/lib/forms';

/**
 * The checks every public form runs before touching the database: Vercel BotID (invisible, it never shows a
 * challenge), then a limit per connection. Returns the problem to show, or null to carry on.
 * The form's page must be listed in src/instrumentation-client.ts, or BotID cannot check it.
 */
export async function checkPublicForm(form: string, max = 5, windowSeconds = 60 * 60): Promise<FormState | null> {
  const { isBot } = await checkBotId();
  if (isBot) return problem(messages.NOT_VERIFIED);
  const ip = await callerIp();
  if (!(await withinLimit(`${form}:ip:${ip ?? 'unknown'}`, max, windowSeconds))) return problem(messages.TOO_MANY);
  return null;
}
