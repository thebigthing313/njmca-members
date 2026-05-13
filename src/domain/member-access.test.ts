import { describe, expect, it } from 'vitest';

import {
  type AuthenticatedUser,
  type MemberRecord,
  resolveMemberAccess,
} from './member-access';
import { normalizeEmail } from './normalization';

const activeUser: AuthenticatedUser = {
  id: 'user-1',
  email: ' Member@One.Test ',
  name: 'Member One',
};

const activeMember: MemberRecord = {
  id: 'member-1',
  userId: 'user-1',
  firstName: 'Member',
  lastName: 'One',
  email: 'member@one.test',
  emailNormalized: normalizeEmail('member@one.test'),
  isActive: true,
};

describe('resolveMemberAccess', () => {
  it('requires an authenticated BetterAuth user', () => {
    expect(resolveMemberAccess(null, null)).toEqual({
      status: 'unauthenticated',
    });
  });

  it('blocks authenticated users without a member record', () => {
    expect(resolveMemberAccess(activeUser, null)).toMatchObject({
      status: 'blocked',
      reason: 'missing_member',
    });
  });

  it('blocks inactive members even when the user link and email match', () => {
    expect(
      resolveMemberAccess(activeUser, { ...activeMember, isActive: false }),
    ).toMatchObject({
      status: 'blocked',
      reason: 'inactive_member',
    });
  });

  it('blocks active members that are not linked to the authenticated user', () => {
    expect(
      resolveMemberAccess(activeUser, { ...activeMember, userId: null }),
    ).toMatchObject({
      status: 'blocked',
      reason: 'unlinked_member',
    });
  });

  it('blocks active linked members when normalized email no longer matches', () => {
    expect(
      resolveMemberAccess(activeUser, {
        ...activeMember,
        emailNormalized: normalizeEmail('someone-else@one.test'),
      }),
    ).toMatchObject({
      status: 'blocked',
      reason: 'email_mismatch',
    });
  });

  it('allows active linked members with matching normalized email', () => {
    expect(resolveMemberAccess(activeUser, activeMember)).toMatchObject({
      status: 'active',
      permissions: [],
    });
  });
});

describe('normalizeEmail', () => {
  it('trims and lowercases only', () => {
    expect(normalizeEmail('  First.Last+Tag@Example.COM  ')).toBe(
      'first.last+tag@example.com',
    );
  });
});
