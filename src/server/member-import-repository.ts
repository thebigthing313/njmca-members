import type {
  CsvImportReferenceData,
  ExistingImportMember,
  ExistingImportOrganization,
} from '../domain/member-import-preview';
import { getDb } from './db';

type ImportMemberRow = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  email_normalized: string | null;
  is_active: boolean;
  organization_names: string[] | null;
};

type ImportOrganizationRow = {
  id: string;
  name: string;
  name_normalized: string;
};

export async function getMemberCsvImportReferenceData(): Promise<CsvImportReferenceData> {
  const [membersResult, organizationsResult] = await Promise.all([
    getDb().query<ImportMemberRow>(
      `
        select
          members.id,
          members.first_name,
          members.last_name,
          members.email,
          members.email_normalized,
          members.is_active,
          coalesce(
            array_agg(organizations.name order by organizations.name)
              filter (where organizations.id is not null),
            '{}'
          ) as organization_names
        from members
        left join organization_members
          on organization_members.member_id = members.id
        left join organizations
          on organizations.id = organization_members.organization_id
        group by members.id
        order by members.last_name, members.first_name
      `,
    ),
    getDb().query<ImportOrganizationRow>(
      `
        select id, name, name_normalized
        from organizations
        order by name
      `,
    ),
  ]);

  return {
    members: membersResult.rows.map(toExistingImportMember),
    organizations: organizationsResult.rows.map(toExistingImportOrganization),
  };
}

function toExistingImportMember(row: ImportMemberRow): ExistingImportMember {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    emailNormalized: row.email_normalized,
    isActive: row.is_active,
    organizationNames: row.organization_names ?? [],
  };
}

function toExistingImportOrganization(
  row: ImportOrganizationRow,
): ExistingImportOrganization {
  return {
    id: row.id,
    name: row.name,
    nameNormalized: row.name_normalized,
  };
}
