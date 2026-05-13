import { Resend } from 'resend';

type VerificationOtpInput = {
  email: string;
  otp: string;
  type: 'sign-in' | 'email-verification' | 'forget-password' | 'change-email';
};

let resend: Resend | null = null;

export async function sendMemberVerificationOtp(input: VerificationOtpInput) {
  const deliveryMode = getEmailDeliveryMode();

  if (deliveryMode === 'console') {
    console.info(
      `[NJMCA OTP] ${input.type} for ${input.email}: ${input.otp}`,
    );
    return;
  }

  const recipient =
    deliveryMode === 'resend-test'
      ? (process.env.RESEND_TEST_RECIPIENT ?? 'delivered@resend.dev')
      : input.email;
  const from = process.env.NJMCA_OTP_FROM_EMAIL;

  if (!from) {
    throw new Error('NJMCA_OTP_FROM_EMAIL is required for OTP delivery.');
  }

  const { error } = await getResend().emails.send({
    from,
    to: recipient,
    subject: getOtpSubject(input.type, deliveryMode),
    text: getOtpText(input, deliveryMode),
    html: getOtpHtml(input, deliveryMode),
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

function getEmailDeliveryMode() {
  const configuredMode = process.env.NJMCA_EMAIL_DELIVERY;

  if (
    configuredMode === 'console' ||
    configuredMode === 'resend-test' ||
    configuredMode === 'resend'
  ) {
    return configuredMode;
  }

  return process.env.NODE_ENV === 'production' ? 'resend' : 'console';
}

function getOtpSubject(
  type: VerificationOtpInput['type'],
  deliveryMode: 'console' | 'resend-test' | 'resend',
) {
  const prefix = deliveryMode === 'resend-test' ? '[TEST] ' : '';

  switch (type) {
    case 'forget-password':
      return `${prefix}Reset your NJMCA Members password`;
    case 'change-email':
      return `${prefix}Confirm your NJMCA Members email change`;
    default:
      return `${prefix}Your NJMCA Members verification code`;
  }
}

function getOtpText(
  input: VerificationOtpInput,
  deliveryMode: 'console' | 'resend-test' | 'resend',
) {
  const lines = [
    'Use this verification code for NJMCA Members:',
    '',
    input.otp,
    '',
    'If you did not request this code, you can ignore this email.',
  ];

  if (deliveryMode === 'resend-test') {
    lines.push('', `Intended recipient: ${input.email}`);
  }

  return lines.join('\n');
}

function getOtpHtml(
  input: VerificationOtpInput,
  deliveryMode: 'console' | 'resend-test' | 'resend',
) {
  const escapedOtp = escapeHtml(input.otp);
  const intendedRecipient =
    deliveryMode === 'resend-test'
      ? `<p>Intended recipient: ${escapeHtml(input.email)}</p>`
      : '';

  return `
    <div>
      <p>Use this verification code for NJMCA Members:</p>
      <p style="font-size: 24px; font-weight: 700; letter-spacing: 4px;">${escapedOtp}</p>
      <p>If you did not request this code, you can ignore this email.</p>
      ${intendedRecipient}
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
