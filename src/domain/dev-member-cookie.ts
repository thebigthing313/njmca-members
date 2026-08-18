const devMemberCookieName = 'njmca_dev_member';

export function getDevMemberCookieHeader(key: string) {
  return `${devMemberCookieName}=${encodeURIComponent(key)}; Path=/; SameSite=Lax`;
}

export function getClearDevMemberCookieHeader() {
  return `${devMemberCookieName}=; Path=/; Max-Age=0; SameSite=Lax`;
}

export function readDevMemberCookieKey(cookieHeader: string) {
  const match = cookieHeader
    .split(';')
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(`${devMemberCookieName}=`));

  if (!match) {
    return null;
  }

  return decodeURIComponent(match.slice(devMemberCookieName.length + 1));
}
