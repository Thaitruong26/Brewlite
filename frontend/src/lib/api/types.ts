export interface ApiErrorBody {
  statusCode?: number;
  code?: string;
  message?: string | string[];
  details?: unknown;
}

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PageMeta;
}

export interface Product {
  id: number;
  name: string;
  price: number;
  imageUrl: string;
  category: string;
  stock: number;
  inStock: boolean;
}

export interface User {
  id: number;
  email: string;
  fullName: string;
  role: "CUSTOMER" | "BARISTA";
  loyaltyPoints: number;
}

export interface LoginResponse {
  accessToken: string;
  tokenType: "Bearer";
  expiresIn: number;
  user: User;
}

export interface RegisterRequest {
  email: string;
  password: string;
  fullName: string;
}

export interface AuthStoreState {
  accessToken: string | null;
  user: User | null;
}
