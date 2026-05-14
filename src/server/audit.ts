import type { PoolClient } from 'pg';

export type AuditTransactionMethod = 'manual' | 'csv_import' | 'seed' | 'system';

export type AuditActor = {
  userId: string | null;
  memberId: string | null;
};

export type WriteAuditEventInput = {
  actor: AuditActor;
  subjectType: string;
  subjectId: string;
  eventType: string;
  transactionMethod: AuditTransactionMethod;
  metadata: Record<string, unknown>;
};

export type FlatAuditEventInput = {
  actorUserId: string | null;
  actorMemberId: string | null;
  subjectType: string;
  subjectId: string;
  eventType: string;
  transactionMethod: AuditTransactionMethod;
  metadata: Record<string, unknown>;
};

export async function writeAuditEvent(
  client: PoolClient,
  input: WriteAuditEventInput | FlatAuditEventInput,
) {
  const event = normalizeAuditEvent(input);

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
        $4,
        $5,
        $6,
        $7,
        $8::jsonb
      )
    `,
    [
      crypto.randomUUID(),
      event.actorUserId,
      event.actorMemberId,
      event.subjectType,
      event.subjectId,
      event.eventType,
      event.transactionMethod,
      JSON.stringify(event.metadata),
    ],
  );
}

function normalizeAuditEvent(
  input: WriteAuditEventInput | FlatAuditEventInput,
): FlatAuditEventInput {
  if ('actor' in input) {
    return {
      actorUserId: input.actor.userId,
      actorMemberId: input.actor.memberId,
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      eventType: input.eventType,
      transactionMethod: input.transactionMethod,
      metadata: input.metadata,
    };
  }

  return input;
}
