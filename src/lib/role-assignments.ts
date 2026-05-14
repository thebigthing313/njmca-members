import { createServerFn } from '@tanstack/react-start';

import { hasPermission, permissionKeys } from '../domain/permissions';

type AssignRoleInput = {
  memberId: string;
  roleId: string;
  startsOn?: string | null;
  endsOn?: string | null;
};

type EndRoleInput = {
  assignmentId: string;
  endsOn?: string | null;
};

export const getRoleAssignmentAdminData = createServerFn({
  method: 'GET',
}).handler(async () => {
  const access = await requireManageRoles();

  if (!access.ok) {
    return access;
  }

  const { listRoleAssignmentAdminData } = await import(
    '../server/role-assignment-repository'
  );

  return {
    ok: true as const,
    data: await listRoleAssignmentAdminData(),
  };
});

export const assignMemberRole = createServerFn({ method: 'POST' })
  .inputValidator((input: AssignRoleInput) => input)
  .handler(async ({ data }) => {
    const access = await requireManageRoles();

    if (!access.ok) {
      return access;
    }

    const { assignRoleToMember } = await import(
      '../server/role-assignment-repository'
    );

    return assignRoleToMember({
      actorUserId: access.userId,
      actorMemberId: access.memberId,
      memberId: data.memberId,
      roleId: data.roleId,
      startsOn: toNullableDate(data.startsOn),
      endsOn: toNullableDate(data.endsOn),
    });
  });

export const endMemberRoleAssignment = createServerFn({ method: 'POST' })
  .inputValidator((input: EndRoleInput) => input)
  .handler(async ({ data }) => {
    const access = await requireManageRoles();

    if (!access.ok) {
      return access;
    }

    const { endRoleAssignment } = await import(
      '../server/role-assignment-repository'
    );

    return endRoleAssignment({
      actorUserId: access.userId,
      actorMemberId: access.memberId,
      assignmentId: data.assignmentId,
      endsOn: toNullableDate(data.endsOn),
    });
  });

async function requireManageRoles() {
  const { getCurrentMemberManagementActor } = await import(
    '../server/current-member-actor'
  );
  const actor = await getCurrentMemberManagementActor();

  if (!actor) {
    return {
      ok: false as const,
      reason: 'unauthorized' as const,
      message: 'Sign in to manage roles.',
    };
  }

  if (!actor.memberId) {
    return {
      ok: false as const,
      reason: 'forbidden' as const,
      message: 'Active member access is required to manage roles.',
    };
  }

  if (!hasPermission(actor.permissions, permissionKeys.manageRoles)) {
    return {
      ok: false as const,
      reason: 'forbidden' as const,
      message: 'The manage_roles permission is required.',
    };
  }

  return {
    ok: true as const,
    userId: actor.userId,
    memberId: actor.memberId,
  };
}

function toNullableDate(value: string | null | undefined) {
  const trimmed = value?.trim() ?? '';

  return trimmed ? trimmed : null;
}
