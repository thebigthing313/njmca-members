import { describe, expect, it } from 'vitest';

import type {
  ManagedMember,
  MemberManagementActor,
  MemberManagementAuditEvent,
  MemberManagementGateway,
  MemberManagementTransaction,
  MemberWrite,
} from './member-management';
import {
  createManagedMember,
  deactivateManagedMember,
  unlinkManagedMemberUser,
  updateManagedMember,
} from './member-management';
import { permissionKeys } from './permissions';

const operator: MemberManagementActor = {
  userId: 'operator-user',
  memberId: 'operator-member',
  permissions: [permissionKeys.manageMembers],
};

const linkedMember: ManagedMember = {
  id: 'member-linked',
  userId: 'auth-user-1',
  firstName: 'Linked',
  lastName: 'Member',
  email: 'linked@njmca.test',
  emailNormalized: 'linked@njmca.test',
  phone: '555-0100',
  isActive: true,
};

describe('member management', () => {
  it('creates a member with a nullable email and writes audit metadata', async () => {
    const gateway = new FakeMemberGateway();

    const result = await createManagedMember(
      operator,
      {
        firstName: '  Noemi  ',
        lastName: '  Noemail  ',
        email: '',
        phone: ' 555-1111 ',
      },
      gateway,
    );

    expect(result).toMatchObject({
      ok: true,
      data: {
        firstName: 'Noemi',
        lastName: 'Noemail',
        email: null,
        emailNormalized: null,
        phone: '555-1111',
        userId: null,
        isActive: true,
      },
    });
    expect(gateway.auditEvents).toMatchObject([
      {
        actorUserId: operator.userId,
        actorMemberId: operator.memberId,
        eventType: 'member.created',
        transactionMethod: 'manual',
      },
    ]);
  });

  it('validates required names and basic email shape', async () => {
    const gateway = new FakeMemberGateway();

    const result = await createManagedMember(
      operator,
      { firstName: ' ', lastName: '', email: 'not-an-email' },
      gateway,
    );

    expect(result).toMatchObject({
      ok: false,
      error: {
        type: 'validation',
        fieldErrors: {
          firstName: 'First name is required.',
          lastName: 'Last name is required.',
          email: 'Enter a valid email address.',
        },
      },
    });
  });

  it('rejects normalized email conflicts when creating members', async () => {
    const gateway = new FakeMemberGateway([linkedMember]);

    const result = await createManagedMember(
      operator,
      {
        firstName: 'Duplicate',
        lastName: 'Email',
        email: '  LINKED@NJMCA.TEST ',
      },
      gateway,
    );

    expect(result).toMatchObject({
      ok: false,
      error: { type: 'conflict' },
    });
  });

  it('returns unauthorized and forbidden outcomes before mutating', async () => {
    const gateway = new FakeMemberGateway();

    await expect(
      createManagedMember(null, validCreateInput(), gateway),
    ).resolves.toMatchObject({
      ok: false,
      error: { type: 'unauthorized' },
    });

    await expect(
      createManagedMember(
        { ...operator, permissions: [] },
        validCreateInput(),
        gateway,
      ),
    ).resolves.toMatchObject({
      ok: false,
      error: { type: 'forbidden' },
    });

    expect(gateway.members).toHaveLength(0);
  });

  it('updates member email and unlinks the auth user by default', async () => {
    const gateway = new FakeMemberGateway([linkedMember]);

    const result = await updateManagedMember(
      operator,
      {
        memberId: linkedMember.id,
        firstName: 'Linked',
        lastName: 'Member',
        email: 'new-linked@njmca.test',
        phone: '555-0100',
      },
      gateway,
    );

    expect(result).toMatchObject({
      ok: true,
      data: {
        email: 'new-linked@njmca.test',
        emailNormalized: 'new-linked@njmca.test',
        userId: null,
      },
    });
    expect(gateway.auditEvents[0].metadata).toMatchObject({
      emailChanged: true,
      authUserUnlinked: true,
      before: { userId: 'auth-user-1' },
      after: { userId: null },
    });
  });

  it('explicitly unlinks a member from an auth user', async () => {
    const gateway = new FakeMemberGateway([linkedMember]);

    const result = await unlinkManagedMemberUser(
      operator,
      { memberId: linkedMember.id },
      gateway,
    );

    expect(result).toMatchObject({
      ok: true,
      data: { userId: null, isActive: true },
    });
    expect(gateway.auditEvents).toMatchObject([
      { eventType: 'member.unlinked' },
    ]);
  });

  it('deactivates a member while retaining the linked user', async () => {
    const gateway = new FakeMemberGateway([linkedMember]);

    const result = await deactivateManagedMember(
      operator,
      { memberId: linkedMember.id },
      gateway,
    );

    expect(result).toMatchObject({
      ok: true,
      data: { userId: 'auth-user-1', isActive: false },
    });
    expect(gateway.auditEvents).toMatchObject([
      { eventType: 'member.deactivated' },
    ]);
  });

  it('translates unexpected transaction errors into typed results', async () => {
    const gateway = new FakeMemberGateway();
    gateway.throwInTransaction = true;

    const result = await createManagedMember(
      operator,
      validCreateInput(),
      gateway,
    );

    expect(result).toEqual({
      ok: false,
      error: {
        type: 'unexpected',
        message: 'Member creation failed unexpectedly.',
      },
    });
  });
});

function validCreateInput() {
  return {
    firstName: 'Val',
    lastName: 'Member',
    email: 'val.member@njmca.test',
  };
}

class FakeMemberGateway implements MemberManagementGateway {
  auditEvents: MemberManagementAuditEvent[] = [];
  members: ManagedMember[];
  throwInTransaction = false;
  private nextId = 1;

  constructor(members: ManagedMember[] = []) {
    this.members = members.map((member) => ({ ...member }));
  }

  async runInTransaction<T>(
    callback: (transaction: MemberManagementTransaction) => Promise<T>,
  ) {
    if (this.throwInTransaction) {
      throw new Error('database unavailable');
    }

    return callback({
      findMemberById: async (id) =>
        this.members.find((member) => member.id === id) ?? null,
      findMemberByEmailNormalized: async (emailNormalized) =>
        this.members.find(
          (member) => member.emailNormalized === emailNormalized,
        ) ?? null,
      createMember: async (input) => this.create(input),
      updateMember: async (id, input) => this.update(id, input),
      writeAuditEvent: async (event) => {
        this.auditEvents.push(event);
      },
    });
  }

  private create(input: MemberWrite) {
    const member: ManagedMember = {
      id: `member-${this.nextId}`,
      ...input,
    };

    this.nextId += 1;
    this.members.push(member);

    return member;
  }

  private update(id: string, input: Partial<MemberWrite>) {
    const index = this.members.findIndex((member) => member.id === id);

    if (index < 0) {
      throw new Error('missing member');
    }

    const member = {
      ...this.members[index],
      ...input,
    };

    this.members[index] = member;

    return member;
  }
}
