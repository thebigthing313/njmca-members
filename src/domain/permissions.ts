export const permissionKeys = {
  manageMembers: 'manage_members',
  manageOrganizations: 'manage_organizations',
  manageRoles: 'manage_roles',
} as const;

export type PermissionKey =
  (typeof permissionKeys)[keyof typeof permissionKeys];

export type RoleAssignment = {
  roleKey: string;
  startsOn: string | null;
  endsOn: string | null;
};

export type RolePermission = {
  roleKey: string;
  permissionKey: PermissionKey;
};

export function hasPermission(
  permissions: readonly string[],
  permission: PermissionKey,
) {
  return permissions.includes(permission);
}

export function getEffectivePermissions(input: {
  memberIsActive: boolean;
  memberUserId: string | null;
  memberEmailNormalized: string | null;
  roleAssignments: readonly RoleAssignment[];
  rolePermissions: readonly RolePermission[];
  today: string;
}) {
  if (
    !input.memberIsActive ||
    !input.memberUserId ||
    !input.memberEmailNormalized
  ) {
    return [];
  }

  const activeRoleKeys = new Set(
    input.roleAssignments
      .filter((assignment) => isAssignmentActiveOn(assignment, input.today))
      .map((assignment) => assignment.roleKey),
  );

  return Array.from(
    new Set(
      input.rolePermissions
        .filter((rolePermission) => activeRoleKeys.has(rolePermission.roleKey))
        .map((rolePermission) => rolePermission.permissionKey),
    ),
  ).sort();
}

function isAssignmentActiveOn(assignment: RoleAssignment, today: string) {
  return (
    (!assignment.startsOn || assignment.startsOn <= today) &&
    (!assignment.endsOn || assignment.endsOn >= today)
  );
}
