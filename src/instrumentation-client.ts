import { initBotId } from 'botid/client/core';

// Vercel BotID: the pages whose forms are checked for bots. A form's server action posts to its own page,
// so each page with a public form is listed here, and its action calls checkPublicForm().
initBotId({
  protect: ['/book/details', '/waitlist', '/alerts', '/groups', '/volunteer', '/support']
    .map((path) => ({ path, method: 'POST' as const })),
});
