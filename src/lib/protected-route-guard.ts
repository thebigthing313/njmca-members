import { redirect } from '@tanstack/react-router';

import type { MemberAccess } from '../domain/member-access';
import { hasPermission, type PermissionKey } from '../domain/permissions';

export type RedirectTarget =
  | {
      to: '/login';
      search: { redirect: string };
    }
  | {
      to: '/access-blocked';
      search: { reason: Extract<MemberAccess, { status: 'blocked' }>['reason'] };
    }
  | {
      to: '/forbidden' | '/portal';
    };

export type ProtectedRouteDecision =
  | {
      status: 'allow';
      access: Extract<MemberAccess, { status: 'active' }>;
    }
  | {
      status: 'redirect';
      redirect: RedirectTarget;
    };

export type BlockedRouteDecision =
  | {
      status: 'allow';
      access: Extract<MemberAccess, { status: 'blocked' }>;
    }
  | {
      status: 'redirect';
      redirect: RedirectTarget;
    };

export function getProtectedRouteDecision(
  access: MemberAccess,
  options: {
    currentHref: string;
    requiredPermission?: PermissionKey;
    requiredPermissions?: readonly PermissionKey[];
  },
): ProtectedRouteDecision {
  if (access.status === 'unauthenticated') {
    return {
      status: 'redirect',
      redirect: {
        to: '/login',
        search: { redirect: options.currentHref },
      },
    };
  }

  if (access.status === 'blocked') {
    return {
      status: 'redirect',
      redirect: {
        to: '/access-blocked',
        search: { reason: access.reason },
      },
    };
  }

  const requiredPermissions = [
    ...(options.requiredPermission ? [options.requiredPermission] : []),
    ...(options.requiredPermissions ?? []),
  ];

  if (
    requiredPermissions.length > 0 &&
    !requiredPermissions.some((permission) =>
      hasPermission(access.permissions, permission),
    )
  ) {
    return {
      status: 'redirect',
      redirect: {
        to: '/forbidden',
      },
    };
  }

  return { status: 'allow', access };
}

export function getBlockedRouteDecision(
  access: MemberAccess,
  options: {
    currentHref: string;
  },
): BlockedRouteDecision {
  if (access.status === 'unauthenticated') {
    return {
      status: 'redirect',
      redirect: {
        to: '/login',
        search: { redirect: options.currentHref },
      },
    };
  }

  if (access.status === 'active') {
    return {
      status: 'redirect',
      redirect: {
        to: '/portal',
      },
    };
  }

  return { status: 'allow', access };
}

export function requireProtectedRouteAccess(
  access: MemberAccess,
  options: {
    currentHref: string;
    requiredPermission?: PermissionKey;
    requiredPermissions?: readonly PermissionKey[];
  },
) {
  const decision = getProtectedRouteDecision(access, options);

  if (decision.status === 'redirect') {
    throw redirect(decision.redirect);
  }

  return decision.access;
}

export function requireBlockedRouteAccess(
  access: MemberAccess,
  options: {
    currentHref: string;
  },
) {
  const decision = getBlockedRouteDecision(access, options);

  if (decision.status === 'redirect') {
    throw redirect(decision.redirect);
  }

  return decision.access;
}
