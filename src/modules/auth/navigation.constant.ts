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

const NAV_FOUNDER: NavigationItem[] = [
  ...NAV_BASE,
  {
    key: 'customFields',
    labelKey: 'Sidebar.customFields',
    path: '/admin/custom-fields',
    icon: 'Settings',
    order: 80,
  },
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
  [MembershipRoleEnum.FOUNDER]: NAV_FOUNDER,
  [MembershipRoleEnum.SUPER_ADMIN]: NAV_SUPER_ADMIN,
  [MembershipRoleEnum.ADMIN]: NAV_BASE,
  [MembershipRoleEnum.MEMBER]: NAV_BASE,
};

export function navigationForRole(role: string): NavigationItem[] {
  return NAVIGATION_BY_ROLE[role] ?? NAV_BASE;
}
