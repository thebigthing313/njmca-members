import { type AppResult, appError, appSuccess } from './app-result';
import { normalizeEmail } from './normalization';
import { hasPermission, permissionKeys } from './permissions';

export type ManagedMember = {
  id: string;
  userId: string | null;
  firstName: string;
  lastName: string;
  email: string | null;
  emailNormalized: string | null;
  phone: string | null;
  isActive: boolean;
};

export type MemberManagementActor = {
  userId: string;
  memberId: string | null;
  permissions: readonly string[];
};

export type MemberManagementAuditEvent = {
  actorUserId: string;
  actorMemberId: string | null;
  subjectType: 'member';
  subjectId: string;
  eventType:
    | 'member.created'
    | 'member.updated'
    | 'member.deactivated'
    | 'member.unlinked';
  transactionMethod: 'manual';
  metadata: Record<string, unknown>;
};

export type MemberManagementTransaction = {
  findMemberById(id: string): Promise<ManagedMember | null>;
  findMemberByEmailNormalized(
    emailNormalized: string,
  ): Promise<ManagedMember | null>;
  createMember(input: MemberWrite): Promise<ManagedMember>;
  updateMember(id: string, input: Partial<MemberWrite>): Promise<ManagedMember>;
  writeAuditEvent(event: MemberManagementAuditEvent): Promise<void>;
};

export type MemberManagementGateway = {
  runInTransaction<T>(
    callback: (transaction: MemberManagementTransaction) => Promise<T>,
  ): Promise<T>;
};

export type MemberWrite = {
  firstName: string;
  lastName: string;
  email: string | null;
  emailNormalized: string | null;
  phone: string | null;
  isActive: boolean;
  userId: string | null;
};

export type CreateMemberInput = {
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
};

export type UpdateMemberInput = {
  memberId: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  unlinkOnEmailChange?: boolean;
};

export type MemberIdInput = {
  memberId: string;
};

export async function createManagedMember(
  actor: MemberManagementActor | null,
  input: CreateMemberInput,
  gateway: MemberManagementGateway,
): Promise<AppResult<ManagedMember>> {
  return translateUnexpected('Member creation failed unexpectedly.', async () => {
    const actorResult = requireManageMembers(actor);

    if (!actorResult.ok) {
      return actorResult;
    }

    const normalizedInput = normalizeMemberWriteInput(input);

    if (!normalizedInput.ok) {
      return normalizedInput;
    }

    return gateway.runInTransaction(async (transaction) => {
      if (normalizedInput.data.emailNormalized) {
        const existing = await transaction.findMemberByEmailNormalized(
          normalizedInput.data.emailNormalized,
        );

        if (existing) {
          return appError(
            'conflict',
            'A member already has that email address.',
          );
        }
      }

      const member = await transaction.createMember({
        ...normalizedInput.data,
        isActive: true,
        userId: null,
      });

      await transaction.writeAuditEvent({
        actorUserId: actorResult.data.userId,
        actorMemberId: actorResult.data.memberId,
        subjectType: 'member',
        subjectId: member.id,
        eventType: 'member.created',
        transactionMethod: 'manual',
        metadata: {
          after: getAuditMemberSnapshot(member),
        },
      });

      return appSuccess(member);
    });
  });
}

export async function updateManagedMember(
  actor: MemberManagementActor | null,
  input: UpdateMemberInput,
  gateway: MemberManagementGateway,
): Promise<AppResult<ManagedMember>> {
  return translateUnexpected('Member update failed unexpectedly.', async () => {
    const actorResult = requireManageMembers(actor);

    if (!actorResult.ok) {
      return actorResult;
    }

    const normalizedInput = normalizeMemberWriteInput(input);

    if (!normalizedInput.ok) {
      return normalizedInput;
    }

    return gateway.runInTransaction(async (transaction) => {
      const before = await transaction.findMemberById(input.memberId);

      if (!before) {
        return appError('not_found', 'Member not found.');
      }

      if (normalizedInput.data.emailNormalized) {
        const existing = await transaction.findMemberByEmailNormalized(
          normalizedInput.data.emailNormalized,
        );

        if (existing && existing.id !== input.memberId) {
          return appError(
            'conflict',
            'A member already has that email address.',
          );
        }
      }

      const emailChanged =
        before.emailNormalized !== normalizedInput.data.emailNormalized;
      const shouldUnlink =
        emailChanged &&
        before.userId !== null &&
        input.unlinkOnEmailChange !== false;

      const member = await transaction.updateMember(input.memberId, {
        ...normalizedInput.data,
        isActive: before.isActive,
        userId: shouldUnlink ? null : before.userId,
      });

      await transaction.writeAuditEvent({
        actorUserId: actorResult.data.userId,
        actorMemberId: actorResult.data.memberId,
        subjectType: 'member',
        subjectId: member.id,
        eventType: 'member.updated',
        transactionMethod: 'manual',
        metadata: {
          before: getAuditMemberSnapshot(before),
          after: getAuditMemberSnapshot(member),
          emailChanged,
          authUserUnlinked: shouldUnlink,
        },
      });

      return appSuccess(member);
    });
  });
}

export async function deactivateManagedMember(
  actor: MemberManagementActor | null,
  input: MemberIdInput,
  gateway: MemberManagementGateway,
): Promise<AppResult<ManagedMember>> {
  return translateUnexpected(
    'Member deactivation failed unexpectedly.',
    async () => {
      const actorResult = requireManageMembers(actor);

      if (!actorResult.ok) {
        return actorResult;
      }

      return gateway.runInTransaction(async (transaction) => {
        const before = await transaction.findMemberById(input.memberId);

        if (!before) {
          return appError('not_found', 'Member not found.');
        }

        const member = await transaction.updateMember(input.memberId, {
          isActive: false,
        });

        await transaction.writeAuditEvent({
          actorUserId: actorResult.data.userId,
          actorMemberId: actorResult.data.memberId,
          subjectType: 'member',
          subjectId: member.id,
          eventType: 'member.deactivated',
          transactionMethod: 'manual',
          metadata: {
            before: getAuditMemberSnapshot(before),
            after: getAuditMemberSnapshot(member),
          },
        });

        return appSuccess(member);
      });
    },
  );
}

export async function unlinkManagedMemberUser(
  actor: MemberManagementActor | null,
  input: MemberIdInput,
  gateway: MemberManagementGateway,
): Promise<AppResult<ManagedMember>> {
  return translateUnexpected('Member unlink failed unexpectedly.', async () => {
    const actorResult = requireManageMembers(actor);

    if (!actorResult.ok) {
      return actorResult;
    }

    return gateway.runInTransaction(async (transaction) => {
      const before = await transaction.findMemberById(input.memberId);

      if (!before) {
        return appError('not_found', 'Member not found.');
      }

      const member = await transaction.updateMember(input.memberId, {
        userId: null,
      });

      await transaction.writeAuditEvent({
        actorUserId: actorResult.data.userId,
        actorMemberId: actorResult.data.memberId,
        subjectType: 'member',
        subjectId: member.id,
        eventType: 'member.unlinked',
        transactionMethod: 'manual',
        metadata: {
          before: getAuditMemberSnapshot(before),
          after: getAuditMemberSnapshot(member),
        },
      });

      return appSuccess(member);
    });
  });
}

function requireManageMembers(
  actor: MemberManagementActor | null,
): AppResult<MemberManagementActor> {
  if (!actor) {
    return appError('unauthorized', 'Sign in before managing members.');
  }

  if (!hasPermission(actor.permissions, permissionKeys.manageMembers)) {
    return appError(
      'forbidden',
      'You do not have permission to manage members.',
    );
  }

  return appSuccess(actor);
}

function normalizeMemberWriteInput(input: {
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
}): AppResult<Omit<MemberWrite, 'isActive' | 'userId'>> {
  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  const email = normalizeOptionalText(input.email ?? null);
  const emailNormalized = email ? normalizeEmail(email) : null;
  const phone = normalizeOptionalText(input.phone ?? null);
  const fieldErrors: Record<string, string> = {};

  if (!firstName) {
    fieldErrors.firstName = 'First name is required.';
  }

  if (!lastName) {
    fieldErrors.lastName = 'Last name is required.';
  }

  if (email && !email.includes('@')) {
    fieldErrors.email = 'Enter a valid email address.';
  }

  if (Object.keys(fieldErrors).length > 0) {
    return appError(
      'validation',
      'Fix the highlighted member fields.',
      fieldErrors,
    );
  }

  return appSuccess({
    firstName,
    lastName,
    email,
    emailNormalized,
    phone,
  });
}

function normalizeOptionalText(value: string | null) {
  const trimmed = value?.trim() ?? '';

  return trimmed.length > 0 ? trimmed : null;
}

function getAuditMemberSnapshot(member: ManagedMember) {
  return {
    id: member.id,
    userId: member.userId,
    firstName: member.firstName,
    lastName: member.lastName,
    email: member.email,
    emailNormalized: member.emailNormalized,
    phone: member.phone,
    isActive: member.isActive,
  };
}

async function translateUnexpected<T>(
  message: string,
  operation: () => Promise<AppResult<T>>,
): Promise<AppResult<T>> {
  try {
    return await operation();
  } catch {
    return appError('unexpected', message);
  }
}
