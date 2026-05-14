import type { PoolClient } from 'pg';

import {
  getNewYorkLocalDate,
  validateDateWindow,
  validateRoleAssignment,
  type RoleAssignmentMode,
  type RoleAssignmentWindow,
} from '../domain/role-assignments';
import { getDb } from './db';

export type RoleAssignmentAdminMember = {
  id: string;
  displayName: string;
  email: string | null;
  isActive: boolean;
};

export type RoleAssignmentAdminRole = {
  id: string;
  key: string;
  displayName: string;
  assignmentMode: RoleAssignmentMode;
};

export type RoleAssignmentAdminRecord = {
  id: string;
  memberId: string;
  memberName: string;
  roleId: string;
  roleKey: string;
  roleName: string;
  startsOn: string | null;
  endsOn: string | null;
};

export type RoleAssignmentMutationResult =
  | { ok: true; assignment: RoleAssignmentAdminRecord }
  | {
      ok: false;
      reason:
        | 'validation'
        | 'member_not_found'
        | 'role_not_found'
        | 'assignment_not_found'
        | 'conflict'
        | 'unexpected';
      message: string;
    };

type MemberRow = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  is_active: boolean;
};

type RoleRow = {
  id: string;
  key: string;
  display_name: string;
  assignment_mode: RoleAssignmentMode;
};

type AssignmentRow = {
  id: string;
  member_id: string;
  member_name: string;
  role_id: string;
  role_key: string;
  role_name: string;
  starts_on: string | null;
  ends_on: string | null;
};

export async function listRoleAssignmentAdminData() {
  const [members, roles, assignments] = await Promise.all([
    getDb().query<MemberRow>(
      `
        select id, first_name, last_name, email, is_active
        from members
        order by last_name, first_name, id
      `,
    ),
    getDb().query<RoleRow>(
      `
        select id, key, display_name, assignment_mode
        from roles
        order by display_name
      `,
    ),
    getDb().query<AssignmentRow>(assignmentSelectSql()),
  ]);

  return {
    members: members.rows.map((row) => ({
      id: row.id,
      displayName: `${row.first_name} ${row.last_name}`,
      email: row.email,
      isActive: row.is_active,
    })),
    roles: roles.rows.map(toRoleRecord),
    assignments: assignments.rows.map(toAssignmentRecord),
  };
}

export async function assignRoleToMember(input: {
  actorUserId: string;
  actorMemberId: string;
  memberId: string;
  roleId: string;
  startsOn: string | null;
  endsOn: string | null;
}): Promise<RoleAssignmentMutationResult> {
  const client = await getDb().connect();

  try {
    await client.query('begin');

    const memberExists = await findMemberExists(client, input.memberId);

    if (!memberExists) {
      await client.query('rollback');
      return notFound('member_not_found', 'Member was not found.');
    }

    const role = await findRoleForUpdate(client, input.roleId);

    if (!role) {
      await client.query('rollback');
      return notFound('role_not_found', 'Role was not found.');
    }

    const assignment: RoleAssignmentWindow = {
      id: null,
      memberId: input.memberId,
      roleId: input.roleId,
      startsOn: input.startsOn,
      endsOn: input.endsOn,
    };
    const existingAssignments = await findRoleAssignmentWindowsForUpdate(
      client,
      input.roleId,
    );
    const validation = validateRoleAssignment({
      assignment,
      role: { id: role.id, assignmentMode: role.assignment_mode },
      existingAssignments,
    });

    if (!validation.ok) {
      await client.query('rollback');
      return {
        ok: false,
        reason: validation.reason === 'invalid_date' ||
          validation.reason === 'date_order'
          ? 'validation'
          : 'conflict',
        message: getValidationMessage(validation.reason),
      };
    }

    const assignmentId = crypto.randomUUID();

    await client.query(
      `
        insert into member_roles (
          id,
          member_id,
          role_id,
          starts_on,
          ends_on
        ) values (
          $1,
          $2,
          $3,
          $4::date,
          $5::date
        )
      `,
      [
        assignmentId,
        input.memberId,
        input.roleId,
        input.startsOn,
        input.endsOn,
      ],
    );

    await writeRoleAssignmentAuditEvent(client, {
      actorUserId: input.actorUserId,
      actorMemberId: input.actorMemberId,
      assignmentId,
      eventType: 'member_role.assigned',
      metadata: {
        after: {
          memberId: input.memberId,
          roleId: input.roleId,
          startsOn: input.startsOn,
          endsOn: input.endsOn,
        },
      },
    });

    const insertedAssignment = await findAssignmentById(client, assignmentId);

    if (!insertedAssignment) {
      await client.query('rollback');
      return unexpected();
    }

    await client.query('commit');

    return { ok: true, assignment: insertedAssignment };
  } catch {
    await client.query('rollback');
    return unexpected();
  } finally {
    client.release();
  }
}

export async function endRoleAssignment(input: {
  actorUserId: string;
  actorMemberId: string;
  assignmentId: string;
  endsOn: string | null;
}): Promise<RoleAssignmentMutationResult> {
  const client = await getDb().connect();

  try {
    await client.query('begin');

    const existingAssignment = await findAssignmentWindowForUpdate(
      client,
      input.assignmentId,
    );

    if (!existingAssignment) {
      await client.query('rollback');
      return notFound('assignment_not_found', 'Role assignment was not found.');
    }

    const endsOn =
      input.endsOn ?? getDefaultEndDate(existingAssignment.startsOn);
    const validation = validateDateWindow({
      startsOn: existingAssignment.startsOn,
      endsOn,
    });

    if (!validation.ok) {
      await client.query('rollback');
      return {
        ok: false,
        reason: 'validation',
        message: getValidationMessage(validation.reason),
      };
    }

    await client.query(
      `
        update member_roles
        set ends_on = $1::date
        where id = $2
      `,
      [endsOn, input.assignmentId],
    );

    await writeRoleAssignmentAuditEvent(client, {
      actorUserId: input.actorUserId,
      actorMemberId: input.actorMemberId,
      assignmentId: input.assignmentId,
      eventType: 'member_role.ended',
      metadata: {
        before: {
          memberId: existingAssignment.memberId,
          roleId: existingAssignment.roleId,
          startsOn: existingAssignment.startsOn,
          endsOn: existingAssignment.endsOn,
        },
        after: {
          memberId: existingAssignment.memberId,
          roleId: existingAssignment.roleId,
          startsOn: existingAssignment.startsOn,
          endsOn,
        },
      },
    });

    const updatedAssignment = await findAssignmentById(
      client,
      input.assignmentId,
    );

    if (!updatedAssignment) {
      await client.query('rollback');
      return unexpected();
    }

    await client.query('commit');

    return { ok: true, assignment: updatedAssignment };
  } catch {
    await client.query('rollback');
    return unexpected();
  } finally {
    client.release();
  }
}

async function findMemberExists(client: PoolClient, memberId: string) {
  const result = await client.query<{ exists: boolean }>(
    'select exists(select 1 from members where id = $1)',
    [memberId],
  );

  return result.rows[0]?.exists ?? false;
}

async function findRoleForUpdate(client: PoolClient, roleId: string) {
  const result = await client.query<RoleRow>(
    `
      select id, key, display_name, assignment_mode
      from roles
      where id = $1
      for update
    `,
    [roleId],
  );

  return result.rows[0] ?? null;
}

async function findRoleAssignmentWindowsForUpdate(
  client: PoolClient,
  roleId: string,
) {
  const result = await client.query<{
    id: string;
    member_id: string;
    role_id: string;
    starts_on: string | null;
    ends_on: string | null;
  }>(
    `
      select
        id,
        member_id,
        role_id,
        starts_on::text as starts_on,
        ends_on::text as ends_on
      from member_roles
      where role_id = $1
      for update
    `,
    [roleId],
  );

  return result.rows.map((row) => ({
    id: row.id,
    memberId: row.member_id,
    roleId: row.role_id,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
  }));
}

async function findAssignmentWindowForUpdate(
  client: PoolClient,
  assignmentId: string,
): Promise<RoleAssignmentWindow | null> {
  const result = await client.query<{
    id: string;
    member_id: string;
    role_id: string;
    starts_on: string | null;
    ends_on: string | null;
  }>(
    `
      select
        id,
        member_id,
        role_id,
        starts_on::text as starts_on,
        ends_on::text as ends_on
      from member_roles
      where id = $1
      for update
    `,
    [assignmentId],
  );
  const row = result.rows[0];

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    memberId: row.member_id,
    roleId: row.role_id,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
  };
}

async function findAssignmentById(client: PoolClient, assignmentId: string) {
  const result = await client.query<AssignmentRow>(
    `${assignmentSelectSql()} where member_roles.id = $1`,
    [assignmentId],
  );
  const row = result.rows[0];

  return row ? toAssignmentRecord(row) : null;
}

async function writeRoleAssignmentAuditEvent(
  client: PoolClient,
  input: {
    actorUserId: string;
    actorMemberId: string;
    assignmentId: string;
    eventType: string;
    metadata: unknown;
  },
) {
  await client.query(
    `
      insert into audit_events (
        id,
        actor_user_id,
        actor_member_id,
        subject_type,
        subject_id,
        event_type,
        transaction_method,
        metadata
      ) values (
        $1,
        $2,
        $3,
        'member_role',
        $4,
        $5,
        'manual',
        $6::jsonb
      )
    `,
    [
      crypto.randomUUID(),
      input.actorUserId,
      input.actorMemberId,
      input.assignmentId,
      input.eventType,
      JSON.stringify(input.metadata),
    ],
  );
}

function assignmentSelectSql() {
  return `
    select
      member_roles.id,
      member_roles.member_id,
      members.first_name || ' ' || members.last_name as member_name,
      member_roles.role_id,
      roles.key as role_key,
      roles.display_name as role_name,
      member_roles.starts_on::text as starts_on,
      member_roles.ends_on::text as ends_on
    from member_roles
    join members on members.id = member_roles.member_id
    join roles on roles.id = member_roles.role_id
  `;
}

function toRoleRecord(row: RoleRow): RoleAssignmentAdminRole {
  return {
    id: row.id,
    key: row.key,
    displayName: row.display_name,
    assignmentMode: row.assignment_mode,
  };
}

function toAssignmentRecord(row: AssignmentRow): RoleAssignmentAdminRecord {
  return {
    id: row.id,
    memberId: row.member_id,
    memberName: row.member_name,
    roleId: row.role_id,
    roleKey: row.role_key,
    roleName: row.role_name,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
  };
}

function getDefaultEndDate(startsOn: string | null) {
  const today = getNewYorkLocalDate();

  if (startsOn && startsOn > today) {
    return startsOn;
  }

  return today;
}

function getValidationMessage(
  reason:
    | 'invalid_date'
    | 'date_order'
    | 'same_member_role_overlap'
    | 'single_role_overlap',
) {
  switch (reason) {
    case 'invalid_date':
      return 'Use valid YYYY-MM-DD dates.';
    case 'date_order':
      return 'End date must be on or after the start date.';
    case 'same_member_role_overlap':
      return 'This member already has an overlapping assignment for that role.';
    case 'single_role_overlap':
      return 'That role only allows one overlapping assignment at a time.';
    default:
      return 'Role assignment could not be saved.';
  }
}

function notFound(
  reason: 'member_not_found' | 'role_not_found' | 'assignment_not_found',
  message: string,
): RoleAssignmentMutationResult {
  return { ok: false, reason, message };
}

function unexpected(): RoleAssignmentMutationResult {
  return {
    ok: false,
    reason: 'unexpected',
    message: 'Role assignment could not be saved.',
  };
}
