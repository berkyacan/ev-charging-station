import type { UserRole } from '../types';
import { formatRoleLabel } from '../utils/labels';

export interface NavigationLinkDefinition {
  caption: string;
  label: string;
  matchPrefixes?: string[];
  roles: UserRole[];
  shortLabel: string;
  showInSidebar?: boolean;
  to: string;
}

const authenticatedNavigationDefinitions: NavigationLinkDefinition[] = [
  {
    caption: 'Driver workspace overview and charging operations access',
    label: 'Overview',
    matchPrefixes: ['/dashboard'],
    roles: ['EV_DRIVER'],
    shortLabel: 'DB',
    showInSidebar: true,
    to: '/dashboard',
  },
  {
    caption: 'Monitor revenue, usage, and activity reports in admin view',
    label: 'Admin Reports',
    matchPrefixes: ['/admin'],
    roles: ['ADMIN'],
    shortLabel: 'YR',
    showInSidebar: true,
    to: '/admin/reports',
  },
  {
    caption: 'Vehicle records and charging compatibility profiles',
    label: 'Vehicles',
    matchPrefixes: ['/vehicles'],
    roles: ['EV_DRIVER'],
    shortLabel: 'VR',
    showInSidebar: true,
    to: '/vehicles',
  },
  {
    caption: 'Station discovery, availability status, and route navigation',
    label: 'Stations',
    matchPrefixes: ['/stations', '/route'],
    roles: ['EV_DRIVER'],
    shortLabel: 'SF',
    showInSidebar: true,
    to: '/stations',
  },
  {
    caption: 'Reservation planning, verification, and lifecycle tracking',
    label: 'Reservations',
    matchPrefixes: ['/reservations'],
    roles: ['EV_DRIVER'],
    shortLabel: 'RS',
    showInSidebar: true,
    to: '/reservations',
  },
  {
    caption: 'Charging session management and payment summary',
    label: 'Charging Sessions',
    matchPrefixes: ['/charging-sessions'],
    roles: ['EV_DRIVER'],
    shortLabel: 'CS',
    showInSidebar: true,
    to: '/charging-sessions',
  },
  {
    caption: 'Completed sessions, energy usage, and payment history',
    label: 'History',
    matchPrefixes: ['/history'],
    roles: ['EV_DRIVER'],
    shortLabel: 'HI',
    showInSidebar: true,
    to: '/history',
  },
  {
    caption: 'Workspace alerts and notification access',
    label: 'Notifications',
    matchPrefixes: ['/notifications'],
    roles: ['EV_DRIVER'],
    shortLabel: 'AL',
    showInSidebar: false,
    to: '/notifications',
  },
  {
    caption: 'Event logging and service issue reporting',
    label: 'Issues',
    matchPrefixes: ['/issues'],
    roles: ['EV_DRIVER'],
    shortLabel: 'IR',
    showInSidebar: false,
    to: '/issues/report',
  },
  {
    caption: 'Charger availability, station assets, and network operations',
    label: 'Operator Panel',
    matchPrefixes: ['/operator'],
    roles: ['OPERATOR'],
    shortLabel: 'OP',
    showInSidebar: true,
    to: '/operator',
  },
];

export const guestLinks: Array<Omit<NavigationLinkDefinition, 'roles'>> = [
  {
    caption: 'Access the charging network workspace',
    label: 'Sign In',
    shortLabel: 'SI',
    to: '/login',
  },
  {
    caption: 'Create a charging network account',
    label: 'Register',
    shortLabel: 'CA',
    to: '/register',
  },
];

export function getSidebarLinksForRole(
  role: UserRole | null,
): NavigationLinkDefinition[] {
  if (!role) {
    return [];
  }

  return authenticatedNavigationDefinitions.filter(
    (link) => link.showInSidebar && link.roles.includes(role),
  );
}

export function resolveSectionForPath(
  pathname: string,
  role: UserRole | null,
): NavigationLinkDefinition | null {
  const matchingLink = authenticatedNavigationDefinitions.find((link) => {
    if (role && !link.roles.includes(role)) {
      return false;
    }

    const candidatePrefixes = link.matchPrefixes ?? [link.to];

    return candidatePrefixes.some((prefix) => matchesPath(pathname, prefix));
  });

  return matchingLink ?? null;
}

export function getDefaultPathForRole(role: UserRole | null | undefined): string {
  switch (role) {
    case 'OPERATOR':
      return '/operator';
    case 'ADMIN':
      return '/admin/reports';
    case 'EV_DRIVER':
    default:
      return '/dashboard';
  }
}

export function getRoleLabel(role: UserRole | null | undefined): string {
  return formatRoleLabel(role);
}

export function isRoleAllowed(
  role: UserRole | null,
  allowedRoles: UserRole[],
): boolean {
  if (!role) {
    return false;
  }

  return allowedRoles.includes(role);
}

function matchesPath(pathname: string, target: string): boolean {
  return pathname === target || pathname.startsWith(`${target}/`);
}
