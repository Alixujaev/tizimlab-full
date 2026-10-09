import type { Role } from '../auth/auth.types.js';
import type { SampleRow, SampleType } from './samples.types.js';

// Namuna pasporti qoidalari (spec §3; D-39/D-85, D-40, D-41, D-111, D-112, D-119) — sof funksiyalar.
// Namunaning foydalanuvchiga ko'rinishi (kontrolyor — o'ziniki, chemist — biriktirilgan) bu yerda emas,
// service'da oldindan tekshiriladi (ko'rinmasa 404).

export type PassportFlow = 'approval' | 'attachment' | 'none';
export type PassportStatus = 'pending' | 'approved' | 'rejected';

/** reagent/standard — tasdiqlashning yagona yo'li; raw/finished — holatsiz qo'shimcha hujjat; other — yo'q. */
export function passportFlow(type: SampleType): PassportFlow {
  if (type === 'reagent' || type === 'standard_substance') return 'approval';
  if (type === 'raw_material' || type === 'finished_product') return 'attachment';
  return 'none';
}

export const isReviewer = (role: Role) => role === 'lab_head' || role === 'admin';

type PolicySample = Pick<
  SampleRow,
  | 'type'
  | 'status'
  | 'assigned_to'
  | 'passport_status'
  | 'passport_file_path'
  | 'passport_uploaded_by'
>;

export interface Actor {
  id: string;
  role: Role;
}

export type Denial =
  | { code: 'PASSPORT_NOT_ALLOWED'; status: 422 }
  | { code: 'FORBIDDEN'; status: 403 }
  | { code: 'PASSPORT_EXISTS'; status: 409 }
  | { code: 'INVALID_TRANSITION'; status: 409 }
  | { code: 'PASSPORT_REVIEW_NOT_APPLICABLE'; status: 422 }
  | { code: 'SELF_REVIEW_FORBIDDEN'; status: 403 }
  | { code: 'PASSPORT_NOT_FOUND'; status: 404 };

export type UploadDecision =
  | { allowed: true; passportStatus: PassportStatus | null; approvesSample: boolean }
  | { allowed: false; denial: Denial };

const deny = (denial: Denial) => ({ allowed: false as const, denial });

/**
 * Kim yuklay oladi va natija qanday bo'ladi:
 * - approval: lab_head/admin → `approved` + namuna `approved`; kontrolyor/chemist → `pending`; director → 403.
 * - attachment: kontrolyor, lab_head, admin, biriktirilgan chemist → holatsiz (`null`); boshqalar → 403.
 * - Mavjud pasport (rejected'dan tashqari) bo'lsa 409 (D-119); tasdiqlangan reagent namunasiga 409.
 */
export function decideUpload(actor: Actor, sample: PolicySample): UploadDecision {
  const flow = passportFlow(sample.type);
  if (flow === 'none') return deny({ code: 'PASSPORT_NOT_ALLOWED', status: 422 });

  if (flow === 'approval') {
    if (!['kontrolyor', 'chemist', 'lab_head', 'admin'].includes(actor.role)) {
      return deny({ code: 'FORBIDDEN', status: 403 });
    }
    if (sample.passport_file_path && sample.passport_status !== 'rejected') {
      return deny({ code: 'PASSPORT_EXISTS', status: 409 });
    }
    if (sample.status !== 'pending_assignment') {
      return deny({ code: 'INVALID_TRANSITION', status: 409 });
    }
    // Rad etilgan pasportni yuklagan foydalanuvchi yoki lab_head/admin qayta yuklaydi (D-85)
    if (
      sample.passport_status === 'rejected' &&
      sample.passport_uploaded_by !== actor.id &&
      !isReviewer(actor.role)
    ) {
      return deny({ code: 'FORBIDDEN', status: 403 });
    }
    return isReviewer(actor.role)
      ? { allowed: true, passportStatus: 'approved', approvesSample: true }
      : { allowed: true, passportStatus: 'pending', approvesSample: false };
  }

  // attachment
  const roleOk =
    actor.role === 'kontrolyor' ||
    isReviewer(actor.role) ||
    (actor.role === 'chemist' && sample.assigned_to === actor.id);
  if (!roleOk) return deny({ code: 'FORBIDDEN', status: 403 });
  if (sample.passport_file_path) return deny({ code: 'PASSPORT_EXISTS', status: 409 });
  return { allowed: true, passportStatus: null, approvesSample: false };
}

export type SimpleDecision = { allowed: true } | { allowed: false; denial: Denial };

/** `reviewPassport`: faqat approval turlari, faqat `pending`, faqat lab_head/admin, o'zinikini emas. */
export function decideReview(actor: Actor, sample: PolicySample): SimpleDecision {
  if (passportFlow(sample.type) !== 'approval') {
    return deny({ code: 'PASSPORT_REVIEW_NOT_APPLICABLE', status: 422 });
  }
  if (!isReviewer(actor.role)) return deny({ code: 'FORBIDDEN', status: 403 });
  if (!sample.passport_file_path) return deny({ code: 'PASSPORT_NOT_FOUND', status: 404 });
  if (sample.passport_status !== 'pending')
    return deny({ code: 'INVALID_TRANSITION', status: 409 });
  if (sample.passport_uploaded_by === actor.id) {
    return deny({ code: 'SELF_REVIEW_FORBIDDEN', status: 403 });
  }
  return { allowed: true };
}

/** O'chirish: lab_head/admin — har doim; yuklagan foydalanuvchi — faqat tasdiqlanmagan bo'lsa; director — hech qachon. */
export function decideDelete(actor: Actor, sample: PolicySample): SimpleDecision {
  if (!sample.passport_file_path) return deny({ code: 'PASSPORT_NOT_FOUND', status: 404 });
  if (isReviewer(actor.role)) return { allowed: true };
  if (actor.role === 'director') return deny({ code: 'FORBIDDEN', status: 403 });
  if (sample.passport_uploaded_by !== actor.id) return deny({ code: 'FORBIDDEN', status: 403 });
  if (sample.passport_status === 'approved') return deny({ code: 'FORBIDDEN', status: 403 });
  return { allowed: true };
}
