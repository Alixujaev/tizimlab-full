import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createTelegramLinkToken,
  getTelegramStatus,
  unlinkTelegram,
} from '@/api/telegram';
import { useAuthStore } from '@/store/authStore';

export const telegramKeys = {
  status: ['telegram', 'status'] as const,
};

export function useTelegramStatusQuery() {
  const user = useAuthStore((s) => s.user);

  return useQuery({
    queryKey: telegramKeys.status,
    queryFn: () => getTelegramStatus(),
    enabled: !!user, // Ruxsatsiz yoki kirmagan holatda so'rov yubormaydi
  });
}

export function useCreateTelegramLinkTokenMutation() {
  return useMutation({
    mutationFn: () => createTelegramLinkToken(),
  });
}

export function useUnlinkTelegramMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => unlinkTelegram(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: telegramKeys.status });
    },
  });
}
