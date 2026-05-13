import { betterAuth } from 'better-auth';
import { tanstackStartCookies } from 'better-auth/tanstack-start';

import { getDb } from '../server/db';

export const auth = betterAuth({
  appName: 'NJMCA Members',
  database: getDb(),
  emailAndPassword: {
    enabled: true,
  },
  plugins: [tanstackStartCookies()],
});
