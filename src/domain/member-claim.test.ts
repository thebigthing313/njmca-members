import { describe, expect, it } from 'vitest';

import type { MemberRecord } from './member-access';
import { resolveMemberClaimEligibility } from './member-claim';
import { normalizeEmail } from './normalization';

const claimableMember: MemberRecord = {
  id: 'member-claimable',
  userId: null,
  firstName: 'Casey',
  lastName: 'Claimable',
  email: 'casey.claimable@njmca.test',
  emailNormalized: normalizeEmail('casey.claimable@njmca.test'),
  isActive: true,
};

describe('resolveMemberClaimEligibility', () => {
  it('requires exactly one matching member', () => {
    expect(resolveMemberClaimEligibility('nobody@njmca.test', [])).toEqual({
      ok: false,
      emailNormalized: 'nobody@njmca.test',
      reason: 'no_matching_member',
    });

    expect(
      resolveMemberClaimEligibility('casey.claimable@njmca.test', [
        claimableMember,
        { ...claimableMember, id: 'member-duplicate' },
      ]),
    ).toMatchObject({
      ok: false,
      reason: 'multiple_matching_members',
    });
  });

  it('blocks inactive members', () => {
    expect(
      resolveMemberClaimEligibility('casey.claimable@njmca.test', [
        { ...claimableMember, isActive: false },
      ]),
    ).toMatchObject({
      ok: false,
      reason: 'inactive_member',
    });
  });

  it('blocks members that are already linked to an auth user', () => {
    expect(
      resolveMemberClaimEligibility('casey.claimable@njmca.test', [
        { ...claimableMember, userId: 'existing-user' },
      ]),
    ).toMatchObject({
      ok: false,
      reason: 'already_linked',
    });
  });

  it('allows active unlinked members with an authoritative email', () => {
    expect(
      resolveMemberClaimEligibility('  CASEY.CLAIMABLE@NJMCA.TEST  ', [
        claimableMember,
      ]),
    ).toMatchObject({
      ok: true,
      emailNormalized: 'casey.claimable@njmca.test',
      member: claimableMember,
    });
  });
});
