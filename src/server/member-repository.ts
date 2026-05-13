import type { MemberRecord } from '../domain/member-access';
import { getDb } from './db';

type MemberRow = {
  id: string;
  user_id: string | null;
  first_name: string;
  last_name: string;
  email: string | null;
  email_normalized: string | null;
  is_active: boolean;
};

export async function findMemberByUserId(
  userId: string,
): Promise<MemberRecord | null> {
  const result = await getDb().query<MemberRow>(
    `
      select
        id,
        user_id,
        first_name,
        last_name,
        email,
        email_normalized,
        is_active
      from members
      where user_id = $1
      limit 1
    `,
    [userId],
  );

  const row = result.rows[0];

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    userId: row.user_id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    emailNormalized: row.email_normalized,
    isActive: row.is_active,
  };
}
