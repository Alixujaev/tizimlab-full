import axios, { type AxiosInstance, type InternalAxiosRequestConfig, isAxiosError } from 'axios';
import { useAuthStore } from '@/store/authStore';
import type { ApiError, ApiErrorResponse, ApiResponse } from '@/types';

export const API_BASE_URL = '/api/v1';
const REFRESH_PATH = '/auth/refresh';

/** `POST /auth/refresh` javobi (D-22). Foydalanuvchi ma'lumoti alohida `GET /auth/me` dan. */
export interface RefreshPayload {
  accessToken: string;
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

const REFRESH_LOCK = 'tizimlab-auth-refresh';
// D-200: "refresh yo'lda" belgisi — faqat vaqt (sir emas). Reload paytida javob yo'qolgan bo'lsa,
// keyingi yuklanishda bir marta qayta urinish uchun. sessionStorage — tabga xos, reload'dan omon qoladi.
const PENDING_KEY = 'auth.refreshPending';
const PENDING_TTL_MS = 30_000;

function readPendingMarker(): boolean {
  try {
    const at = Number(window.sessionStorage.getItem(PENDING_KEY));
    return Number.isFinite(at) && at > 0 && Date.now() - at < PENDING_TTL_MS;
  } catch {
    return false;
  }
}

function setPendingMarker(on: boolean): void {
  try {
    if (on) window.sessionStorage.setItem(PENDING_KEY, String(Date.now()));
    else window.sessionStorage.removeItem(PENDING_KEY);
  } catch {
    // storage yo'q/yopiq — belgisiz ishlaymiz
  }
}

// Oldingi yuklanishda boshlangan refresh natijasi yo'qolganmi (modul bir marta, sahifa yuklanganda o'qiladi)
let lostRefreshRetryAvailable = readPendingMarker();

/** Tablar orasida bitta refresh: `navigator.locks` bo'lsa — eksklyuziv lock, yo'q bo'lsa — to'g'ridan-to'g'ri. */
function withRefreshLock<T>(fn: () => Promise<T>): Promise<T> {
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
  if (locks && typeof locks.request === 'function') {
    return locks.request(REFRESH_LOCK, () => fn());
  }
  return fn();
}

async function postRefresh(): Promise<string> {
  setPendingMarker(true);
  try {
    const { data } = await refreshClient.post<ApiResponse<RefreshPayload>>(REFRESH_PATH);
    return data.data.accessToken;
  } finally {
    setPendingMarker(false);
  }
}

async function doRefresh(): Promise<string> {
  let token: string;
  try {
    token = await withRefreshLock(postRefresh);
  } catch (err) {
    if (!lostRefreshRetryAvailable) throw err;
    lostRefreshRetryAvailable = false;
    token = await withRefreshLock(postRefresh);
  }
  lostRefreshRetryAvailable = false;
  useAuthStore.getState().setAccessToken(token);
  return token;
}

/**
 * Single-flight refresh (D-200): tab ichida bir vaqtda faqat BITTA `POST /auth/refresh`
 * (parallel 401'lar shu promise'ni kutadi), tablar orasida — `navigator.locks` bilan navbat.
 */
export function refreshAccessToken(): Promise<string> {
  refreshPromise ??= doRefresh().finally(() => {
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
