import { createServerFn } from '@tanstack/react-start';

import { appError, appSuccess, unexpectedError } from '../domain/app-result';
import { hasPermission, permissionKeys } from '../domain/permissions';
import type {
  MemberAffiliationAdminRecord,
  OrganizationRecord,
} from '../server/organization-repository';

type CreateOrganizationInput = {
  name: string;
};

type UpdateOrganizationInput = {
  id: string;
  name: string;
};

type DeleteOrganizationInput = {
  id: string;
};

type UpdateMemberAffiliationsInput = {
  memberId: string;
  affiliations: {
    organizationId: string;
    title?: string | null;
  }[];
};

type OrganizationAdminData = {
  organizations: OrganizationRecord[];
  members: MemberAffiliationAdminRecord[];
};

export const getOrganizationAdminData = createServerFn({ method: 'GET' }).handler(
  async () => {
    const actor = await requireOrganizationManager();

    if (!actor.ok) {
      return actor;
    }

    const { listMembersWithOrganizationAffiliations, listOrganizations } =
      await import('../server/organization-repository');

    return appSuccess<OrganizationAdminData>({
      organizations: await listOrganizations(),
      members: await listMembersWithOrganizationAffiliations(),
    });
  },
);

export const createOrganizationAction = createServerFn({ method: 'POST' })
  .validator((input: CreateOrganizationInput) => input)
  .handler(async ({ data }) => {
    const actor = await requireOrganizationManager();

    if (!actor.ok) {
      return actor;
    }

    try {
      const { createOrganization } = await import(
        '../server/organization-repository'
      );

      return await createOrganization({
        name: data.name,
        actor: actor.data,
      });
    } catch {
      return unexpectedError('Organization could not be created.');
    }
  });

export const updateOrganizationAction = createServerFn({ method: 'POST' })
  .validator((input: UpdateOrganizationInput) => input)
  .handler(async ({ data }) => {
    const actor = await requireOrganizationManager();

    if (!actor.ok) {
      return actor;
    }

    try {
      const { updateOrganization } = await import(
        '../server/organization-repository'
      );

      return await updateOrganization({
        id: data.id,
        name: data.name,
        actor: actor.data,
      });
    } catch {
      return unexpectedError('Organization could not be updated.');
    }
  });

export const deleteOrganizationAction = createServerFn({ method: 'POST' })
  .validator((input: DeleteOrganizationInput) => input)
  .handler(async ({ data }) => {
    const actor = await requireOrganizationManager();

    if (!actor.ok) {
      return actor;
    }

    try {
      const { deleteOrganization } = await import(
        '../server/organization-repository'
      );

      return await deleteOrganization({
        id: data.id,
        actor: actor.data,
      });
    } catch {
      return unexpectedError('Organization could not be deleted.');
    }
  });

export const updateMemberOrganizationAffiliationsAction = createServerFn({
  method: 'POST',
})
  .validator((input: UpdateMemberAffiliationsInput) => input)
  .handler(async ({ data }) => {
    const actor = await requireOrganizationManager();

    if (!actor.ok) {
      return actor;
    }

    try {
      const { replaceMemberOrganizationAffiliations } = await import(
        '../server/organization-repository'
      );

      return await replaceMemberOrganizationAffiliations({
        memberId: data.memberId,
        affiliations: data.affiliations,
        actor: actor.data,
      });
    } catch {
      return unexpectedError('Member affiliations could not be updated.');
    }
  });

async function requireOrganizationManager() {
  const { getCurrentMemberManagementActor } = await import(
    '../server/current-member-actor'
  );
  const actor = await getCurrentMemberManagementActor();

  if (!actor) {
    return appError('unauthorized', 'Sign in is required.');
  }

  if (!actor.memberId) {
    return appError('forbidden', 'Active member access is required.');
  }

  if (!hasPermission(actor.permissions, permissionKeys.manageOrganizations)) {
    return appError(
      'forbidden',
      'You do not have permission to manage organizations.',
    );
  }

  return appSuccess({
    userId: actor.userId,
    memberId: actor.memberId,
  });
}
