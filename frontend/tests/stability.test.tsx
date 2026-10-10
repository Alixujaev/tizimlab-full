import { cleanup, screen, waitFor } from '@testing-library/react';
import MockAdapter from 'axios-mock-adapter';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { apiClient } from '@/api/client';
import type { StabilityStudyDetailDto, StabilityStudyDto } from '@/types';
import { loginAs, renderAt, resetAuth } from './helpers';

let api: MockAdapter;

const mockStudy: StabilityStudyDto = {
  id: 'study-1',
  companyId: 'c1',
  sampleId: 'sample-1',
  serialNumber: 'LOT-2026-001',
  substanceName: 'Paracetamol Extra',
  sampleName: 'Paracetamol Extra',
  startedAt: '2026-03-01',
  storageConditions: '25°C ± 2°C / 60% ± 5% RH',
  status: 'active',
  createdBy: 'user-1',
  createdByName: 'Admin Foydalanuvchi',
  totalCheckpoints: 2,
  completedCheckpoints: 0,
  createdAt: '2026-03-01T10:00:00.000Z',
  updatedAt: '2026-03-01T10:00:00.000Z',
};

const mockStudyDetail: StabilityStudyDetailDto = {
  ...mockStudy,
  parameters: [
    { parameter: 'Assay', initialValue: '99.5%', specification: '98.0 - 102.0%' },
    { parameter: 'Namlik', initialValue: '0.4%', specification: '< 0.5%' },
  ],
  checkpoints: [
    {
      id: 'cp-1',
      companyId: 'c1',
      studyId: 'study-1',
      intervalTag: 'T3',
      dueDate: '2026-06-01',
      status: 'pending',
      isDueSoon: false,
      assignedTo: 'u1',
      assignedToName: 'Aziz Kimyogar',
      completedAt: null,
      completedBy: null,
      completedByName: null,
      notes: null,
      createdAt: '2026-03-01T10:00:00.000Z',
      updatedAt: '2026-03-01T10:00:00.000Z',
      results: [
        {
          id: 'res-1',
          companyId: 'c1',
          checkpointId: 'cp-1',
          parameter: 'Assay',
          initialValue: '99.5%',
          currentValue: null,
          specification: '98.0 - 102.0%',
          resultStatus: 'pass',
          recordedBy: 'user-1',
          recordedByName: 'Admin',
          recordedAt: '2026-03-01T10:00:00.000Z',
        },
      ],
    },
    {
      id: 'cp-2',
      companyId: 'c1',
      studyId: 'study-1',
      intervalTag: 'T6',
      dueDate: '2026-09-01',
      status: 'pending',
      isDueSoon: false,
      assignedTo: 'u2',
      assignedToName: 'Boshqa Kimyogar',
      completedAt: null,
      completedBy: null,
      completedByName: null,
      notes: null,
      createdAt: '2026-03-01T10:00:00.000Z',
      updatedAt: '2026-03-01T10:00:00.000Z',
      results: [],
    },
  ],
};

describe('Frontend: Stabilizatsiya sahifalari (P9, spec §8, D-05, D-53..D-58, D-142..D-145)', () => {
  beforeEach(() => {
    resetAuth();
    api = new MockAdapter(apiClient);

    api.onGet(/\/stability$/).reply(200, {
      items: [mockStudy],
      meta: { page: 1, limit: 20, total: 1 },
    });
    api.onGet(/\/stability\/study-1/).reply(200, mockStudyDetail);
    api.onGet(/\/samples/).reply(200, { data: [], meta: { page: 1, limit: 100, total: 0 } });
  });

  afterEach(() => {
    cleanup();
    api.restore();
    resetAuth();
  });

  describe('1. Ruxsat matritsasi va ko‘rinish qoidalari (RBAC UX)', () => {
    it('kontrolyor va chemist: /stability sahifasida "Yangi tekshiruv boshlash" tugmasi yo‘q (403 so‘rov ketmaydi)', async () => {
      for (const role of ['kontrolyor', 'chemist'] as const) {
        cleanup();
        resetAuth();
        loginAs(role);
        renderAt('/stability');

        await waitFor(() => {
          expect(screen.getByText('Paracetamol Extra')).toBeInTheDocument();
        });

        // Ruxsatsiz rol 403 so'rov yubormasligi uchun tugma ko'rinmaydi
        expect(
          screen.queryByRole('button', { name: /\+ Yangi tekshiruv boshlash/i }),
        ).not.toBeInTheDocument();
      }
    });

    it('lab_head, director va admin: "Yangi tekshiruv boshlash" tugmasi mavjud', async () => {
      for (const role of ['lab_head', 'director', 'admin'] as const) {
        cleanup();
        resetAuth();
        loginAs(role);
        renderAt('/stability');

        await waitFor(() => {
          expect(screen.getByText('Paracetamol Extra')).toBeInTheDocument();
        });

        expect(
          screen.getByRole('button', { name: /\+ Yangi tekshiruv boshlash/i }),
        ).toBeInTheDocument();
      }
    });

    it('kontrolyor: detal sahifasida natija kiritish yoki checkpoint qo‘shish tugmalari yo‘q', async () => {
      resetAuth();
      loginAs('kontrolyor');
      renderAt('/stability/study-1');

      await waitFor(() => {
        expect(screen.getByText('T3')).toBeInTheDocument();
      });

      expect(screen.queryByRole('button', { name: /\+ Checkpoint qo'shish/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Natija kiritish/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Yakunlash/i })).not.toBeInTheDocument();
    });

    it('chemist: faqat o‘ziga biriktirilgan checkpoint uchun "Natija kiritish" tugmasini ko‘radi (R-ROLE-64)', async () => {
      resetAuth();
      loginAs('chemist');
      renderAt('/stability/study-1');

      await waitFor(() => {
        expect(screen.getByText('T3')).toBeInTheDocument();
        expect(screen.getByText('T6')).toBeInTheDocument();
      });

      // cp-1 ga biriktirilgan (chemist-user-id) -> Natija kiritish bor
      const recordButtons = screen.getAllByRole('button', { name: /Natija kiritish/i });
      expect(recordButtons.length).toBe(1);

      // Checkpoint qo'shish tugmasi chemistda yo'q
      expect(screen.queryByRole('button', { name: /\+ Checkpoint qo'shish/i })).not.toBeInTheDocument();
    });

    it('lab_head va admin: detal sahifasida barcha boshqaruv tugmalariga ega', async () => {
      resetAuth();
      loginAs('lab_head');
      renderAt('/stability/study-1');

      await waitFor(() => {
        expect(screen.getByText('T3')).toBeInTheDocument();
      });

      expect(screen.getByRole('button', { name: /\+ Checkpoint qo'shish/i })).toBeInTheDocument();
      const recordButtons = screen.getAllByRole('button', { name: /Natija kiritish/i });
      expect(recordButtons.length).toBeGreaterThan(0);
    });
  });

  describe('2. Checkpointlar va holat belgilari', () => {
    it('tadqiqot va checkpoint ma‘lumotlari to‘g‘ri aks etadi', async () => {
      loginAs('lab_head');
      renderAt('/stability/study-1');

      await waitFor(() => {
        expect(screen.getByText('LOT-2026-001')).toBeInTheDocument();
        expect(screen.getByText('T3')).toBeInTheDocument();
        expect(screen.getByText('Assay')).toBeInTheDocument();
        expect(screen.getByText('99.5%')).toBeInTheDocument();
      });
    });
  });
});
