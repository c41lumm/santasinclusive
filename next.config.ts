import type { NextConfig } from 'next';
import { withBotId } from 'botid/next/config';

const nextConfig: NextConfig = {};

// Routes BotID's script and checks through this site, so ad blockers do not stop it
export default withBotId(nextConfig);
