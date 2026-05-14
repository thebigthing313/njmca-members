import type { PoolClient } from 'pg';

import type {
  ManagedMember,
  MemberManagementAuditEvent,
  MemberManagementGateway,
  MemberManagementTransaction,
  MemberWrite,
} from '../domain/member-management';
import { getDb } from './db';
import { writeAuditEvent as insertAuditEvent } from './audit';

type MemberManagementRow = {
  id: string;
  user_id: string | null;
  first_name: string;
  last_name: string;
  email: string | null;
  email_normalized: string | null;
  phone: string | null;
  is_active: boolean;
};

export const postgresMemberManagementGateway: MemberManagementGateway = {
  async runInTransaction<T>(
    callback: (transaction: MemberManagementTransaction) => Promise<T>,
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

export async function listMembersForManagement(): Promise<ManagedMember[]> {
  const result = await getDb().query<MemberManagementRow>(
    `
      select
        id,
        user_id,
        first_name,
        last_name,
        email,
        email_normalized,
        phone,
        is_active
      from members
      order by last_name, first_name, id
    `,
  );

  return result.rows.map(toManagedMember);
}

function createTransaction(client: PoolClient): MemberManagementTransaction {
  return {
    async findMemberById(id) {
      const result = await client.query<MemberManagementRow>(
        `
          select
            id,
            user_id,
            first_name,
            last_name,
            email,
            email_normalized,
            phone,
            is_active
          from members
          where id = $1
          for update
        `,
        [id],
      );

      return result.rows[0] ? toManagedMember(result.rows[0]) : null;
    },

    async findMemberByEmailNormalized(emailNormalized) {
      const result = await client.query<MemberManagementRow>(
        `
          select
            id,
            user_id,
            first_name,
            last_name,
            email,
            email_normalized,
            phone,
            is_active
          from members
          where email_normalized = $1
          limit 1
        `,
        [emailNormalized],
      );

      return result.rows[0] ? toManagedMember(result.rows[0]) : null;
    },

    async createMember(input) {
      const result = await client.query<MemberManagementRow>(
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
            $2,
            $3,
            $4,
            $5,
            $6,
            $7,
            $8
          )
          returning
            id,
            user_id,
            first_name,
            last_name,
            email,
            email_normalized,
            phone,
            is_active
        `,
        [
          crypto.randomUUID(),
          input.userId,
          input.firstName,
          input.lastName,
          input.email,
          input.emailNormalized,
          input.phone,
          input.isActive,
        ],
      );

      return toManagedMember(result.rows[0]);
    },

    async updateMember(id, input) {
      const current = await this.findMemberById(id);

      if (!current) {
        throw new Error('Cannot update missing member.');
      }

      const next = {
        userId: coalesce(input.userId, current.userId),
        firstName: coalesce(input.firstName, current.firstName),
        lastName: coalesce(input.lastName, current.lastName),
        email: coalesce(input.email, current.email),
        emailNormalized: coalesce(
          input.emailNormalized,
          current.emailNormalized,
        ),
        phone: coalesce(input.phone, current.phone),
        isActive: coalesce(input.isActive, current.isActive),
      } satisfies MemberWrite;

      const result = await client.query<MemberManagementRow>(
        `
          update members
          set
            user_id = $2,
            first_name = $3,
            last_name = $4,
            email = $5,
            email_normalized = $6,
            phone = $7,
            is_active = $8,
            updated_at = now()
          where id = $1
          returning
            id,
            user_id,
            first_name,
            last_name,
            email,
            email_normalized,
            phone,
            is_active
        `,
        [
          id,
          next.userId,
          next.firstName,
          next.lastName,
          next.email,
          next.emailNormalized,
          next.phone,
          next.isActive,
        ],
      );

      return toManagedMember(result.rows[0]);
    },

    async writeAuditEvent(event: MemberManagementAuditEvent) {
      await insertAuditEvent(client, {
        actor: {
          userId: event.actorUserId,
          memberId: event.actorMemberId,
        },
        subjectType: event.subjectType,
        subjectId: event.subjectId,
        eventType: event.eventType,
        transactionMethod: event.transactionMethod,
        metadata: event.metadata,
      });
    },
  };
}

function toManagedMember(row: MemberManagementRow): ManagedMember {
  return {
    id: row.id,
    userId: row.user_id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    emailNormalized: row.email_normalized,
    phone: row.phone,
    isActive: row.is_active,
  };
}

function coalesce<T>(value: T | undefined, fallback: T): T {
  return value === undefined ? fallback : value;
}
