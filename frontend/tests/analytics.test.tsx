import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MockAdapter from 'axios-mock-adapter';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { apiClient } from '@/api/client';
import i18n from '@/i18n';
import { toCsv } from '@/lib/csv';
import type {
  AnalyticsOverviewDto,
  DashboardDto,
  Role,
  TeamRowDto,
  UserAnalyticsDto,
} from '@/types';
import { loginAs, renderAt } from './helpers';

let api: MockAdapter;

const counts = {
  pending_assignment: 0,
  in_progress: 0,
  stopped: 0,
  submitted: 0,
  approved: 0,
  rejected: 0,
};
const period = {
  from: '2025-03-01',
  to: '2025-03-31',
  days: 31,
  bucket: 'day' as const,
  previousFrom: '2025-01-29',
  previousTo: '2025-02-28',
};
const points = [
  { date: '2025-03-01', value: 0 },
  { date: '2025-03-02', value: 2 },
  { date: '2025-03-03', value: 1 },
];

const chemistMe: UserAnalyticsDto = {
  user: { id: 'u1', fullName: 'Test Foydalanuvchi', role: 'chemist', isActive: true },
  period,
  kpis: [
    { key: 'completed', unit: 'count', value: 3, previous: 2, snapshot: false },
    { key: 'rejectionRate', unit: 'percent', value: 50, previous: 25, snapshot: false },
    { key: 'avgCompletionHours', unit: 'hours', value: null, previous: null, snapshot: false },
    { key: 'inProgress', unit: 'count', value: 2, previous: null, snapshot: true },
  ],
  trend: { key: 'completed', points },
  outcomes: [
    { key: 'approved', label: null, value: 2 },
    { key: 'rejected', label: null, value: 2 },
  ],
  reasons: [
    { key: "noto'g'ri hisob", label: "Noto'g'ri hisob", value: 2 },
    { key: 'unspecified', label: null, value: 1 },
  ],
  activity: [],
};

const overview: AnalyticsOverviewDto = {
  period,
  kpis: [{ key: 'samplesCreated', unit: 'count', value: 5, previous: 1, snapshot: false }],
  trend: [
    { date: '2025-03-01', created: 1, approved: 0 },
    { date: '2025-03-02', created: 4, approved: 2 },
  ],
  funnel: [
    { key: 'created', label: null, value: 5 },
    { key: 'assigned', label: null, value: 4 },
    { key: 'inAnalysis', label: null, value: 4 },
    { key: 'submitted', label: null, value: 3 },
    { key: 'approved', label: null, value: 2 },
    { key: 'finalized', label: null, value: 1 },
  ],
  reasons: [{ key: 'unspecified', label: null, value: 1 }],
  byType: [{ key: 'raw_material', label: null, value: 5 }],
  lateSamples: [],
  workload: [{ userId: 'c1', fullName: 'Kimyogar Bir', open: 3 }],
  temperature: { unresolvedAlerts: 1, alertsInPeriod: 2 },
  stability: { activeStudies: 1, overdueCheckpoints: 0, dueSoonCheckpoints: 2 },
};

const teamRows: TeamRowDto[] = [
  {
    id: 'c1',
    fullName: 'Kimyogar Bir',
    role: 'chemist',
    isActive: true,
    openSamples: 3,
    metrics: { assigned: 4, completed: 2, rejectionRate: 50, firstPassRate: null },
  },
];

const analyticsCalls = () =>
  api.history.get.map((r) => r.url ?? '').filter((u) => u.startsWith('/analytics'));

beforeEach(async () => {
  await i18n.changeLanguage('uz');
  api = new MockAdapter(apiClient);
  api.onGet('/notifications/unread-count').reply(200, { data: { count: 0 } });
  api.onGet('/analytics/me').reply(200, { data: chemistMe });
  api.onGet('/analytics/overview').reply(200, { data: overview });
  api
    .onGet('/analytics/team')
    .reply(200, { data: teamRows, meta: { page: 1, limit: 20, total: 1 } });
  api.onGet(/\/analytics\/users\/[^/]+\/samples/).reply(200, {
    data: [],
    meta: { page: 1, limit: 10, total: 0 },
  });
  api.onGet(/\/analytics\/users\/[^/]+$/).reply(200, { data: chemistMe });
});

afterEach(() => {
  api.restore();
});

function dashboard(role: Role, data: DashboardDto) {
  loginAs(role);
  api.onGet('/dashboard').reply(200, { data });
  return renderAt('/');
}

describe('Analitika: rolga qarab bloklar (D-159, D-165)', () => {
  it('director dashboardi: kompaniya KPI, voronka, yuklama, jamoa jadvali', async () => {
    dashboard('director', {
      view: 'director',
      samplesByStatus: counts,
      totalSamples: 0,
      openProtocolsByStatus: { draft: 0, submitted: 0, approved: 0, rejected: 0 },
      openProtocolsTotal: 0,
    });
    expect(await screen.findByText('Kompaniya analitikasi')).toBeInTheDocument();
    expect(await screen.findByTestId('kpi-samplesCreated')).toHaveTextContent('5');
    expect(
      screen.getByRole('list', { name: "Davr bo'yicha namunalar voronkasi" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('list', { name: "Kimyogarlar bo'yicha ochiq namunalar" }),
    ).toBeInTheDocument();
    // Jadval qatori va yuklama grafigi
    expect((await screen.findAllByText('Kimyogar Bir')).length).toBeGreaterThanOrEqual(2);
    const urls = analyticsCalls();
    expect(urls).toContain('/analytics/overview');
    expect(urls).toContain('/analytics/team');
  });

  it('lab_head dashboardi: jamoa va navbat, overview so‘rovi yo‘q', async () => {
    api.onGet('/analytics/me').reply(200, {
      data: {
        ...chemistMe,
        user: { ...chemistMe.user, role: 'lab_head' },
        kpis: [
          { key: 'reviewedApproved', unit: 'count', value: 2, previous: 1, snapshot: false },
          { key: 'queueApprovals', unit: 'count', value: 4, previous: null, snapshot: true },
          { key: 'queueAssignments', unit: 'count', value: 1, previous: null, snapshot: true },
        ],
      },
    });
    dashboard('lab_head', {
      view: 'lab_head',
      samplesByStatus: counts,
      totalSamples: 0,
      pendingAssignment: 0,
      awaitingApproval: 0,
    });
    expect(await screen.findByText('Tasdiq kutayotganlar')).toBeInTheDocument();
    expect(await screen.findByTestId('kpi-reviewedApproved')).toHaveTextContent('2');
    await waitFor(() => expect(analyticsCalls()).toContain('/analytics/team'));
    expect(analyticsCalls()).not.toContain('/analytics/overview');
  });

  it('chemist dashboardi: faqat "Mening natijalarim" (o‘z /me)', async () => {
    dashboard('chemist', { view: 'chemist', samplesByStatus: counts, totalSamples: 0 });
    expect(await screen.findByTestId('kpi-completed')).toHaveTextContent('3');
    expect(screen.getByRole('link', { name: /Barcha natijalarim/ })).toHaveAttribute('href', '/me');
    expect(new Set(analyticsCalls())).toEqual(new Set(['/analytics/me']));
  });

  it.each(['admin'] as Role[])(
    '%s: analitika bloki yo‘q va hech qanday /analytics so‘rovi yuborilmaydi',
    async (role) => {
      dashboard(role, {
        view: 'lab_head',
        samplesByStatus: counts,
        totalSamples: 0,
        pendingAssignment: 0,
        awaitingApproval: 0,
      });
      expect(
        await screen.findByRole('heading', { name: /Kompaniya namunalari|namunalar/ }),
      ).toBeInTheDocument();
      await new Promise((r) => setTimeout(r, 50));
      expect(screen.queryByText('Mening natijalarim')).not.toBeInTheDocument();
      expect(analyticsCalls()).toEqual([]);
    },
  );

  it.each([
    ['admin', '/me'],
    ['admin', '/team'],
    ['super_admin', '/me'],
    ['chemist', '/team'],
    ['chemist', '/team/c1'],
    ['kontrolyor', '/team/c1'],
  ] as [Role, string][])('%s → %s: ruxsat yo‘q sahifasi, so‘rov yo‘q', async (role, path) => {
    loginAs(role);
    renderAt(path);
    expect(await screen.findByRole('heading', { name: "Ruxsat yo'q" })).toBeInTheDocument();
    expect(analyticsCalls()).toEqual([]);
  });
});

describe('Analitika sahifalari', () => {
  it('/me: KPI, formula izohi, ▲▼ taqqoslash, "ma‘lumot yo‘q", grafik va jadval muqobili', async () => {
    loginAs('chemist');
    renderAt('/me');
    expect(await screen.findByRole('heading', { name: 'Mening natijalarim' })).toBeInTheDocument();
    expect(await screen.findByTestId('kpi-rejectionRate')).toHaveTextContent('50%');
    expect(screen.getByTestId('kpi-avgCompletionHours')).toHaveTextContent("Ma'lumot yo'q");
    expect(screen.getByText('Oldingi davrga nisbatan 100% oshgan')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '«Rad etish foizi» qanday hisoblanadi' }),
    ).toBeInTheDocument();
    // Rad sabablari: "ko'rsatilmagan" tarjima qilingan
    expect(screen.getByRole('img', { name: 'Rad etish sabablari taqsimoti' })).toBeInTheDocument();
    expect(screen.getAllByText("Ko'rsatilmagan").length).toBeGreaterThan(0);

    const user = userEvent.setup();
    const trend = screen.getByRole('region', { name: 'Trend: Bajarilgan' });
    expect(within(trend).getByRole('img')).toBeInTheDocument();
    await user.click(within(trend).getByRole('button', { name: 'Jadval' }));
    const table = within(trend).getByRole('table');
    expect(within(table).getAllByRole('row')).toHaveLength(points.length + 1);
  });

  it('davrni almashtirish yangi so‘rov yuboradi (period=7d)', async () => {
    loginAs('chemist');
    renderAt('/me');
    await screen.findByTestId('kpi-completed');
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '7 kun' }));
    await waitFor(() =>
      expect(
        api.history.get.some((r) => r.url === '/analytics/me' && r.params?.period === '7d'),
      ).toBe(true),
    );
    expect(screen.getByRole('button', { name: '7 kun' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('/team (lab_head): jadval va qatordan xodim kartasiga o‘tish', async () => {
    loginAs('lab_head');
    const { router } = renderAt('/team');
    expect(
      await screen.findByRole('heading', { name: "Xodimlar ko'rsatkichlari" }),
    ).toBeInTheDocument();
    const cell = await screen.findByText('Kimyogar Bir', { selector: 'span.font-medium' });
    const user = userEvent.setup();
    await user.click(cell);
    await waitFor(() => expect(router.state.location.pathname).toBe('/team/c1'));
    await waitFor(() => expect(analyticsCalls()).toContain('/analytics/users/c1'));
  });
});

describe('CSV eksport', () => {
  it('maxsus belgilar qochiriladi, formula in‘ektsiyasi zararsizlantiriladi', () => {
    expect(
      toCsv(
        ['A', 'B'],
        [
          ['x,y', '=SUM(1)'],
          ['say "hi"', -5],
        ],
      ),
    ).toBe('A,B\r\n"x,y",\'=SUM(1)\r\n"say ""hi""",-5');
  });
});
