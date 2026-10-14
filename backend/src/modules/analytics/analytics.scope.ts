import { ROLE_PERMISSIONS } from '../../config/permissions.js';
import { ForbiddenError, UnauthorizedError } from '../../utils/errors.js';
import { loadUserGrants } from '../auth/auth.service.js';
import type { AuthContext, Role } from '../auth/auth.types.js';
import type { AnalyticsScope, Viewer } from './analytics.types.js';

/** D-159: analitikaga kira oladigan rollar (admin va super_admin — yo'q, grant bilan ham). */
export const ANALYTICS_ROLES = ['kontrolyor', 'chemist', 'lab_head', 'director'] as const;

/** D-159/D-160: doira bo'yicha ko'rinadigan boshqa xodim rollari (o'zi har doim ko'rinadi). */
export const SCOPE_VISIBLE_ROLES: Record<AnalyticsScope, readonly Role[]> = {
  company: ['lab_head', 'chemist', 'kontrolyor'],
  team: ['chemist', 'kontrolyor'],
  self: [],
};

/** Eng keng ruxsat: `analytics:company` > `analytics:team` > o'zi (rol katalogi ∪ individual grant). */
export async function resolveViewer(auth: AuthContext | undefined): Promise<Viewer> {
  if (!auth || !auth.companyId) throw new UnauthorizedError();
  const catalog = ROLE_PERMISSIONS[auth.role] as readonly string[];
  let grants: ReadonlySet<string> | null = null;
  const has = async (key: string): Promise<boolean> => {
    if (catalog.includes(key)) return true;
    auth.grants ??= loadUserGrants(auth.userId, auth.companyId);
    grants ??= await auth.grants;
    return grants.has(key);
  };
  const scope: AnalyticsScope = (await has('analytics:company'))
    ? 'company'
    : (await has('analytics:team'))
      ? 'team'
      : 'self';
  return { userId: auth.userId, companyId: auth.companyId, role: auth.role, scope };
}

export function canView(viewer: Viewer, target: { id: string; role: Role }): boolean {
  return target.id === viewer.userId || SCOPE_VISIBLE_ROLES[viewer.scope].includes(target.role);
}

/** D-160: o'z kompaniyasida, lekin doiradan tashqari — 403 (boshqa kompaniya — service'da 404). */
export function assertCanView(viewer: Viewer, target: { id: string; role: Role }): void {
  if (!canView(viewer, target)) {
    throw new ForbiddenError("Bu xodim ko'rsatkichlarini ko'rish uchun ruxsat yo'q");
  }
}
