import type { MemberRecord } from './member-access';
import { normalizeEmail } from './normalization';

export type MemberClaimEligibility =
  | {
      ok: true;
      emailNormalized: string;
      member: MemberRecord;
    }
  | {
      ok: false;
      emailNormalized: string;
      reason:
        | 'no_matching_member'
        | 'multiple_matching_members'
        | 'inactive_member'
        | 'already_linked'
        | 'member_email_missing';
    };

export function resolveMemberClaimEligibility(
  email: string,
  matches: MemberRecord[],
): MemberClaimEligibility {
  const emailNormalized = normalizeEmail(email);

  if (matches.length === 0) {
    return { ok: false, emailNormalized, reason: 'no_matching_member' };
  }

  if (matches.length > 1) {
    return { ok: false, emailNormalized, reason: 'multiple_matching_members' };
  }

  const member = matches[0];

  if (!member.isActive) {
    return { ok: false, emailNormalized, reason: 'inactive_member' };
  }

  if (!member.emailNormalized) {
    return { ok: false, emailNormalized, reason: 'member_email_missing' };
  }

  if (member.userId) {
    return { ok: false, emailNormalized, reason: 'already_linked' };
  }

  return { ok: true, emailNormalized, member };
}
