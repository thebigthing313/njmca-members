import { type AppResult, appError, appSuccess } from './app-result';
import { normalizeEmail } from './normalization';
import { normalizeOrganizationName } from './organizations';

export type CsvMemberImportMapping = {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  organization?: string | null;
  title?: string | null;
};

export type CsvMemberImportOrganizationMode =
  | {
      type: 'none';
    }
  | {
      type: 'fixed';
      organizationName: string;
    }
  | {
      type: 'column';
    };

export type PreviewMemberCsvImportInput = {
  csvText: string;
  mapping: CsvMemberImportMapping;
  organizationMode: CsvMemberImportOrganizationMode;
};

export type ExistingImportMember = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  emailNormalized: string | null;
  phone: string | null;
  isActive: boolean;
  organizationNames: readonly string[];
};

export type ExistingImportOrganization = {
  id: string;
  name: string;
  nameNormalized: string;
};

export type CsvImportReferenceData = {
  members: readonly ExistingImportMember[];
  organizations: readonly ExistingImportOrganization[];
};

export type CsvMemberImportPreviewRow = {
  rowNumber: number;
  status: 'ready' | 'blocked' | 'review_required';
  action: 'create_member' | 'update_member' | 'skip';
  firstName: string;
  lastName: string;
  email: string | null;
  emailNormalized: string | null;
  phone: string | null;
  organizationName: string | null;
  organizationNameNormalized: string | null;
  title: string | null;
  existingMemberId: string | null;
  possibleDuplicateMemberIds: string[];
  messages: string[];
};

export type CsvMemberImportPreview = {
  previewFingerprint: string;
  headers: string[];
  rows: CsvMemberImportPreviewRow[];
  newOrganizations: {
    name: string;
    nameNormalized: string;
    rowNumbers: number[];
  }[];
  summary: {
    totalRows: number;
    readyRows: number;
    blockedRows: number;
    reviewRows: number;
    membersToCreate: number;
    membersToUpdate: number;
    organizationsToCreate: number;
  };
};

type ParsedCsv = {
  headers: string[];
  rows: Record<string, string>[];
};

const fieldGuessPatterns: Record<keyof CsvMemberImportMapping, RegExp[]> = {
  firstName: [/^first$/, /^first name$/, /^firstname$/, /^given name$/],
  lastName: [/^last$/, /^last name$/, /^lastname$/, /^surname$/, /^family name$/],
  email: [/^email$/, /^email address$/, /^e-mail$/, /^e-mail address$/],
  phone: [/^phone$/, /^phone number$/, /^telephone$/, /^mobile$/, /^cell$/],
  organization: [
    /^organization$/,
    /^organisation$/,
    /^org$/,
    /^company$/,
    /^district$/,
    /^agency$/,
  ],
  title: [/^title$/, /^position$/, /^role$/, /^job title$/],
};

export function getCsvHeadersFromText(csvText: string): AppResult<string[]> {
  const parsed = parseCsvWithHeader(csvText);

  if (!parsed.ok) {
    return parsed;
  }

  return appSuccess(parsed.data.headers);
}

export function guessCsvMemberImportMapping(
  headers: readonly string[],
): CsvMemberImportMapping {
  const mapping: CsvMemberImportMapping = {};

  for (const key of Object.keys(fieldGuessPatterns) as Array<
    keyof CsvMemberImportMapping
  >) {
    const match = headers.find((header) =>
      fieldGuessPatterns[key].some((pattern) =>
        pattern.test(normalizeHeader(header)),
      ),
    );

    if (match) {
      mapping[key] = match;
    }
  }

  return mapping;
}

export function previewMemberCsvImport(
  input: PreviewMemberCsvImportInput,
  referenceData: CsvImportReferenceData,
): AppResult<CsvMemberImportPreview> {
  const parsed = parseCsvWithHeader(input.csvText);

  if (!parsed.ok) {
    return parsed;
  }

  const mappingValidation = validateMapping(
    parsed.data.headers,
    input.mapping,
    input.organizationMode,
  );

  if (!mappingValidation.ok) {
    return mappingValidation;
  }

  const rows = buildPreviewRows(input, parsed.data, referenceData);
  const newOrganizations = findNewOrganizations(rows, referenceData);

  const preview = {
    headers: parsed.data.headers,
    rows,
    newOrganizations,
    summary: {
      totalRows: rows.length,
      readyRows: rows.filter((row) => row.status === 'ready').length,
      blockedRows: rows.filter((row) => row.status === 'blocked').length,
      reviewRows: rows.filter((row) => row.status === 'review_required')
        .length,
      membersToCreate: rows.filter(
        (row) => row.status === 'ready' && row.action === 'create_member',
      ).length,
      membersToUpdate: rows.filter(
        (row) => row.status === 'ready' && row.action === 'update_member',
      ).length,
      organizationsToCreate: newOrganizations.length,
    },
  };

  return appSuccess({
    previewFingerprint: createCsvMemberImportPreviewFingerprint(preview),
    ...preview,
  });
}

export function createCsvMemberImportPreviewFingerprint(
  preview: Omit<CsvMemberImportPreview, 'previewFingerprint'>,
) {
  return hashString(stableStringify(preview));
}

function buildPreviewRows(
  input: PreviewMemberCsvImportInput,
  parsed: ParsedCsv,
  referenceData: CsvImportReferenceData,
) {
  const fileEmailCounts = countFileEmails(parsed.rows, input.mapping);
  const membersByEmail = new Map(
    referenceData.members
      .filter((member) => member.emailNormalized)
      .map((member) => [member.emailNormalized, member]),
  );

  return parsed.rows.map((row, index) => {
    const firstName = getMappedValue(row, input.mapping.firstName);
    const lastName = getMappedValue(row, input.mapping.lastName);
    const email = getMappedValue(row, input.mapping.email) || null;
    const emailNormalized = email ? normalizeEmail(email) : null;
    const phone = getMappedValue(row, input.mapping.phone) || null;
    const organizationName = getOrganizationName(row, input);
    const organizationNameNormalized = organizationName
      ? normalizeOrganizationName(organizationName)
      : null;
    const title = getMappedValue(row, input.mapping.title) || null;
    const existingMember = emailNormalized
      ? membersByEmail.get(emailNormalized) ?? null
      : null;
    const messages: string[] = [];
    let status: CsvMemberImportPreviewRow['status'] = 'ready';
    let action: CsvMemberImportPreviewRow['action'] = existingMember
      ? 'update_member'
      : 'create_member';
    let possibleDuplicateMemberIds: string[] = [];

    if (!firstName) {
      messages.push('First name is required.');
    }

    if (!lastName) {
      messages.push('Last name is required.');
    }

    if (email && !email.includes('@')) {
      messages.push('Email must contain @.');
    }

    if (emailNormalized && (fileEmailCounts.get(emailNormalized) ?? 0) > 1) {
      messages.push('Email appears more than once in this CSV.');
    }

    if (input.organizationMode.type === 'fixed' && !organizationName) {
      messages.push('Fixed organization name is required.');
    }

    if (messages.length > 0) {
      status = 'blocked';
      action = 'skip';
    } else if (!emailNormalized) {
      possibleDuplicateMemberIds = findPossibleDuplicateMembers(
        {
          firstName,
          lastName,
          organizationNameNormalized,
        },
        referenceData.members,
      );

      if (possibleDuplicateMemberIds.length > 0) {
        status = 'review_required';
        action = 'skip';
        messages.push(
          'Possible duplicate by name and organization; review before commit.',
        );
      }
    }

    return {
      rowNumber: index + 2,
      status,
      action,
      firstName,
      lastName,
      email,
      emailNormalized,
      phone,
      organizationName,
      organizationNameNormalized,
      title,
      existingMemberId: existingMember?.id ?? null,
      possibleDuplicateMemberIds,
      messages,
    };
  });
}

function parseCsvWithHeader(csvText: string): AppResult<ParsedCsv> {
  const table = parseCsvTable(csvText);

  if (!table.ok) {
    return table;
  }

  const [rawHeaders, ...records] = table.data;
  const headers = (rawHeaders ?? []).map((header) => header.trim());

  if (headers.length === 0 || headers.every((header) => !header)) {
    return appError('validation', 'CSV header row is required.');
  }

  const duplicateHeaders = findDuplicateHeaders(headers);

  if (duplicateHeaders.length > 0) {
    return appError(
      'validation',
      `CSV headers must be unique: ${duplicateHeaders.join(', ')}.`,
    );
  }

  return appSuccess({
    headers,
    rows: records
      .filter((record) => record.some((value) => value.trim()))
      .map((record) =>
        Object.fromEntries(
          headers.map((header, index) => [header, record[index]?.trim() ?? '']),
        ),
      ),
  });
}

function parseCsvTable(csvText: string): AppResult<string[][]> {
  if (!csvText.trim()) {
    return appError('validation', 'Choose a CSV file before previewing.');
  }

  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let index = 0; index < csvText.length; index += 1) {
    const char = csvText[index];
    const next = csvText[index + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (char !== '\r') {
      field += char;
    }
  }

  if (inQuotes) {
    return appError('validation', 'CSV contains an unterminated quoted field.');
  }

  row.push(field);
  rows.push(row);

  return appSuccess(rows);
}

function validateMapping(
  headers: readonly string[],
  mapping: CsvMemberImportMapping,
  organizationMode: CsvMemberImportOrganizationMode,
): AppResult<null> {
  const fieldErrors: Record<string, string> = {};

  for (const [key, header] of Object.entries(mapping)) {
    if (header && !headers.includes(header)) {
      fieldErrors[key] = 'Choose a CSV column.';
    }
  }

  if (!mapping.firstName) {
    fieldErrors.firstName = 'Map first name.';
  }

  if (!mapping.lastName) {
    fieldErrors.lastName = 'Map last name.';
  }

  if (organizationMode.type === 'column' && !mapping.organization) {
    fieldErrors.organization = 'Map organization.';
  }

  if (Object.keys(fieldErrors).length > 0) {
    return appError('validation', 'Fix the CSV field mapping.', fieldErrors);
  }

  return appSuccess(null);
}

function countFileEmails(
  rows: readonly Record<string, string>[],
  mapping: CsvMemberImportMapping,
) {
  const counts = new Map<string, number>();

  for (const row of rows) {
    const email = getMappedValue(row, mapping.email);

    if (email) {
      const normalized = normalizeEmail(email);
      counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
    }
  }

  return counts;
}

function findPossibleDuplicateMembers(
  input: {
    firstName: string;
    lastName: string;
    organizationNameNormalized: string | null;
  },
  members: readonly ExistingImportMember[],
) {
  if (!input.organizationNameNormalized) {
    return [];
  }

  const nameKey = normalizeNameKey(input.firstName, input.lastName);

  return members
    .filter((member) => {
      return (
        normalizeNameKey(member.firstName, member.lastName) === nameKey &&
        member.organizationNames.some(
          (organizationName) =>
            normalizeOrganizationName(organizationName) ===
            input.organizationNameNormalized,
        )
      );
    })
    .map((member) => member.id);
}

function findNewOrganizations(
  rows: readonly CsvMemberImportPreviewRow[],
  referenceData: CsvImportReferenceData,
) {
  const existingNames = new Set(
    referenceData.organizations.map(
      (organization) => organization.nameNormalized,
    ),
  );
  const staged = new Map<
    string,
    { name: string; nameNormalized: string; rowNumbers: number[] }
  >();

  for (const row of rows) {
    if (
      !row.organizationName ||
      !row.organizationNameNormalized ||
      existingNames.has(row.organizationNameNormalized)
    ) {
      continue;
    }

    const current = staged.get(row.organizationNameNormalized);

    if (current) {
      current.rowNumbers.push(row.rowNumber);
    } else {
      staged.set(row.organizationNameNormalized, {
        name: row.organizationName,
        nameNormalized: row.organizationNameNormalized,
        rowNumbers: [row.rowNumber],
      });
    }
  }

  return Array.from(staged.values()).sort((left, right) =>
    left.name.localeCompare(right.name),
  );
}

function getOrganizationName(
  row: Record<string, string>,
  input: PreviewMemberCsvImportInput,
) {
  if (input.organizationMode.type === 'none') {
    return null;
  }

  const value =
    input.organizationMode.type === 'fixed'
      ? input.organizationMode.organizationName
      : getMappedValue(row, input.mapping.organization);

  return value || null;
}

function getMappedValue(
  row: Record<string, string>,
  header: string | null | undefined,
) {
  return header ? row[header]?.trim() ?? '' : '';
}

function findDuplicateHeaders(headers: readonly string[]) {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const header of headers) {
    const normalized = normalizeHeader(header);

    if (seen.has(normalized)) {
      duplicates.add(header);
    } else {
      seen.add(normalized);
    }
  }

  return Array.from(duplicates);
}

function normalizeHeader(header: string) {
  return header.trim().replace(/\s+/g, ' ').toLowerCase();
}

function normalizeNameKey(firstName: string, lastName: string) {
  return `${firstName.trim().toLowerCase()} ${lastName.trim().toLowerCase()}`;
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`)
      .join(',')}}`;
  }

  return JSON.stringify(value);
}

function hashString(value: string) {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(16).padStart(8, '0');
}
