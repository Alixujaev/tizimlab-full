import { apiClient } from '@/api/client';
import type {
  ApiResponse,
  ChangePasswordInput,
  UpdateProfileInput,
  User,
} from '@/types';

export async function fetchProfile(): Promise<User> {
  const { data } = await apiClient.get<ApiResponse<User>>('/auth/profile');
  return data.data;
}

export async function updateProfile(input: UpdateProfileInput): Promise<User> {
  const { data } = await apiClient.patch<ApiResponse<User>>('/auth/profile', input);
  return data.data;
}

export async function changePassword(input: ChangePasswordInput): Promise<{ success: boolean }> {
  const { data } = await apiClient.put<ApiResponse<{ success: boolean }>>(
    '/auth/password',
    input,
  );
  return data.data;
}
