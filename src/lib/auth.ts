import { betterAuth } from 'better-auth';
import { emailOTP } from 'better-auth/plugins';
import { tanstackStartCookies } from 'better-auth/tanstack-start';

import { getDb } from '../server/db';
import { sendMemberVerificationOtp } from '../server/member-otp';

type AuthSession = {
  user: {
    id: string;
    email?: string;
    name?: string | null;
  };
} | null;

type AuthApi = {
  handler: (request: Request) => Promise<Response>;
  api: {
    getSession: (input: { headers: Headers }) => Promise<AuthSession>;
    sendVerificationOTP: (input: {
      body: {
        email: string;
        type: 'email-verification';
      };
    }) => Promise<unknown>;
    checkVerificationOTP: (input: {
      body: {
        email: string;
        type: 'email-verification';
        otp: string;
      };
    }) => Promise<unknown>;
  };
};

export const auth = betterAuth({
  appName: 'NJMCA Members',
  database: getDb(),
  emailAndPassword: {
    enabled: true,
  },
  plugins: [
    emailOTP({
      disableSignUp: true,
      overrideDefaultEmailVerification: true,
      sendVerificationOTP: sendMemberVerificationOtp,
    }),
    tanstackStartCookies(),
  ],
}) as unknown as AuthApi;
