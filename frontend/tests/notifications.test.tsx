import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MockAdapter from 'axios-mock-adapter';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '@/api/client';
import i18n from '@/i18n';
import { NOTIFICATION_EVENT } from '@/lib/socket';
import type { NotificationDto } from '@/types';
import { fakeSockets } from './fakeSocket';
import { loginAs, renderAt } from './helpers';

const toastMock = vi.hoisted(() => Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }));
vi.mock('sonner', () => ({ toast: toastMock }));

let api: MockAdapter;

const notif = (over: Partial<NotificationDto> = {}): NotificationDto => ({
  id: 'n1',
  type: 'sample_assigned',
  title: 'Sizga yangi namuna biriktirildi',
  message: 'Paratsetamol',
  referenceId: 's1',
  isRead: false,
  createdAt: '2026-10-09T08:00:00.000Z',
  ...over,
});

const page = (items: NotificationDto[], total = items.length) => ({
  data: items,
  meta: { page: 1, limit: 10, total },
});

beforeEach(async () => {
  await i18n.changeLanguage('uz');
  toastMock.mockClear();
  api = new MockAdapter(apiClient);
  api.onGet('/dashboard').reply(200, {
    data: { view: 'chemist', samplesByStatus: {}, totalSamples: 0 },
  });
  loginAs('chemist');
});

afterEach(() => {
  api.restore();
});

const bell = () => screen.getByRole('button', { name: 'Bildirishnomalar' });

describe('NotificationBell (R-NOTIF-13, R-NOTIF-25, R-NOTIF-26, R-NOTIF-27)', () => {
  it("o'qilmaganlar soni badge'da; ochilganda ro'yxat joriy tilda", async () => {
    api.onGet('/notifications/unread-count').reply(200, { data: { count: 3 } });
    api
      .onGet('/notifications')
      .reply(
        200,
        page([
          notif(),
          notif({
            id: 'n2',
            type: 'protocol_rejected',
            message: 'Ibuprofen — sabab',
            isRead: true,
          }),
        ]),
      );
    renderAt('/');

    expect(await screen.findByTestId('notification-badge')).toHaveTextContent('3');
    await userEvent.setup().click(bell());
    expect(await screen.findByText('Sizga yangi namuna biriktirildi')).toBeInTheDocument();
    expect(screen.getByText('Protokol rad etildi')).toBeInTheDocument();
    expect(screen.getByText('Ibuprofen — sabab')).toBeInTheDocument();
    expect(api.history.get.find((r) => r.url === '/notifications')?.params).toMatchObject({
      page: 1,
      limit: 10,
    });
  });

  it("bittasini bosish — POST /:id/read va namuna sahifasiga o'tish", async () => {
    api.onGet('/notifications/unread-count').reply(200, { data: { count: 1 } });
    api.onGet('/notifications').reply(200, page([notif()]));
    api.onPost('/notifications/n1/read').reply(200, { data: notif({ isRead: true }) });
    api.onGet(/\/samples\/s1.*/).reply(404, {});
    const { router } = renderAt('/');

    const user = userEvent.setup();
    await user.click(bell());
    await user.click(await screen.findByText('Sizga yangi namuna biriktirildi'));
    await waitFor(() =>
      expect(api.history.post.map((r) => r.url)).toContain('/notifications/n1/read'),
    );
    expect(router.state.location.pathname).toBe('/samples/s1');
  });

  it("'Hammasini o'qilgan deb belgilash' — POST /read-all va badge yo'qoladi", async () => {
    let count = 2;
    api.onGet('/notifications/unread-count').reply(() => [200, { data: { count } }]);
    api.onGet('/notifications').reply(200, page([notif(), notif({ id: 'n2' })]));
    api.onPost('/notifications/read-all').reply(() => {
      count = 0;
      return [200, { data: { updated: 2 } }];
    });
    renderAt('/');

    const user = userEvent.setup();
    expect(await screen.findByTestId('notification-badge')).toHaveTextContent('2');
    await user.click(bell());
    await user.click(
      await screen.findByRole('button', { name: "Hammasini o'qilgan deb belgilash" }),
    );
    await waitFor(() => expect(screen.queryByTestId('notification-badge')).not.toBeInTheDocument());
  });

  it("super_admin uchun bell va socket yo'q", async () => {
    loginAs('super_admin');
    api.onGet(/\/companies.*/).reply(200, { data: [], meta: { page: 1, limit: 20, total: 0 } });
    renderAt('/companies');
    await screen.findByRole('heading', { name: 'Kompaniyalar' });
    expect(screen.queryByRole('button', { name: 'Bildirishnomalar' })).not.toBeInTheDocument();
    expect(fakeSockets).toHaveLength(0);
  });
});

describe('useNotificationSocket (R-NOTIF-17, R-NOTIF-18, R-FE-05, R-FE-06)', () => {
  it('access token bilan ulanadi; notification:new keshga yoziladi va toast chiqadi', async () => {
    api.onGet('/notifications/unread-count').reply(200, { data: { count: 1 } });
    api.onGet('/notifications').reply(200, page([notif()]));
    renderAt('/');
    expect(await screen.findByTestId('notification-badge')).toHaveTextContent('1');

    const user = userEvent.setup();
    await user.click(bell());
    await screen.findByText('Paratsetamol');
    const listCalls = () => api.history.get.filter((r) => r.url === '/notifications').length;
    const before = listCalls();

    const socket = fakeSockets[0]!;
    expect(socket.auth).toEqual({ token: 'token-1' });
    expect(socket.connected).toBe(true);
    act(() =>
      socket.emit(
        NOTIFICATION_EVENT,
        notif({ id: 'n9', type: 'protocol_approved', message: 'Aspirin' }),
      ),
    );

    // Sahifa yangilanmasdan: badge va ro'yxat keshdan yangilanadi, qayta so'rov yo'q
    await waitFor(() => expect(screen.getByTestId('notification-badge')).toHaveTextContent('2'));
    const items = within(screen.getByRole('list', { name: 'Bildirishnomalar' })).getAllByRole(
      'button',
    );
    expect(items[0]).toHaveTextContent('Protokol tasdiqlandi');
    expect(items[0]).toHaveTextContent('Aspirin');
    expect(listCalls()).toBe(before);
    expect(toastMock).toHaveBeenCalledWith('Protokol tasdiqlandi', { description: 'Aspirin' });
  });

  it('toast sarlavhasi joriy tilda (ru)', async () => {
    await i18n.changeLanguage('ru');
    api.onGet('/notifications/unread-count').reply(200, { data: { count: 0 } });
    renderAt('/');
    await waitFor(() => expect(fakeSockets).toHaveLength(1));
    act(() => fakeSockets[0]!.emit(NOTIFICATION_EVENT, notif()));
    expect(toastMock).toHaveBeenCalledWith('Вам назначен новый образец', {
      description: 'Paratsetamol',
    });
  });

  it("logout'da socket uziladi", async () => {
    api.onGet('/notifications/unread-count').reply(200, { data: { count: 0 } });
    api.onPost('/auth/logout').reply(204);
    renderAt('/');
    await waitFor(() => expect(fakeSockets).toHaveLength(1));
    const socket = fakeSockets[0]!;
    await userEvent.setup().click(screen.getByRole('button', { name: 'Chiqish' }));
    await waitFor(() => expect(socket.connected).toBe(false));
    expect(socket.listenerCount(NOTIFICATION_EVENT)).toBe(0);
  });
});
