import { clearAuth, getAccessToken } from "./auth-storage";
import type { ApiErrorBody } from "./types";

const baseUrl = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api").replace(/\/$/, "");

export class ApiError extends Error {
  status: number;
  code?: string;
  details?: unknown;

  constructor(status: number, body: ApiErrorBody) {
    const message = Array.isArray(body.message) ? body.message.join(" ") : body.message;
    super(message || `Yêu cầu không thành công (${status}).`);
    this.name = "ApiError";
    this.status = status;
    this.code = body.code;
    this.details = body.details;
  }
}

type RequestOptions = Omit<RequestInit, "body"> & { body?: unknown; authenticated?: boolean };

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { authenticated = false, headers, body, ...init } = options;
  const requestHeaders = new Headers(headers);
  if (body !== undefined) requestHeaders.set("Content-Type", "application/json");
  if (authenticated) {
    const token = getAccessToken();
    if (token) requestHeaders.set("Authorization", `Bearer ${token}`);
  }

  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path.startsWith("/") ? path : `/${path}`}`, {
      ...init,
      headers: requestHeaders,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, { message: "Không thể kết nối máy chủ. Vui lòng thử lại." });
  }

  if (response.status === 401 && authenticated && typeof window !== "undefined") {
    clearAuth();
    window.dispatchEvent(new CustomEvent("brewlite:unauthorized"));
  }
  if (!response.ok) {
    let error: ApiErrorBody = {};
    try { error = await response.json() as ApiErrorBody; } catch { /* non-JSON API error */ }
    throw new ApiError(response.status, error);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
