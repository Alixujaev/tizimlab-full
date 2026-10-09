import { describe, expect, it } from 'vitest';
import type { Role } from '../src/modules/auth/auth.types.js';
import {
  decideDelete,
  decideReview,
  decideUpload,
  passportFlow,
} from '../src/modules/samples/samples.passport.policy.js';
import {
  ALLOWED_TRANSITIONS,
  canApproveViaPassport,
} from '../src/modules/samples/samples.state-machine.js';
import type { SampleRow, SampleType } from '../src/modules/samples/samples.types.js';

const ME = 'user-me';
const OTHER = 'user-other';

type S = Pick<
  SampleRow,
  | 'type'
  | 'status'
  | 'assigned_to'
  | 'passport_status'
  | 'passport_file_path'
  | 'passport_uploaded_by'
>;
const sample = (over: Partial<S> = {}): S => ({
  type: 'reagent',
  status: 'pending_assignment',
  assigned_to: null,
  passport_status: null,
  passport_file_path: null,
  passport_uploaded_by: null,
  ...over,
});

const outcome = (d: ReturnType<typeof decideUpload>) =>
  d.allowed ? (d.passportStatus ?? 'attached') : d.denial.status;

describe('pasport oqimi turi (R-PASS-01, R-PASS-02, R-PASS-14)', () => {
  it.each([
    ['reagent', 'approval'],
    ['standard_substance', 'approval'],
    ['raw_material', 'attachment'],
    ['finished_product', 'attachment'],
    ['other', 'none'],
  ] as [SampleType, string][])('%s → %s', (type, flow) => {
    expect(passportFlow(type)).toBe(flow);
  });
});

describe('yuklash: rol × tur jadvali', () => {
  // R-PASS-05/06/09/24: reagent/standard — lab_head/admin → approved, kontrolyor/chemist → pending, director → 403
  it.each([
    ['kontrolyor', 'pending'],
    ['chemist', 'pending'],
    ['lab_head', 'approved'],
    ['admin', 'approved'],
    ['director', 403],
  ] as [Role, string | number][])('reagent/standard: %s → %s', (role, expected) => {
    for (const type of ['reagent', 'standard_substance'] as const) {
      expect(outcome(decideUpload({ id: ME, role }, sample({ type })))).toBe(expected);
    }
  });

  it('reagent: lab_head/admin yuklasa namuna ham tasdiqlanadi (R-PASS-07)', () => {
    const d = decideUpload({ id: ME, role: 'lab_head' }, sample());
    expect(d).toEqual({ allowed: true, passportStatus: 'approved', approvesSample: true });
    expect(decideUpload({ id: ME, role: 'kontrolyor' }, sample())).toMatchObject({
      approvesSample: false,
    });
  });

  // R-PASS-15/16/17: raw/finished — kontrolyor, lab_head, admin, biriktirilgan chemist; director va boshqa chemist — 403
  it.each([
    ['kontrolyor', null, 'attached'],
    ['lab_head', null, 'attached'],
    ['admin', null, 'attached'],
    ['chemist', ME, 'attached'],
    ['chemist', OTHER, 403],
    ['chemist', null, 403],
    ['director', null, 403],
  ] as [Role, string | null, string | number][])(
    'raw/finished: %s (assigned=%s) → %s',
    (role, assigned, expected) => {
      for (const type of ['raw_material', 'finished_product'] as const) {
        expect(
          outcome(
            decideUpload(
              { id: ME, role },
              sample({ type, status: 'in_progress', assigned_to: assigned }),
            ),
          ),
        ).toBe(expected);
      }
    },
  );

  it('raw/finished pasporti holatsiz va namunani tasdiqlamaydi (R-PASS-14, R-PASS-25)', () => {
    expect(decideUpload({ id: ME, role: 'lab_head' }, sample({ type: 'raw_material' }))).toEqual({
      allowed: true,
      passportStatus: null,
      approvesSample: false,
    });
  });

  it('other → 422 PASSPORT_NOT_ALLOWED (R-PASS-02)', () => {
    const d = decideUpload({ id: ME, role: 'lab_head' }, sample({ type: 'other' }));
    expect(d).toMatchObject({
      allowed: false,
      denial: { code: 'PASSPORT_NOT_ALLOWED', status: 422 },
    });
  });

  it('mavjud pasport → 409; rad etilgan — yuklagan yoki lab_head qayta yuklaydi (R-PASS-22, D-119)', () => {
    const pending = sample({
      passport_file_path: 'k',
      passport_status: 'pending',
      passport_uploaded_by: ME,
    });
    expect(outcome(decideUpload({ id: ME, role: 'kontrolyor' }, pending))).toBe(409);
    const rejected = sample({
      passport_file_path: 'k',
      passport_status: 'rejected',
      passport_uploaded_by: ME,
    });
    expect(outcome(decideUpload({ id: ME, role: 'kontrolyor' }, rejected))).toBe('pending');
    expect(outcome(decideUpload({ id: OTHER, role: 'kontrolyor' }, rejected))).toBe(403);
    expect(outcome(decideUpload({ id: OTHER, role: 'lab_head' }, rejected))).toBe('approved');
    expect(
      outcome(
        decideUpload(
          { id: ME, role: 'kontrolyor' },
          sample({ type: 'raw_material', passport_file_path: 'k' }),
        ),
      ),
    ).toBe(409);
  });

  it('tasdiqlangan reagent namunasiga yuklab bo‘lmaydi → 409', () => {
    expect(
      outcome(decideUpload({ id: ME, role: 'lab_head' }, sample({ status: 'approved' }))),
    ).toBe(409);
  });
});

describe('ko‘rib chiqish (R-PASS-10, R-PASS-12, R-PASS-13, R-PASS-25)', () => {
  const pending = (by = OTHER) =>
    sample({ passport_file_path: 'k', passport_status: 'pending', passport_uploaded_by: by });

  it.each([
    ['lab_head', true],
    ['admin', true],
    ['kontrolyor', 403],
    ['chemist', 403],
    ['director', 403],
  ] as [Role, true | number][])('%s → %s', (role, expected) => {
    const d = decideReview({ id: ME, role }, pending());
    expect(d.allowed ? true : d.denial.status).toBe(expected);
  });

  it('o‘zi yuklaganini o‘zi tasdiqlay olmaydi → 403 SELF_REVIEW_FORBIDDEN', () => {
    expect(decideReview({ id: ME, role: 'lab_head' }, pending(ME))).toMatchObject({
      denial: { code: 'SELF_REVIEW_FORBIDDEN', status: 403 },
    });
  });

  it('raw/finished → 422; pending emas → 409; pasport yo‘q → 404', () => {
    expect(
      decideReview({ id: ME, role: 'lab_head' }, { ...pending(), type: 'finished_product' }),
    ).toMatchObject({
      denial: { status: 422 },
    });
    expect(
      decideReview({ id: ME, role: 'lab_head' }, { ...pending(), passport_status: 'approved' }),
    ).toMatchObject({
      denial: { status: 409 },
    });
    expect(decideReview({ id: ME, role: 'lab_head' }, sample())).toMatchObject({
      denial: { status: 404 },
    });
  });
});

describe('o‘chirish (R-PASS-19, R-PASS-20, R-PASS-21)', () => {
  const withPassport = (status: 'pending' | 'approved' | 'rejected' | null, by = ME) =>
    sample({ passport_file_path: 'k', passport_status: status, passport_uploaded_by: by });

  it.each([
    ['kontrolyor', 'pending', ME, true],
    ['kontrolyor', 'rejected', ME, true],
    ['kontrolyor', null, ME, true],
    ['kontrolyor', 'approved', ME, 403],
    ['chemist', 'pending', ME, true],
    ['kontrolyor', 'pending', OTHER, 403],
    ['lab_head', 'approved', OTHER, true],
    ['admin', 'approved', OTHER, true],
    ['director', 'pending', ME, 403],
  ] as [Role, 'pending' | 'approved' | 'rejected' | null, string, true | number][])(
    '%s, holat=%s, egasi=%s → %s',
    (role, status, by, expected) => {
      const d = decideDelete({ id: ME, role }, withPassport(status, by));
      expect(d.allowed ? true : d.denial.status).toBe(expected);
    },
  );

  it('pasport yo‘q → 404', () => {
    expect(decideDelete({ id: ME, role: 'lab_head' }, sample())).toMatchObject({
      denial: { status: 404 },
    });
  });
});

describe('pasport o‘tishi (D-118)', () => {
  it('pending_assignment → approved faqat reagent/standard uchun; umumiy matritsa o‘zgarmaydi', () => {
    expect(canApproveViaPassport('reagent', 'pending_assignment')).toBe(true);
    expect(canApproveViaPassport('standard_substance', 'pending_assignment')).toBe(true);
    expect(canApproveViaPassport('raw_material', 'pending_assignment')).toBe(false);
    expect(canApproveViaPassport('reagent', 'approved')).toBe(false);
    expect(ALLOWED_TRANSITIONS.pending_assignment).toEqual(['in_progress']);
  });
});
