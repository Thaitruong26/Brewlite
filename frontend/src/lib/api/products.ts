import { apiRequest } from "./client";
import type { PaginatedResponse, Product } from "./types";

export interface ProductQuery {
  search?: string;
  category?: string;
  page?: number;
  limit?: number;
}

export function getProducts(query: ProductQuery = {}) {
  const params = new URLSearchParams();
  if (query.search) params.set("search", query.search);
  if (query.category) params.set("category", query.category);
  if (query.page !== undefined) params.set("page", String(query.page));
  if (query.limit !== undefined) params.set("limit", String(query.limit));
  const suffix = params.size ? `?${params.toString()}` : "";
  return apiRequest<PaginatedResponse<Product>>(`/products${suffix}`);
}
