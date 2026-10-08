import MockAdapter from 'axios-mock-adapter';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient, refreshClient, setAuthFailureHandler, toApiError } from '@/api/client';
import { useAuthStore } from '@/store/authStore';
import type { User } from '@/types';

const user: User = {
  id: 'u1',
  email: 'ali@test.uz',
  fullName: 'Ali',
  role: 'chemist',
  companyId: 'c1',
  company: { id: 'c1', name: 'Lab', slug: 'lab' },
};

let api: MockAdapter;
let refresh: MockAdapter;
let onFailure: ReturnType<typeof vi.fn<() => void>>;

beforeEach(() => {
  api = new MockAdapter(apiClient);
  refresh = new MockAdapter(refreshClient);
  onFailure = vi.fn<() => void>();
  setAuthFailureHandler(onFailure);
  useAuthStore.getState().setSession({ user, accessToken: 'old' });
});
afterEach(() => {
  api.restore();
  refresh.restore();
});

/** Faqat yangi token bilan kelgan so'rovga 200, eski token bilan 401. */
function protectedEndpoint(url: string) {
  api
    .onGet(url)
    .reply((config) =>
      config.headers?.Authorization === 'Bearer new' ? [200, { data: url }] : [401, {}],
    );
}

describe('apiClient', () => {
  it("Bearer token authStore dan qo'yiladi, baseURL /api/v1, withCredentials", async () => {
    api
      .onGet('/ping')
      .reply((config) => [200, { auth: config.headers?.Authorization, cfg: config }]);
    const res = await apiClient.get('/ping');
    expect(res.data.auth).toBe('Bearer old');
    expect(apiClient.defaults.baseURL).toBe('/api/v1');
    expect(apiClient.defaults.withCredentials).toBe(true);
  });

  it('ikki parallel 401 → faqat BITTA refresh, ikkalasi yangi token bilan qayta yuboriladi', async () => {
    protectedEndpoint('/a');
    protectedEndpoint('/b');
    let refreshCalls = 0;
    refresh.onPost('/auth/refresh').reply(async () => {
      refreshCalls++;
      await new Promise((r) => setTimeout(r, 20));
      return [200, { data: { accessToken: 'new' } }];
    });
    const [a, b] = await Promise.all([apiClient.get('/a'), apiClient.get('/b')]);
    expect(a.data).toEqual({ data: '/a' });
    expect(b.data).toEqual({ data: '/b' });
    expect(refreshCalls).toBe(1);
    expect(useAuthStore.getState().accessToken).toBe('new');
    expect(onFailure).not.toHaveBeenCalled();
  });

  it('refresh muvaffaqiyatsiz → authStore tozalanadi va onAuthFailure chaqiriladi', async () => {
    protectedEndpoint('/a');
    protectedEndpoint('/b');
    refresh.onPost('/auth/refresh').reply(401, { error: { code: 'UNAUTHORIZED', message: 'x' } });
    const results = await Promise.allSettled([apiClient.get('/a'), apiClient.get('/b')]);
    expect(results.every((r) => r.status === 'rejected')).toBe(true);
    expect(useAuthStore.getState()).toMatchObject({
      user: null,
      accessToken: null,
      status: 'anonymous',
    });
    expect(onFailure).toHaveBeenCalled();
    expect(refresh.history.post).toHaveLength(1);
  });

  it("/auth/* so'rovlaridagi 401 refresh qilmaydi (cheksiz sikl yo'q)", async () => {
    api.onPost('/auth/login').reply(401, {});
    api.onPost('/auth/logout').reply(401, {});
    await expect(apiClient.post('/auth/login')).rejects.toMatchObject({
      response: { status: 401 },
    });
    await expect(apiClient.post('/auth/logout')).rejects.toMatchObject({
      response: { status: 401 },
    });
    expect(refresh.history.post).toHaveLength(0);
    expect(onFailure).not.toHaveBeenCalled();
  });

  it("qayta yuborilgan so'rov yana 401 bersa — ikkinchi refresh yo'q", async () => {
    api.onGet('/always401').reply(401, {});
    refresh.onPost('/auth/refresh').reply(200, { data: { accessToken: 'new' } });
    await expect(apiClient.get('/always401')).rejects.toMatchObject({ response: { status: 401 } });
    expect(refresh.history.post).toHaveLength(1);
  });

  it("401 dan boshqa xatolar o'zgarishsiz qaytadi", async () => {
    api.onGet('/forbidden').reply(403, { error: { code: 'FORBIDDEN', message: "Ruxsat yo'q" } });
    const err = await apiClient.get('/forbidden').catch((e: unknown) => e);
    expect(toApiError(err)).toEqual({ code: 'FORBIDDEN', message: "Ruxsat yo'q" });
    expect(refresh.history.post).toHaveLength(0);
  });
});
