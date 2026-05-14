import { describe, expect, it } from 'vitest';

import { appSuccess } from './app-result';
import {
  commitMemberCsvImport,
  type CsvImportAuditEvent,
  type CsvImportCommitGateway,
} from './member-import-commit';
import {
  previewMemberCsvImport,
  type CsvImportReferenceData,
  type ExistingImportMember,
  type ExistingImportOrganization,
} from './member-import-preview';
import { permissionKeys } from './permissions';

const actor = {
  userId: 'user-admin',
  memberId: 'member-admin',
  permissions: [permissionKeys.manageMembers],
};

const baseReferenceData = {
  members: [
    {
      id: 'member-existing',
      firstName: 'Avery',
      lastName: 'Active',
      email: 'active.member.test@njmca.test',
      emailNormalized: 'active.member.test@njmca.test',
      phone: null,
      isActive: true,
      organizationNames: ['North Jersey MCA'],
    },
  ],
  organizations: [
    {
      id: 'organization-north',
      name: 'North Jersey MCA',
      nameNormalized: 'north jersey mca',
    },
  ],
} satisfies CsvImportReferenceData;

describe('commitMemberCsvImport', () => {
  it('commits a reviewed ready preview transactionally with audit events', async () => {
    const input = {
      csvText: [
        'First Name,Last Name,Email,Phone,Organization,Title',
        'Avery,Active,active.member.test@njmca.test,555-0100,North Jersey MCA,Delegate',
        'Jordan,New,jordan.new@njmca.test,555-0101,New District,Inspector',
      ].join('\n'),
      mapping: {
        firstName: 'First Name',
        lastName: 'Last Name',
        email: 'Email',
        phone: 'Phone',
        organization: 'Organization',
        title: 'Title',
      },
      organizationMode: { type: 'column' as const },
    };
    const preview = previewMemberCsvImport(input, baseReferenceData);

    expect(preview.ok).toBe(true);

    if (!preview.ok) {
      return;
    }

    const gateway = createGateway(baseReferenceData);
    const result = await commitMemberCsvImport(
      actor,
      {
        ...input,
        expectedPreviewFingerprint: preview.data.previewFingerprint,
        confirmed: true,
      },
      gateway,
    );

    expect(result).toEqual(
      appSuccess({
        previewFingerprint: preview.data.previewFingerprint,
        rowsCommitted: 2,
        membersCreated: 1,
        membersUpdated: 1,
        organizationsCreated: 1,
        affiliationsUpserted: 2,
      }),
    );
    expect(gateway.state.organizations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'New District',
          nameNormalized: 'new district',
        }),
      ]),
    );
    expect(gateway.state.members).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          firstName: 'Jordan',
          lastName: 'New',
          emailNormalized: 'jordan.new@njmca.test',
        }),
        expect.objectContaining({
          id: 'member-existing',
          phone: '555-0100',
        }),
      ]),
    );
    expect(gateway.state.auditEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          eventType: 'organization.created',
          transactionMethod: 'csv_import',
        }),
        expect.objectContaining({
          eventType: 'member.created',
          transactionMethod: 'csv_import',
        }),
        expect.objectContaining({
          eventType: 'member.updated',
          transactionMethod: 'csv_import',
        }),
        expect.objectContaining({
          eventType: 'member.organization_imported',
          transactionMethod: 'csv_import',
        }),
      ]),
    );
  });

  it('requires explicit confirmation and an up-to-date preview fingerprint', async () => {
    const input = {
      csvText: 'First,Last,Email\nAvery,Active,active.member.test@njmca.test',
      mapping: {
        firstName: 'First',
        lastName: 'Last',
        email: 'Email',
      },
      organizationMode: { type: 'none' as const },
      expectedPreviewFingerprint: 'stale',
    };

    await expect(
      commitMemberCsvImport(
        actor,
        {
          ...input,
          confirmed: false,
        },
        createGateway(baseReferenceData),
      ),
    ).resolves.toMatchObject({
      ok: false,
      error: {
        type: 'validation',
        message: 'Review the preview and confirm before committing.',
      },
    });

    await expect(
      commitMemberCsvImport(
        actor,
        {
          ...input,
          confirmed: true,
        },
        createGateway(baseReferenceData),
      ),
    ).resolves.toMatchObject({
      ok: false,
      error: {
        type: 'conflict',
        message:
          'The import preview changed. Preview the CSV again before committing.',
      },
    });
  });

  it('rejects blocked and review-required rows before writing', async () => {
    const gateway = createGateway(baseReferenceData);
    const input = {
      csvText: [
        'First,Last,Email',
        'Jamie,One,jamie.test@njmca.test',
        'Jamie,Two,JAMIE.TEST@NJMCA.TEST',
      ].join('\n'),
      mapping: {
        firstName: 'First',
        lastName: 'Last',
        email: 'Email',
      },
      organizationMode: { type: 'none' as const },
    };
    const preview = previewMemberCsvImport(input, baseReferenceData);

    expect(preview.ok).toBe(true);

    if (!preview.ok) {
      return;
    }

    const result = await commitMemberCsvImport(
      actor,
      {
        ...input,
        expectedPreviewFingerprint: preview.data.previewFingerprint,
        confirmed: true,
      },
      gateway,
    );

    expect(result).toMatchObject({
      ok: false,
      error: {
        type: 'validation',
        message: 'Resolve blocked and review-required rows before committing.',
      },
    });
    expect(gateway.state.members).toHaveLength(1);
    expect(gateway.state.auditEvents).toHaveLength(0);
  });

  it('rolls back all writes when the transaction fails', async () => {
    const input = {
      csvText: 'First,Last,Email\nJordan,New,jordan.new@njmca.test',
      mapping: {
        firstName: 'First',
        lastName: 'Last',
        email: 'Email',
      },
      organizationMode: { type: 'none' as const },
    };
    const preview = previewMemberCsvImport(input, baseReferenceData);

    expect(preview.ok).toBe(true);

    if (!preview.ok) {
      return;
    }

    const gateway = createGateway(baseReferenceData, {
      failAfterFirstMemberWrite: true,
    });
    const result = await commitMemberCsvImport(
      actor,
      {
        ...input,
        expectedPreviewFingerprint: preview.data.previewFingerprint,
        confirmed: true,
      },
      gateway,
    );

    expect(result).toMatchObject({
      ok: false,
      error: {
        type: 'unexpected',
      },
    });
    expect(gateway.state.members).toHaveLength(1);
    expect(gateway.state.auditEvents).toHaveLength(0);
  });
});

function createGateway(
  referenceData: CsvImportReferenceData,
  options: { failAfterFirstMemberWrite?: boolean } = {},
) {
  const state = {
    members: referenceData.members.map((member) => ({ ...member })),
    organizations: referenceData.organizations.map((organization) => ({
      ...organization,
    })),
    affiliations: [] as Array<{
      id: string;
      memberId: string;
      organizationId: string;
      title: string | null;
    }>,
    auditEvents: [] as CsvImportAuditEvent[],
  };

  const gateway: CsvImportCommitGateway & { state: typeof state } = {
    state,
    async runInTransaction(callback) {
      const snapshot = cloneState(state);

      try {
        return await callback({
          async getReferenceData() {
            return {
              members: state.members,
              organizations: state.organizations,
            };
          },
          async createOrganization(input) {
            const organization = {
              id: `organization-${state.organizations.length + 1}`,
              name: input.name,
              nameNormalized: input.nameNormalized,
            };
            state.organizations.push(organization);
            return organization;
          },
          async createMember(input) {
            const member = {
              id: `member-${state.members.length + 1}`,
              ...input,
              isActive: true,
              organizationNames: [],
            };
            state.members.push(member);

            if (options.failAfterFirstMemberWrite) {
              throw new Error('forced failure');
            }

            return member;
          },
          async updateMember(memberId, input) {
            const member = state.members.find((entry) => entry.id === memberId);

            if (!member) {
              throw new Error('missing member');
            }

            Object.assign(member, input);
            return member;
          },
          async upsertMemberOrganization(input) {
            const existing = state.affiliations.find(
              (affiliation) =>
                affiliation.memberId === input.memberId &&
                affiliation.organizationId === input.organizationId,
            );

            if (existing) {
              existing.title = input.title;
              return { id: existing.id };
            }

            const affiliation = {
              id: `affiliation-${state.affiliations.length + 1}`,
              ...input,
            };
            state.affiliations.push(affiliation);
            return { id: affiliation.id };
          },
          async writeAuditEvent(event) {
            state.auditEvents.push(event);
          },
        });
      } catch (error) {
        state.members = snapshot.members;
        state.organizations = snapshot.organizations;
        state.affiliations = snapshot.affiliations;
        state.auditEvents = snapshot.auditEvents;
        throw error;
      }
    },
  };

  return gateway;
}

function cloneState(state: {
  members: ExistingImportMember[];
  organizations: ExistingImportOrganization[];
  affiliations: Array<{
    id: string;
    memberId: string;
    organizationId: string;
    title: string | null;
  }>;
  auditEvents: CsvImportAuditEvent[];
}) {
  return {
    members: state.members.map((member) => ({ ...member })),
    organizations: state.organizations.map((organization) => ({
      ...organization,
    })),
    affiliations: state.affiliations.map((affiliation) => ({
      ...affiliation,
    })),
    auditEvents: state.auditEvents.map((event) => ({ ...event })),
  };
}
