import { useMutation, useQueryClient } from '@tanstack/react-query';
import { login, logout, type LoginInput } from '@/api/auth';
import { useAuthStore } from '@/store/authStore';

/** Login xatosi formada ko'rsatiladi — global toast o'chirilgan (`meta.silentError`). */
export function useLogin() {
  return useMutation({
    mutationFn: (input: LoginInput) => login(input),
    meta: { silentError: true },
    onSuccess: ({ user, accessToken }) => useAuthStore.getState().setSession({ user, accessToken }),
  });
}

/** Server xatosida ham lokal sessiya tozalanadi (foydalanuvchi baribir chiqishi kerak). */
export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => logout(),
    meta: { silentError: true },
    onSettled: () => {
      queryClient.clear();
      useAuthStore.getState().clear();
    },
  });
}
