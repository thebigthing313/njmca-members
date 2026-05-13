import { createServerFn } from '@tanstack/react-start';
import { getRequestHeaders } from '@tanstack/react-start/server';

import {
  type AuthenticatedUser,
  type MemberAccess,
  resolveMemberAccess,
} from '../domain/member-access';
import { resolveDevMemberAccess } from '../server/dev-member-bypass';
import { findMemberByUserId } from '../server/member-repository';
import { auth } from './auth';

export const getCurrentMemberAccess = createServerFn({ method: 'GET' }).handler(
  async (): Promise<MemberAccess> => {
    const headers = getRequestHeaders();
    const devAccess = resolveDevMemberAccess(headers.get('cookie'));

    if (devAccess) {
      return devAccess;
    }

    const session = await auth.api.getSession({ headers });
    const user = toAuthenticatedUser(session?.user ?? null);
    const member = user ? await findMemberByUserId(user.id) : null;

    return resolveMemberAccess(user, member);
  },
);

function toAuthenticatedUser(
  user: { id: string; email?: string; name?: string | null } | null,
): AuthenticatedUser | null {
  if (!user?.email) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name ?? null,
  };
}
