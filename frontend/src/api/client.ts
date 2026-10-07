import axios, { type AxiosInstance, type InternalAxiosRequestConfig, isAxiosError } from 'axios';
import { useAuthStore } from '@/store/authStore';
import type { ApiError, ApiErrorResponse, ApiResponse, User } from '@/types';

export const API_BASE_URL = '/api/v1';
const REFRESH_PATH = '/auth/refresh';

/** Refresh javobi (D-22 formatida). Endpoint P2 da yoziladi. */
export interface RefreshPayload {
  accessToken: string;
  user: User;
}

type RetriableConfig = InternalAxiosRequestConfig & { _retry?: boolean };

let onAuthFailure: () => void = () => {
  if (window.location.pathname !== '/login') window.location.assign('/login');
};

/** Refresh muvaffaqiyatsiz bo'lganda nima qilishni belgilaydi (router navigatsiyasi yoki testlar uchun). */
export function setAuthFailureHandler(handler: () => void): void {
  onAuthFailure = handler;
}

// Interceptorsiz alohida instance — refresh so'rovining o'zi 401 bersa sikl bo'lmaydi
export const refreshClient = axios.create({ baseURL: API_BASE_URL, withCredentials: true });

export const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

let refreshPromise: Promise<string> | null = null;

/**
 * Single-flight refresh: bir vaqtda faqat BITTA `POST /auth/refresh`;
 * parallel 401'lar shu promise'ni kutadi.
 */
export function refreshAccessToken(): Promise<string> {
  refreshPromise ??= refreshClient
    .post<ApiResponse<RefreshPayload>>(REFRESH_PATH)
    .then(({ data }) => {
      useAuthStore.getState().setSession(data.data);
      return data.data.accessToken;
    })
    .finally(() => {
      refreshPromise = null;
    });
  return refreshPromise;
}

const isAuthRequest = (url?: string) => !!url && url.replace(API_BASE_URL, '').startsWith('/auth/');

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.set('Authorization', `Bearer ${token}`);
  return config;
});

apiClient.interceptors.response.use(undefined, async (error: unknown) => {
  if (!isAxiosError(error) || error.response?.status !== 401 || !error.config) {
    throw error;
  }
  const config = error.config as RetriableConfig;
  // /auth/* (login, refresh, logout) yoki allaqachon qayta urinilgan so'rov — refresh qilinmaydi
  if (config._retry || isAuthRequest(config.url)) throw error;
  config._retry = true;
  let token: string;
  try {
    token = await refreshAccessToken();
  } catch {
    useAuthStore.getState().clear();
    onAuthFailure();
    throw error;
  }
  config.headers.set('Authorization', `Bearer ${token}`);
  return apiClient(config);
});

/** Axios xatosidan D-22 `ApiError` ni ajratib oladi. */
export function toApiError(error: unknown): ApiError | null {
  if (isAxiosError(error)) {
    const body = error.response?.data as Partial<ApiErrorResponse> | undefined;
    if (body?.error?.code) return body.error;
  }
  return null;
}
