import type { Role } from '@/types';

/**
 * P19: OOS va AI kopilot ruxsatlari — backend `oos:*`, `ai:extract_peaks`, `rag:manage` rol standartlari bilan bir xil.
 * UI faqat yashiradi; majburlash serverda. Kontrolyor OOS'ga umuman kirmaydi.
 */
export const OOS_VIEW_ROLES = [
  'chemist',
  'lab_head',
  'director',
  'admin',
] as const satisfies readonly Role[];

/** OOS ochish, izoh, tergov, chat va ilovalar (direktor faqat o'qiydi). */
export const OOS_WRITE_ROLES = ['chemist', 'lab_head', 'admin'] as const satisfies readonly Role[];

/** AI bilan peak jadvalini o'qish. */
export const PEAK_AI_ROLES = ['chemist', 'lab_head', 'admin'] as const satisfies readonly Role[];

/** "Bilim bazasi" (RAG indeks holati). */
export const RAG_ROLES = ['lab_head', 'admin'] as const satisfies readonly Role[];

const has = (roles: readonly Role[], role: Role | undefined) =>
  Boolean(role && roles.includes(role));

export const canWriteOos = (role: Role | undefined) => has(OOS_WRITE_ROLES, role);
/** OOS yopish — FAQAT laboratoriya mudiri (inson qarori; AI hech qachon yopmaydi). */
export const canCloseOos = (role: Role | undefined) => role === 'lab_head';
export const canExtractPeaks = (role: Role | undefined) => has(PEAK_AI_ROLES, role);
export const canManageRag = (role: Role | undefined) => has(RAG_ROLES, role);

/** Chat cheklovlari (backend bilan bir xil). */
export const CHAT_MAX_QUESTION = 4000;
export const CHAT_MAX_ATTACHMENTS_PER_MESSAGE = 3;
export const CHAT_MAX_ATTACHMENTS_PER_SESSION = 10;
export const CHAT_ACCEPT = ['pdf', 'docx', 'jpg', 'jpeg', 'png', 'webp'] as const;
