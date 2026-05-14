export type RoleAssignmentMode = 'single' | 'multiple';

export type RoleAssignmentWindow = {
  id: string | null;
  memberId: string;
  roleId: string;
  startsOn: string | null;
  endsOn: string | null;
};

export type RoleAssignmentRole = {
  id: string;
  assignmentMode: RoleAssignmentMode;
};

export type RoleAssignmentValidationResult =
  | { ok: true }
  | {
      ok: false;
      reason:
        | 'invalid_date'
        | 'date_order'
        | 'same_member_role_overlap'
        | 'single_role_overlap';
      conflictingAssignmentId?: string | null;
    };

export function validateRoleAssignment(input: {
  assignment: RoleAssignmentWindow;
  role: RoleAssignmentRole;
  existingAssignments: readonly RoleAssignmentWindow[];
}): RoleAssignmentValidationResult {
  const dateValidation = validateDateWindow(input.assignment);

  if (!dateValidation.ok) {
    return dateValidation;
  }

  for (const existingAssignment of input.existingAssignments) {
    if (existingAssignment.id === input.assignment.id) {
      continue;
    }

    if (existingAssignment.roleId !== input.assignment.roleId) {
      continue;
    }

    if (!dateWindowsOverlap(input.assignment, existingAssignment)) {
      continue;
    }

    if (existingAssignment.memberId === input.assignment.memberId) {
      return {
        ok: false,
        reason: 'same_member_role_overlap',
        conflictingAssignmentId: existingAssignment.id,
      };
    }

    if (input.role.assignmentMode === 'single') {
      return {
        ok: false,
        reason: 'single_role_overlap',
        conflictingAssignmentId: existingAssignment.id,
      };
    }
  }

  return { ok: true };
}

export function validateDateWindow(
  assignment: Pick<RoleAssignmentWindow, 'startsOn' | 'endsOn'>,
): RoleAssignmentValidationResult {
  if (!isNullableIsoDate(assignment.startsOn)) {
    return { ok: false, reason: 'invalid_date' };
  }

  if (!isNullableIsoDate(assignment.endsOn)) {
    return { ok: false, reason: 'invalid_date' };
  }

  if (
    assignment.startsOn &&
    assignment.endsOn &&
    assignment.startsOn > assignment.endsOn
  ) {
    return { ok: false, reason: 'date_order' };
  }

  return { ok: true };
}

export function dateWindowsOverlap(
  left: Pick<RoleAssignmentWindow, 'startsOn' | 'endsOn'>,
  right: Pick<RoleAssignmentWindow, 'startsOn' | 'endsOn'>,
) {
  const leftStartsBeforeRightEnds = !right.endsOn || !left.startsOn
    ? true
    : left.startsOn <= right.endsOn;
  const rightStartsBeforeLeftEnds = !left.endsOn || !right.startsOn
    ? true
    : right.startsOn <= left.endsOn;

  return leftStartsBeforeRightEnds && rightStartsBeforeLeftEnds;
}

export function getNewYorkLocalDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'America/New_York',
    year: 'numeric',
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );

  return `${values.year}-${values.month}-${values.day}`;
}

function isNullableIsoDate(value: string | null) {
  return value === null || /^\d{4}-\d{2}-\d{2}$/.test(value);
}
