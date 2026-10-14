import { ANALYTICS_ROLES, TEAM_ANALYTICS_ROLES } from '@/config/analytics';
import { COMPANY_ROLES, type Role } from '@/types';
import type { IconName } from '@/ui';

/** Foydalanuvchilar va Faoliyat sahifalariga kiruvchi rollar (spec §1 matritsa, §10, §11). */
export const MANAGER_ROLES = ['lab_head', 'director', 'admin'] as const satisfies readonly Role[];

export interface NavItem {
  key: string;
  path: string;
  labelKey: string;
  icon: IconName;
  roles: readonly Role[];
}

/**
 * Sidebar menyusi — ma'lumotga asoslangan (D-28, spec §16 eslatmasi).
 * Moddalar, Reaktivlar, Stabilizatsiya menyuda YO'Q — ichki havolalar orqali ochiladi.
 */
export const NAV_ITEMS: readonly NavItem[] = [
  { key: 'dashboard', path: '/', labelKey: 'nav.dashboard', icon: 'home', roles: COMPANY_ROLES },
  {
    key: 'samples',
    path: '/samples',
    labelKey: 'nav.samples',
    icon: 'flask',
    roles: COMPANY_ROLES,
  },
  {
    key: 'substances',
    path: '/substances',
    labelKey: 'nav.substances',
    icon: 'beaker',
    roles: COMPANY_ROLES,
  },
  {
    key: 'registry',
    path: '/registry',
    labelKey: 'nav.registry',
    icon: 'clipboard',
    roles: COMPANY_ROLES,
  },
  {
    key: 'temperature',
    path: '/temperature',
    labelKey: 'nav.temperature',
    icon: 'thermometer',
    roles: COMPANY_ROLES,
  },
  {
    key: 'myResults',
    path: '/me',
    labelKey: 'nav.myResults',
    icon: 'check-circle',
    roles: ANALYTICS_ROLES,
  },
  { key: 'team', path: '/team', labelKey: 'nav.team', icon: 'layers', roles: TEAM_ANALYTICS_ROLES },
  { key: 'users', path: '/users', labelKey: 'nav.users', icon: 'users', roles: MANAGER_ROLES },
  {
    key: 'activity',
    path: '/activity',
    labelKey: 'nav.activity',
    icon: 'activity',
    roles: MANAGER_ROLES,
  },
  // super_admin uchun alohida menyu (spec §1)
  {
    key: 'companies',
    path: '/companies',
    labelKey: 'nav.companies',
    icon: 'building',
    roles: ['super_admin'],
  },
  {
    key: 'auditLog',
    path: '/logs',
    labelKey: 'nav.auditLog',
    icon: 'shield-check',
    roles: ['super_admin'],
  },
];

export function navItemsFor(role: Role): NavItem[] {
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}
