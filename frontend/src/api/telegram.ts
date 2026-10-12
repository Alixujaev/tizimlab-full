import { apiClient } from '@/api/client';
import type { ApiResponse } from '@/types';

export interface TelegramStatus {
  linked: boolean;
  telegramChatId: number | null;
  telegramUsername: string | null;
  linkedAt: string | null;
  language: string;
}

export interface TelegramLinkToken {
  token: string;
  botUsername: string | null;
  linkUrl: string | null;
  expiresInSeconds: number;
}

export async function getTelegramStatus(): Promise<TelegramStatus> {
  const { data } = await apiClient.get<ApiResponse<TelegramStatus>>('/telegram/status');
  return data.data;
}

export async function createTelegramLinkToken(): Promise<TelegramLinkToken> {
  const { data } = await apiClient.post<ApiResponse<TelegramLinkToken>>('/telegram/link-token');
  return data.data;
}

export async function unlinkTelegram(): Promise<{ success: boolean }> {
  const { data } = await apiClient.post<ApiResponse<{ success: boolean }>>('/telegram/unlink');
  return data.data;
}

export async function webAppAuth(initData: string): Promise<{ accessToken: string; user: unknown }> {
  const { data } = await apiClient.post<ApiResponse<{ accessToken: string; user: unknown }>>(
    '/telegram/webapp-auth',
    { initData },
  );
  return data.data;
}
