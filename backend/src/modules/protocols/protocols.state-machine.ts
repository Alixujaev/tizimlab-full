import { AppError } from '../../utils/errors.js';
import type { Role } from '../auth/auth.types.js';
import type { SampleStatus, SampleType } from '../samples/samples.types.js';
import type { ProtocolRole, ProtocolStatus } from './protocols.types.js';

export class InvalidTransitionError extends AppError {
  constructor(message = 'Noto‘g‘ri protokol status o‘tishi', details?: unknown) {
    super(409, 'INVALID_TRANSITION', message, details);
  }
}

export class ProtocolLockedError extends AppError {
  constructor(message = 'Ushbu holatda protokol fayllarini o‘zgartirish taqiqlangan') {
    super(409, 'PROTOCOL_LOCKED', message);
  }
}

export class ProtocolAccessError extends AppError {
  constructor(message: string, status = 403, code = 'FORBIDDEN') {
    super(status, code, message);
  }
}

/**
 * Protokol hayot tsikli bo'yicha ruxsat etilgan o'tishlar matritsasi (Spec §4, DECISIONS D-14).
 *
 * draft -> submitted (biriktirilgan kimyogar)
 * submitted -> approved (lab_head)
 * submitted -> rejected (lab_head, sabab bilan)
 * rejected -> submitted (biriktirilgan kimyogar qayta yuboradi, D-14)
 * approved -> finalized (director, D-07, Q-34)
 */
export const ALLOWED_TRANSITIONS: Record<ProtocolStatus, readonly ProtocolStatus[]> = {
  draft: ['submitted'],
  submitted: ['approved', 'rejected'],
  rejected: ['submitted'],
  approved: ['finalized'],
  finalized: [],
};

/**
 * Status o'tishini tekshiradi (sof funksiya).
 */
export function canTransition(from: ProtocolStatus, to: ProtocolStatus): boolean {
  if (from === to) return false;
  const allowed = ALLOWED_TRANSITIONS[from];
  return Boolean(allowed && allowed.includes(to));
}

/**
 * Status o'tishini majburiy tekshiradi; taqiqlangan bo'lsa 409 INVALID_TRANSITION xatosini tashlaydi.
 */
export function assertTransition(from: ProtocolStatus, to: ProtocolStatus): void {
  if (!canTransition(from, to)) {
    throw new InvalidTransitionError(
      `Protokolni «${from}» holatidan «${to}» holatiga o‘tkazish taqiqlangan`,
      { from, to, allowedTransitions: ALLOWED_TRANSITIONS[from] },
    );
  }
}

/**
 * Protokol faylini yuklash yoki almashtirish tekshiruvi (D-38, D-45, D-47, R-SAMPLE-39, R-PROTO-57).
 */
export function canUploadFile(params: {
  protocolStatus: ProtocolStatus;
  sampleStatus: SampleStatus;
  userRole: Role;
  isAssignedChemist: boolean;
}): { allowed: boolean; reason?: string } {
  const { protocolStatus, sampleStatus, userRole, isAssignedChemist } = params;

  if (protocolStatus !== 'draft' && protocolStatus !== 'rejected') {
    return {
      allowed: false,
      reason: `Protokol «${protocolStatus}» holatida bo‘lganda fayl yuklash yoki almashtirish taqiqlanadi (qulflangan)`,
    };
  }

  if (sampleStatus === 'stopped') {
    return {
      allowed: false,
      reason: 'To‘xtatilgan (stopped) namunada protokol fayli yuklanmaydi',
    };
  }

  if (userRole === 'chemist') {
    if (!isAssignedChemist) {
      return {
        allowed: false,
        reason: 'Faqat biriktirilgan kimyogar protokol faylini yuklay oladi',
      };
    }
    return { allowed: true };
  }

  if (userRole === 'lab_head' || userRole === 'admin') {
    return { allowed: true };
  }

  return {
    allowed: false,
    reason: 'Ushbu rolda protokol faylini yuklash huquqi yo‘q',
  };
}

export function assertCanUploadFile(params: {
  protocolStatus: ProtocolStatus;
  sampleStatus: SampleStatus;
  userRole: Role;
  isAssignedChemist: boolean;
}): void {
  const check = canUploadFile(params);
  if (!check.allowed) {
    if (params.protocolStatus !== 'draft' && params.protocolStatus !== 'rejected') {
      throw new ProtocolLockedError(check.reason);
    }
    if (params.sampleStatus === 'stopped') {
      throw new AppError(409, 'SAMPLE_STOPPED', check.reason!);
    }
    throw new ProtocolAccessError(check.reason!, 403);
  }
}

/**
 * Protokolni yuborish (draft/rejected -> submitted) tekshiruvi (Q-28, D-36, D-45, R-PROTO-07, R-PROTO-08, R-SAMPLE-34).
 */
export function canSubmit(params: {
  protocolStatus: ProtocolStatus;
  sampleStatus: SampleStatus;
  hasFile: boolean;
  userRole: Role;
  isAssignedChemist: boolean;
}): { allowed: boolean; reason?: string } {
  const { protocolStatus, sampleStatus, hasFile, userRole, isAssignedChemist } = params;

  if (protocolStatus !== 'draft' && protocolStatus !== 'rejected') {
    return {
      allowed: false,
      reason: `Faqat draft yoki rejected holatidagi protokolni yuborish mumkin`,
    };
  }

  if (userRole !== 'chemist' || !isAssignedChemist) {
    return {
      allowed: false,
      reason: 'Protokolni faqat namunaga biriktirilgan kimyogar yubora oladi',
    };
  }

  if (!hasFile) {
    return {
      allowed: false,
      reason: 'Asosiy tahlil fayli yuklanmagan protokolni yuborib bo‘lmaydi',
    };
  }

  if (sampleStatus === 'stopped') {
    return {
      allowed: false,
      reason: 'To‘xtatilgan (stopped) namunadan protokolni yuborish taqiqlanadi (avval davom ettirish kerak)',
    };
  }

  return { allowed: true };
}

export function assertCanSubmit(params: {
  protocolStatus: ProtocolStatus;
  sampleStatus: SampleStatus;
  hasFile: boolean;
  userRole: Role;
  isAssignedChemist: boolean;
}): void {
  const check = canSubmit(params);
  if (!check.allowed) {
    if (params.protocolStatus !== 'draft' && params.protocolStatus !== 'rejected') {
      throw new InvalidTransitionError(check.reason);
    }
    if (params.userRole !== 'chemist' || !params.isAssignedChemist) {
      throw new ProtocolAccessError(check.reason!, 403);
    }
    if (!params.hasFile) {
      throw new AppError(422, 'FILE_REQUIRED', check.reason!);
    }
    if (params.sampleStatus === 'stopped') {
      throw new AppError(409, 'SAMPLE_STOPPED', check.reason!);
    }
    throw new AppError(400, 'BAD_REQUEST', check.reason!);
  }
}

/**
 * Protokolni tasdiqlash (submitted -> approved) tekshiruvi.
 */
export function canApprove(params: {
  protocolStatus: ProtocolStatus;
  userRole: Role;
}): { allowed: boolean; reason?: string } {
  const { protocolStatus, userRole } = params;

  if (protocolStatus !== 'submitted') {
    return {
      allowed: false,
      reason: 'Faqat yuborilgan (submitted) holatdagi protokolni tasdiqlash mumkin',
    };
  }

  if (userRole !== 'lab_head') {
    return {
      allowed: false,
      reason: 'Faqat laboratoriya mudiri (lab_head) protokolni tasdiqlay oladi',
    };
  }

  return { allowed: true };
}

export function assertCanApprove(params: {
  protocolStatus: ProtocolStatus;
  userRole: Role;
}): void {
  const check = canApprove(params);
  if (!check.allowed) {
    if (params.protocolStatus !== 'submitted') {
      throw new InvalidTransitionError(check.reason);
    }
    throw new ProtocolAccessError(check.reason!, 403);
  }
}

/**
 * Protokolni rad etish (submitted -> rejected) tekshiruvi (Q-29, D-122).
 */
export function canReject(params: {
  protocolStatus: ProtocolStatus;
  userRole: Role;
  reason: string;
}): { allowed: boolean; reason?: string } {
  const { protocolStatus, userRole, reason } = params;

  if (protocolStatus !== 'submitted') {
    return {
      allowed: false,
      reason: 'Faqat yuborilgan (submitted) holatdagi protokolni rad etish mumkin',
    };
  }

  if (userRole !== 'lab_head') {
    return {
      allowed: false,
      reason: 'Faqat laboratoriya mudiri (lab_head) protokolni rad eta oladi',
    };
  }

  const trimmed = reason ? reason.trim() : '';
  if (trimmed.length < 5) {
    return {
      allowed: false,
      reason: 'Rad etish sababi kamida 5 ta belgidan iborat bo‘lishi shart',
    };
  }

  return { allowed: true };
}

export function assertCanReject(params: {
  protocolStatus: ProtocolStatus;
  userRole: Role;
  reason: string;
}): void {
  const check = canReject(params);
  if (!check.allowed) {
    if (params.protocolStatus !== 'submitted') {
      throw new InvalidTransitionError(check.reason);
    }
    if (params.userRole !== 'lab_head') {
      throw new ProtocolAccessError(check.reason!, 403);
    }
    throw new AppError(400, 'VALIDATION_ERROR', check.reason!);
  }
}

/**
 * Protokolni yakunlash (approved -> finalized) tekshiruvi (D-07, Q-34).
 */
export function canFinalize(params: {
  protocolStatus: ProtocolStatus;
  userRole: Role;
}): { allowed: boolean; reason?: string } {
  const { protocolStatus, userRole } = params;

  if (protocolStatus !== 'approved') {
    return {
      allowed: false,
      reason: 'Faqat tasdiqlangan (approved) holatdagi protokolni yakunlash mumkin',
    };
  }

  if (userRole !== 'director') {
    return {
      allowed: false,
      reason: 'Faqat direktor protokolni yakunlay oladi',
    };
  }

  return { allowed: true };
}

export function assertCanFinalize(params: {
  protocolStatus: ProtocolStatus;
  userRole: Role;
}): void {
  const check = canFinalize(params);
  if (!check.allowed) {
    if (params.protocolStatus !== 'approved') {
      throw new InvalidTransitionError(check.reason);
    }
    throw new ProtocolAccessError(check.reason!, 403);
  }
}

/**
 * in_process protokol yaratish tekshiruvi (D-15, R-PROTO-53).
 */
export function canCreateInProcess(params: {
  sampleType: SampleType;
  sampleStatus: SampleStatus;
  userRole: Role;
  isAssignedChemist: boolean;
  existingRoles: readonly ProtocolRole[];
}): { allowed: boolean; reason?: string } {
  const { sampleType, sampleStatus, userRole, isAssignedChemist, existingRoles } = params;

  if (sampleType !== 'finished_product') {
    return {
      allowed: false,
      reason: 'Oraliq (in_process) protokol faqat tayyor mahsulot (finished_product) namunasi uchun yaratilishi mumkin',
    };
  }

  if (sampleStatus === 'approved') {
    return {
      allowed: false,
      reason: 'Namuna tasdiqlangandan (approved) so‘ng in_process protokol yaratib bo‘lmaydi',
    };
  }

  const isAuthorized = userRole === 'lab_head' || (userRole === 'chemist' && isAssignedChemist);
  if (!isAuthorized) {
    return {
      allowed: false,
      reason: 'Oraliq protokolni faqat laboratoriya mudiri yoki biriktirilgan kimyogar yarata oladi',
    };
  }

  if (existingRoles.includes('in_process')) {
    return {
      allowed: false,
      reason: 'Ushbu namunada allaqachon oraliq (in_process) protokol mavjud',
    };
  }

  return { allowed: true };
}

export function assertCanCreateInProcess(params: {
  sampleType: SampleType;
  sampleStatus: SampleStatus;
  userRole: Role;
  isAssignedChemist: boolean;
  existingRoles: readonly ProtocolRole[];
}): void {
  const check = canCreateInProcess(params);
  if (!check.allowed) {
    if (params.sampleType !== 'finished_product') {
      throw new AppError(422, 'UNPROCESSABLE_ENTITY', check.reason!);
    }
    if (params.sampleStatus === 'approved') {
      throw new AppError(409, 'SAMPLE_ALREADY_APPROVED', check.reason!);
    }
    if (params.existingRoles.includes('in_process')) {
      throw new AppError(409, 'PROTOCOL_ALREADY_EXISTS', check.reason!);
    }
    throw new ProtocolAccessError(check.reason!, 403);
  }
}
