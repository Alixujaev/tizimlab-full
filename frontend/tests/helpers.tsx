import { QueryClientProvider } from '@tanstack/react-query';
import { render, waitFor } from '@testing-library/react';
import { expect } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { createQueryClient } from '@/lib/queryClient';
import { routes } from '@/router';
import { useAuthStore } from '@/store/authStore';
import type { Role, User } from '@/types';

export function userWith(role: Role): User {
  const company = role === 'super_admin' ? null : { id: 'c1', name: 'Test Lab', slug: 'test-lab' };
  return {
    id: 'u1',
    email: `${role}@test.uz`,
    fullName: 'Test Foydalanuvchi',
    role,
    companyId: company?.id ?? null,
    company,
  };
}

export function loginAs(role: Role): void {
  useAuthStore.getState().setSession({ user: userWith(role), accessToken: 'token-1' });
}

export function resetAuth(status: 'unknown' | 'anonymous' = 'anonymous'): void {
  useAuthStore.setState({ user: null, accessToken: null, status });
}

/** Haqiqiy route daraxtini xotiradagi router (va React Query) bilan render qiladi. */
export function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const queryClient = createQueryClient();
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { ...utils, router, queryClient };
}

type UserLike = { click: (el: Element) => Promise<void> };

/** `@/ui` Select (combobox) dan qiymat bo'yicha variant tanlaydi — native `selectOptions` o'rnida. */
export async function selectOption(user: UserLike, combobox: HTMLElement, value: string) {
  // Variantlar yuklanguncha (select o'chiq) kutiladi
  await waitFor(() => expect(combobox).not.toBeDisabled());
  await user.click(combobox);
  const option = await waitFor(() => {
    const el = document.querySelector<HTMLElement>(
      `[role="option"][data-value="${CSS.escape(value)}"]`,
    );
    if (!el) throw new Error(`Select variant topilmadi: ${value}`);
    return el;
  });
  await user.click(option);
}
