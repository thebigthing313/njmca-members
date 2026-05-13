import { findDevMemberFixture } from '../domain/dev-fixtures';
import { resolveMemberAccess } from '../domain/member-access';

const devMemberCookieName = 'njmca_dev_member';

export function getDevMemberCookieName() {
  return devMemberCookieName;
}

export function getDevMemberCookieHeader(key: string) {
  return `${devMemberCookieName}=${encodeURIComponent(key)}; Path=/; SameSite=Lax`;
}

export function getClearDevMemberCookieHeader() {
  return `${devMemberCookieName}=; Path=/; Max-Age=0; SameSite=Lax`;
}

export function resolveDevMemberAccess(cookieHeader: string | null) {
  if (process.env.NODE_ENV === 'production' || !cookieHeader) {
    return null;
  }

  const fixture = findDevMemberFixture(readCookie(cookieHeader, devMemberCookieName));

  if (!fixture) {
    return null;
  }

  return resolveMemberAccess(fixture.user, fixture.member, fixture.permissions);
}

function readCookie(cookieHeader: string, name: string) {
  const match = cookieHeader
    .split(';')
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(`${name}=`));

  if (!match) {
    return null;
  }

  return decodeURIComponent(match.slice(name.length + 1));
}
