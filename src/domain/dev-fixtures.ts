import type { AuthenticatedUser, MemberRecord } from './member-access';
import { normalizeEmail } from './normalization';
import { permissionKeys } from './permissions';

export type DevMemberFixture = {
  key: string;
  label: string;
  user: AuthenticatedUser;
  member: MemberRecord | null;
  permissions?: string[];
};

const activeEmail = 'active.member.test@njmca.test';
const inactiveEmail = 'inactive.member.test@njmca.test';
const mismatchUserEmail = 'changed.email.test@njmca.test';
const mismatchMemberEmail = 'old.email.test@njmca.test';

export const devMemberFixtures: DevMemberFixture[] = [
  {
    key: 'active-member',
    label: 'Active linked member',
    user: {
      id: 'dev-user-active-member',
      email: activeEmail,
      name: 'Avery Active',
    },
    member: {
      id: 'dev-member-active',
      userId: 'dev-user-active-member',
      firstName: 'Avery',
      lastName: 'Active',
      email: activeEmail,
      emailNormalized: normalizeEmail(activeEmail),
      isActive: true,
    },
    permissions: [
      permissionKeys.manageMembers,
      permissionKeys.manageOrganizations,
      permissionKeys.manageRoles,
    ],
  },
  {
    key: 'inactive-member',
    label: 'Inactive linked member',
    user: {
      id: 'dev-user-inactive-member',
      email: inactiveEmail,
      name: 'Indigo Inactive',
    },
    member: {
      id: 'dev-member-inactive',
      userId: 'dev-user-inactive-member',
      firstName: 'Indigo',
      lastName: 'Inactive',
      email: inactiveEmail,
      emailNormalized: normalizeEmail(inactiveEmail),
      isActive: false,
    },
  },
  {
    key: 'email-mismatch',
    label: 'Linked member with mismatched email',
    user: {
      id: 'dev-user-email-mismatch',
      email: mismatchUserEmail,
      name: 'Morgan Mismatch',
    },
    member: {
      id: 'dev-member-email-mismatch',
      userId: 'dev-user-email-mismatch',
      firstName: 'Morgan',
      lastName: 'Mismatch',
      email: mismatchMemberEmail,
      emailNormalized: normalizeEmail(mismatchMemberEmail),
      isActive: true,
    },
  },
  {
    key: 'missing-member',
    label: 'Authenticated user without member',
    user: {
      id: 'dev-user-missing-member',
      email: 'missing.member.test@njmca.test',
      name: 'Marlowe Missing',
    },
    member: null,
  },
];

export function findDevMemberFixture(key: string | null | undefined) {
  return devMemberFixtures.find((fixture) => fixture.key === key) ?? null;
}
