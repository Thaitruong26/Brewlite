import { apiRequest } from "./client";

export interface CreateOrderItem {
  productId: number;
  size: "S" | "M" | "L";
  toppingIds: number[];
  quantity: number;
  note?: string;
}

export interface CreateOrderRequest {
  items: CreateOrderItem[];
  promoCode?: string;
}

export interface OrderItemResponse {
  productId: number;
  productName: string;
  size: "S" | "M" | "L";
  toppings: {
    id: number;
    name: string;
    price: number;
  }[];
  unitPrice: number;
  qty: number;
  lineTotal: number;
  note?: string;
}

export interface OrderResponse {
  id: number;
  code: string;
  status: string;
  items: OrderItemResponse[];
  subtotal: number;
  discountAmount: number;
  total: number;
  pointsEarned?: number;
  createdAt?: string;
}

// Chức năng: Tạo mới hoặc thêm dữ liệu (createOrder). Cách hoạt động: Kiểm tra đầu vào (payload), thực hiện lưu trữ và trả về bản ghi vừa tạo.
export function createOrder(payload: CreateOrderRequest) {
  return apiRequest<OrderResponse>("/orders", {
    method: "POST",
    authenticated: true,
    body: payload,
  });
}

// Chức năng: Lấy dữ liệu Order. Cách hoạt động: Truy vấn dữ liệu từ Backend API và trả về kết quả đã định dạng.
export function getOrder(orderId: number) {
  return apiRequest<OrderResponse>(`/orders/${orderId}`, {
    authenticated: true,
  });
}
