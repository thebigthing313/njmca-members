import { type AppResult, appError, appSuccess } from './app-result';
import {
  previewMemberCsvImport,
  type CsvImportReferenceData,
  type CsvMemberImportPreviewRow,
  type ExistingImportMember,
  type ExistingImportOrganization,
  type PreviewMemberCsvImportInput,
} from './member-import-preview';
import { hasPermission, permissionKeys } from './permissions';

export type CommitMemberCsvImportInput = PreviewMemberCsvImportInput & {
  expectedPreviewFingerprint: string;
  confirmed: boolean;
};

export type MemberCsvImportCommitActor = {
  userId: string;
  memberId: string | null;
  permissions: readonly string[];
};

export type CsvImportAuditEvent = {
  actorUserId: string | null;
  actorMemberId: string | null;
  subjectType: 'member' | 'organization';
  subjectId: string;
  eventType:
    | 'member.created'
    | 'member.updated'
    | 'member.organization_imported'
    | 'organization.created';
  transactionMethod: 'csv_import';
  metadata: Record<string, unknown>;
};

export type CsvImportMemberWrite = {
  firstName: string;
  lastName: string;
  email: string | null;
  emailNormalized: string | null;
  phone: string | null;
};

export type CsvImportAffiliationWrite = {
  memberId: string;
  organizationId: string;
  title: string | null;
};

export type CsvImportCommitTransaction = {
  getReferenceData(): Promise<CsvImportReferenceData>;
  createOrganization(input: {
    name: string;
    nameNormalized: string;
  }): Promise<ExistingImportOrganization>;
  createMember(input: CsvImportMemberWrite): Promise<ExistingImportMember>;
  updateMember(
    memberId: string,
    input: CsvImportMemberWrite,
  ): Promise<ExistingImportMember>;
  upsertMemberOrganization(
    input: CsvImportAffiliationWrite,
  ): Promise<{ id: string }>;
  writeAuditEvent(event: CsvImportAuditEvent): Promise<void>;
};

export type CsvImportCommitGateway = {
  runInTransaction<T>(
    callback: (transaction: CsvImportCommitTransaction) => Promise<T>,
  ): Promise<T>;
};

export type CsvMemberImportCommitSummary = {
  previewFingerprint: string;
  rowsCommitted: number;
  membersCreated: number;
  membersUpdated: number;
  organizationsCreated: number;
  affiliationsUpserted: number;
};

export async function commitMemberCsvImport(
  actor: MemberCsvImportCommitActor | null,
  input: CommitMemberCsvImportInput,
  gateway: CsvImportCommitGateway,
): Promise<AppResult<CsvMemberImportCommitSummary>> {
  return translateUnexpected('CSV import could not be committed.', async () => {
    const actorResult = requireManageMembers(actor);

    if (!actorResult.ok) {
      return actorResult;
    }

    if (!input.confirmed) {
      return appError(
        'validation',
        'Review the preview and confirm before committing.',
      );
    }

    if (!input.expectedPreviewFingerprint) {
      return appError(
        'validation',
        'Preview the import before committing it.',
      );
    }

    return gateway.runInTransaction(async (transaction) => {
      const referenceData = await transaction.getReferenceData();
      const previewResult = previewMemberCsvImport(input, referenceData);

      if (!previewResult.ok) {
        return previewResult;
      }

      const preview = previewResult.data;

      if (preview.previewFingerprint !== input.expectedPreviewFingerprint) {
        return appError(
          'conflict',
          'The import preview changed. Preview the CSV again before committing.',
        );
      }

      if (preview.summary.blockedRows > 0 || preview.summary.reviewRows > 0) {
        return appError(
          'validation',
          'Resolve blocked and review-required rows before committing.',
        );
      }

      const organizationsByNormalizedName = new Map(
        referenceData.organizations.map((organization) => [
          organization.nameNormalized,
          organization,
        ]),
      );
      let organizationsCreated = 0;

      for (const organization of preview.newOrganizations) {
        const createdOrganization = await transaction.createOrganization({
          name: organization.name,
          nameNormalized: organization.nameNormalized,
        });
        organizationsByNormalizedName.set(
          createdOrganization.nameNormalized,
          createdOrganization,
        );
        organizationsCreated += 1;

        await transaction.writeAuditEvent({
          actorUserId: actorResult.data.userId,
          actorMemberId: actorResult.data.memberId,
          subjectType: 'organization',
          subjectId: createdOrganization.id,
          eventType: 'organization.created',
          transactionMethod: 'csv_import',
          metadata: {
            rowNumbers: organization.rowNumbers,
            after: {
              name: createdOrganization.name,
              nameNormalized: createdOrganization.nameNormalized,
            },
          },
        });
      }

      const existingMembersById = new Map(
        referenceData.members.map((member) => [member.id, member]),
      );
      let membersCreated = 0;
      let membersUpdated = 0;
      let affiliationsUpserted = 0;

      for (const row of preview.rows.filter(
        (previewRow) => previewRow.status === 'ready',
      )) {
        const memberWrite = toMemberWrite(row);
        const before = row.existingMemberId
          ? existingMembersById.get(row.existingMemberId) ?? null
          : null;
        const member =
          row.action === 'update_member' && row.existingMemberId
            ? await transaction.updateMember(row.existingMemberId, memberWrite)
            : await transaction.createMember(memberWrite);

        if (row.action === 'update_member') {
          membersUpdated += 1;
        } else {
          membersCreated += 1;
        }

        await transaction.writeAuditEvent({
          actorUserId: actorResult.data.userId,
          actorMemberId: actorResult.data.memberId,
          subjectType: 'member',
          subjectId: member.id,
          eventType:
            row.action === 'update_member' ? 'member.updated' : 'member.created',
          transactionMethod: 'csv_import',
          metadata: {
            rowNumber: row.rowNumber,
            before: before ? getMemberAuditValue(before) : null,
            after: getMemberAuditValue(member),
          },
        });

        if (row.organizationNameNormalized) {
          const organization = organizationsByNormalizedName.get(
            row.organizationNameNormalized,
          );

          if (!organization) {
            return appError(
              'conflict',
              'The import organization list changed. Preview the CSV again before committing.',
            );
          }

          const affiliation = await transaction.upsertMemberOrganization({
            memberId: member.id,
            organizationId: organization.id,
            title: row.title,
          });
          affiliationsUpserted += 1;

          await transaction.writeAuditEvent({
            actorUserId: actorResult.data.userId,
            actorMemberId: actorResult.data.memberId,
            subjectType: 'member',
            subjectId: member.id,
            eventType: 'member.organization_imported',
            transactionMethod: 'csv_import',
            metadata: {
              rowNumber: row.rowNumber,
              affiliationId: affiliation.id,
              organizationId: organization.id,
              organizationName: organization.name,
              title: row.title,
            },
          });
        }
      }

      return appSuccess({
        previewFingerprint: preview.previewFingerprint,
        rowsCommitted: membersCreated + membersUpdated,
        membersCreated,
        membersUpdated,
        organizationsCreated,
        affiliationsUpserted,
      });
    });
  });
}

function requireManageMembers(
  actor: MemberCsvImportCommitActor | null,
): AppResult<MemberCsvImportCommitActor> {
  if (!actor) {
    return appError('unauthorized', 'Sign in before committing imports.');
  }

  if (!hasPermission(actor.permissions, permissionKeys.manageMembers)) {
    return appError(
      'forbidden',
      'You do not have permission to commit member imports.',
    );
  }

  return appSuccess(actor);
}

function toMemberWrite(row: CsvMemberImportPreviewRow): CsvImportMemberWrite {
  return {
    firstName: row.firstName,
    lastName: row.lastName,
    email: row.email,
    emailNormalized: row.emailNormalized,
    phone: row.phone,
  };
}

function getMemberAuditValue(member: ExistingImportMember) {
  return {
    id: member.id,
    firstName: member.firstName,
    lastName: member.lastName,
    email: member.email,
    emailNormalized: member.emailNormalized,
    phone: member.phone,
    isActive: member.isActive,
  };
}

async function translateUnexpected<T>(
  message: string,
  operation: () => Promise<AppResult<T>>,
): Promise<AppResult<T>> {
  try {
    return await operation();
  } catch {
    return appError('unexpected', message);
  }
}
