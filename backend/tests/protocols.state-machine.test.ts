import { describe, expect, it } from 'vitest';
import {
  assertCanReject,
  assertCanSubmit,
  assertCanUploadFile,
  assertTransition,
  canApprove,
  canCreateInProcess,
  canFinalize,
  canReject,
  canSubmit,
  canTransition,
  canUploadFile,
  InvalidTransitionError,
  ProtocolAccessError,
  ProtocolLockedError,
} from '../src/modules/protocols/protocols.state-machine.js';
import type { ProtocolStatus } from '../src/modules/protocols/protocols.types.js';

describe('protocols state machine (unit tests)', () => {
  describe('ALLOWED_TRANSITIONS matrix', () => {
    it('allows valid transitions', () => {
      expect(canTransition('draft', 'submitted')).toBe(true);
      expect(canTransition('submitted', 'approved')).toBe(true);
      expect(canTransition('submitted', 'rejected')).toBe(true);
      expect(canTransition('rejected', 'submitted')).toBe(true);
      expect(canTransition('approved', 'finalized')).toBe(true);
    });

    it('rejects invalid or skipped transitions', () => {
      expect(canTransition('draft', 'approved')).toBe(false);
      expect(canTransition('draft', 'finalized')).toBe(false);
      expect(canTransition('submitted', 'finalized')).toBe(false);
      expect(canTransition('rejected', 'approved')).toBe(false);
      expect(canTransition('rejected', 'draft')).toBe(false);
      expect(canTransition('approved', 'submitted')).toBe(false);
      expect(canTransition('finalized', 'draft')).toBe(false);
      expect(canTransition('finalized', 'approved')).toBe(false);
    });

    it('assertTransition throws InvalidTransitionError for invalid transition', () => {
      expect(() => assertTransition('draft', 'approved')).toThrow(InvalidTransitionError);
      expect(() => assertTransition('draft', 'submitted')).not.toThrow();
    });
  });

  describe('canUploadFile / assertCanUploadFile', () => {
    it('allows chemist to upload when protocol is draft or rejected', () => {
      expect(
        canUploadFile({
          protocolStatus: 'draft',
          sampleStatus: 'in_progress',
          userRole: 'chemist',
          isAssignedChemist: true,
        }).allowed,
      ).toBe(true);

      expect(
        canUploadFile({
          protocolStatus: 'rejected',
          sampleStatus: 'in_progress',
          userRole: 'chemist',
          isAssignedChemist: true,
        }).allowed,
      ).toBe(true);
    });

    it('allows lab_head and admin to upload file', () => {
      expect(
        canUploadFile({
          protocolStatus: 'draft',
          sampleStatus: 'in_progress',
          userRole: 'lab_head',
          isAssignedChemist: false,
        }).allowed,
      ).toBe(true);

      expect(
        canUploadFile({
          protocolStatus: 'draft',
          sampleStatus: 'in_progress',
          userRole: 'admin',
          isAssignedChemist: false,
        }).allowed,
      ).toBe(true);
    });

    it('disallows non-assigned chemist, director, and kontrolyor', () => {
      expect(
        canUploadFile({
          protocolStatus: 'draft',
          sampleStatus: 'in_progress',
          userRole: 'chemist',
          isAssignedChemist: false,
        }).allowed,
      ).toBe(false);

      expect(
        canUploadFile({
          protocolStatus: 'draft',
          sampleStatus: 'in_progress',
          userRole: 'director',
          isAssignedChemist: false,
        }).allowed,
      ).toBe(false);

      expect(
        canUploadFile({
          protocolStatus: 'draft',
          sampleStatus: 'in_progress',
          userRole: 'kontrolyor',
          isAssignedChemist: false,
        }).allowed,
      ).toBe(false);
    });

    it('locks files when protocol is submitted, approved, or finalized', () => {
      const lockedStatuses: ProtocolStatus[] = ['submitted', 'approved', 'finalized'];
      for (const st of lockedStatuses) {
        const res = canUploadFile({
          protocolStatus: st,
          sampleStatus: 'in_progress',
          userRole: 'chemist',
          isAssignedChemist: true,
        });
        expect(res.allowed).toBe(false);
        expect(() =>
          assertCanUploadFile({
            protocolStatus: st,
            sampleStatus: 'in_progress',
            userRole: 'chemist',
            isAssignedChemist: true,
          }),
        ).toThrow(ProtocolLockedError);
      }
    });

    it('rejects upload when sample is stopped', () => {
      expect(
        canUploadFile({
          protocolStatus: 'draft',
          sampleStatus: 'stopped',
          userRole: 'chemist',
          isAssignedChemist: true,
        }).allowed,
      ).toBe(false);
    });
  });

  describe('canSubmit / assertCanSubmit', () => {
    it('allows assigned chemist to submit if file is attached', () => {
      expect(
        canSubmit({
          protocolStatus: 'draft',
          sampleStatus: 'in_progress',
          hasFile: true,
          userRole: 'chemist',
          isAssignedChemist: true,
        }).allowed,
      ).toBe(true);

      expect(
        canSubmit({
          protocolStatus: 'rejected',
          sampleStatus: 'in_progress',
          hasFile: true,
          userRole: 'chemist',
          isAssignedChemist: true,
        }).allowed,
      ).toBe(true);
    });

    it('rejects submission if file is missing (R-PROTO-08)', () => {
      const res = canSubmit({
        protocolStatus: 'draft',
        sampleStatus: 'in_progress',
        hasFile: false,
        userRole: 'chemist',
        isAssignedChemist: true,
      });
      expect(res.allowed).toBe(false);
      expect(() =>
        assertCanSubmit({
          protocolStatus: 'draft',
          sampleStatus: 'in_progress',
          hasFile: false,
          userRole: 'chemist',
          isAssignedChemist: true,
        }),
      ).toThrow();
    });

    it('rejects submission by lab_head or admin (D-45: only assigned chemist submits)', () => {
      expect(
        canSubmit({
          protocolStatus: 'draft',
          sampleStatus: 'in_progress',
          hasFile: true,
          userRole: 'lab_head',
          isAssignedChemist: false,
        }).allowed,
      ).toBe(false);

      expect(
        canSubmit({
          protocolStatus: 'draft',
          sampleStatus: 'in_progress',
          hasFile: true,
          userRole: 'admin',
          isAssignedChemist: false,
        }).allowed,
      ).toBe(false);
    });

    it('rejects submission when sample is stopped', () => {
      expect(
        canSubmit({
          protocolStatus: 'draft',
          sampleStatus: 'stopped',
          hasFile: true,
          userRole: 'chemist',
          isAssignedChemist: true,
        }).allowed,
      ).toBe(false);
    });
  });

  describe('canApprove / assertCanApprove', () => {
    it('allows lab_head to approve submitted protocol', () => {
      expect(
        canApprove({
          protocolStatus: 'submitted',
          userRole: 'lab_head',
        }).allowed,
      ).toBe(true);
    });

    it('rejects approve by chemist or director or admin', () => {
      expect(canApprove({ protocolStatus: 'submitted', userRole: 'chemist' }).allowed).toBe(false);
      expect(canApprove({ protocolStatus: 'submitted', userRole: 'director' }).allowed).toBe(false);
      expect(canApprove({ protocolStatus: 'submitted', userRole: 'admin' }).allowed).toBe(false);
    });

    it('rejects approve if not in submitted status', () => {
      expect(canApprove({ protocolStatus: 'draft', userRole: 'lab_head' }).allowed).toBe(false);
      expect(canApprove({ protocolStatus: 'rejected', userRole: 'lab_head' }).allowed).toBe(false);
    });
  });

  describe('canReject / assertCanReject', () => {
    it('allows lab_head to reject submitted protocol with reason min 5 chars (D-122)', () => {
      expect(
        canReject({
          protocolStatus: 'submitted',
          userRole: 'lab_head',
          reason: 'Faylda spektr qiymatlari to‘liq emas',
        }).allowed,
      ).toBe(true);
    });

    it('rejects if reason is too short (< 5 chars)', () => {
      expect(
        canReject({
          protocolStatus: 'submitted',
          userRole: 'lab_head',
          reason: 'yoq',
        }).allowed,
      ).toBe(false);

      expect(() =>
        assertCanReject({
          protocolStatus: 'submitted',
          userRole: 'lab_head',
          reason: '   ',
        }),
      ).toThrow();
    });

    it('rejects if user is not lab_head', () => {
      expect(() =>
        assertCanReject({
          protocolStatus: 'submitted',
          userRole: 'director',
          reason: 'Sabab yetarli',
        }),
      ).toThrow(ProtocolAccessError);
    });
  });

  describe('canFinalize / assertCanFinalize', () => {
    it('allows director to finalize approved protocol', () => {
      expect(
        canFinalize({
          protocolStatus: 'approved',
          userRole: 'director',
        }).allowed,
      ).toBe(true);
    });

    it('rejects finalize if not director', () => {
      expect(canFinalize({ protocolStatus: 'approved', userRole: 'lab_head' }).allowed).toBe(false);
      expect(canFinalize({ protocolStatus: 'approved', userRole: 'admin' }).allowed).toBe(false);
    });

    it('rejects finalize if protocol is not approved', () => {
      expect(canFinalize({ protocolStatus: 'submitted', userRole: 'director' }).allowed).toBe(false);
      expect(canFinalize({ protocolStatus: 'draft', userRole: 'director' }).allowed).toBe(false);
    });
  });

  describe('canCreateInProcess / assertCanCreateInProcess', () => {
    it('allows lab_head or assigned chemist to create in_process for finished_product', () => {
      expect(
        canCreateInProcess({
          sampleType: 'finished_product',
          sampleStatus: 'in_progress',
          userRole: 'lab_head',
          isAssignedChemist: false,
          existingRoles: ['final'],
        }).allowed,
      ).toBe(true);

      expect(
        canCreateInProcess({
          sampleType: 'finished_product',
          sampleStatus: 'in_progress',
          userRole: 'chemist',
          isAssignedChemist: true,
          existingRoles: ['final'],
        }).allowed,
      ).toBe(true);
    });

    it('rejects if sample type is not finished_product (D-15)', () => {
      expect(
        canCreateInProcess({
          sampleType: 'raw_material',
          sampleStatus: 'in_progress',
          userRole: 'lab_head',
          isAssignedChemist: false,
          existingRoles: ['standard'],
        }).allowed,
      ).toBe(false);
    });

    it('rejects if in_process protocol already exists', () => {
      expect(
        canCreateInProcess({
          sampleType: 'finished_product',
          sampleStatus: 'in_progress',
          userRole: 'lab_head',
          isAssignedChemist: false,
          existingRoles: ['final', 'in_process'],
        }).allowed,
      ).toBe(false);
    });

    it('rejects if sample is already approved', () => {
      expect(
        canCreateInProcess({
          sampleType: 'finished_product',
          sampleStatus: 'approved',
          userRole: 'lab_head',
          isAssignedChemist: false,
          existingRoles: ['final'],
        }).allowed,
      ).toBe(false);
    });
  });
});
