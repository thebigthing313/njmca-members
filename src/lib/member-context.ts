import { createServerFn } from '@tanstack/react-start';

import type { MemberAccess } from '../domain/member-access';

export const getCurrentMemberAccess = createServerFn({ method: 'GET' }).handler(
  async (): Promise<MemberAccess> => {
    const { resolveCurrentMemberAccess } = await import(
      '../server/current-member-access'
    );

    return resolveCurrentMemberAccess();
  },
);
