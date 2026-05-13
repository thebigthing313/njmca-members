import type { MemberRecord } from '../domain/member-access';
import { normalizeEmail } from '../domain/normalization';
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

export async function findMembersByNormalizedEmail(
  email: string,
): Promise<MemberRecord[]> {
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
      where email_normalized = $1
    `,
    [normalizeEmail(email)],
  );

  return result.rows.map(toMemberRecord);
}

export async function createVerifiedMemberClaim(input: {
  memberId: string;
  emailNormalized: string;
}) {
  const id = crypto.randomUUID();

  await getDb().query(
    `
      insert into member_claims (
        id,
        member_id,
        email_normalized,
        expires_at
      ) values (
        $1,
        $2,
        $3,
        now() + interval '15 minutes'
      )
    `,
    [id, input.memberId, input.emailNormalized],
  );

  return id;
}

export async function linkVerifiedMemberClaim(input: {
  claimId: string;
  userId: string;
  userEmail: string;
}) {
  const client = await getDb().connect();
  const emailNormalized = normalizeEmail(input.userEmail);

  try {
    await client.query('begin');

    const claimResult = await client.query<{
      member_id: string;
      email_normalized: string;
      completed_at: string | null;
      expires_at: string;
    }>(
      `
        select member_id, email_normalized, completed_at, expires_at
        from member_claims
        where id = $1
        for update
      `,
      [input.claimId],
    );
    const claim = claimResult.rows[0];

    if (!claim) {
      await client.query('rollback');
      return { ok: false as const, reason: 'claim_not_found' as const };
    }

    if (claim.completed_at) {
      await client.query('rollback');
      return { ok: false as const, reason: 'claim_completed' as const };
    }

    if (claim.email_normalized !== emailNormalized) {
      await client.query('rollback');
      return { ok: false as const, reason: 'email_mismatch' as const };
    }

    const updateResult = await client.query<MemberRow>(
      `
        update members
        set user_id = $1, updated_at = now()
        where id = $2
          and user_id is null
          and is_active = true
          and email_normalized = $3
        returning
          id,
          user_id,
          first_name,
          last_name,
          email,
          email_normalized,
          is_active
      `,
      [input.userId, claim.member_id, emailNormalized],
    );
    const member = updateResult.rows[0];

    if (!member) {
      await client.query('rollback');
      return { ok: false as const, reason: 'member_not_claimable' as const };
    }

    await client.query(
      `
        update member_claims
        set completed_at = now()
        where id = $1
      `,
      [input.claimId],
    );

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
          'member',
          $3,
          'member.claimed',
          'system',
          $4::jsonb
        )
      `,
      [
        crypto.randomUUID(),
        input.userId,
        member.id,
        JSON.stringify({ emailNormalized }),
      ],
    );

    await client.query('commit');

    return { ok: true as const, member: toMemberRecord(member) };
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

function toMemberRecord(row: MemberRow): MemberRecord {
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
