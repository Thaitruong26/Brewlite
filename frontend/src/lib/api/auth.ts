import { apiRequest } from "./client";
import type { LoginResponse, RegisterRequest, User } from "./types";

export function login(email: string, password: string) {
  return apiRequest<LoginResponse>("/auth/login", { method: "POST", body: { email, password } });
}

export function register(payload: RegisterRequest) {
  return apiRequest<User>("/auth/register", { method: "POST", body: payload });
}
