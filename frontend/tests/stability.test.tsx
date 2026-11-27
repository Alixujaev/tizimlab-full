import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
          screen.queryByRole('button', { name: /Yangi tekshiruv boshlash/i }),
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
          screen.getByRole('button', { name: /Yangi tekshiruv boshlash/i }),
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

      expect(
        screen.queryByRole('button', { name: /Checkpoint qo'shish/i }),
      ).not.toBeInTheDocument();
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
      expect(
        screen.queryByRole('button', { name: /Checkpoint qo'shish/i }),
      ).not.toBeInTheDocument();
    });

    it('lab_head va admin: detal sahifasida barcha boshqaruv tugmalariga ega', async () => {
      resetAuth();
      loginAs('lab_head');
      renderAt('/stability/study-1');

      await waitFor(() => {
        expect(screen.getByText('T3')).toBeInTheDocument();
      });

      expect(screen.getByRole('button', { name: /Checkpoint qo'shish/i })).toBeInTheDocument();
      const recordButtons = screen.getAllByRole('button', { name: /Natija kiritish/i });
      expect(recordButtons.length).toBeGreaterThan(0);
    });
  });

  describe('2. Checkpointlar va holat belgilari', () => {
    it('P20 (D-53): yangi tekshiruvda har boshlang‘ich checkpointga mas‘ul kimyogar tanlanadi', async () => {
      const user = userEvent.setup();
      loginAs('lab_head');
      api.onGet('/admin/users').reply(200, {
        data: [
          {
            id: 'chem-9',
            fullName: 'Karim Kimyogar',
            email: 'k@x.uz',
            role: 'chemist',
            isActive: true,
          },
        ],
        meta: { page: 1, limit: 100, total: 1 },
      });
      api.onGet(/\/samples/).reply(200, {
        data: [
          {
            id: 'sample-9',
            substanceName: 'Aspirin',
            serialNumber: 'S-9',
            lotNumber: null,
            type: 'raw_material',
            status: 'approved',
          },
        ],
        meta: { page: 1, limit: 100, total: 1 },
      });
      let body: { checkpoints?: Array<{ intervalTag: string; assignedTo: string | null }> } | null =
        null;
      api.onPost('/stability').reply((c) => {
        body = JSON.parse(c.data as string);
        return [201, { ...mockStudy, id: 'study-9' }];
      });
      renderAt('/stability');
      await user.click(await screen.findByRole('button', { name: /Yangi tekshiruv boshlash/ }));
      const dialog = screen.getByRole('dialog');
      await user.click(within(dialog).getByRole('combobox', { name: /^Namuna/ }));
      await user.click(await screen.findByRole('option', { name: /Aspirin/ }));
      await user.click(within(dialog).getByRole('combobox', { name: "T3 — Mas'ul kimyogar" }));
      await user.click(await screen.findByRole('option', { name: 'Karim Kimyogar' }));
      await user.click(within(dialog).getByRole('button', { name: /Saqlash/ }));
      await waitFor(() => expect(body).not.toBeNull());
      expect(body!.checkpoints).toEqual([
        expect.objectContaining({ intervalTag: 'T3', assignedTo: 'chem-9' }),
        expect.objectContaining({ intervalTag: 'T6', assignedTo: null }),
        expect.objectContaining({ intervalTag: 'T12', assignedTo: null }),
      ]);
    });

    it('P20 (D-53, R-STAB-30): checkpoint qo‘shishda mas‘ul kimyogar tanlanadi va POST ga assignedTo ketadi', async () => {
      const user = userEvent.setup();
      loginAs('lab_head');
      api.onGet('/admin/users').reply(200, {
        data: [
          {
            id: 'chem-9',
            fullName: 'Karim Kimyogar',
            email: 'k@x.uz',
            role: 'chemist',
            isActive: true,
          },
        ],
        meta: { page: 1, limit: 100, total: 1 },
      });
      let body: unknown = null;
      api.onPost('/stability/study-1/checkpoints').reply((c) => {
        body = JSON.parse(c.data as string);
        return [201, { ...mockStudyDetail.checkpoints[0], id: 'cp-9', intervalTag: 'T12' }];
      });
      renderAt('/stability/study-1');
      await user.click(await screen.findByRole('button', { name: /Checkpoint qo'shish/i }));
      const dialog = screen.getByRole('dialog');
      await user.type(within(dialog).getByLabelText(/^Checkpoint nomi/), 'T12');
      await user.type(within(dialog).getByLabelText(/^Muddat/), '01.12.2027');
      await user.click(within(dialog).getByLabelText(/^Mas'ul kimyogar/));
      await user.click(await screen.findByRole('option', { name: 'Karim Kimyogar' }));
      await user.click(within(dialog).getByRole('button', { name: /Saqlash/ }));
      await waitFor(() =>
        expect(body).toMatchObject({
          intervalTag: 'T12',
          dueDate: '2027-12-01',
          assignedTo: 'chem-9',
        }),
      );
    });

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
