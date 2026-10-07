import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { routes } from '@/router';
import { useAuthStore } from '@/store/authStore';
import type { Role, User } from '@/types';

export function userWith(role: Role): User {
  return {
    id: 'u1',
    fullName: 'Test Foydalanuvchi',
    role,
    companyId: role === 'super_admin' ? null : 'c1',
  };
}

export function loginAs(role: Role): void {
  useAuthStore.getState().setSession({ user: userWith(role), accessToken: 'token-1' });
}

export function resetAuth(status: 'unknown' | 'anonymous' = 'anonymous'): void {
  useAuthStore.setState({ user: null, accessToken: null, status });
}

/** Haqiqiy route daraxtini xotiradagi router bilan render qiladi. */
export function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const utils = render(<RouterProvider router={router} />);
  return { ...utils, router };
}
