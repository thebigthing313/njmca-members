import type {
  CsvImportCommitGateway,
  CsvImportCommitTransaction,
} from '../domain/member-import-commit';
import type {
  CsvImportReferenceData,
  ExistingImportMember,
  ExistingImportOrganization,
} from '../domain/member-import-preview';
import type { Pool, PoolClient } from 'pg';

import { writeAuditEvent as insertAuditEvent } from './audit';
import { getDb } from './db';

type ImportMemberRow = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  email_normalized: string | null;
  phone: string | null;
  is_active: boolean;
  organization_names: string[] | null;
};

type ImportOrganizationRow = {
  id: string;
  name: string;
  name_normalized: string;
};

type MemberOrganizationRow = {
  id: string;
};

export const postgresMemberCsvImportCommitGateway: CsvImportCommitGateway = {
  async runInTransaction<T>(
    callback: (transaction: CsvImportCommitTransaction) => Promise<T>,
  ) {
    const client = await getDb().connect();

    try {
      await client.query('begin');
      const result = await callback(createTransaction(client));
      await client.query('commit');

      return result;
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  },
};

export async function getMemberCsvImportReferenceData(
  client: Pool | PoolClient = getDb(),
): Promise<CsvImportReferenceData> {
  const membersResult = await client.query<ImportMemberRow>(
    `
      select
        members.id,
        members.first_name,
        members.last_name,
        members.email,
        members.email_normalized,
        members.phone,
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
  );
  const organizationsResult = await client.query<ImportOrganizationRow>(
    `
      select id, name, name_normalized
      from organizations
      order by name
    `,
  );

  return {
    members: membersResult.rows.map(toExistingImportMember),
    organizations: organizationsResult.rows.map(toExistingImportOrganization),
  };
}

function createTransaction(client: PoolClient): CsvImportCommitTransaction {
  return {
    async getReferenceData() {
      return getMemberCsvImportReferenceData(client);
    },

    async createOrganization(input) {
      const result = await client.query<ImportOrganizationRow>(
        `
          insert into organizations (id, name, name_normalized)
          values ($1, $2, $3)
          returning id, name, name_normalized
        `,
        [crypto.randomUUID(), input.name, input.nameNormalized],
      );

      return toExistingImportOrganization(result.rows[0]);
    },

    async createMember(input) {
      const result = await client.query<ImportMemberRow>(
        `
          insert into members (
            id,
            user_id,
            first_name,
            last_name,
            email,
            email_normalized,
            phone,
            is_active
          ) values (
            $1,
            null,
            $2,
            $3,
            $4,
            $5,
            $6,
            true
          )
          returning
            id,
            first_name,
            last_name,
            email,
            email_normalized,
            phone,
            is_active,
            '{}'::text[] as organization_names
        `,
        [
          crypto.randomUUID(),
          input.firstName,
          input.lastName,
          input.email,
          input.emailNormalized,
          input.phone,
        ],
      );

      return toExistingImportMember(result.rows[0]);
    },

    async updateMember(memberId, input) {
      const result = await client.query<ImportMemberRow>(
        `
          update members
          set
            first_name = $2,
            last_name = $3,
            email = $4,
            email_normalized = $5,
            phone = $6,
            updated_at = now()
          where id = $1
          returning
            id,
            first_name,
            last_name,
            email,
            email_normalized,
            phone,
            is_active,
            (
              select coalesce(
                array_agg(organizations.name order by organizations.name),
                '{}'
              )
              from organization_members
              join organizations
                on organizations.id = organization_members.organization_id
              where organization_members.member_id = members.id
            ) as organization_names
        `,
        [
          memberId,
          input.firstName,
          input.lastName,
          input.email,
          input.emailNormalized,
          input.phone,
        ],
      );

      return toExistingImportMember(result.rows[0]);
    },

    async upsertMemberOrganization(input) {
      const result = await client.query<MemberOrganizationRow>(
        `
          insert into organization_members (
            id,
            member_id,
            organization_id,
            title
          ) values (
            $1,
            $2,
            $3,
            $4
          )
          on conflict (member_id, organization_id) do update set
            title = excluded.title,
            updated_at = now()
          returning id
        `,
        [
          crypto.randomUUID(),
          input.memberId,
          input.organizationId,
          input.title,
        ],
      );

      return result.rows[0];
    },

    async writeAuditEvent(event) {
      await insertAuditEvent(client, {
        actorUserId: event.actorUserId,
        actorMemberId: event.actorMemberId,
        subjectType: event.subjectType,
        subjectId: event.subjectId,
        eventType: event.eventType,
        transactionMethod: event.transactionMethod,
        metadata: event.metadata,
      });
    },
  };
}

function toExistingImportMember(row: ImportMemberRow): ExistingImportMember {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    emailNormalized: row.email_normalized,
    phone: row.phone,
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
