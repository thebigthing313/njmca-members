import { describe, expect, it } from 'vitest';

import {
  dateWindowsOverlap,
  getNewYorkLocalDate,
  validateRoleAssignment,
  type RoleAssignmentWindow,
} from './role-assignments';

const singleRole = {
  id: 'role-president',
  assignmentMode: 'single' as const,
};

const multipleRole = {
  id: 'role-trustee',
  assignmentMode: 'multiple' as const,
};

describe('validateRoleAssignment', () => {
  it('rejects overlapping assignments for the same member and role', () => {
    const existingAssignments: RoleAssignmentWindow[] = [
      assignment({
        id: 'existing-assignment',
        memberId: 'member-1',
        roleId: multipleRole.id,
        startsOn: '2026-01-01',
        endsOn: '2026-06-30',
      }),
    ];

    expect(
      validateRoleAssignment({
        assignment: assignment({
          memberId: 'member-1',
          roleId: multipleRole.id,
          startsOn: '2026-06-01',
          endsOn: '2026-12-31',
        }),
        role: multipleRole,
        existingAssignments,
      }),
    ).toEqual({
      ok: false,
      reason: 'same_member_role_overlap',
      conflictingAssignmentId: 'existing-assignment',
    });
  });

  it('rejects overlapping single-assignment roles across members', () => {
    const existingAssignments: RoleAssignmentWindow[] = [
      assignment({
        id: 'existing-assignment',
        memberId: 'member-1',
        roleId: singleRole.id,
        startsOn: '2026-01-01',
        endsOn: null,
      }),
    ];

    expect(
      validateRoleAssignment({
        assignment: assignment({
          memberId: 'member-2',
          roleId: singleRole.id,
          startsOn: '2026-05-01',
          endsOn: '2026-09-30',
        }),
        role: singleRole,
        existingAssignments,
      }),
    ).toEqual({
      ok: false,
      reason: 'single_role_overlap',
      conflictingAssignmentId: 'existing-assignment',
    });
  });

  it('allows concurrent holders for multiple-assignment roles', () => {
    const existingAssignments: RoleAssignmentWindow[] = [
      assignment({
        memberId: 'member-1',
        roleId: multipleRole.id,
        startsOn: '2026-01-01',
        endsOn: null,
      }),
    ];

    expect(
      validateRoleAssignment({
        assignment: assignment({
          memberId: 'member-2',
          roleId: multipleRole.id,
          startsOn: '2026-05-01',
          endsOn: null,
        }),
        role: multipleRole,
        existingAssignments,
      }),
    ).toEqual({ ok: true });
  });

  it('treats touching range boundaries as overlapping', () => {
    expect(
      dateWindowsOverlap(
        { startsOn: '2026-01-01', endsOn: '2026-06-30' },
        { startsOn: '2026-06-30', endsOn: '2026-12-31' },
      ),
    ).toBe(true);
  });

  it('allows adjacent ranges when the next start is after the prior end', () => {
    expect(
      validateRoleAssignment({
        assignment: assignment({
          memberId: 'member-1',
          roleId: multipleRole.id,
          startsOn: '2026-07-01',
          endsOn: '2026-12-31',
        }),
        role: multipleRole,
        existingAssignments: [
          assignment({
            memberId: 'member-1',
            roleId: multipleRole.id,
            startsOn: '2026-01-01',
            endsOn: '2026-06-30',
          }),
        ],
      }),
    ).toEqual({ ok: true });
  });

  it('handles open-ended ranges as unbounded on either side', () => {
    expect(
      dateWindowsOverlap(
        { startsOn: null, endsOn: '2026-05-14' },
        { startsOn: '2026-05-14', endsOn: null },
      ),
    ).toBe(true);

    expect(
      validateRoleAssignment({
        assignment: assignment({
          memberId: 'member-2',
          roleId: singleRole.id,
          startsOn: '2027-01-01',
          endsOn: null,
        }),
        role: singleRole,
        existingAssignments: [
          assignment({
            memberId: 'member-1',
            roleId: singleRole.id,
            startsOn: null,
            endsOn: '2026-12-31',
          }),
        ],
      }),
    ).toEqual({ ok: true });
  });

  it('formats effective dates in America/New_York local time', () => {
    expect(getNewYorkLocalDate(new Date('2026-05-14T03:30:00.000Z'))).toBe(
      '2026-05-13',
    );
  });
});

function assignment(
  overrides: Partial<RoleAssignmentWindow> = {},
): RoleAssignmentWindow {
  return {
    id: null,
    memberId: 'member-1',
    roleId: 'role-1',
    startsOn: null,
    endsOn: null,
    ...overrides,
  };
}
