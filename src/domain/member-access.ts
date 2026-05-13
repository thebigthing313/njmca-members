import { normalizeEmail } from './normalization';

export type AuthenticatedUser = {
  id: string;
  email: string;
  name: string | null;
};

export type MemberRecord = {
  id: string;
  userId: string | null;
  firstName: string;
  lastName: string;
  email: string | null;
  emailNormalized: string | null;
  isActive: boolean;
};

export type MemberAccess =
  | {
      status: 'unauthenticated';
    }
  | {
      status: 'blocked';
      reason:
        | 'missing_member'
        | 'inactive_member'
        | 'unlinked_member'
        | 'email_mismatch';
      user: AuthenticatedUser;
      member: MemberRecord | null;
    }
  | {
      status: 'active';
      user: AuthenticatedUser;
      member: MemberRecord;
      permissions: string[];
    };

export function resolveMemberAccess(
  user: AuthenticatedUser | null,
  member: MemberRecord | null,
  permissions: string[] = [],
): MemberAccess {
  if (!user) {
    return { status: 'unauthenticated' };
  }

  if (!member) {
    return { status: 'blocked', reason: 'missing_member', user, member };
  }

  if (!member.isActive) {
    return { status: 'blocked', reason: 'inactive_member', user, member };
  }

  if (member.userId !== user.id) {
    return { status: 'blocked', reason: 'unlinked_member', user, member };
  }

  if (
    !member.emailNormalized ||
    member.emailNormalized !== normalizeEmail(user.email)
  ) {
    return { status: 'blocked', reason: 'email_mismatch', user, member };
  }

  return { status: 'active', user, member, permissions };
}

export function getMemberDisplayName(member: MemberRecord) {
  return `${member.firstName} ${member.lastName}`;
}
