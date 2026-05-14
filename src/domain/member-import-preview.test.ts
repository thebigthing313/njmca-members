import { describe, expect, it } from 'vitest';

import {
  guessCsvMemberImportMapping,
  previewMemberCsvImport,
  type CsvImportReferenceData,
} from './member-import-preview';

const referenceData = {
  members: [
    {
      id: 'member-existing-email',
      firstName: 'Avery',
      lastName: 'Active',
      email: 'active.member.test@njmca.test',
      emailNormalized: 'active.member.test@njmca.test',
      isActive: true,
      organizationNames: ['North Jersey MCA'],
    },
    {
      id: 'member-existing-no-email',
      firstName: 'Casey',
      lastName: 'Claimable',
      email: null,
      emailNormalized: null,
      isActive: true,
      organizationNames: ['Shore Builders'],
    },
  ],
  organizations: [
    {
      id: 'organization-north',
      name: 'North Jersey MCA',
      nameNormalized: 'north jersey mca',
    },
    {
      id: 'organization-shore',
      name: 'Shore Builders',
      nameNormalized: 'shore builders',
    },
  ],
} satisfies CsvImportReferenceData;

describe('guessCsvMemberImportMapping', () => {
  it('guesses common member and organization headers', () => {
    expect(
      guessCsvMemberImportMapping([
        'First Name',
        'Last Name',
        'Email Address',
        'Phone Number',
        'District',
        'Position',
      ]),
    ).toEqual({
      firstName: 'First Name',
      lastName: 'Last Name',
      email: 'Email Address',
      phone: 'Phone Number',
      organization: 'District',
      title: 'Position',
    });
  });
});

describe('previewMemberCsvImport', () => {
  it('previews creates, updates, and staged organizations without committing them', () => {
    const result = previewMemberCsvImport(
      {
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
        organizationMode: { type: 'column' },
      },
      referenceData,
    );

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    expect(result.data.summary).toMatchObject({
      totalRows: 2,
      readyRows: 2,
      membersToCreate: 1,
      membersToUpdate: 1,
      organizationsToCreate: 1,
    });
    expect(result.data.rows[0]).toMatchObject({
      status: 'ready',
      action: 'update_member',
      existingMemberId: 'member-existing-email',
    });
    expect(result.data.rows[1]).toMatchObject({
      status: 'ready',
      action: 'create_member',
      organizationName: 'New District',
    });
    expect(result.data.newOrganizations).toEqual([
      {
        name: 'New District',
        nameNormalized: 'new district',
        rowNumbers: [3],
      },
    ]);
  });

  it('blocks duplicate normalized emails within the CSV', () => {
    const result = previewMemberCsvImport(
      {
        csvText: [
          'First,Last,Email',
          'Jamie,One,JAMIE.TEST@NJMCA.TEST',
          'Jamie,Two, jamie.test@njmca.test ',
        ].join('\n'),
        mapping: {
          firstName: 'First',
          lastName: 'Last',
          email: 'Email',
        },
        organizationMode: { type: 'none' },
      },
      referenceData,
    );

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    expect(result.data.summary.blockedRows).toBe(2);
    expect(result.data.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: 'blocked',
          messages: ['Email appears more than once in this CSV.'],
        }),
      ]),
    );
  });

  it('marks no-email name and organization matches for review', () => {
    const result = previewMemberCsvImport(
      {
        csvText: ['First,Last,Organization', 'Casey,Claimable,Shore Builders']
          .join('\n'),
        mapping: {
          firstName: 'First',
          lastName: 'Last',
          organization: 'Organization',
        },
        organizationMode: { type: 'column' },
      },
      referenceData,
    );

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    expect(result.data.rows[0]).toMatchObject({
      status: 'review_required',
      action: 'skip',
      possibleDuplicateMemberIds: ['member-existing-no-email'],
    });
  });

  it('supports fixed organization imports', () => {
    const result = previewMemberCsvImport(
      {
        csvText: ['First,Last,Email', 'Taylor,Fixed,taylor.fixed@njmca.test']
          .join('\n'),
        mapping: {
          firstName: 'First',
          lastName: 'Last',
          email: 'Email',
        },
        organizationMode: {
          type: 'fixed',
          organizationName: 'Fixed Org',
        },
      },
      referenceData,
    );

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    expect(result.data.rows[0]).toMatchObject({
      organizationName: 'Fixed Org',
      organizationNameNormalized: 'fixed org',
      status: 'ready',
    });
    expect(result.data.newOrganizations).toEqual([
      {
        name: 'Fixed Org',
        nameNormalized: 'fixed org',
        rowNumbers: [2],
      },
    ]);
  });

  it('validates required mappings and malformed CSV', () => {
    const missingMapping = previewMemberCsvImport(
      {
        csvText: 'First,Last\nAvery,Active',
        mapping: {
          firstName: 'First',
        },
        organizationMode: { type: 'none' },
      },
      referenceData,
    );
    const malformed = previewMemberCsvImport(
      {
        csvText: 'First,Last\n"Avery,Active',
        mapping: {
          firstName: 'First',
          lastName: 'Last',
        },
        organizationMode: { type: 'none' },
      },
      referenceData,
    );

    expect(missingMapping).toMatchObject({
      ok: false,
      error: {
        type: 'validation',
        fieldErrors: { lastName: 'Map last name.' },
      },
    });
    expect(malformed).toMatchObject({
      ok: false,
      error: {
        type: 'validation',
        message: 'CSV contains an unterminated quoted field.',
      },
    });
  });
});
