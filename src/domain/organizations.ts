import { appError, appSuccess, type AppResult } from './app-result';

const maxOrganizationNameLength = 160;
const maxAffiliationTitleLength = 160;

export type OrganizationNameInput = {
  name: string;
};

export type PreparedOrganizationName = {
  name: string;
  nameNormalized: string;
};

export type ExistingOrganizationName = {
  id: string;
};

export type AffiliationInput = {
  organizationId: string;
  title?: string | null;
};

export type PreparedAffiliation = {
  organizationId: string;
  title: string | null;
};

export function normalizeOrganizationName(name: string) {
  return collapseWhitespace(name).toLowerCase();
}

export function prepareOrganizationName(
  input: OrganizationNameInput,
): AppResult<PreparedOrganizationName> {
  const name = collapseWhitespace(input.name);

  if (!name) {
    return appError('validation', 'Organization name is required.', {
      name: 'Organization name is required.',
    });
  }

  if (name.length > maxOrganizationNameLength) {
    return appError('validation', 'Organization name is too long.', {
      name: `Organization name must be ${maxOrganizationNameLength} characters or fewer.`,
    });
  }

  return appSuccess({
    name,
    nameNormalized: normalizeOrganizationName(name),
  });
}

export function ensureOrganizationNameIsAvailable(input: {
  existing: ExistingOrganizationName | null;
  currentOrganizationId?: string;
}) {
  if (
    input.existing &&
    input.existing.id !== input.currentOrganizationId
  ) {
    return appError(
      'conflict',
      'An organization with that name already exists.',
      {
        name: 'An organization with that name already exists.',
      },
    );
  }

  return appSuccess(null);
}

export function ensureOrganizationCanBeDeleted(memberLinkCount: number) {
  if (memberLinkCount > 0) {
    return appError(
      'conflict',
      'Organizations with member affiliations cannot be deleted.',
    );
  }

  return appSuccess(null);
}

export function prepareMemberAffiliations(
  affiliations: readonly AffiliationInput[],
): AppResult<PreparedAffiliation[]> {
  const seenOrganizationIds = new Set<string>();
  const prepared: PreparedAffiliation[] = [];

  for (const [index, affiliation] of affiliations.entries()) {
    const organizationId = affiliation.organizationId.trim();

    if (!organizationId) {
      return appError('validation', 'Organization is required.', {
        [`affiliations.${index}.organizationId`]: 'Organization is required.',
      });
    }

    if (seenOrganizationIds.has(organizationId)) {
      return appError(
        'validation',
        'A member cannot be linked to the same organization twice.',
        {
          [`affiliations.${index}.organizationId`]:
            'A member cannot be linked to the same organization twice.',
        },
      );
    }

    const title = normalizeAffiliationTitle(affiliation.title ?? null);

    if (title && title.length > maxAffiliationTitleLength) {
      return appError('validation', 'Affiliation title is too long.', {
        [`affiliations.${index}.title`]:
          `Title must be ${maxAffiliationTitleLength} characters or fewer.`,
      });
    }

    seenOrganizationIds.add(organizationId);
    prepared.push({ organizationId, title });
  }

  return appSuccess(prepared);
}

function normalizeAffiliationTitle(title: string | null) {
  if (title === null) {
    return null;
  }

  const normalized = collapseWhitespace(title);

  return normalized || null;
}

function collapseWhitespace(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

export type AffiliationFingerprintInput = {
  organizationId: string;
  title: string | null;
};

// Identifies a member's saved affiliations by content, so a screen holding
// drafts seeded from them can tell a real change from a reordering. Affiliations
// arrive ordered by organization name, so renaming one permutes the list without
// changing what it holds — hence the sort.
export function memberAffiliationsFingerprint(
  affiliations: readonly AffiliationFingerprintInput[],
) {
  return affiliations
    .map(
      (affiliation) =>
        `${affiliation.organizationId}:${affiliation.title ?? ''}`,
    )
    .sort()
    .join('|');
}
