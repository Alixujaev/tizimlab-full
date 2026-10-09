import { screen } from '@testing-library/react';
import MockAdapter from 'axios-mock-adapter';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { apiClient } from '@/api/client';
import i18n from '@/i18n';
import type { DashboardDto, Role } from '@/types';
import { loginAs, renderAt } from './helpers';

let api: MockAdapter;

const counts = {
  pending_assignment: 4,
  in_progress: 3,
  stopped: 0,
  submitted: 2,
  approved: 7,
  rejected: 1,
};

beforeEach(async () => {
  await i18n.changeLanguage('uz');
  api = new MockAdapter(apiClient);
  api.onGet('/notifications/unread-count').reply(200, { data: { count: 0 } });
});

afterEach(() => {
  api.restore();
});

function renderDashboard(role: Role, data: DashboardDto) {
  loginAs(role);
  api.onGet('/dashboard').reply(200, { data });
  return renderAt('/');
}

/** Karta: label va qiymat bitta havola/blok ichida. */
const card = (label: string) => screen.getByText(label).parentElement!;

describe('Dashboardlar (D-33)', () => {
  it('ChemistDashboard — biriktirilgan namunalar statuslar bo‘yicha (R-FE-19, R-FE-43)', async () => {
    renderDashboard('chemist', { view: 'chemist', samplesByStatus: counts, totalSamples: 17 });
    expect(
      await screen.findByRole('heading', { name: 'Menga biriktirilgan namunalar (17)' }),
    ).toBeInTheDocument();
    expect(card('Jarayonda')).toHaveTextContent('3');
    expect(card('Tasdiqlangan')).toHaveTextContent('7');
    expect(screen.queryByText('Diqqat talab qiladi')).not.toBeInTheDocument();
  });

  it('InspectorDashboard — kontrolyorning o‘z namunalari (R-FE-22, R-FE-43)', async () => {
    renderDashboard('kontrolyor', { view: 'inspector', samplesByStatus: counts, totalSamples: 17 });
    expect(
      await screen.findByRole('heading', { name: 'Mening namunalarim (17)' }),
    ).toBeInTheDocument();
  });

  it('LabHeadDashboard — biriktirish va tasdiq kutayotganlar; admin ham shu ko‘rinishda (R-FE-21, R-FE-44)', async () => {
    const data: DashboardDto = {
      view: 'lab_head',
      samplesByStatus: counts,
      totalSamples: 17,
      pendingAssignment: 4,
      awaitingApproval: 5,
    };
    for (const role of ['lab_head', 'admin'] as const) {
      const { unmount } = renderDashboard(role, data);
      expect(await screen.findByText('Diqqat talab qiladi')).toBeInTheDocument();
      expect(card('Biriktirish kutilmoqda')).toHaveTextContent('4');
      expect(card('Tasdiqlash kutilmoqda (protokollar)')).toHaveTextContent('5');
      expect(
        screen.getByRole('heading', { name: 'Kompaniya namunalari (17)' }),
      ).toBeInTheDocument();
      unmount();
    }
  });

  it('DirectorDashboard — umumiy sonlar va yakunlanmagan protokollar (R-FE-20, R-FE-45)', async () => {
    renderDashboard('director', {
      view: 'director',
      samplesByStatus: counts,
      totalSamples: 17,
      openProtocolsByStatus: { draft: 1, submitted: 2, approved: 3, rejected: 0 },
      openProtocolsTotal: 6,
    });
    expect(
      await screen.findByRole('heading', { name: 'Yakunlanmagan protokollar (6)' }),
    ).toBeInTheDocument();
    expect(card('Qoralama')).toHaveTextContent('1');
    expect(screen.getByRole('heading', { name: 'Kompaniya namunalari (17)' })).toBeInTheDocument();
  });

  it('dashboard ruscha (i18n)', async () => {
    await i18n.changeLanguage('ru');
    renderDashboard('chemist', { view: 'chemist', samplesByStatus: counts, totalSamples: 17 });
    expect(
      await screen.findByRole('heading', { name: 'Назначенные мне образцы (17)' }),
    ).toBeInTheDocument();
  });
});
