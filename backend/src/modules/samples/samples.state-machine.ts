import { AppError } from '../../utils/errors.js';
import type { SampleStatus, SampleType } from './samples.types.js';

export class InvalidTransitionError extends AppError {
  constructor(message = "Noto‘g‘ri status o‘tishi", details?: unknown) {
    super(409, 'INVALID_TRANSITION', message, details);
  }
}

export class SampleAssignmentError extends AppError {
  constructor(message: string, status = 422, code = 'UNPROCESSABLE_ENTITY') {
    super(status, code, message);
  }
}

/**
 * Namuna hayot tsikli bo'yicha ruxsat etilgan o'tishlar matritsasi (Spec §3, DECISIONS D-14, D-36).
 *
 * pending_assignment -> in_progress (lab_head biriktiradi)
 * in_progress -> stopped (kimyogar to'xtatadi)
 * in_progress -> submitted (protokol yuboriladi, P5)
 * stopped -> in_progress (kimyogar davom ettiradi)
 * submitted -> approved (lab_head tasdiqlaydi, P5)
 * submitted -> rejected (lab_head rad etadi, P5)
 * rejected -> submitted (kimyogar qayta yuboradi, P5 / D-14)
 */
export const ALLOWED_TRANSITIONS: Record<SampleStatus, readonly SampleStatus[]> = {
  pending_assignment: ['in_progress'],
  in_progress: ['stopped', 'submitted'],
  stopped: ['in_progress'],
  submitted: ['approved', 'rejected'],
  rejected: ['submitted'],
  approved: [],
};

/** Qayta biriktirish ruxsat etilgan statuslar (Q-15, D-37, R-SAMPLE-35). */
export const REASSIGNABLE_STATUSES: readonly SampleStatus[] = [
  'in_progress',
  'stopped',
  'rejected',
];

/**
 * Status o'tishini tekshiradi (sof funksiya).
 */
export function canTransition(from: SampleStatus, to: SampleStatus): boolean {
  if (from === to) return false;
  const allowed = ALLOWED_TRANSITIONS[from];
  return Boolean(allowed && allowed.includes(to));
}

/**
 * Status o'tishini majburiy tekshiradi; taqiqlangan bo'lsa 409 INVALID_TRANSITION xatosini tashlaydi.
 */
export function assertTransition(from: SampleStatus, to: SampleStatus): void {
  if (!canTransition(from, to)) {
    throw new InvalidTransitionError(
      `Namunani «${from}» holatidan «${to}» holatiga o‘tkazish taqiqlangan`,
      { from, to, allowedTransitions: ALLOWED_TRANSITIONS[from] },
    );
  }
}

/**
 * Namunani kimyogarga biriktirish yoki qayta biriktirish imkoniyatini tekshiradi.
 * R-PASS-23 (D-39): reagent va standard_substance turlariga kimyogar biriktirilmaydi.
 */
export function canAssign(
  sampleType: SampleType,
  currentStatus: SampleStatus,
): { allowed: boolean; reason?: string } {
  if (sampleType === 'reagent' || sampleType === 'standard_substance') {
    return {
      allowed: false,
      reason:
        'Reaktiv va standart namunalar uchun kimyogar biriktirilmaydi (tasdiqlash pasport orqali amalga oshiriladi)',
    };
  }

  if (currentStatus === 'pending_assignment') {
    return { allowed: true };
  }

  if (REASSIGNABLE_STATUSES.includes(currentStatus)) {
    return { allowed: true };
  }

  return {
    allowed: false,
    reason: `«${currentStatus}» holatidagi namunani biriktirib yoki qayta biriktirib bo‘lmaydi`,
  };
}

/**
 * Biriktirish qoidalarini tasdiqlaydi, qoidabuzarlik bo'lsa xato tashlaydi.
 */
export function assertCanAssign(sampleType: SampleType, currentStatus: SampleStatus): void {
  const check = canAssign(sampleType, currentStatus);
  if (!check.allowed) {
    if (sampleType === 'reagent' || sampleType === 'standard_substance') {
      throw new SampleAssignmentError(check.reason!, 422, 'INVALID_SAMPLE_TYPE_FOR_ASSIGNMENT');
    }
    throw new InvalidTransitionError(check.reason!);
  }
}

/**
 * Tahlilni to'xtatish (in_progress -> stopped) qoidalarini tekshiradi (R-SAMPLE-19, 20, 21).
 */
export function canStop(
  currentStatus: SampleStatus,
  reason: string,
): { allowed: boolean; reason?: string } {
  if (currentStatus !== 'in_progress') {
    return {
      allowed: false,
      reason: 'Faqat tahlil jarayonidagi (in_progress) namunani to‘xtatish mumkin',
    };
  }
  const trimmed = reason ? reason.trim() : '';
  if (trimmed.length < 5) {
    return {
      allowed: false,
      reason: 'To‘xtatish sababi kamida 5 ta belgidan iborat bo‘lishi shart',
    };
  }
  return { allowed: true };
}

/**
 * To'xtatishni tasdiqlaydi.
 */
export function assertCanStop(currentStatus: SampleStatus, reason: string): void {
  const check = canStop(currentStatus, reason);
  if (!check.allowed) {
    if (currentStatus !== 'in_progress') {
      throw new InvalidTransitionError(check.reason!);
    }
    throw new AppError(400, 'VALIDATION_ERROR', check.reason!);
  }
}

/**
 * Tahlilni davom ettirish (stopped -> in_progress) qoidalarini tekshiradi (R-SAMPLE-22).
 */
export function canResume(currentStatus: SampleStatus): { allowed: boolean; reason?: string } {
  if (currentStatus !== 'stopped') {
    return {
      allowed: false,
      reason: 'Faqat to‘xtatilgan (stopped) namunani davom ettirish mumkin',
    };
  }
  return { allowed: true };
}

/**
 * Davom ettirishni tasdiqlaydi.
 */
export function assertCanResume(currentStatus: SampleStatus): void {
  const check = canResume(currentStatus);
  if (!check.allowed) {
    throw new InvalidTransitionError(check.reason!);
  }
}
