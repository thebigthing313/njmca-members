import { describe, expect, it } from 'vitest';

import type { MemberAccess } from '../domain/member-access';
import { permissionKeys } from '../domain/permissions';
import {
  getBlockedRouteDecision,
  getProtectedRouteDecision,
} from './protected-route-guard';

const activeAccess: Extract<MemberAccess, { status: 'active' }> = {
  status: 'active',
  user: {
    id: 'user-1',
    email: 'member@one.test',
    name: 'Member One',
  },
  member: {
    id: 'member-1',
    userId: 'user-1',
    firstName: 'Member',
    lastName: 'One',
    email: 'member@one.test',
    emailNormalized: 'member@one.test',
    isActive: true,
  },
  permissions: [],
};

const blockedAccess: Extract<MemberAccess, { status: 'blocked' }> = {
  status: 'blocked',
  reason: 'inactive_member',
  user: activeAccess.user,
  member: {
    ...activeAccess.member,
    isActive: false,
  },
};

describe('getProtectedRouteDecision', () => {
  it('redirects unauthenticated users to login with the requested route', () => {
    expect(
      getProtectedRouteDecision(
        { status: 'unauthenticated' },
        { currentHref: '/admin/members' },
      ),
    ).toEqual({
      status: 'redirect',
      redirect: {
        to: '/login',
        search: { redirect: '/admin/members' },
      },
    });
  });

  it('redirects authenticated users without active member access to access-blocked', () => {
    expect(
      getProtectedRouteDecision(blockedAccess, { currentHref: '/portal' }),
    ).toEqual({
      status: 'redirect',
      redirect: {
        to: '/access-blocked',
        search: { reason: 'inactive_member' },
      },
    });
  });

  it('redirects active members missing a required permission to forbidden', () => {
    expect(
      getProtectedRouteDecision(activeAccess, {
        currentHref: '/admin/members',
        requiredPermission: permissionKeys.manageMembers,
      }),
    ).toEqual({
      status: 'redirect',
      redirect: {
        to: '/forbidden',
      },
    });
  });

  it('allows active members with a required permission', () => {
    const authorizedAccess = {
      ...activeAccess,
      permissions: [permissionKeys.manageMembers],
    };

    expect(
      getProtectedRouteDecision(authorizedAccess, {
        currentHref: '/admin/members',
        requiredPermission: permissionKeys.manageMembers,
      }),
    ).toEqual({
      status: 'allow',
      access: authorizedAccess,
    });
  });

  it('allows active members with any listed required permission', () => {
    const authorizedAccess = {
      ...activeAccess,
      permissions: [permissionKeys.manageRoles],
    };

    expect(
      getProtectedRouteDecision(authorizedAccess, {
        currentHref: '/admin/members',
        requiredPermissions: [
          permissionKeys.manageMembers,
          permissionKeys.manageRoles,
        ],
      }),
    ).toEqual({
      status: 'allow',
      access: authorizedAccess,
    });
  });
});

describe('getBlockedRouteDecision', () => {
  it('allows authenticated blocked members to render access-blocked', () => {
    expect(
      getBlockedRouteDecision(blockedAccess, {
        currentHref: '/access-blocked',
      }),
    ).toEqual({
      status: 'allow',
      access: blockedAccess,
    });
  });

  it('redirects active members away from access-blocked', () => {
    expect(
      getBlockedRouteDecision(activeAccess, {
        currentHref: '/access-blocked',
      }),
    ).toEqual({
      status: 'redirect',
      redirect: {
        to: '/portal',
      },
    });
  });
});
