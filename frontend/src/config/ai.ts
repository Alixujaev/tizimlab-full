import type { Role } from '@/types';

/** P18 (D-179): AI ekstraksiya ruxsatlari — backend `ai:*` katalogi bilan bir xil (UI faqat yashiradi). */
export const AI_ROLES = {
  sample: ['kontrolyor', 'lab_head'],
  reagent: ['kontrolyor', 'lab_head', 'chemist'],
  nd: ['lab_head', 'admin'],
} as const satisfies Record<'sample' | 'reagent' | 'nd', readonly Role[]>;

export const canUseAi = (kind: keyof typeof AI_ROLES, role: Role | undefined): boolean =>
  Boolean(role && (AI_ROLES[kind] as readonly Role[]).includes(role));
