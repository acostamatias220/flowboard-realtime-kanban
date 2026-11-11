import { useAuthStore } from '../store/authStore';
import { getSocketId } from './socket';

const BASE_URL = import.meta.env.VITE_API_URL ?? '';

export class ApiError extends Error {
  constructor(status, body) {
    super(body?.error?.message ?? `Request failed with status ${status}`);
    this.status = status;
    this.code = body?.error?.code;
    this.details = body?.error?.details;
  }
}

async function rawRequest(path, { method = 'GET', body, token } = {}) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const socketId = getSocketId();
  if (socketId) headers['X-Socket-Id'] = socketId;

  const res = await fetch(`${BASE_URL}/api${path}`, {
    method,
    headers,
    credentials: 'include',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, data);
  return data;
}

// Single-flight refresh: concurrent 401s share the same refresh request.
let refreshPromise = null;

export function refreshSession() {
  if (!refreshPromise) {
    refreshPromise = rawRequest('/auth/refresh', { method: 'POST' })
      .then((session) => {
        useAuthStore.getState().setSession(session);
        return session;
      })
      .catch((err) => {
        useAuthStore.getState().clearSession();
        throw err;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

/** Authenticated request with transparent access token renewal. */
export async function request(path, options = {}) {
  const token = useAuthStore.getState().accessToken;
  try {
    return await rawRequest(path, { ...options, token });
  } catch (err) {
    if (err.status !== 401 || err.code !== 'INVALID_TOKEN') throw err;
    const session = await refreshSession();
    return rawRequest(path, { ...options, token: session.accessToken });
  }
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body }),
  patch: (path, body) => request(path, { method: 'PATCH', body }),
  delete: (path) => request(path, { method: 'DELETE' }),
};

export const authApi = {
  login: (body) => rawRequest('/auth/login', { method: 'POST', body }),
  register: (body) => rawRequest('/auth/register', { method: 'POST', body }),
  logout: () => rawRequest('/auth/logout', { method: 'POST' }),
};
