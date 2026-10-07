import { renderHook, waitFor } from '@testing-library/react';
import MockAdapter from 'axios-mock-adapter';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { refreshClient } from '@/api/client';
import { useBootstrapAuth } from '@/hooks/useBootstrapAuth';
import { useAuthStore } from '@/store/authStore';
import { resetAuth, userWith } from './helpers';

let refresh: MockAdapter;
beforeEach(() => {
  refresh = new MockAdapter(refreshClient);
  localStorage.clear();
  sessionStorage.clear();
  resetAuth('unknown');
});
afterEach(() => refresh.restore());

describe('D-23: access token faqat xotirada', () => {
  it('setSession token va foydalanuvchini brauzer xotirasiga yozmaydi', () => {
    useAuthStore.getState().setSession({ user: userWith('admin'), accessToken: 'secret-access' });
    const stored = JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage });
    expect(stored).not.toContain('secret-access');
    expect(useAuthStore.getState().status).toBe('authenticated');
  });

  it('ilova ochilganda refresh cookie orqali sessiya tiklanadi', async () => {
    refresh.onPost('/auth/refresh').reply(200, {
      data: { accessToken: 'restored', user: userWith('chemist') },
    });
    renderHook(() => useBootstrapAuth());
    await waitFor(() => expect(useAuthStore.getState().status).toBe('authenticated'));
    expect(useAuthStore.getState().accessToken).toBe('restored');
  });

  it("refresh muvaffaqiyatsiz bo'lsa — anonymous", async () => {
    refresh.onPost('/auth/refresh').reply(401, {});
    renderHook(() => useBootstrapAuth());
    await waitFor(() => expect(useAuthStore.getState().status).toBe('anonymous'));
    expect(refresh.history.post).toHaveLength(1);
  });
});
