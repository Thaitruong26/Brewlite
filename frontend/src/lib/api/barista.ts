import { apiRequest } from "./client";
import type { PaginatedResponse, Product } from "./types";

export interface BaristaOrderItem {
  productName: string;
  size: "S" | "M" | "L";
  qty: number;
  toppings: { name: string; price?: number }[];
  note?: string | null;
}

export interface BaristaOrder {
  id: number;
  code: string;
  status: "PENDING" | "PAID" | "PREPARING" | "READY" | "COMPLETED" | "CANCELLED";
  total: number;
  customerName: string;
  createdAt: string;
  items: BaristaOrderItem[];
}

/**
 * Lấy hàng đợi đơn hàng của quán (mặc định: PAID, PREPARING, READY)
 */
export async function getBaristaOrders(status = "PAID,PREPARING,READY", page = 1, limit = 50) {
  return apiRequest<PaginatedResponse<BaristaOrder>>(
    `/orders?status=${encodeURIComponent(status)}&page=${page}&limit=${limit}`,
    { authenticated: true },
  );
}

/**
 * Barista chuyển bước đơn hàng: PAID → PREPARING → READY → COMPLETED
 */
export async function updateOrderStatus(orderId: number, status: "PREPARING" | "READY" | "COMPLETED") {
  return apiRequest<{ id: number; code: string; status: string }>(
    `/orders/${orderId}/status`,
    {
      method: "PATCH",
      body: { status },
      authenticated: true,
    },
  );
}

/**
 * Hủy đơn khi còn ở trạng thái PAID
 */
export async function cancelBaristaOrder(orderId: number) {
  return apiRequest<{ id: number; code: string; status: string; message: string }>(
    `/orders/${orderId}/cancel`,
    {
      method: "POST",
      authenticated: true,
    },
  );
}

/**
 * Nhập thêm tồn kho cho sản phẩm
 */
export async function addProductStock(productId: number, quantity: number, note?: string) {
  return apiRequest<{ id: number; name: string; stock: number; inStock: boolean }>(
    `/products/${productId}/stock`,
    {
      method: "POST",
      body: { quantity, note },
      authenticated: true,
    },
  );
}
