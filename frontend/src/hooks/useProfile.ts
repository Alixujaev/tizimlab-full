import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { changePassword, fetchProfile, updateProfile } from '@/api/profile';
import { useAuthStore } from '@/store/authStore';
import type { ChangePasswordInput, UpdateProfileInput } from '@/types';

export const profileKeys = {
  all: ['profile'] as const,
};

export function useProfileQuery() {
  return useQuery({
    queryKey: profileKeys.all,
    queryFn: () => fetchProfile(),
  });
}

export function useUpdateProfileMutation() {
  const queryClient = useQueryClient();
  const setUser = useAuthStore((s) => s.setUser);
  return useMutation({
    mutationFn: (input: UpdateProfileInput) => updateProfile(input),
    onSuccess: (updated) => {
      setUser(updated);
      void queryClient.invalidateQueries({ queryKey: profileKeys.all });
    },
  });
}

export function useChangePasswordMutation() {
  return useMutation({
    mutationFn: (input: ChangePasswordInput) => changePassword(input),
  });
}
