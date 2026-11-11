import { create } from 'zustand';

/**
 * Session state. The access token lives only in memory (never in
 * localStorage) to reduce the impact of XSS; the refresh token is an
 * httpOnly cookie the JavaScript code cannot read.
 */
export const useAuthStore = create((set) => ({
  status: 'loading', // 'loading' | 'authenticated' | 'anonymous'
  user: null,
  accessToken: null,
  setSession: ({ user, accessToken }) => set({ user, accessToken, status: 'authenticated' }),
  clearSession: () => set({ user: null, accessToken: null, status: 'anonymous' }),
}));
