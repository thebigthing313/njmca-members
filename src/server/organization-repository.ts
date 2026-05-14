import type { PoolClient } from 'pg';

import { appError, appSuccess, type AppResult } from '../domain/app-result';
import {
  ensureOrganizationCanBeDeleted,
  ensureOrganizationNameIsAvailable,
  prepareMemberAffiliations,
  prepareOrganizationName,
  type AffiliationInput,
} from '../domain/organizations';
import { writeAuditEvent, type AuditActor } from './audit';
import { getDb } from './db';

export type OrganizationRecord = {
  id: string;
  name: string;
  nameNormalized: string;
  memberCount: number;
};

export type MemberAffiliationRecord = {
  id: string;
  organizationId: string;
  organizationName: string;
  title: string | null;
};

export type MemberAffiliationAdminRecord = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  isActive: boolean;
  affiliations: MemberAffiliationRecord[];
};

type OrganizationRow = {
  id: string;
  name: string;
  name_normalized: string;
  member_count: string | number;
};

type MemberAffiliationRow = {
  id: string;
  member_id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  is_active: boolean;
  affiliation_id: string | null;
  organization_id: string | null;
  organization_name: string | null;
  title: string | null;
};

type ExistingOrganizationRow = {
  id: string;
  name: string;
  name_normalized: string;
};

export async function listOrganizations(): Promise<OrganizationRecord[]> {
  const result = await getDb().query<OrganizationRow>(
    `
      select
        organizations.id,
        organizations.name,
        organizations.name_normalized,
        count(organization_members.id) as member_count
      from organizations
      left join organization_members
        on organization_members.organization_id = organizations.id
      group by organizations.id
      order by organizations.name
    `,
  );

  return result.rows.map(toOrganizationRecord);
}

export async function listMembersWithOrganizationAffiliations(): Promise<
  MemberAffiliationAdminRecord[]
> {
  const result = await getDb().query<MemberAffiliationRow>(
    `
      select
        members.id,
        members.first_name,
        members.last_name,
        members.email,
        members.is_active,
        organization_members.id as affiliation_id,
        organization_members.organization_id,
        organizations.name as organization_name,
        organization_members.title
      from members
      left join organization_members
        on organization_members.member_id = members.id
      left join organizations
        on organizations.id = organization_members.organization_id
      order by members.last_name, members.first_name, organizations.name
    `,
  );

  const members = new Map<string, MemberAffiliationAdminRecord>();

  for (const row of result.rows) {
    let member = members.get(row.id);

    if (!member) {
      member = {
        id: row.id,
        firstName: row.first_name,
        lastName: row.last_name,
        email: row.email,
        isActive: row.is_active,
        affiliations: [],
      };
      members.set(row.id, member);
    }

    if (
      row.affiliation_id &&
      row.organization_id &&
      row.organization_name
    ) {
      member.affiliations.push({
        id: row.affiliation_id,
        organizationId: row.organization_id,
        organizationName: row.organization_name,
        title: row.title,
      });
    }
  }

  return Array.from(members.values());
}

export async function createOrganization(input: {
  name: string;
  actor: AuditActor;
}): Promise<AppResult<OrganizationRecord>> {
  const prepared = prepareOrganizationName({ name: input.name });

  if (!prepared.ok) {
    return prepared;
  }

  const client = await getDb().connect();

  try {
    await client.query('begin');

    const existing = await findOrganizationByNormalizedName(
      client,
      prepared.data.nameNormalized,
    );
    const availability = ensureOrganizationNameIsAvailable({ existing });

    if (!availability.ok) {
      await client.query('rollback');
      return availability;
    }

    const insertResult = await client.query<OrganizationRow>(
      `
        insert into organizations (id, name, name_normalized)
        values ($1, $2, $3)
        returning id, name, name_normalized, 0 as member_count
      `,
      [
        crypto.randomUUID(),
        prepared.data.name,
        prepared.data.nameNormalized,
      ],
    );
    const organization = toOrganizationRecord(insertResult.rows[0]);

    await writeAuditEvent(client, {
      actor: input.actor,
      subjectType: 'organization',
      subjectId: organization.id,
      eventType: 'organization.created',
      transactionMethod: 'manual',
      metadata: {
        after: {
          name: organization.name,
          nameNormalized: organization.nameNormalized,
        },
      },
    });

    await client.query('commit');

    return appSuccess(organization);
  } catch (error) {
    await client.query('rollback');

    if (isUniqueViolation(error)) {
      return appError(
        'conflict',
        'An organization with that name already exists.',
        {
          name: 'An organization with that name already exists.',
        },
      );
    }

    throw error;
  } finally {
    client.release();
  }
}

export async function updateOrganization(input: {
  id: string;
  name: string;
  actor: AuditActor;
}): Promise<AppResult<OrganizationRecord>> {
  const prepared = prepareOrganizationName({ name: input.name });

  if (!prepared.ok) {
    return prepared;
  }

  const client = await getDb().connect();

  try {
    await client.query('begin');

    const before = await findOrganizationByIdForUpdate(client, input.id);

    if (!before) {
      await client.query('rollback');
      return appError('not_found', 'Organization was not found.');
    }

    const existing = await findOrganizationByNormalizedName(
      client,
      prepared.data.nameNormalized,
    );
    const availability = ensureOrganizationNameIsAvailable({
      existing,
      currentOrganizationId: input.id,
    });

    if (!availability.ok) {
      await client.query('rollback');
      return availability;
    }

    const updateResult = await client.query<OrganizationRow>(
      `
        update organizations
        set name = $2,
            name_normalized = $3,
            updated_at = now()
        where id = $1
        returning
          id,
          name,
          name_normalized,
          (
            select count(*)
            from organization_members
            where organization_members.organization_id = organizations.id
          ) as member_count
      `,
      [input.id, prepared.data.name, prepared.data.nameNormalized],
    );
    const organization = toOrganizationRecord(updateResult.rows[0]);

    await writeAuditEvent(client, {
      actor: input.actor,
      subjectType: 'organization',
      subjectId: organization.id,
      eventType: 'organization.updated',
      transactionMethod: 'manual',
      metadata: {
        before: {
          name: before.name,
          nameNormalized: before.name_normalized,
        },
        after: {
          name: organization.name,
          nameNormalized: organization.nameNormalized,
        },
      },
    });

    await client.query('commit');

    return appSuccess(organization);
  } catch (error) {
    await client.query('rollback');

    if (isUniqueViolation(error)) {
      return appError(
        'conflict',
        'An organization with that name already exists.',
        {
          name: 'An organization with that name already exists.',
        },
      );
    }

    throw error;
  } finally {
    client.release();
  }
}

export async function deleteOrganization(input: {
  id: string;
  actor: AuditActor;
}): Promise<AppResult<{ id: string }>> {
  const client = await getDb().connect();

  try {
    await client.query('begin');

    const organization = await findOrganizationByIdForUpdate(client, input.id);

    if (!organization) {
      await client.query('rollback');
      return appError('not_found', 'Organization was not found.');
    }

    const memberLinkCount = await countOrganizationMemberLinks(
      client,
      input.id,
    );
    const canDelete = ensureOrganizationCanBeDeleted(memberLinkCount);

    if (!canDelete.ok) {
      await client.query('rollback');
      return canDelete;
    }

    await client.query('delete from organizations where id = $1', [input.id]);

    await writeAuditEvent(client, {
      actor: input.actor,
      subjectType: 'organization',
      subjectId: organization.id,
      eventType: 'organization.deleted',
      transactionMethod: 'manual',
      metadata: {
        before: {
          name: organization.name,
          nameNormalized: organization.name_normalized,
        },
      },
    });

    await client.query('commit');

    return appSuccess({ id: input.id });
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

export async function replaceMemberOrganizationAffiliations(input: {
  memberId: string;
  affiliations: readonly AffiliationInput[];
  actor: AuditActor;
}): Promise<AppResult<MemberAffiliationRecord[]>> {
  const prepared = prepareMemberAffiliations(input.affiliations);

  if (!prepared.ok) {
    return prepared;
  }

  const client = await getDb().connect();

  try {
    await client.query('begin');

    const memberExists = await doesMemberExist(client, input.memberId);

    if (!memberExists) {
      await client.query('rollback');
      return appError('not_found', 'Member was not found.');
    }

    const organizationIds = prepared.data.map(
      (affiliation) => affiliation.organizationId,
    );
    const existingOrganizationIds = await findExistingOrganizationIds(
      client,
      organizationIds,
    );
    const missingOrganizationIds = organizationIds.filter(
      (organizationId) => !existingOrganizationIds.has(organizationId),
    );

    if (missingOrganizationIds.length > 0) {
      await client.query('rollback');
      return appError('not_found', 'One or more organizations were not found.');
    }

    const before = await listMemberAffiliations(client, input.memberId);

    await client.query('delete from organization_members where member_id = $1', [
      input.memberId,
    ]);

    for (const affiliation of prepared.data) {
      await client.query(
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
        `,
        [
          crypto.randomUUID(),
          input.memberId,
          affiliation.organizationId,
          affiliation.title,
        ],
      );
    }

    const after = await listMemberAffiliations(client, input.memberId);

    await writeAuditEvent(client, {
      actor: input.actor,
      subjectType: 'member',
      subjectId: input.memberId,
      eventType: 'member.organizations_updated',
      transactionMethod: 'manual',
      metadata: {
        before: before.map(toAffiliationAuditValue),
        after: after.map(toAffiliationAuditValue),
      },
    });

    await client.query('commit');

    return appSuccess(after);
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

async function findOrganizationByNormalizedName(
  client: PoolClient,
  nameNormalized: string,
) {
  const result = await client.query<ExistingOrganizationRow>(
    `
      select id, name, name_normalized
      from organizations
      where name_normalized = $1
      limit 1
    `,
    [nameNormalized],
  );

  return result.rows[0] ?? null;
}

async function findOrganizationByIdForUpdate(
  client: PoolClient,
  id: string,
) {
  const result = await client.query<ExistingOrganizationRow>(
    `
      select id, name, name_normalized
      from organizations
      where id = $1
      for update
    `,
    [id],
  );

  return result.rows[0] ?? null;
}

async function countOrganizationMemberLinks(client: PoolClient, id: string) {
  const result = await client.query<{ count: string }>(
    `
      select count(*) as count
      from organization_members
      where organization_id = $1
    `,
    [id],
  );

  return Number(result.rows[0]?.count ?? 0);
}

async function doesMemberExist(client: PoolClient, memberId: string) {
  const result = await client.query<{ id: string }>(
    `
      select id
      from members
      where id = $1
      for update
    `,
    [memberId],
  );

  return Boolean(result.rows[0]);
}

async function findExistingOrganizationIds(
  client: PoolClient,
  organizationIds: readonly string[],
) {
  if (organizationIds.length === 0) {
    return new Set<string>();
  }

  const result = await client.query<{ id: string }>(
    `
      select id
      from organizations
      where id = any($1::text[])
    `,
    [organizationIds],
  );

  return new Set(result.rows.map((row) => row.id));
}

async function listMemberAffiliations(client: PoolClient, memberId: string) {
  const result = await client.query<{
    id: string;
    organization_id: string;
    organization_name: string;
    title: string | null;
  }>(
    `
      select
        organization_members.id,
        organization_members.organization_id,
        organizations.name as organization_name,
        organization_members.title
      from organization_members
      join organizations
        on organizations.id = organization_members.organization_id
      where organization_members.member_id = $1
      order by organizations.name
    `,
    [memberId],
  );

  return result.rows.map((row) => ({
    id: row.id,
    organizationId: row.organization_id,
    organizationName: row.organization_name,
    title: row.title,
  }));
}

function toOrganizationRecord(row: OrganizationRow): OrganizationRecord {
  return {
    id: row.id,
    name: row.name,
    nameNormalized: row.name_normalized,
    memberCount: Number(row.member_count),
  };
}

function toAffiliationAuditValue(affiliation: MemberAffiliationRecord) {
  return {
    organizationId: affiliation.organizationId,
    organizationName: affiliation.organizationName,
    title: affiliation.title,
  };
}

function isUniqueViolation(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === '23505'
  );
}
