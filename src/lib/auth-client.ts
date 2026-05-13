import { createAuthClient } from 'better-auth/react';
import { emailOTPClient } from 'better-auth/client/plugins';

type AuthClientResult = Promise<{
  error?: {
    message?: string | null;
  } | null;
}>;

type AuthClient = {
  emailOtp: {
    requestPasswordReset: (input: { email: string }) => AuthClientResult;
    resetPassword: (input: {
      email: string;
      otp: string;
      password: string;
    }) => AuthClientResult;
  };
  signIn: {
    email: (input: {
      email: string;
      password: string;
      callbackURL?: string;
    }) => AuthClientResult;
  };
  signUp: {
    email: (input: {
      email: string;
      password: string;
      name: string;
      callbackURL?: string;
    }) => AuthClientResult;
  };
};

export const authClient = createAuthClient({
  plugins: [emailOTPClient()],
}) as unknown as AuthClient;
