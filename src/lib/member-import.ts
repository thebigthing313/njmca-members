import { createServerFn } from '@tanstack/react-start';

import { appError, unexpectedError } from '../domain/app-result';
import {
  previewMemberCsvImport,
  type PreviewMemberCsvImportInput,
} from '../domain/member-import-preview';
import { hasPermission, permissionKeys } from '../domain/permissions';

export const previewMemberCsvImportAction = createServerFn({ method: 'POST' })
  .inputValidator((input: PreviewMemberCsvImportInput) => input)
  .handler(async ({ data }) => {
    const actor = await requireMemberImportPreviewAccess();

    if (!actor.ok) {
      return actor;
    }

    try {
      const { getMemberCsvImportReferenceData } = await import(
        '../server/member-import-repository'
      );

      return previewMemberCsvImport(
        data,
        await getMemberCsvImportReferenceData(),
      );
    } catch {
      return unexpectedError('CSV import preview could not be generated.');
    }
  });

async function requireMemberImportPreviewAccess() {
  const { getCurrentMemberManagementActor } = await import(
    '../server/current-member-actor'
  );
  const actor = await getCurrentMemberManagementActor();

  if (!actor) {
    return appError('unauthorized', 'Sign in before previewing imports.');
  }

  if (!hasPermission(actor.permissions, permissionKeys.manageMembers)) {
    return appError(
      'forbidden',
      'You do not have permission to preview member imports.',
    );
  }

  return {
    ok: true as const,
    value: actor,
    data: actor,
  };
}
