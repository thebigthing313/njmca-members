import { describe, expect, it } from 'vitest';

import {
  ensureOrganizationCanBeDeleted,
  ensureOrganizationNameIsAvailable,
  memberAffiliationsFingerprint,
  normalizeOrganizationName,
  prepareMemberAffiliations,
  prepareOrganizationName,
} from './organizations';

describe('organization domain rules', () => {
  it('normalizes organization names by trim, whitespace collapse, and lowercase', () => {
    expect(normalizeOrganizationName('  North   Jersey\tMCA  ')).toBe(
      'north jersey mca',
    );

    expect(
      prepareOrganizationName({ name: '  North   Jersey\tMCA  ' }),
    ).toMatchObject({
      ok: true,
      data: {
        name: 'North Jersey MCA',
        nameNormalized: 'north jersey mca',
      },
    });
  });

  it('rejects empty organization names', () => {
    expect(prepareOrganizationName({ name: '    ' })).toMatchObject({
      ok: false,
      error: { type: 'validation' },
    });
  });

  it('detects duplicate organization names by normalized name', () => {
    expect(
      ensureOrganizationNameIsAvailable({
        existing: {
          id: 'organization-1',
        },
        currentOrganizationId: 'organization-2',
      }),
    ).toMatchObject({
      ok: false,
      error: { type: 'conflict' },
    });

    expect(
      ensureOrganizationNameIsAvailable({
        existing: {
          id: 'organization-1',
        },
        currentOrganizationId: 'organization-1',
      }),
    ).toMatchObject({ ok: true, data: null });
  });

  it('normalizes affiliation titles and rejects duplicate member links', () => {
    expect(
      prepareMemberAffiliations([
        { organizationId: ' organization-1 ', title: '  Board   Chair ' },
        { organizationId: 'organization-2', title: '   ' },
      ]),
    ).toMatchObject({
      ok: true,
      data: [
        { organizationId: 'organization-1', title: 'Board Chair' },
        { organizationId: 'organization-2', title: null },
      ],
    });

    expect(
      prepareMemberAffiliations([
        { organizationId: 'organization-1', title: null },
        { organizationId: 'organization-1', title: 'Director' },
      ]),
    ).toMatchObject({
      ok: false,
      error: { type: 'validation' },
    });
  });

  it('protects organizations with member affiliations from deletion', () => {
    expect(ensureOrganizationCanBeDeleted(0)).toMatchObject({
      ok: true,
      data: null,
    });
    expect(ensureOrganizationCanBeDeleted(2)).toMatchObject({
      ok: false,
      error: { type: 'conflict' },
    });
  });
});

describe('memberAffiliationsFingerprint', () => {
  const alpha = { organizationId: 'org-alpha', title: 'Delegate' };
  const beta = { organizationId: 'org-beta', title: null };

  it('ignores the order affiliations arrive in', () => {
    expect(memberAffiliationsFingerprint([alpha, beta])).toBe(
      memberAffiliationsFingerprint([beta, alpha]),
    );
  });

  it('changes when an organization or a title changes', () => {
    const base = memberAffiliationsFingerprint([alpha, beta]);

    expect(
      memberAffiliationsFingerprint([{ ...alpha, title: 'Chair' }, beta]),
    ).not.toBe(base);
    expect(
      memberAffiliationsFingerprint([
        { ...alpha, organizationId: 'org-gamma' },
        beta,
      ]),
    ).not.toBe(base);
  });

  it('changes when an affiliation is added or removed', () => {
    expect(memberAffiliationsFingerprint([alpha])).not.toBe(
      memberAffiliationsFingerprint([alpha, beta]),
    );
    expect(memberAffiliationsFingerprint([])).toBe('');
  });

  it('treats a null title as empty', () => {
    expect(memberAffiliationsFingerprint([beta])).toBe('org-beta:');
  });
});
