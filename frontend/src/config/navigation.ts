import { COMPANY_ROLES, type Role } from '@/types';

/** Foydalanuvchilar va Faoliyat sahifalariga kiruvchi rollar (spec §1 matritsa, §10, §11). */
export const MANAGER_ROLES = ['lab_head', 'director', 'admin'] as const satisfies readonly Role[];

export interface NavItem {
  key: string;
  path: string;
  labelKey: string;
  roles: readonly Role[];
}

/**
 * Sidebar menyusi — ma'lumotga asoslangan (D-28, spec §16 eslatmasi).
 * Moddalar, Reaktivlar, Stabilizatsiya menyuda YO'Q — ichki havolalar orqali ochiladi.
 */
export const NAV_ITEMS: readonly NavItem[] = [
  { key: 'dashboard', path: '/', labelKey: 'nav.dashboard', roles: COMPANY_ROLES },
  { key: 'samples', path: '/samples', labelKey: 'nav.samples', roles: COMPANY_ROLES },
  { key: 'substances', path: '/substances', labelKey: 'nav.substances', roles: COMPANY_ROLES },
  { key: 'registry', path: '/registry', labelKey: 'nav.registry', roles: COMPANY_ROLES },
  { key: 'temperature', path: '/temperature', labelKey: 'nav.temperature', roles: COMPANY_ROLES },
  { key: 'users', path: '/users', labelKey: 'nav.users', roles: MANAGER_ROLES },
  { key: 'activity', path: '/activity', labelKey: 'nav.activity', roles: MANAGER_ROLES },
  // super_admin uchun alohida menyu (spec §1)
  { key: 'companies', path: '/companies', labelKey: 'nav.companies', roles: ['super_admin'] },
  { key: 'auditLog', path: '/logs', labelKey: 'nav.auditLog', roles: ['super_admin'] },
];

export function navItemsFor(role: Role): NavItem[] {
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}
