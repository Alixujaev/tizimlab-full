import { apiClient } from '@/api/client';
import type { ApiResponse, User } from '@/types';

export interface LoginInput {
  email: string;
  password: string;
}

export interface LoginResult {
  accessToken: string;
  user: User;
}

/** `POST /auth/login` — refresh token HttpOnly cookie'ga yoziladi (D-88). */
export async function login(input: LoginInput): Promise<LoginResult> {
  const { data } = await apiClient.post<ApiResponse<LoginResult>>('/auth/login', input);
  return data.data;
}

export async function logout(): Promise<void> {
  await apiClient.post('/auth/logout');
}

export async function fetchMe(): Promise<User> {
  const { data } = await apiClient.get<ApiResponse<User>>('/auth/me');
  return data.data;
}
