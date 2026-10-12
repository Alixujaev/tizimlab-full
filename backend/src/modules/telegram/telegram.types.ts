import type { MeDto } from '../auth/auth.types.js';

export interface TelegramStatusDto {
  linked: boolean;
  telegramChatId: number | null;
  telegramUsername: string | null;
  linkedAt: string | null;
  language: string;
}

export interface LinkTokenDto {
  token: string;
  botUsername: string | null;
  linkUrl: string | null;
  expiresInSeconds: number;
}

export interface WebAppAuthResult {
  accessToken: string;
  refreshToken: string;
  user: MeDto;
}

export interface TelegramUserData {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_bot?: boolean;
}
