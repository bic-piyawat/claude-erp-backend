import { NAVIGATION_BY_ROLE, navigationForRole } from '../navigation.constant';
import { MembershipRoleEnum } from '../../../common/enums/membership-role.enum';

describe('navigation.constant', () => {
  it('every role array is sorted ascending by order', () => {
    for (const [role, items] of Object.entries(NAVIGATION_BY_ROLE)) {
      const orders = items.map((i) => i.order);
      const sorted = [...orders].sort((a, b) => a - b);
      expect({ role, orders }).toEqual({ role, orders: sorted });
    }
  });

  it('every role array starts with the shared base (overview, projects)', () => {
    for (const items of Object.values(NAVIGATION_BY_ROLE)) {
      expect(items[0]?.key).toBe('overview');
      expect(items[1]?.key).toBe('projects');
    }
  });

  it('every nav item has the required fields populated', () => {
    for (const items of Object.values(NAVIGATION_BY_ROLE)) {
      for (const item of items) {
        expect(item.key).toBeTruthy();
        expect(item.labelKey).toMatch(/^Sidebar\./);
        expect(item.path.startsWith('/')).toBe(true);
        expect(item.icon).toBeTruthy();
        expect(typeof item.order).toBe('number');
      }
    }
  });

  it('navigationForRole falls back to the base list for an unknown role', () => {
    const items = navigationForRole('NOT_A_REAL_ROLE');
    expect(items.map((i) => i.key)).toEqual(['overview', 'projects']);
  });

  it('navigationForRole(FOUNDER) includes platformSettings but NOT customFields (PRJ-073: customFields is org SUPER_ADMIN only)', () => {
    const keys = navigationForRole(MembershipRoleEnum.FOUNDER).map(
      (i) => i.key,
    );
    expect(keys).toContain('platformSettings');
    expect(keys).not.toContain('customFields');
  });

  it('navigationForRole(SUPER_ADMIN) includes orgSettings but not platformSettings', () => {
    const keys = navigationForRole(MembershipRoleEnum.SUPER_ADMIN).map(
      (i) => i.key,
    );
    expect(keys).toContain('orgSettings');
    expect(keys).not.toContain('platformSettings');
  });
});
