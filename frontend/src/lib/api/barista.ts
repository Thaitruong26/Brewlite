import { apiRequest } from "./client";
import type { PaginatedResponse } from "./types";

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
  customerName?: string | null;
  status: "PAID" | "PREPARING" | "READY" | "COMPLETED" | "CANCELLED";
  total: number;
  items: BaristaOrderItem[];
  createdAt: string;
  updatedAt?: string;
  isRefunded?: boolean;
  refundRef?: string | null;
  refundedAt?: string | null;
  refundStatus?: 'PENDING' | 'FAILED' | 'UNKNOWN' | 'COMPLETED' | null;
  refundBank?: string | null;
  refundAccount?: string | null;
  refundExtra?: string | null;
}

// Chức năng: Lấy dữ liệu BaristaOrders. Cách hoạt động: Truy vấn dữ liệu từ Backend API và trả về kết quả đã định dạng.
export function getBaristaOrders(status?: string, page = 1, limit = 50) {
  const query = new URLSearchParams();
  if (status) query.set("status", status);
  if (page) query.set("page", String(page));
  if (limit) query.set("limit", String(limit));
  return apiRequest<PaginatedResponse<BaristaOrder>>(
    `/orders?${query.toString()}`,
    {
      authenticated: true,
    },
  );
}

// Chức năng: Lấy dữ liệu AllBaristaOrders. Cách hoạt động: Truy vấn dữ liệu và trả về kết quả đã định dạng.
export async function getAllBaristaOrders() {
  const first = await getBaristaOrders();
  const data = [...first.data];
  for (let page = 2; page <= first.meta.totalPages; page++) {
    const next = await getBaristaOrders(undefined, page);
    data.push(...next.data);
  }
  return { ...first, data };
}

// Chức năng: Cập nhật dữ liệu (updateOrderStatus). Cách hoạt động: Xác thực dữ liệu thay đổi và cập nhật trạng thái vào hệ thống/state.
export function updateOrderStatus(
  orderId: number,
  status: "PAID" | "PREPARING" | "READY" | "COMPLETED",
) {
  return apiRequest<BaristaOrder>(`/orders/${orderId}/status`, {
    method: "PATCH",
    authenticated: true,
    body: { status },
  });
}

// Chức năng: Hàm cancelBaristaOrder(orderId). Cách hoạt động: Thực thi logic xử lý nghiệp vụ của module và trả về kết quả cho nơi gọi.
export function cancelBaristaOrder(orderId: number) {
  return apiRequest<BaristaOrder>(`/orders/${orderId}/cancel`, {
    method: "POST",
    authenticated: true,
  });
}

// Chức năng: Hàm confirmRefund(orderId, refundRef). Cách hoạt động: Thực thi logic xử lý nghiệp vụ của module và trả về kết quả cho nơi gọi.
export function confirmRefund(orderId: number, refundRef?: string) {
  return apiRequest(`/orders/${orderId}/confirm-refund`, {
    method: "PATCH",
    authenticated: true,
    body: { refundRef },
  });
}

// Chức năng: Hoàn tiền đơn hủy bằng điểm thưởng cho khách hàng. Cách hoạt động: Gọi PATCH /orders/:id/refund-points.
export function refundOrderByPoints(orderId: number) {
  return apiRequest<{
    orderId: number;
    pointsRefunded: number;
    refundedAt: string;
    refundedAmount: number;
    refundRef: string;
    message: string;
  }>(`/orders/${orderId}/refund-points`, {
    method: "PATCH",
    authenticated: true,
  });
}

// Chức năng: Hàm failRefund(orderId, reason). Cách hoạt động: Thực thi logic xử lý nghiệp vụ của module và trả về kết quả cho nơi gọi.
export function failRefund(orderId: number, reason: string) {
  return apiRequest(`/orders/${orderId}/fail-refund`, {
    method: "PATCH",
    authenticated: true,
    body: { reason },
  });
}

// Chức năng: Hàm holdRefund(orderId, note). Cách hoạt động: Thực thi logic xử lý nghiệp vụ của module và trả về kết quả cho nơi gọi.
export function holdRefund(orderId: number, note?: string) {
  return apiRequest(`/orders/${orderId}/hold-refund`, {
    method: "PATCH",
    authenticated: true,
    body: { note },
  });
}

// Chức năng: Hàm retryRefund(orderId, refundBank, refundAccount). Cách hoạt động: Thực thi logic xử lý nghiệp vụ của module và trả về kết quả cho nơi gọi.
export function retryRefund(orderId: number, refundBank?: string, refundAccount?: string) {
  return apiRequest(`/orders/${orderId}/retry-refund`, {
    method: "PATCH",
    authenticated: true,
    body: { refundBank, refundAccount },
  });
}

export interface ProductStockInfo {
  id: number;
  name: string;
  stock: number;
  inStock: boolean;
  price: number;
  category: string;
}

// Chức năng: Lấy dữ liệu ProductsStock. Cách hoạt động: Truy vấn dữ liệu từ Backend API và trả về kết quả đã định dạng.
export function getProductsStock() {
  return apiRequest<PaginatedResponse<ProductStockInfo>>("/products?limit=100", {
    authenticated: true,
  });
}


export interface BackendIngredient {
  id: number;
  name: string;
  unit: string;
  stock: number;
  lowThreshold: number;
  low: boolean;
}

// Chức năng: Lấy dữ liệu IngredientsStock. Cách hoạt động: Truy vấn dữ liệu từ Backend API và trả về kết quả đã định dạng.
export function getIngredientsStock(page = 1, limit = 50) {
  return apiRequest<PaginatedResponse<BackendIngredient>>(
    `/ingredients?page=${page}&limit=${limit}`,
    {
      authenticated: false,
    },
  );
}

// Chức năng: Tạo mới hoặc thêm dữ liệu (addIngredientStock). Cách hoạt động: Kiểm tra đầu vào (ingredientId, quantity, note), thực hiện lưu trữ và trả về bản ghi vừa tạo.
export function addIngredientStock(
  ingredientId: number,
  quantity: number,
  note?: string,
) {
  return apiRequest<BackendIngredient>(`/ingredients/${ingredientId}/stock`, {
    method: "POST",
    authenticated: true,
    body: { quantity, note },
  });
}

export interface ProductRecipeItem {
  ingredientId: number;
  name: string;
  unit: string;
  quantity: number;
}

export interface ProductRecipeResponse {
  productId: number;
  items: ProductRecipeItem[];
}

// Chức năng: Lấy dữ liệu ProductRecipe. Cách hoạt động: Truy vấn dữ liệu từ Backend API và trả về kết quả đã định dạng.
export function getProductRecipe(productId: number) {
  return apiRequest<ProductRecipeResponse>(`/products/${productId}/recipe`, {
    authenticated: true,
  });
}

export type IngredientUnit = "G" | "ML" | "PCS";

export interface CreateIngredientPayload {
  name: string;
  unit: IngredientUnit;
  stock?: number;
  lowThreshold?: number;
}

// Chức năng: Tạo mới nguyên liệu vào kho. Cách hoạt động: Gửi POST /ingredients với thông tin nguyên liệu và trả về bản ghi vừa tạo.
export function createIngredient(payload: CreateIngredientPayload) {
  return apiRequest<BackendIngredient>("/ingredients", {
    method: "POST",
    authenticated: true,
    body: payload,
  });
}

export interface UpdateIngredientPayload {
  name?: string;
  lowThreshold?: number;
}

// Chức năng: Cập nhật thông tin nguyên liệu (tên hoặc ngưỡng cảnh báo). Cách hoạt động: Gửi PATCH /ingredients/:id.
export function updateIngredient(
  ingredientId: number,
  payload: UpdateIngredientPayload,
) {
  return apiRequest<BackendIngredient>(`/ingredients/${ingredientId}`, {
    method: "PATCH",
    authenticated: true,
    body: payload,
  });
}

// Chức năng: Kiểm kê / báo hao hụt tồn kho thực tế. Cách hoạt động: Gửi POST /ingredients/:id/adjust với actualStock và reason.
export function adjustIngredientStock(
  ingredientId: number,
  actualStock: number,
  reason: string,
) {
  return apiRequest<BackendIngredient>(`/ingredients/${ingredientId}/adjust`, {
    method: "POST",
    authenticated: true,
    body: { actualStock, reason },
  });
}

export interface StockMovementItem {
  id: number;
  type: "IN" | "OUT" | "ADJUST";
  quantity: number;
  orderId: number | null;
  userId: number | null;
  reason: string | null;
  createdAt: string;
}

// Chức năng: Lấy lịch sử thẻ kho của nguyên liệu. Cách hoạt động: Gọi GET /ingredients/:id/movements có phân trang.
export function getIngredientMovements(
  ingredientId: number,
  page = 1,
  limit = 20,
) {
  return apiRequest<PaginatedResponse<StockMovementItem>>(
    `/ingredients/${ingredientId}/movements?page=${page}&limit=${limit}`,
    {
      authenticated: true,
    },
  );
}

export interface RecipeItemInput {
  ingredientId: number;
  quantity: number;
}

// Chức năng: Cập nhật công thức pha chế cho món (size M). Cách hoạt động: Gửi PUT /products/:id/recipe với danh sách định lượng nguyên liệu.
export function updateProductRecipe(
  productId: number,
  items: RecipeItemInput[],
) {
  return apiRequest<ProductRecipeResponse>(`/products/${productId}/recipe`, {
    method: "PUT",
    authenticated: true,
    body: { items },
  });
}

export interface BackendTopping {
  id: number;
  name: string;
  price: number;
}

// Chức năng: Lấy danh sách topping đang kích hoạt. Cách hoạt động: Gọi GET /toppings.
export function getToppings() {
  return apiRequest<BackendTopping[]>("/toppings", {
    authenticated: false,
  });
}

export interface ToppingRecipeResponse {
  toppingId: number;
  items: ProductRecipeItem[];
}

// Chức năng: Lấy công thức định lượng cho 1 phần topping. Cách hoạt động: Gọi GET /toppings/:id/recipe.
export function getToppingRecipe(toppingId: number) {
  return apiRequest<ToppingRecipeResponse>(`/toppings/${toppingId}/recipe`, {
    authenticated: true,
  });
}

// Chức năng: Cập nhật công thức nguyên liệu cho topping. Cách hoạt động: Gửi PUT /toppings/:id/recipe.
export function updateToppingRecipe(
  toppingId: number,
  items: RecipeItemInput[],
) {
  return apiRequest<ToppingRecipeResponse>(`/toppings/${toppingId}/recipe`, {
    method: "PUT",
    authenticated: true,
    body: { items },
  });
}

