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

  const value = match.slice(devMemberCookieName.length + 1);

  try {
    return decodeURIComponent(value);
  } catch {
    // A malformed percent sequence throws URIError. This runs on every
    // protected request in development, so treat an unreadable cookie as no
    // cookie rather than 500ing the page that would let you clear it.
    return null;
  }
}
