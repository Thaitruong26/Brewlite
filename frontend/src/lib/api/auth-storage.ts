import type { AuthStoreState, User } from "./types";

const STORAGE_KEY = "brewlite.auth";

export function readAuth(): AuthStoreState {
  if (typeof window === "undefined") return { accessToken: null, user: null };
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) return { accessToken: null, user: null };
    const value = JSON.parse(saved) as Partial<AuthStoreState>;
    return { accessToken: value.accessToken ?? null, user: value.user ?? null };
  } catch {
    return { accessToken: null, user: null };
  }
}

export function saveAuth(accessToken: string, user: User) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ accessToken, user }));
  window.dispatchEvent(new Event("brewlite:auth-change"));
}

export function clearAuth() {
  window.localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new Event("brewlite:auth-change"));
}

export function getAccessToken() {
  return readAuth().accessToken;
}
