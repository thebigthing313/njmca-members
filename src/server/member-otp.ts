type VerificationOtpInput = {
  email: string;
  otp: string;
  type: 'sign-in' | 'email-verification' | 'forget-password' | 'change-email';
};

export async function sendMemberVerificationOtp(input: VerificationOtpInput) {
  if (process.env.NODE_ENV !== 'production') {
    console.info(
      `[NJMCA OTP] ${input.type} for ${input.email}: ${input.otp}`,
    );
    return;
  }

  throw new Error(
    'Production OTP delivery is not configured. Add an email provider before enabling member claims in production.',
  );
}
