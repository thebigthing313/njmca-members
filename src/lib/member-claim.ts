import { createServerFn } from '@tanstack/react-start';
import { getRequestHeaders } from '@tanstack/react-start/server';

import { resolveMemberClaimEligibility } from '../domain/member-claim';
import { normalizeEmail } from '../domain/normalization';
import {
  createVerifiedMemberClaim,
  findMembersByNormalizedEmail,
  linkVerifiedMemberClaim,
} from '../server/member-repository';
import { auth } from '../server/auth';

type ClaimRequestInput = {
  email: string;
};

type ClaimVerifyInput = {
  email: string;
  otp: string;
};

type CompleteClaimInput = {
  claimId: string;
};

export const requestMemberClaimOtp = createServerFn({ method: 'POST' })
  .validator((input: ClaimRequestInput) => input)
  .handler(async ({ data }) => {
    const eligibility = await getClaimEligibility(data.email);

    if (!eligibility.ok) {
      return eligibility;
    }

    await auth.api.sendVerificationOTP({
      body: {
        email: eligibility.emailNormalized,
        type: 'email-verification',
      },
    });

    return {
      ok: true as const,
      emailNormalized: eligibility.emailNormalized,
    };
  });

export const verifyMemberClaimOtp = createServerFn({ method: 'POST' })
  .validator((input: ClaimVerifyInput) => input)
  .handler(async ({ data }) => {
    const eligibility = await getClaimEligibility(data.email);

    if (!eligibility.ok) {
      return eligibility;
    }

    await auth.api.checkVerificationOTP({
      body: {
        email: eligibility.emailNormalized,
        type: 'email-verification',
        otp: data.otp,
      },
    });

    const claimId = await createVerifiedMemberClaim({
      memberId: eligibility.member.id,
      emailNormalized: eligibility.emailNormalized,
    });

    return {
      ok: true as const,
      claimId,
      emailNormalized: eligibility.emailNormalized,
    };
  });

export const completeMemberClaim = createServerFn({ method: 'POST' })
  .validator((input: CompleteClaimInput) => input)
  .handler(async ({ data }) => {
    const headers = getRequestHeaders();
    const session = await auth.api.getSession({ headers });

    if (!session?.user.email) {
      return { ok: false as const, reason: 'unauthenticated' as const };
    }

    return linkVerifiedMemberClaim({
      claimId: data.claimId,
      userId: session.user.id,
      userEmail: session.user.email,
    });
  });

async function getClaimEligibility(email: string) {
  const matches = await findMembersByNormalizedEmail(normalizeEmail(email));

  return resolveMemberClaimEligibility(email, matches);
}
