import { Resend } from 'resend';

type VerificationOtpInput = {
  email: string;
  otp: string;
  type: 'sign-in' | 'email-verification' | 'forget-password' | 'change-email';
};

let resend: Resend | null = null;

export async function sendMemberVerificationOtp(input: VerificationOtpInput) {
  if (process.env.NODE_ENV !== 'production') {
    console.info(
      `[NJMCA OTP] ${input.type} for ${input.email}: ${input.otp}`,
    );
    return;
  }

  const from = process.env.NJMCA_OTP_FROM_EMAIL;

  if (!from) {
    throw new Error('NJMCA_OTP_FROM_EMAIL is required for OTP delivery.');
  }

  const { error } = await getResend().emails.send({
    from,
    to: input.email,
    subject: getOtpSubject(input.type),
    text: getOtpText(input),
    html: getOtpHtml(input),
  });

  if (error) {
    throw new Error(
      `Resend OTP delivery failed: ${error.message ?? 'Unknown error'}`,
    );
  }
}

function getResend() {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    throw new Error('RESEND_API_KEY is required for OTP delivery.');
  }

  resend ??= new Resend(apiKey);

  return resend;
}

function getOtpSubject(type: VerificationOtpInput['type']) {
  switch (type) {
    case 'forget-password':
      return 'Reset your NJMCA Members password';
    case 'change-email':
      return 'Confirm your NJMCA Members email change';
    default:
      return 'Your NJMCA Members verification code';
  }
}

function getOtpText(input: VerificationOtpInput) {
  return [
    'Use this verification code for NJMCA Members:',
    '',
    input.otp,
    '',
    'If you did not request this code, you can ignore this email.',
  ].join('\n');
}

function getOtpHtml(input: VerificationOtpInput) {
  const escapedOtp = escapeHtml(input.otp);

  return `
    <div>
      <p>Use this verification code for NJMCA Members:</p>
      <p style="font-size: 24px; font-weight: 700; letter-spacing: 4px;">${escapedOtp}</p>
      <p>If you did not request this code, you can ignore this email.</p>
    </div>
  `;
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
