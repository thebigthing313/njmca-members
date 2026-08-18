import { describe, expect, it } from 'vitest';

import {
  getClearDevMemberCookieHeader,
  getDevMemberCookieHeader,
  readDevMemberCookieKey,
} from './dev-member-cookie';

describe('dev member cookie', () => {
  it('round-trips a fixture key through the header it writes', () => {
    const header = getDevMemberCookieHeader('active-member');

    expect(readDevMemberCookieKey(header)).toBe('active-member');
  });

  it('round-trips keys needing percent-encoding', () => {
    const header = getDevMemberCookieHeader('member with spaces & symbols');

    expect(readDevMemberCookieKey(header)).toBe('member with spaces & symbols');
  });

  it('finds its cookie among others', () => {
    const key = readDevMemberCookieKey(
      'theme=dark; njmca_dev_member=inactive-member; session=abc',
    );

    expect(key).toBe('inactive-member');
  });

  it('returns null when the cookie is absent', () => {
    expect(readDevMemberCookieKey('theme=dark; session=abc')).toBeNull();
  });

  it('returns null for a malformed percent sequence rather than throwing', () => {
    expect(readDevMemberCookieKey('njmca_dev_member=%')).toBeNull();
    expect(readDevMemberCookieKey('njmca_dev_member=%zz')).toBeNull();
  });

  it('does not match a cookie whose name merely ends with the same text', () => {
    expect(readDevMemberCookieKey('not_njmca_dev_member=sneaky')).toBeNull();
  });

  it('clears the cookie with an expiry in the past', () => {
    expect(getClearDevMemberCookieHeader()).toContain('Max-Age=0');
  });
});
