"use client";

import { create } from "zustand";
import { clearAuth, readAuth, saveAuth } from "@/lib/api/auth-storage";
import type { User } from "@/lib/api/types";

interface AuthState {
  accessToken: string | null;
  user: User | null;
  hydrate: () => void;
  setSession: (accessToken: string, user: User) => void;
  signOut: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  hydrate: () => set(readAuth()),
  setSession: (accessToken, user) => { saveAuth(accessToken, user); set({ accessToken, user }); },
  signOut: () => { clearAuth(); set({ accessToken: null, user: null }); },
}));
