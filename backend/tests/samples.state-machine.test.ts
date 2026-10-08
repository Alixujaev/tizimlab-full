import { describe, expect, it } from 'vitest';
import {
  ALLOWED_TRANSITIONS,
  assertCanAssign,
  assertCanResume,
  assertCanStop,
  assertTransition,
  canAssign,
  canResume,
  canStop,
  canTransition,
  InvalidTransitionError,
  REASSIGNABLE_STATUSES,
  SampleAssignmentError,
} from '../src/modules/samples/samples.state-machine.js';
import type { SampleStatus, SampleType } from '../src/modules/samples/samples.types.js';

describe('Sample State Machine (pure functions)', () => {
  const ALL_STATUSES: SampleStatus[] = [
    'pending_assignment',
    'in_progress',
    'stopped',
    'submitted',
    'approved',
    'rejected',
  ];

  it('barcha ruxsat etilgan o‘tishlar canTransition=true va assertTransition xatosiz', () => {
    for (const [from, allowedList] of Object.entries(ALLOWED_TRANSITIONS) as [
      SampleStatus,
      readonly SampleStatus[],
    ][]) {
      for (const to of allowedList) {
        expect(canTransition(from, to)).toBe(true);
        expect(() => assertTransition(from, to)).not.toThrow();
      }
    }
  });

  it('taqiqlangan o‘tishlar canTransition=false va assertTransition InvalidTransitionError tashlaydi', () => {
    for (const from of ALL_STATUSES) {
      for (const to of ALL_STATUSES) {
        const isAllowed = ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
        if (!isAllowed) {
          expect(canTransition(from, to)).toBe(false);
          expect(() => assertTransition(from, to)).toThrowError(InvalidTransitionError);
        }
      }
    }
  });

  it('bir xil statusga o‘tish taqiqlangan (from === to)', () => {
    for (const status of ALL_STATUSES) {
      expect(canTransition(status, status)).toBe(false);
      expect(() => assertTransition(status, status)).toThrowError(InvalidTransitionError);
    }
  });

  describe('canAssign & assertCanAssign', () => {
    it('reagent va standard_substance turlariga kimyogar biriktirib bo‘lmaydi (R-PASS-23, D-39)', () => {
      const types: SampleType[] = ['reagent', 'standard_substance'];
      for (const type of types) {
        for (const status of ALL_STATUSES) {
          const res = canAssign(type, status);
          expect(res.allowed).toBe(false);
          expect(res.reason).toContain('pasport');
          expect(() => assertCanAssign(type, status)).toThrowError(SampleAssignmentError);
        }
      }
    });

    it('oddiy turlarda pending_assignment holatida biriktirish ruxsat etiladi', () => {
      const types: SampleType[] = ['raw_material', 'finished_product', 'other'];
      for (const type of types) {
        const res = canAssign(type, 'pending_assignment');
        expect(res.allowed).toBe(true);
        expect(() => assertCanAssign(type, 'pending_assignment')).not.toThrow();
      }
    });

    it('oddiy turlarda in_progress, stopped, rejected holatlarida qayta biriktirish ruxsat etiladi (Q-15, D-37, R-SAMPLE-35)', () => {
      const types: SampleType[] = ['raw_material', 'finished_product', 'other'];
      for (const type of types) {
        for (const status of REASSIGNABLE_STATUSES) {
          const res = canAssign(type, status);
          expect(res.allowed).toBe(true);
          expect(() => assertCanAssign(type, status)).not.toThrow();
        }
      }
    });

    it('submitted va approved holatlarida biriktirish taqiqlanadi (409)', () => {
      const types: SampleType[] = ['raw_material', 'finished_product', 'other'];
      for (const type of types) {
        expect(canAssign(type, 'submitted').allowed).toBe(false);
        expect(canAssign(type, 'approved').allowed).toBe(false);
        expect(() => assertCanAssign(type, 'submitted')).toThrowError(InvalidTransitionError);
        expect(() => assertCanAssign(type, 'approved')).toThrowError(InvalidTransitionError);
      }
    });
  });

  describe('canStop & assertCanStop', () => {
    it('faqat in_progress holatida va sabab kamida 5 belgi bo‘lganda to‘xtatish ruxsat etiladi (R-SAMPLE-19, 20, 21)', () => {
      expect(canStop('in_progress', '12345').allowed).toBe(true);
      expect(canStop('in_progress', 'Reagent yetishmadi').allowed).toBe(true);
      expect(() => assertCanStop('in_progress', '12345')).not.toThrow();
    });

    it('sabab 5 belgidan kam bo‘lsa rad etiladi (4 belgi rad)', () => {
      expect(canStop('in_progress', '1234').allowed).toBe(false);
      expect(canStop('in_progress', '    ').allowed).toBe(false);
      expect(canStop('in_progress', '').allowed).toBe(false);
      expect(() => assertCanStop('in_progress', '1234')).toThrow();
    });

    it('in_progress dan boshqa statuslarda to‘xtatish rad etiladi', () => {
      const otherStatuses: SampleStatus[] = [
        'pending_assignment',
        'stopped',
        'submitted',
        'approved',
        'rejected',
      ];
      for (const st of otherStatuses) {
        expect(canStop(st, 'Yetarli sabab').allowed).toBe(false);
        expect(() => assertCanStop(st, 'Yetarli sabab')).toThrowError(InvalidTransitionError);
      }
    });
  });

  describe('canResume & assertCanResume', () => {
    it('faqat stopped holatida davom ettirish ruxsat etiladi (R-SAMPLE-22, 38)', () => {
      expect(canResume('stopped').allowed).toBe(true);
      expect(() => assertCanResume('stopped')).not.toThrow();
    });

    it('stopped dan boshqa statuslarda davom ettirish rad etiladi', () => {
      const otherStatuses: SampleStatus[] = [
        'pending_assignment',
        'in_progress',
        'submitted',
        'approved',
        'rejected',
      ];
      for (const st of otherStatuses) {
        expect(canResume(st).allowed).toBe(false);
        expect(() => assertCanResume(st)).toThrowError(InvalidTransitionError);
      }
    });
  });
});
