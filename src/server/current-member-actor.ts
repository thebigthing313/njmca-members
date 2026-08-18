import { getRequestHeaders } from '@tanstack/react-start/server';

import type { MemberManagementActor } from '../domain/member-management';
import { resolveMemberAccess } from '../domain/member-access';
import { resolveDevMemberAccess } from './dev-member-bypass';
import {
  findEffectivePermissionKeysForMember,
  findMemberByUserId,
} from './member-repository';
import { auth } from './auth';

export async function getCurrentMemberManagementActor(): Promise<MemberManagementActor | null> {
  const headers = getRequestHeaders();
  const devAccess = resolveDevMemberAccess(headers.get('cookie'));

  if (devAccess?.status === 'active') {
    return {
      userId: devAccess.user.id,
      memberId: devAccess.member.id,
      permissions: devAccess.permissions,
    };
  }

  const session = await auth.api.getSession({ headers });

  if (!session?.user.email) {
    return null;
  }

  const user = {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name ?? null,
  };
  const member = await findMemberByUserId(user.id);
  const access = resolveMemberAccess(user, member);

  if (access.status !== 'active') {
    return {
      userId: user.id,
      memberId: member?.id ?? null,
      permissions: [],
    };
  }

  return {
    userId: user.id,
    memberId: access.member.id,
    permissions: await findEffectivePermissionKeysForMember(access.member.id),
  };
}
