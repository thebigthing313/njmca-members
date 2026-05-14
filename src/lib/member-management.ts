import { createServerFn } from '@tanstack/react-start';

import { type AppResult, appError, appSuccess } from '../domain/app-result';
import {
  type CreateMemberInput,
  type ManagedMember,
  type MemberIdInput,
  type UpdateMemberInput,
  createManagedMember,
  deactivateManagedMember,
  unlinkManagedMemberUser,
  updateManagedMember,
} from '../domain/member-management';
import { hasPermission, permissionKeys } from '../domain/permissions';

export const listManagedMembers = createServerFn({ method: 'GET' }).handler(
  async (): Promise<AppResult<ManagedMember[]>> => {
    try {
      const { getCurrentMemberManagementActor } = await import(
        '../server/current-member-actor'
      );
      const { listMembersForManagement } = await import(
        '../server/member-management-repository'
      );
      const actor = await getCurrentMemberManagementActor();

      if (!actor) {
        return appError('unauthorized', 'Sign in before managing members.');
      }

      if (!hasPermission(actor.permissions, permissionKeys.manageMembers)) {
        return appError(
          'forbidden',
          'You do not have permission to manage members.',
        );
      }

      return appSuccess(await listMembersForManagement());
    } catch {
      return appError('unexpected', 'Members could not be loaded.');
    }
  },
);

export const createMember = createServerFn({ method: 'POST' })
  .inputValidator((input: CreateMemberInput) => input)
  .handler(async ({ data }) => {
    const { getCurrentMemberManagementActor } = await import(
      '../server/current-member-actor'
    );
    const { postgresMemberManagementGateway } = await import(
      '../server/member-management-repository'
    );

    return createManagedMember(
      await getCurrentMemberManagementActor(),
      data,
      postgresMemberManagementGateway,
    );
  });

export const updateMember = createServerFn({ method: 'POST' })
  .inputValidator((input: UpdateMemberInput) => input)
  .handler(async ({ data }) => {
    const { getCurrentMemberManagementActor } = await import(
      '../server/current-member-actor'
    );
    const { postgresMemberManagementGateway } = await import(
      '../server/member-management-repository'
    );

    return updateManagedMember(
      await getCurrentMemberManagementActor(),
      data,
      postgresMemberManagementGateway,
    );
  });

export const deactivateMember = createServerFn({ method: 'POST' })
  .inputValidator((input: MemberIdInput) => input)
  .handler(async ({ data }) => {
    const { getCurrentMemberManagementActor } = await import(
      '../server/current-member-actor'
    );
    const { postgresMemberManagementGateway } = await import(
      '../server/member-management-repository'
    );

    return deactivateManagedMember(
      await getCurrentMemberManagementActor(),
      data,
      postgresMemberManagementGateway,
    );
  });

export const unlinkMemberUser = createServerFn({ method: 'POST' })
  .inputValidator((input: MemberIdInput) => input)
  .handler(async ({ data }) => {
    const { getCurrentMemberManagementActor } = await import(
      '../server/current-member-actor'
    );
    const { postgresMemberManagementGateway } = await import(
      '../server/member-management-repository'
    );

    return unlinkManagedMemberUser(
      await getCurrentMemberManagementActor(),
      data,
      postgresMemberManagementGateway,
    );
  });
