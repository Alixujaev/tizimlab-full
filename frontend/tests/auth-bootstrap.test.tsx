import { renderHook, waitFor } from '@testing-library/react';
import MockAdapter from 'axios-mock-adapter';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { apiClient, refreshClient } from '@/api/client';
import { useBootstrapAuth } from '@/hooks/useBootstrapAuth';
import { useAuthStore } from '@/store/authStore';
import { resetAuth, userWith } from './helpers';

let refresh: MockAdapter;
let api: MockAdapter;
beforeEach(() => {
  refresh = new MockAdapter(refreshClient);
  api = new MockAdapter(apiClient);
  localStorage.clear();
  sessionStorage.clear();
  resetAuth('unknown');
});
afterEach(() => {
  refresh.restore();
  api.restore();
});

describe('D-23: access token faqat xotirada', () => {
  it('setSession token va foydalanuvchini brauzer xotirasiga yozmaydi', () => {
    useAuthStore.getState().setSession({ user: userWith('admin'), accessToken: 'secret-access' });
    const stored = JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage });
    expect(stored).not.toContain('secret-access');
    expect(useAuthStore.getState().status).toBe('authenticated');
  });

  it('ilova ochilganda: refresh cookie → access token → /auth/me → authenticated', async () => {
    refresh.onPost('/auth/refresh').reply(200, { data: { accessToken: 'restored' } });
    api
      .onGet('/auth/me')
      .reply((config) =>
        config.headers?.Authorization === 'Bearer restored'
          ? [200, { data: userWith('chemist') }]
          : [401, {}],
      );
    renderHook(() => useBootstrapAuth());
    await waitFor(() => expect(useAuthStore.getState().status).toBe('authenticated'));
    expect(useAuthStore.getState().accessToken).toBe('restored');
    expect(useAuthStore.getState().user).toEqual(userWith('chemist'));
  });

  it("refresh muvaffaqiyatsiz bo'lsa — anonymous, /auth/me chaqirilmaydi", async () => {
    refresh.onPost('/auth/refresh').reply(401, {});
    renderHook(() => useBootstrapAuth());
    await waitFor(() => expect(useAuthStore.getState().status).toBe('anonymous'));
    expect(refresh.history.post).toHaveLength(1);
    expect(api.history.get).toHaveLength(0);
  });

  it("refresh o'tib /auth/me xato bersa — anonymous va token tozalanadi", async () => {
    refresh.onPost('/auth/refresh').reply(200, { data: { accessToken: 'restored' } });
    api.onGet('/auth/me').reply(401, { error: { code: 'SESSION_EXPIRED', message: 'x' } });
    renderHook(() => useBootstrapAuth());
    await waitFor(() => expect(useAuthStore.getState().status).toBe('anonymous'));
    expect(useAuthStore.getState().accessToken).toBeNull();
  });
});
