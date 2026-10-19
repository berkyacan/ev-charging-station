import type { User } from '../types';

const AUTH_TOKEN_STORAGE_KEY = 'ev-charging-auth-token';
const AUTH_USER_STORAGE_KEY = 'ev-charging-current-user';
export const AUTH_STATE_CHANGE_EVENT = 'ev-charging-auth-changed';

export function getToken(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
}

export function setToken(token: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
  dispatchAuthStateChange();
}

export function clearToken(): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
  window.localStorage.removeItem(AUTH_USER_STORAGE_KEY);
  dispatchAuthStateChange();
}

export function getStoredUser(): User | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const serializedUser = window.localStorage.getItem(AUTH_USER_STORAGE_KEY);

  if (!serializedUser) {
    return null;
  }

  try {
    return JSON.parse(serializedUser) as User;
  } catch {
    return null;
  }
}

export function setStoredUser(user: User): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(user));
}

export function clearStoredUser(): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem(AUTH_USER_STORAGE_KEY);
}

export function setAuthSession(token: string, user: User): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
  window.localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(user));
  dispatchAuthStateChange();
}

function dispatchAuthStateChange(): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new Event(AUTH_STATE_CHANGE_EVENT));
}
