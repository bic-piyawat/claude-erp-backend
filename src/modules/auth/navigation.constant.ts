import { MembershipRoleEnum } from '../../common/enums/membership-role.enum';

export interface NavigationItem {
  key: string;
  labelKey: string;
  path: string;
  icon: string;
  order: number;
}

const NAV_BASE: NavigationItem[] = [
  {
    key: 'overview',
    labelKey: 'Sidebar.organizationOverview',
    path: '/dashboard',
    icon: 'LayoutDashboard',
    order: 10,
  },
  {
    key: 'projects',
    labelKey: 'Sidebar.projects',
    path: '/projects',
    icon: 'FolderKanban',
    order: 20,
  },
];

// PRJ-073 (revised 2026-05-07): Custom Fields is strictly org SUPER_ADMIN — it
// is intentionally NOT in NAV_FOUNDER. A platform FOUNDER who is also
// SUPER_ADMIN of the active org will pick up customFields from NAV_SUPER_ADMIN
// via the merge in navigationForRoleAndFounderFlag(); a FOUNDER who is only
// MEMBER of the active org should NOT see customFields, and won't.
const NAV_FOUNDER: NavigationItem[] = [
  ...NAV_BASE,
  {
    key: 'platformSettings',
    labelKey: 'Sidebar.platformSettings',
    path: '/platform/settings',
    icon: 'ShieldCheck',
    order: 90,
  },
];

const NAV_SUPER_ADMIN: NavigationItem[] = [
  ...NAV_BASE,
  {
    key: 'customFields',
    labelKey: 'Sidebar.customFields',
    path: '/admin/custom-fields',
    icon: 'Settings',
    order: 80,
  },
  {
    key: 'orgSettings',
    labelKey: 'Sidebar.orgSettings',
    path: '/settings',
    icon: 'Building',
    order: 85,
  },
];

export const NAVIGATION_BY_ROLE: Record<string, NavigationItem[]> = {
  // MembershipRoleEnum.FOUNDER kept for backwards compat with the deprecated
  // per-org FOUNDER role. Post-migration no Membership has role=FOUNDER, so
  // this branch is unreachable via per-org lookup but harmless to keep.
  [MembershipRoleEnum.FOUNDER]: NAV_FOUNDER,
  [MembershipRoleEnum.SUPER_ADMIN]: NAV_SUPER_ADMIN,
  [MembershipRoleEnum.ADMIN]: NAV_BASE,
  [MembershipRoleEnum.MEMBER]: NAV_BASE,
};

export function navigationForRole(role: string): NavigationItem[] {
  return NAVIGATION_BY_ROLE[role] ?? NAV_BASE;
}

/**
 * Composes the navigation list for a user given their active-org Membership
 * role AND their system-level FOUNDER flag.
 *
 * - Non-founders → org-scoped nav by Membership.role.
 * - System founders → union of org-scoped nav + the FOUNDER-only items
 *   (Platform Settings + Custom Fields admin). De-duped by `key` so a
 *   founder who is ALSO SUPER_ADMIN of the active org doesn't see Custom
 *   Fields twice. Result is ordered by `order` ascending.
 */
export function navigationForRoleAndFounderFlag(
  role: string,
  isFounder: boolean,
): NavigationItem[] {
  const orgNav = navigationForRole(role);
  if (!isFounder) return orgNav;
  const merged = new Map<string, NavigationItem>();
  for (const item of [...orgNav, ...NAV_FOUNDER]) {
    merged.set(item.key, item);
  }
  return Array.from(merged.values()).sort((a, b) => a.order - b.order);
}
