import { describe, expect, it } from 'vitest';

import { getEffectivePermissions, permissionKeys } from './permissions';

const rolePermissions = [
  {
    roleKey: 'webmaster',
    permissionKey: permissionKeys.manageMembers,
  },
  {
    roleKey: 'webmaster',
    permissionKey: permissionKeys.manageOrganizations,
  },
  {
    roleKey: 'secretary',
    permissionKey: permissionKeys.manageMembers,
  },
] as const;

describe('getEffectivePermissions', () => {
  it('grants permissions for active role assignments', () => {
    expect(
      getEffectivePermissions({
        memberIsActive: true,
        memberUserId: 'user-1',
        memberEmailNormalized: 'member@njmca.test',
        roleAssignments: [
          { roleKey: 'webmaster', startsOn: '2026-01-01', endsOn: null },
        ],
        rolePermissions,
        today: '2026-05-13',
      }),
    ).toEqual([permissionKeys.manageMembers, permissionKeys.manageOrganizations]);
  });

  it('does not grant permissions for inactive, unlinked, or no-email members', () => {
    const baseInput = {
      roleAssignments: [
        { roleKey: 'webmaster', startsOn: null, endsOn: null },
      ],
      rolePermissions,
      today: '2026-05-13',
    };

    expect(
      getEffectivePermissions({
        ...baseInput,
        memberIsActive: false,
        memberUserId: 'user-1',
        memberEmailNormalized: 'member@njmca.test',
      }),
    ).toEqual([]);
    expect(
      getEffectivePermissions({
        ...baseInput,
        memberIsActive: true,
        memberUserId: null,
        memberEmailNormalized: 'member@njmca.test',
      }),
    ).toEqual([]);
    expect(
      getEffectivePermissions({
        ...baseInput,
        memberIsActive: true,
        memberUserId: 'user-1',
        memberEmailNormalized: null,
      }),
    ).toEqual([]);
  });

  it('respects inclusive assignment date boundaries', () => {
    expect(
      getEffectivePermissions({
        memberIsActive: true,
        memberUserId: 'user-1',
        memberEmailNormalized: 'member@njmca.test',
        roleAssignments: [
          {
            roleKey: 'secretary',
            startsOn: '2026-05-13',
            endsOn: '2026-05-13',
          },
        ],
        rolePermissions,
        today: '2026-05-13',
      }),
    ).toEqual([permissionKeys.manageMembers]);
  });

  it('ignores expired and future role assignments', () => {
    expect(
      getEffectivePermissions({
        memberIsActive: true,
        memberUserId: 'user-1',
        memberEmailNormalized: 'member@njmca.test',
        roleAssignments: [
          {
            roleKey: 'webmaster',
            startsOn: '2026-01-01',
            endsOn: '2026-05-12',
          },
          {
            roleKey: 'secretary',
            startsOn: '2026-05-14',
            endsOn: null,
          },
        ],
        rolePermissions,
        today: '2026-05-13',
      }),
    ).toEqual([]);
  });
});
