import { readDevMemberCookieKey } from '../domain/dev-member-cookie';
import { findDevMemberFixture } from '../domain/dev-fixtures';
import { resolveMemberAccess } from '../domain/member-access';

export function resolveDevMemberAccess(cookieHeader: string | null) {
  if (process.env.NODE_ENV === 'production' || !cookieHeader) {
    return null;
  }

  const fixture = findDevMemberFixture(readDevMemberCookieKey(cookieHeader));

  if (!fixture) {
    return null;
  }

  return resolveMemberAccess(fixture.user, fixture.member, fixture.permissions);
}
