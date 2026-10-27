import { ApiError } from "./api-error";
import { mockApi, shouldUseMock } from "./mock";

export { ApiError };

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  const direct = localStorage.getItem("brewlite_access_token");
  if (direct) return direct;
  try {
    const auth = localStorage.getItem("brewlite.auth");
    if (auth) return (JSON.parse(auth) as { accessToken?: string }).accessToken ?? null;
  } catch { /* ignore */ }
  return null;
}

export function saveSession(token: string, user: User) {
  localStorage.setItem("brewlite_access_token", token);
  localStorage.setItem("brewlite_user", JSON.stringify(user));
  localStorage.setItem("brewlite.auth", JSON.stringify({ accessToken: token, user }));
}

export function clearSession() {
  localStorage.removeItem("brewlite_access_token");
  localStorage.removeItem("brewlite_user");
  localStorage.removeItem("brewlite.auth");
}

/** User đã lưu lúc đăng nhập (dùng làm dự phòng khi /auth/me chưa trả đủ field). */
export function getCachedUser(): User | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("brewlite_user");
  if (raw) {
    try { return JSON.parse(raw) as User; } catch { /* ignore */ }
  }
  try {
    const auth = localStorage.getItem("brewlite.auth");
    if (auth) return (JSON.parse(auth) as { user?: User }).user ?? null;
  } catch { /* ignore */ }
  return null;
}

export type User = {
  id: number;
  email: string;
  fullName?: string;
  role?: string;
  loyaltyPoints?: number;
};

/** Dạng phân trang chung (api.md mục 2.3). */
export type Paginated<T> = { data: T[]; meta: { page: number; limit: number; total: number; totalPages: number } };

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (shouldUseMock(path)) return mockApi<T>(path, init);

  const token = getToken();
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, { ...init, headers, cache: "no-store" });
  } catch {
    throw new ApiError("Không kết nối được máy chủ. Kiểm tra backend tại " + API_BASE, 0, "NETWORK_ERROR");
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload?.message;
    throw new ApiError(
      Array.isArray(message) ? message.join(", ") : message || `Yêu cầu thất bại (${response.status})`,
      response.status,
      typeof payload?.code === "string" ? payload.code : "ERROR",
      payload?.details,
    );
  }
  return payload as T;
}

export function formatVND(value: number) {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(value);
}
