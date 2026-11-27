"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useStockStore } from "@/store/stock-store";
import { useAuthStore } from "@/store/auth-store";
import {
  getAllBaristaOrders,
  updateOrderStatus,
  confirmRefund,
  refundOrderByPoints,
  failRefund,
  holdRefund,
  retryRefund,
  getProductsStock,
  getIngredientsStock,
  addIngredientStock,
  getProductRecipe,
  createIngredient,
  updateIngredient,
  adjustIngredientStock,
  getIngredientMovements,
  updateProductRecipe,
  getToppings,
  getToppingRecipe,
  updateToppingRecipe,
  type BackendTopping,
  type IngredientUnit,
  type StockMovementItem,
  BaristaOrder as BackendOrder,
} from "@/lib/api/barista";

type OrderStage = "pending" | "preparing" | "ready" | "completed" | "cancelled";
type QueueTab = "pending" | "preparing" | "ready" | "history" | "cancelled";
type ProductLine = { quantity: number; name: string; size: string; options: string[] };
type IngredientItem = { id?: number; sku: string; name: string; detail: string; unit: string; stock: number; minimum: number };
type BaristaOrder = {
  id: number;
  rawStatus: "PENDING" | "PAID" | "PREPARING" | "READY" | "COMPLETED" | "CANCELLED";
  customer: string;
  placedAt: string;
  stage: OrderStage;
  elapsed: string;
  items: ProductLine[];
  note?: string;
  total: number;
  isRefunded?: boolean;
  refundRef?: string | null;
  refundedAt?: string | null;
  refundStatus?: 'PENDING' | 'FAILED' | 'UNKNOWN' | 'COMPLETED' | null;
  refundBank?: string | null;
  refundAccount?: string | null;
  refundExtra?: string | null;
  hasRefundObligation?: boolean;
};
type StockItem = { id?: number; sku: string; name: string; description: string; category: string; price: number; stock: number; target: number };

type RecipeIngredient = {
  ingredient: string;
  quantity: number;
  unit: string;
  ingredientId?: number;
};

const BANK_NAMES: Record<string, string> = {
  VCB: "Vietcombank",
  MB: "MB Bank",
  TCB: "Techcombank",
  TPB: "TPBank",
  VPB: "VPBank",
  ACB: "ACB",
  ICB: "VietinBank",
  BIDV: "BIDV",
};

const PRODUCT_RECIPES: Record<string, RecipeIngredient[]> = {
  "Trà Sữa Truyền Thống": [
    { ingredient: "Cốt trà đen đã pha", quantity: 150, unit: "ml" },
    { ingredient: "Sữa tươi", quantity: 120, unit: "ml" },
    { ingredient: "Bột kem béo", quantity: 20, unit: "g" },
    { ingredient: "Đường nước / syrup đường", quantity: 20, unit: "ml" },
  ],
  "Ô Long Sữa": [
    { ingredient: "Cốt trà ô long đã pha", quantity: 180, unit: "ml" },
    { ingredient: "Sữa tươi", quantity: 100, unit: "ml" },
    { ingredient: "Bột kem béo", quantity: 15, unit: "g" },
    { ingredient: "Đường nước / syrup đường", quantity: 20, unit: "ml" },
  ],
  "Trà Sữa Khoai Môn": [
    { ingredient: "Cốt trà đen đã pha", quantity: 130, unit: "ml" },
    { ingredient: "Sữa tươi", quantity: 100, unit: "ml" },
    { ingredient: "Bột khoai môn", quantity: 25, unit: "g" },
    { ingredient: "Bột kem béo", quantity: 15, unit: "g" },
    { ingredient: "Đường nước / syrup đường", quantity: 15, unit: "ml" },
  ],
  "Trà Sữa Oreo Phô Mai": [
    { ingredient: "Cốt trà đen đã pha", quantity: 130, unit: "ml" },
    { ingredient: "Sữa tươi", quantity: 100, unit: "ml" },
    { ingredient: "Bột kem béo", quantity: 15, unit: "g" },
    { ingredient: "Đường nước / syrup đường", quantity: 15, unit: "ml" },
    { ingredient: "Bánh Oreo nghiền", quantity: 10, unit: "g" },
    { ingredient: "Kem cheese", quantity: 30, unit: "ml" },
  ],
  "Trà Sữa Trân Châu Đen": [
    { ingredient: "Cốt trà đen đã pha", quantity: 150, unit: "ml" },
    { ingredient: "Sữa tươi", quantity: 120, unit: "ml" },
    { ingredient: "Bột kem béo", quantity: 20, unit: "g" },
    { ingredient: "Đường nước / syrup đường", quantity: 20, unit: "ml" },
    { ingredient: "Trân châu đen đã nấu", quantity: 40, unit: "g" },
  ],
  "Trà Sữa Trân Châu Đường Đen": [
    { ingredient: "Cốt trà đen đã pha", quantity: 140, unit: "ml" },
    { ingredient: "Sữa tươi", quantity: 120, unit: "ml" },
    { ingredient: "Bột kem béo", quantity: 15, unit: "g" },
    { ingredient: "Syrup đường đen", quantity: 20, unit: "ml" },
    { ingredient: "Trân châu đường đen đã nấu", quantity: 40, unit: "g" },
  ],
  "Trà Đào Cam Sả": [
    { ingredient: "Cốt trà đen đã pha", quantity: 200, unit: "ml" },
    { ingredient: "Đào ngâm", quantity: 40, unit: "g" },
    { ingredient: "Cam tươi", quantity: 30, unit: "g" },
    { ingredient: "Sả", quantity: 5, unit: "g" },
    { ingredient: "Đường nước / syrup đường", quantity: 15, unit: "ml" },
  ],
  "Trà Vải": [
    { ingredient: "Cốt trà hoa nhài đã pha", quantity: 200, unit: "ml" },
    { ingredient: "Vải ngâm", quantity: 40, unit: "g" },
    { ingredient: "Đường nước / syrup đường", quantity: 15, unit: "ml" },
  ],
  "Trà Chanh Dây": [
    { ingredient: "Cốt trà đen đã pha", quantity: 180, unit: "ml" },
    { ingredient: "Syrup chanh dây", quantity: 30, unit: "ml" },
    { ingredient: "Đường nước / syrup đường", quantity: 15, unit: "ml" },
  ],
  "Trà Dâu Tây": [
    { ingredient: "Cốt trà hoa nhài đã pha", quantity: 180, unit: "ml" },
    { ingredient: "Dâu tây / puree dâu", quantity: 40, unit: "g" },
    { ingredient: "Đường nước / syrup đường", quantity: 15, unit: "ml" },
  ],
  "Trà Xoài": [
    { ingredient: "Cốt trà xanh đã pha", quantity: 180, unit: "ml" },
    { ingredient: "Xoài / puree xoài", quantity: 50, unit: "g" },
    { ingredient: "Đường nước / syrup đường", quantity: 15, unit: "ml" },
  ],
  "Ô Long Sữa Nhài": [
    { ingredient: "Cốt trà ô long đã pha", quantity: 140, unit: "ml" },
    { ingredient: "Cốt trà hoa nhài đã pha", quantity: 40, unit: "ml" },
    { ingredient: "Sữa tươi", quantity: 100, unit: "ml" },
    { ingredient: "Đường nước / syrup đường", quantity: 15, unit: "ml" },
  ],
  "Ô Long Sữa Tươi Nướng": [
    { ingredient: "Cốt trà ô long đã pha", quantity: 160, unit: "ml" },
    { ingredient: "Sữa tươi", quantity: 120, unit: "ml" },
    { ingredient: "Bột kem béo", quantity: 10, unit: "g" },
  ],
  "Ô Long Sữa Tươi Xoài": [
    { ingredient: "Cốt trà ô long đã pha", quantity: 150, unit: "ml" },
    { ingredient: "Sữa tươi", quantity: 100, unit: "ml" },
    { ingredient: "Mứt xoài", quantity: 35, unit: "g" },
    { ingredient: "Đường nước / syrup đường", quantity: 10, unit: "ml" },
  ],
  "Matcha Latte": [
    { ingredient: "Sữa tươi", quantity: 220, unit: "ml" },
    { ingredient: "Bột matcha", quantity: 4, unit: "g" },
    { ingredient: "Đường nước / syrup đường", quantity: 15, unit: "ml" },
  ],
  "Matcha Sữa Dâu": [
    { ingredient: "Sữa tươi", quantity: 200, unit: "ml" },
    { ingredient: "Bột matcha", quantity: 4, unit: "g" },
    { ingredient: "Mứt dâu", quantity: 35, unit: "g" },
  ],
  "Matcha Đậu Đỏ": [
    { ingredient: "Sữa tươi", quantity: 200, unit: "ml" },
    { ingredient: "Bột matcha", quantity: 4, unit: "g" },
    { ingredient: "Đậu đỏ đã nấu", quantity: 40, unit: "g" },
  ],
  "Cà Phê Sữa": [
    { ingredient: "Cà phê espresso/phin đã pha", quantity: 50, unit: "ml" },
    { ingredient: "Sữa đặc", quantity: 35, unit: "g" },
    { ingredient: "Nước lọc", quantity: 30, unit: "ml" },
  ],
  "Bạc Xỉu": [
    { ingredient: "Cà phê espresso/phin đã pha", quantity: 30, unit: "ml" },
    { ingredient: "Sữa tươi", quantity: 150, unit: "ml" },
    { ingredient: "Sữa đặc", quantity: 25, unit: "g" },
  ],
  "Cà Phê Muối": [
    { ingredient: "Cà phê espresso/phin đã pha", quantity: 50, unit: "ml" },
    { ingredient: "Sữa đặc", quantity: 20, unit: "g" },
    { ingredient: "Kem nền / whipping cream", quantity: 30, unit: "ml" },
    { ingredient: "Muối", quantity: 1, unit: "g" },
  ],
};

const defaultMenuStock: StockItem[] = [
  { id: 1, sku: "SP-001", name: "Trà Sữa Truyền Thống", description: "Trà đen đậm đà kết hợp sữa thơm béo", category: "Trà sữa", price: 35000, stock: 50, target: 50 },
  { id: 2, sku: "SP-002", name: "Ô Long Sữa", description: "Trà ô long thanh mát hòa quyện vị sữa béo ngậy", category: "Trà sữa", price: 38000, stock: 45, target: 50 },
  { id: 3, sku: "SP-003", name: "Trà Sữa Khoai Môn", description: "Vị khoai môn bùi béo tự nhiên, màu tím bắt mắt", category: "Trà sữa", price: 42000, stock: 40, target: 50 },
  { id: 4, sku: "SP-004", name: "Trà Sữa Oreo Phô Mai", description: "Vụn bánh Oreo giòn tan kết hợp lớp kem phô mai béo ngậy", category: "Trà sữa", price: 45000, stock: 35, target: 50 },
  { id: 5, sku: "SP-005", name: "Trà Sữa Trân Châu Đen", description: "Trà sữa truyền thống kèm trân châu đen dẻo dai", category: "Trà sữa", price: 40000, stock: 40, target: 50 },
  { id: 6, sku: "SP-006", name: "Trà Sữa Trân Châu Đường Đen", description: "Đường đen thơm lừng quyện cùng sữa tươi và trân châu", category: "Trà sữa", price: 45000, stock: 30, target: 50 },
  { id: 7, sku: "SP-007", name: "Trà Đào Cam Sả", description: "Trà đen thanh mát kết hợp đào ngâm giòn, cam tươi và sả thơm", category: "Trà trái cây", price: 39000, stock: 35, target: 50 },
  { id: 8, sku: "SP-008", name: "Trà Vải", description: "Trà hoa nhài thanh khiết với trái vải mọng nước", category: "Trà trái cây", price: 42000, stock: 30, target: 50 },
  { id: 9, sku: "SP-009", name: "Trà Chanh Dây", description: "Vị chua ngọt thanh mát giải nhiệt tức thì", category: "Trà trái cây", price: 35000, stock: 40, target: 50 },
  { id: 10, sku: "SP-010", name: "Trà Dâu Tây", description: "Dâu tây tươi ngọt ngào hòa quyện cùng cốt trà hoa quả", category: "Trà trái cây", price: 42000, stock: 25, target: 50 },
  { id: 11, sku: "SP-011", name: "Trà Xoài", description: "Thịt xoài chín thơm ngọt thanh mát trên nền trà xanh", category: "Trà trái cây", price: 40000, stock: 30, target: 50 },
  { id: 12, sku: "SP-012", name: "Ô Long Sữa Nhài", description: "Hương hoa nhài thoang thoảng hòa cùng cốt trà ô long sữa", category: "Trà nguyên vị và ô long", price: 40000, stock: 30, target: 50 },
  { id: 13, sku: "SP-013", name: "Ô Long Sữa Tươi Nướng", description: "Vị trà nướng đậm đà đặc trưng kết hợp sữa tươi thanh trùng", category: "Trà nguyên vị và ô long", price: 45000, stock: 28, target: 50 },
  { id: 14, sku: "SP-014", name: "Ô Long Sữa Tươi Xoài", description: "Trà ô long sữa thơm ngậy kết hợp mứt xoài ngọt dịu", category: "Trà nguyên vị và ô long", price: 45000, stock: 25, target: 50 },
  { id: 15, sku: "SP-015", name: "Matcha Latte", description: "Bột trà xanh Nhật Bản nguyên chất hòa cùng sữa tươi", category: "Matcha", price: 48000, stock: 20, target: 50 },
  { id: 16, sku: "SP-016", name: "Matcha Sữa Dâu", description: "Hai tầng đẹp mắt: mứt dâu tây chua ngọt và matcha thơm đậm", category: "Matcha", price: 50000, stock: 20, target: 50 },
  { id: 17, sku: "SP-017", name: "Matcha Đậu Đỏ", description: "Matcha đậm vị kết hợp topping đậu đỏ bùi ngọt truyền thống", category: "Matcha", price: 52000, stock: 22, target: 50 },
  { id: 18, sku: "SP-018", name: "Cà Phê Sữa", description: "Cà phê phin truyền thống pha sữa đặc đậm đà", category: "Cà phê và món đặc biệt", price: 35000, stock: 50, target: 50 },
  { id: 19, sku: "SP-019", name: "Bạc Xỉu", description: "Nhiều sữa ít cà phê, ngọt béo thơm lừng", category: "Cà phê và món đặc biệt", price: 38000, stock: 45, target: 50 },
  { id: 20, sku: "SP-020", name: "Cà Phê Muối", description: "Lớp kem béo mặn độc đáo trên nền cà phê phin đậm đặc", category: "Cà phê và món đặc biệt", price: 42000, stock: 5, target: 15 },
];

const defaultIngredients: IngredientItem[] = [
  { id: 1, sku: "NL-001", name: "Cốt trà đen đã pha", detail: "Đã ủ chuẩn nhiệt · Bảo quản bình giữ nhiệt", unit: "ml", stock: 20000, minimum: 2000 },
  { id: 2, sku: "NL-002", name: "Cốt trà ô long đã pha", detail: "Đã ủ chuẩn nhiệt · Bảo quản bình giữ nhiệt", unit: "ml", stock: 20000, minimum: 2000 },
  { id: 3, sku: "NL-003", name: "Cốt trà xanh đã pha", detail: "Trà xanh lài thơm nhẹ", unit: "ml", stock: 10000, minimum: 2000 },
  { id: 4, sku: "NL-004", name: "Cốt trà hoa nhài đã pha", detail: "Trà hoa nhài thanh hương", unit: "ml", stock: 10000, minimum: 2000 },
  { id: 5, sku: "NL-005", name: "Sữa tươi", detail: "Bảo quản tủ mát 2-4°C", unit: "ml", stock: 30000, minimum: 5000 },
  { id: 6, sku: "NL-006", name: "Sữa đặc", detail: "Sữa đặc có đường đậm đà", unit: "g", stock: 15000, minimum: 2000 },
  { id: 7, sku: "NL-007", name: "Bột kem béo", detail: "Bột kem béo thực vật", unit: "g", stock: 10000, minimum: 1000 },
  { id: 8, sku: "NL-008", name: "Đường nước / syrup đường", detail: "Syrup đường mía chuẩn độ ngọt", unit: "ml", stock: 20000, minimum: 2000 },
  { id: 9, sku: "NL-009", name: "Bột khoai môn", detail: "Bột khoai môn bùi béo tự nhiên", unit: "g", stock: 3000, minimum: 500 },
  { id: 10, sku: "NL-010", name: "Bánh Oreo nghiền", detail: "Vụn bánh Oreo giòn rụm", unit: "g", stock: 3000, minimum: 500 },
  { id: 11, sku: "NL-011", name: "Kem cheese", detail: "Kem phô mai béo mặn", unit: "ml", stock: 8000, minimum: 1000 },
  { id: 12, sku: "NL-012", name: "Trân châu đen đã nấu", detail: "Trân châu truyền thống dẻo dai", unit: "g", stock: 10000, minimum: 2000 },
  { id: 13, sku: "NL-013", name: "Trân châu đường đen đã nấu", detail: "Ngâm đường mía nguyên chất", unit: "g", stock: 10000, minimum: 2000 },
  { id: 14, sku: "NL-014", name: "Syrup đường đen", detail: "Đường đen nấu chuẩn vị", unit: "ml", stock: 5000, minimum: 500 },
  { id: 15, sku: "NL-015", name: "Đào ngâm", detail: "Đào miếng giòn bảo quản lạnh", unit: "g", stock: 5000, minimum: 1000 },
  { id: 16, sku: "NL-016", name: "Cam tươi", detail: "Cam vàng tươi cắt lát", unit: "g", stock: 5000, minimum: 500 },
  { id: 17, sku: "NL-017", name: "Sả", detail: "Sả tươi đập dập tạo mùi", unit: "g", stock: 2000, minimum: 200 },
  { id: 18, sku: "NL-018", name: "Vải ngâm", detail: "Vải thiều mọng nước", unit: "g", stock: 5000, minimum: 1000 },
  { id: 19, sku: "NL-019", name: "Syrup chanh dây", detail: "Chanh dây cô đặc tươi chua thanh", unit: "ml", stock: 5000, minimum: 1000 },
  { id: 20, sku: "NL-020", name: "Dâu tây / puree dâu", detail: "Puree dâu tây mọng ngọt", unit: "g", stock: 5000, minimum: 1000 },
  { id: 21, sku: "NL-021", name: "Xoài / puree xoài", detail: "Puree xoài chín thơm", unit: "g", stock: 5000, minimum: 1000 },
  { id: 22, sku: "NL-022", name: "Bột matcha", detail: "Matcha chuẩn Nhật Bản", unit: "g", stock: 2000, minimum: 200 },
  { id: 23, sku: "NL-023", name: "Đậu đỏ đã nấu", detail: "Đậu đỏ hầm bùi ngọt", unit: "g", stock: 5000, minimum: 500 },
  { id: 24, sku: "NL-024", name: "Cà phê espresso/phin đã pha", detail: "Robusta Đắk Lắk chiết xuất phin", unit: "ml", stock: 15000, minimum: 1500 },
  { id: 25, sku: "NL-025", name: "Muối", detail: "Muối tinh luyện pha kem mặn", unit: "g", stock: 500, minimum: 50 },
  { id: 26, sku: "NL-026", name: "Kem nền / whipping cream", detail: "Whipping cream béo ngậy làm kem", unit: "ml", stock: 5000, minimum: 500 },
  { id: 27, sku: "NL-027", name: "Thạch củ năng đã chuẩn bị", detail: "Thạch củ năng giòn ngọt", unit: "g", stock: 5000, minimum: 500 },
  { id: 28, sku: "NL-028", name: "Thạch đen đã chuẩn bị", detail: "Thạch sương sáo thanh mát", unit: "g", stock: 5000, minimum: 500 },
  { id: 29, sku: "NL-029", name: "Trân châu popping", detail: "Trân châu nổ vị hoa quả", unit: "g", stock: 5000, minimum: 500 },
  { id: 30, sku: "NL-030", name: "Thạch dừa", detail: "Thạch dừa giòn ngọt tự nhiên", unit: "g", stock: 5000, minimum: 500 },
  { id: 31, sku: "NL-031", name: "Pudding trứng", detail: "Pudding mềm mịn thơm béo", unit: "g", stock: 5000, minimum: 500 },
  { id: 32, sku: "NL-032", name: "Mứt dâu", detail: "Mứt dâu tây miếng ngọt dịu", unit: "g", stock: 5000, minimum: 500 },
  { id: 33, sku: "NL-033", name: "Mứt xoài", detail: "Mứt xoài nhiệt đới", unit: "g", stock: 5000, minimum: 500 },
  { id: 34, sku: "NL-034", name: "Nước lọc", detail: "Nước tinh khiết đã lọc", unit: "ml", stock: 50000, minimum: 5000 },
];

// Chức năng: Hàm money(value). Cách hoạt động: Thực thi logic xử lý nghiệp vụ của module và trả về kết quả cho nơi gọi.
const money = (value: number) => `${new Intl.NumberFormat("vi-VN").format(value)}đ`;

// Chức năng: Hàm mapBackendOrderToBarista(bo). Cách hoạt động: Thực thi logic xử lý nghiệp vụ của module và trả về kết quả cho nơi gọi.
function mapBackendOrderToBarista(bo: BackendOrder): BaristaOrder {
  const stageMap: Record<string, OrderStage> = {
    PENDING: "pending",
    PAID: "preparing",
    PREPARING: "preparing",
    READY: "ready",
    COMPLETED: "completed",
    CANCELLED: "cancelled",
  };
  const stage: OrderStage = stageMap[bo.status] || "preparing";

  const d = new Date(bo.createdAt);
  const placedAt = isNaN(d.getTime()) ? "Vừa xong" : d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });

  const items: ProductLine[] = bo.items.map((it) => ({
    quantity: it.qty,
    name: it.productName,
    size: it.size,
    options: [
      ...(Array.isArray(it.toppings) ? it.toppings.map((t) => `+ ${t.name}`) : []),
      ...(it.note ? [`Ghi chú: ${it.note}`] : []),
    ],
  }));

  return {
    id: bo.id,
    rawStatus: bo.status,
    customer: bo.customerName || `Khách hàng #${bo.id}`,
    placedAt,
    stage,
    elapsed: "Vừa xong",
    items,
    note: bo.items.find((i) => i.note)?.note || undefined,
    total: bo.total || 0,
    isRefunded: bo.isRefunded,
    refundRef: bo.refundRef,
    refundedAt: bo.refundedAt,
    refundStatus: bo.refundStatus,
    refundBank: bo.refundBank,
    refundAccount: bo.refundAccount,
    refundExtra: bo.refundExtra,
    hasRefundObligation: Boolean(bo.refundRef?.startsWith("VIETQR") || bo.isRefunded || bo.refundedAt),
  };
}

// Chức năng: Component giao diện BaristaPage. Cách hoạt động: Quản lý trạng thái hiển thị bằng React hooks và render cấu trúc JSX tương ứng.
export default function BaristaPage() {
  const [inventoryTab, setInventoryTab] = useState<"stock" | "ingredients" | "toppings">("stock");
  const [queueTab, setQueueTab] = useState<QueueTab>("preparing");
  const [orders, setOrders] = useState<BaristaOrder[]>([]);
  const [stock, setStock] = useState<StockItem[]>(defaultMenuStock);
  const [ingredientStock, setIngredientStock] = useState<IngredientItem[]>(defaultIngredients);
  const [toppings, setToppings] = useState<BackendTopping[]>([]);
  const [receivingSku, setReceivingSku] = useState<string | null>(null);
  const [receivingAmount, setReceivingAmount] = useState("1000");
  const [selectedRecipeProduct, setSelectedRecipeProduct] = useState<StockItem | null>(null);
  const [dynamicRecipe, setDynamicRecipe] = useState<RecipeIngredient[] | null>(null);
  const [loadingRecipe, setLoadingRecipe] = useState(false);
  const [editingProductRecipe, setEditingProductRecipe] = useState(false);
  const [productRecipeDraft, setProductRecipeDraft] = useState<{ ingredientId: number; name: string; unit: string; quantity: number }[]>([]);
  const [newRecipeIngId, setNewRecipeIngId] = useState<number>(0);
  const [savingProductRecipe, setSavingProductRecipe] = useState(false);

  const [createIngOpen, setCreateIngOpen] = useState(false);
  const [newIngName, setNewIngName] = useState("");
  const [newIngUnit, setNewIngUnit] = useState<IngredientUnit>("G");
  const [newIngStock, setNewIngStock] = useState("0");
  const [newIngThreshold, setNewIngThreshold] = useState("500");
  const [submittingCreateIng, setSubmittingCreateIng] = useState(false);

  const [editIngTarget, setEditIngTarget] = useState<IngredientItem | null>(null);
  const [editIngName, setEditIngName] = useState("");
  const [editIngThreshold, setEditIngThreshold] = useState("500");
  const [submittingEditIng, setSubmittingEditIng] = useState(false);

  const [adjustTarget, setAdjustTarget] = useState<IngredientItem | null>(null);
  const [adjustActualStock, setAdjustActualStock] = useState("0");
  const [adjustReason, setAdjustReason] = useState("");
  const [submittingAdjust, setSubmittingAdjust] = useState(false);

  const [movementsTarget, setMovementsTarget] = useState<IngredientItem | null>(null);
  const [movementsList, setMovementsList] = useState<StockMovementItem[]>([]);
  const [loadingMovements, setLoadingMovements] = useState(false);

  const [selectedTopping, setSelectedTopping] = useState<BackendTopping | null>(null);
  const [toppingRecipeDraft, setToppingRecipeDraft] = useState<{ ingredientId: number; name: string; unit: string; quantity: number }[]>([]);
  const [loadingToppingRecipe, setLoadingToppingRecipe] = useState(false);
  const [savingToppingRecipe, setSavingToppingRecipe] = useState(false);
  const [newToppingIngId, setNewToppingIngId] = useState<number>(0);
  const [refundOrder, setRefundOrder] = useState<BaristaOrder | null>(null);
  const [refundBank, setRefundBank] = useState("VCB");
  const [refundAccount, setRefundAccount] = useState("");
  const [refundProof, setRefundProof] = useState("");
  const [isVerifiedWithBank, setIsVerifiedWithBank] = useState(false);
  const [showTroubleshoot, setShowTroubleshoot] = useState(false);
  const [showFullAccount, setShowFullAccount] = useState(false);
  const [isEditingAccount, setIsEditingAccount] = useState(false);
  const [isRefunding, setIsRefunding] = useState(false);
  const [refundedOrders, setRefundedOrders] = useState<number[]>([]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("brewlite_refunded_orders");
        if (saved) {
          setRefundedOrders(JSON.parse(saved));
        }
      } catch {}
    }
  }, []);

  // Chức năng: Hàm openRefundModal(order). Cách hoạt động: Thực thi logic xử lý nghiệp vụ của module và trả về kết quả cho nơi gọi.
  const openRefundModal = (order: BaristaOrder) => {
    setRefundOrder(order);
    setRefundProof("");
    setIsVerifiedWithBank(false);
    setShowTroubleshoot(false);
    setShowFullAccount(false);
    setIsEditingAccount(false);
    let acc = "";
    let bank = "MB";
    if (order.refundRef && order.refundRef.startsWith("VIETQR:")) {
      const parts = order.refundRef.split(":");
      if (parts[1]) bank = parts[1];
      if (parts[2]) acc = parts[2];
    } else if (typeof window !== "undefined") {
      acc = localStorage.getItem(`refund_account_${order.id}`) || "";
      bank = localStorage.getItem(`refund_bank_${order.id}`) || "MB";
    }
    setRefundAccount(acc);
    setRefundBank(bank);
  };

  // Chức năng: Xử lý sự kiện ConfirmRefund. Cách hoạt động: Nhận sự kiện từ giao diện, cập nhật state hoặc gọi API xử lý nghiệp vụ tương ứng.
  const handleConfirmRefund = async (orderId: number) => {
    if (!refundProof.trim()) {
      alert("Vui lòng nhập mã giao dịch ngân hàng trước khi xác nhận!");
      return;
    }
    if (!isVerifiedWithBank) {
      alert("Vui lòng tích cam kết đã đối chiếu lịch sử giao dịch ngân hàng thành công!");
      return;
    }
    setIsRefunding(true);
    try {
      await confirmRefund(orderId, refundProof.trim());
      setRefundedOrders((prev) => {
        const next = Array.from(new Set([...prev, orderId]));
        if (typeof window !== "undefined") {
          try {
            localStorage.setItem("brewlite_refunded_orders", JSON.stringify(next));
          } catch {}
        }
        return next;
      });
      setRefundOrder(null);
      setRefundProof("");
      setIsVerifiedWithBank(false);
      setNotice(`Đã xác nhận hoàn tiền thành công cho đơn #${orderId}!`);
      getAllBaristaOrders().then((res) => setOrders(res.data.map(mapBackendOrderToBarista))).catch(() => {});
    } catch (e: any) {
      console.error("Xác nhận hoàn tiền thất bại:", e);
      alert(e?.message || "Xác nhận hoàn tiền thất bại. Vui lòng đối soát giao dịch và thử lại!");
    } finally {
      setIsRefunding(false);
    }
  };

  // Chức năng: Xử lý sự kiện FailRefund. Cách hoạt động: Nhận sự kiện từ giao diện, cập nhật state hoặc gọi API xử lý nghiệp vụ tương ứng.
  // Chức năng: Hoàn tiền đơn hủy bằng điểm thưởng cho khách. Cách hoạt động: Gọi refundOrderByPoints(orderId) và cập nhật lại danh sách đơn.
  const handleRefundPoints = async (orderId: number) => {
    setIsRefunding(true);
    try {
      const res = await refundOrderByPoints(orderId);
      setRefundedOrders((prev) => {
        const next = prev.includes(orderId) ? prev : [...prev, orderId];
        if (typeof window !== "undefined") {
          localStorage.setItem("brewlite_refunded_orders", JSON.stringify(next));
        }
        return next;
      });
      const ordersRes = await getAllBaristaOrders();
      setOrders(ordersRes.data.map(mapBackendOrderToBarista));
      setNotice(`✓ Đã hoàn ${res.pointsRefunded.toLocaleString("vi-VN")} điểm thưởng cho khách đơn #${orderId}!`);
      setRefundOrder(null);
    } catch (err: any) {
      setNotice(`Lỗi hoàn điểm: ${err?.message || "Không thể hoàn điểm"}`);
    } finally {
      setIsRefunding(false);
    }
  };

  const handleFailRefund = async (orderId: number) => {
    const reason = prompt("Nhập lý do chuyển khoản thất bại (vd: Sai số tài khoản, tài khoản đóng):", "Sai số tài khoản hoặc tài khoản thụ hưởng không hợp lệ");
    if (!reason || !reason.trim()) return;

    setIsRefunding(true);
    try {
      await failRefund(orderId, reason.trim());
      setRefundOrder(null);
      setNotice(`Đã ghi nhận chuyển khoản thất bại cho đơn #${orderId}.`);
      getAllBaristaOrders().then((res) => setOrders(res.data.map(mapBackendOrderToBarista))).catch(() => {});
    } catch (e: any) {
      alert(e?.message || "Không thể cập nhật trạng thái thất bại");
    } finally {
      setIsRefunding(false);
    }
  };

  // Chức năng: Xử lý sự kiện HoldRefund. Cách hoạt động: Nhận sự kiện từ giao diện, cập nhật state hoặc gọi API xử lý nghiệp vụ tương ứng.
  const handleHoldRefund = async (orderId: number) => {
    const note = prompt("Nhập lý do chuyển sang đối soát ngân hàng:", "Lệnh chuyển tiền đang treo, chờ ngân hàng đối soát");
    if (!note || !note.trim()) return;

    setIsRefunding(true);
    try {
      await holdRefund(orderId, note.trim());
      setRefundOrder(null);
      setNotice(`Đã chuyển đơn #${orderId} sang trạng thái đối soát (UNKNOWN).`);
      getAllBaristaOrders().then((res) => setOrders(res.data.map(mapBackendOrderToBarista))).catch(() => {});
    } catch (e: any) {
      alert(e?.message || "Không thể chuyển đối soát");
    } finally {
      setIsRefunding(false);
    }
  };

  // Chức năng: Xử lý sự kiện RetryRefund. Cách hoạt động: Nhận sự kiện từ giao diện, cập nhật state hoặc gọi API xử lý nghiệp vụ tương ứng.
  const handleRetryRefund = async (orderId: number) => {
    if (refundOrder?.refundStatus === "UNKNOWN") {
      alert("Đơn hàng đang ở trạng thái Đối soát (UNKNOWN). Tuyệt đối không được chuyển tiền lại ngay để tránh hoàn tiền trùng lặp cho khách hàng!");
      return;
    }
    setIsRefunding(true);
    try {
      await retryRefund(orderId, refundBank, refundAccount);
      setRefundOrder(null);
      setNotice(`Đã đặt lại trạng thái hoàn tiền đơn #${orderId} về PENDING để thử lại.`);
      getAllBaristaOrders().then((res) => setOrders(res.data.map(mapBackendOrderToBarista))).catch(() => {});
    } catch (e: any) {
      alert(e?.message || "Không thể thử lại hoàn tiền");
    } finally {
      setIsRefunding(false);
    }
  };

  useEffect(() => {
    let ignore = false;
    getToppings()
      .then((list) => {
        if (!ignore && Array.isArray(list)) setToppings(list);
      })
      .catch(() => {});
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    setEditingProductRecipe(false);
    if (selectedRecipeProduct?.id) {
      let ignore = false;
      setLoadingRecipe(true);
      getProductRecipe(selectedRecipeProduct.id)
        .then((res) => {
          if (!ignore && res && Array.isArray(res.items) && res.items.length > 0) {
            setDynamicRecipe(
              res.items.map((i) => ({
                ingredient: i.name,
                quantity: i.quantity,
                unit: i.unit.toLowerCase(),
                ingredientId: i.ingredientId,
              }))
            );
          }
        })
        .catch(() => {
          if (!ignore) setDynamicRecipe(null);
        })
        .finally(() => {
          if (!ignore) setLoadingRecipe(false);
        });
      return () => {
        ignore = true;
      };
    } else {
      setDynamicRecipe(null);
    }
  }, [selectedRecipeProduct]);

  const availability = useStockStore((state) => state.availability);
  const hydrateAvailability = useStockStore((state) => state.hydrate);
  const setProductAvailability = useStockStore((state) => state.setProductAvailability);
  const user = useAuthStore((state) => state.user);
  const hydrateAuth = useAuthStore((state) => state.hydrate);
  const [authChecked, setAuthChecked] = useState(false);
  const [notice, setNotice] = useState("");
  const [updatedAt, setUpdatedAt] = useState("vừa xong");

  useEffect(() => {
    hydrateAuth();
    hydrateAvailability();
    setAuthChecked(true);
    // Chức năng: Hàm sync. Cách hoạt động: Thực thi logic xử lý nghiệp vụ của module và trả về kết quả cho nơi gọi.
    const sync = () => hydrateAvailability();
    window.addEventListener("brewlite:stock-availability-change", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("brewlite:stock-availability-change", sync);
      window.removeEventListener("storage", sync);
    };
  }, [hydrateAuth, hydrateAvailability]);

  const previousOrders = useRef<Map<number, string>>(new Map());

  useEffect(() => {
    let ignore = false;
    let timer: any = null;
    // Chức năng: Hàm loadBackendOrders. Cách hoạt động: Thực thi logic xử lý nghiệp vụ của module và trả về kết quả cho nơi gọi.
    async function loadBackendOrders() {
      try {
        const res = await getAllBaristaOrders();
        const list = Array.isArray(res) ? res : res?.data;
        if (!ignore && Array.isArray(list)) {
          const newlyCancelled = list.filter((order) => order.status === "CANCELLED" && previousOrders.current.has(order.id) && previousOrders.current.get(order.id) !== "CANCELLED");
          previousOrders.current = new Map(list.map((order) => [order.id, order.status]));
          if (newlyCancelled.length) setNotice(`Đơn ${newlyCancelled.map((order) => `#${order.id}`).join(", ")} đã bị hủy. Không tiếp tục pha chế các đơn này.`);
          const mapped = list.map(mapBackendOrderToBarista);
          setOrders(mapped);
          setUpdatedAt(new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }));
        }
      } catch (err) {
        console.warn("Không thể tải đơn hàng từ máy chủ:", err);
      } finally {
        if (!ignore) {
          timer = setTimeout(loadBackendOrders, 5000);
        }
      }
    }
    loadBackendOrders();
    return () => {
      ignore = true;
      if (timer) clearTimeout(timer);
    };
  }, [user]);

  // Chức năng: Hàm loadRealIngredients. Cách hoạt động: Thực thi logic xử lý nghiệp vụ của module và trả về kết quả cho nơi gọi.
  const loadRealIngredients = async () => {
    try {
      const res: any = await getIngredientsStock(1, 50);
      const raw = res?.data ?? res;
      const list = Array.isArray(raw) ? raw : Array.isArray(raw?.data) ? raw.data : [];
      if (Array.isArray(list) && list.length > 0) {
        setIngredientStock(
          list.map((item: any) => ({
            id: item.id,
            sku: `NL-${String(item.id).padStart(3, "0")}`,
            name: item.name,
            detail: `Nguyên liệu pha chế tiêu chuẩn · Mã DB #${item.id}`,
            unit: item.unit ? item.unit.toLowerCase() : "ml",
            stock: item.stock,
            minimum: item.lowThreshold || 500,
          }))
        );
      }
    } catch (err) {
      console.warn("Sử dụng danh sách nguyên liệu mặc định:", err);
    }
  };

  // Chức năng: Hàm loadRealStock. Cách hoạt động: Thực thi logic xử lý nghiệp vụ của module và trả về kết quả cho nơi gọi.
  const loadRealStock = async () => {
    try {
      const res: any = await getProductsStock();
      const raw = res?.data ?? res;
      const list = Array.isArray(raw) ? raw : Array.isArray(raw?.data) ? raw.data : [];
      if (Array.isArray(list) && list.length > 0) {
        setStock(
          list.map((item: any) => ({
            id: item.id,
            sku: `SP-${String(item.id).padStart(3, "0")}`,
            name: item.name,
            description: item.category,
            category: item.category,
            price: item.price,
            stock: item.stock ?? 0,
            target: Math.max(item.stock ?? 0, 20),
          })),
        );
      }
    } catch (err) {
      console.warn("Sử dụng danh sách menu mặc định:", err);
    }
  };

  useEffect(() => {
    loadRealStock();
    loadRealIngredients();
    const interval = setInterval(() => {
      loadRealIngredients();
      loadRealStock();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const counts = useMemo(() => ({
    pending: orders.filter((order) => order.stage === "pending").length,
    preparing: orders.filter((order) => order.stage === "preparing").length,
    ready: orders.filter((order) => order.stage === "ready").length,
    cancelled: orders.filter((order) => order.stage === "cancelled").length,
    history: orders.filter((order) => order.stage === "completed").length,
  }), [orders]);

  const needingRefundCount = useMemo(() => {
    return orders.filter(
      (order) => order.stage === "cancelled" && !order.isRefunded && !refundedOrders.includes(order.id)
    ).length;
  }, [orders, refundedOrders]);

  // Chức năng: Hàm moveOrder(id, nextStatus). Cách hoạt động: Thực thi logic xử lý nghiệp vụ của module và trả về kết quả cho nơi gọi.
  async function moveOrder(id: number, nextStatus: "PAID" | "PREPARING" | "READY" | "COMPLETED") {
    const stage: OrderStage =
      nextStatus === "COMPLETED"
        ? "completed"
        : nextStatus === "READY"
        ? "ready"
        : nextStatus === "PAID" || nextStatus === "PREPARING"
        ? "preparing"
        : "pending";
    try {
      if (nextStatus === "PREPARING") {
        const orderToPrepare = orders.find((o) => o.id === id);
        if (orderToPrepare) {
          setIngredientStock((prevIngredients) => {
            const nextList = prevIngredients.map((item) => ({ ...item }));
            for (const line of orderToPrepare.items) {
              const recipe = getRecipeForProduct(line.name);
              const qty = line.quantity || 1;
              for (const rec of recipe) {
                // Chức năng: Hàm normalize(s). Cách hoạt động: Thực thi logic xử lý nghiệp vụ của module và trả về kết quả cho nơi gọi.
                const normalize = (s: string) => s.toLowerCase().trim();
                const recName = normalize(rec.ingredient);
                const targetIng = nextList.find((i) => {
                  const iName = normalize(i.name);
                  return iName === recName || iName.includes(recName) || recName.includes(iName);
                });
                if (targetIng) {
                  targetIng.stock = Math.max(0, targetIng.stock - rec.quantity * qty);
                }
              }
              if (Array.isArray(line.options)) {
                for (const opt of line.options) {
                  const optName = opt.replace(/^\+\s*/, "").toLowerCase().trim();
                  const targetTop = nextList.find((i) => {
                    const iName = i.name.toLowerCase().trim();
                    return iName === optName || iName.includes(optName) || optName.includes(iName);
                  });
                  if (targetTop) {
                    targetTop.stock = Math.max(0, targetTop.stock - 30 * qty);
                  }
                }
              }
            }
            return nextList;
          });
        }
      }

      await updateOrderStatus(id, nextStatus);
      setOrders((current) => current.map((order) => order.id === id ? { ...order, stage, rawStatus: nextStatus } : order));
      setNotice(
        nextStatus === "PAID"
          ? `Đơn #${id} đã xác nhận nhận tiền thành công (PAID). Màn hình khách đang được chuyển sang Chờ lấy nước.`
          : nextStatus === "PREPARING"
          ? `Đơn #${id} đã bắt đầu pha chế (PREPARING). Đã trừ nguyên liệu và tự động cập nhật giảm số ly tồn quầy!`
          : nextStatus === "READY"
          ? `Đơn #${id} đã làm xong và chuyển sang mục Làm xong (READY).`
          : `Đơn #${id} đã ghi nhận giao thành công (COMPLETED).`,
      );
      await loadRealIngredients();
      await loadRealStock();
    } catch (err: unknown) {
      console.error("Lỗi cập nhật trạng thái đơn hàng:", err);
      const errMsg = err instanceof Error ? err.message : "Lỗi máy chủ";
      setNotice(`Không thể cập nhật đơn #${id}: ${errMsg}`);
    }
  }

  // Chức năng: Hàm refresh. Cách hoạt động: Thực thi logic xử lý nghiệp vụ của module và trả về kết quả cho nơi gọi.
  async function refresh() {
    setUpdatedAt(new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }));
    try {
      const res = await getAllBaristaOrders();
      const list = Array.isArray(res) ? res : res?.data;
      if (Array.isArray(list)) {
        setOrders(list.map(mapBackendOrderToBarista));
      }
    } catch (err) {
      console.error(err);
    }
    await loadRealStock();
    await loadRealIngredients();
    setNotice("Đã đồng bộ đơn hàng và tồn kho mới nhất.");
  }

  // Chức năng: Hàm toggleAvailability(sku). Cách hoạt động: Thực thi logic xử lý nghiệp vụ của module và trả về kết quả cho nơi gọi.
  function toggleAvailability(sku: string) {
    const item = stock.find((entry) => entry.sku === sku);
    if (!item) return;
    const currentlyAvailable = availability[item.name] ?? availability[item.sku] ?? item.stock > 0;
    const nextAvailable = !currentlyAvailable;
    
    setProductAvailability([item.sku, item.name, item.name.toLowerCase().trim()], nextAvailable);
    
    setNotice(
      `${item.name} đã chuyển sang ${
        nextAvailable
          ? "Đang bán (đã hiển thị trên thực đơn của khách)"
          : "Tạm hết (đã ẩn hoàn toàn khỏi thực đơn của khách)"
      }; thực đơn được đồng bộ ngay lập tức.`
    );
  }

  // Chức năng: Hàm receiveIngredient(event). Cách hoạt động: Thực thi logic xử lý nghiệp vụ của module và trả về kết quả cho nơi gọi.
  async function receiveIngredient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = Number(receivingAmount);
    if (!receivingSku || !Number.isFinite(amount) || amount <= 0) return;
    const item = ingredientStock.find((entry) => entry.sku === receivingSku);
    if (!item) return;

    setReceivingSku(null);

    let targetId = item.id;
    if (!targetId && item.sku) {
      const parsed = parseInt(item.sku.replace("NL-", ""), 10);
      if (!isNaN(parsed) && parsed > 50) targetId = parsed;
    }

    if (targetId) {
      try {
        await addIngredientStock(targetId, amount, "Nhập thêm nguyên liệu tại quầy Barista");
        await loadRealIngredients();
        setNotice(`✓ Đã cập nhật CSDL thành công: Nhập thêm ${amount} ${item.unit} cho ${item.name}.`);
      } catch (err: any) {
        console.error("Lỗi lưu database:", err);
        setNotice(`Lỗi khi lưu CSDL: ${err.message || "Không thể kết nối"}`);
      }
    } else {
      setIngredientStock((current) => current.map((entry) => entry.sku === receivingSku
        ? { ...entry, stock: Number((entry.stock + amount).toFixed(2)) }
        : entry));
      setNotice(`Đã nhập thêm ${amount} ${item.unit} ${item.name}.`);
    }
  }

  async function handleCreateIngredient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!newIngName.trim()) return;
    setSubmittingCreateIng(true);
    try {
      await createIngredient({
        name: newIngName.trim(),
        unit: newIngUnit,
        stock: Math.max(0, Math.round(Number(newIngStock) || 0)),
        lowThreshold: Math.max(0, Math.round(Number(newIngThreshold) || 0)),
      });
      await loadRealIngredients();
      setNotice(`✓ Đã thêm nguyên liệu mới: ${newIngName.trim()}.`);
      setCreateIngOpen(false);
      setNewIngName("");
      setNewIngStock("0");
      setNewIngThreshold("500");
    } catch (err: any) {
      setNotice(`Lỗi thêm nguyên liệu: ${err?.message || "Không thể lưu"}`);
    } finally {
      setSubmittingCreateIng(false);
    }
  }

  async function handleUpdateIngredient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editIngTarget?.id) return;
    setSubmittingEditIng(true);
    try {
      await updateIngredient(editIngTarget.id, {
        name: editIngName.trim() || undefined,
        lowThreshold: Math.max(0, Math.round(Number(editIngThreshold) || 0)),
      });
      await loadRealIngredients();
      setNotice(`✓ Đã cập nhật thông tin nguyên liệu #${editIngTarget.id}.`);
      setEditIngTarget(null);
    } catch (err: any) {
      setNotice(`Lỗi cập nhật nguyên liệu: ${err?.message || "Không thể lưu"}`);
    } finally {
      setSubmittingEditIng(false);
    }
  }

  async function handleAdjustStock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!adjustTarget?.id) return;
    if (adjustReason.trim().length < 3) {
      setNotice("Vui lòng nhập lý do kiểm kê/hao hụt từ 3 ký tự trở lên.");
      return;
    }
    setSubmittingAdjust(true);
    try {
      await adjustIngredientStock(
        adjustTarget.id,
        Math.max(0, Math.round(Number(adjustActualStock) || 0)),
        adjustReason.trim(),
      );
      await loadRealIngredients();
      setNotice(`✓ Đã kiểm kê tồn thực tế cho ${adjustTarget.name}.`);
      setAdjustTarget(null);
      setAdjustReason("");
    } catch (err: any) {
      setNotice(`Lỗi kiểm kê kho: ${err?.message || "Không thể lưu"}`);
    } finally {
      setSubmittingAdjust(false);
    }
  }

  async function openMovementsModal(item: IngredientItem) {
    if (!item.id) return;
    setMovementsTarget(item);
    setMovementsList([]);
    setLoadingMovements(true);
    try {
      const res = await getIngredientMovements(item.id, 1, 30);
      setMovementsList(Array.isArray(res?.data) ? res.data : []);
    } catch (err: any) {
      setNotice(`Không tải được lịch sử thẻ kho: ${err?.message || "Lỗi kết nối"}`);
    } finally {
      setLoadingMovements(false);
    }
  }

  function startEditProductRecipe() {
    const base = dynamicRecipe || (selectedRecipeProduct ? getRecipeForProduct(selectedRecipeProduct.name) : []);
    const draft = base
      .map((rec) => {
        const matched =
          (rec.ingredientId ? ingredientStock.find((i) => i.id === rec.ingredientId) : undefined) ||
          ingredientStock.find((i) => i.name.toLowerCase().trim() === rec.ingredient.toLowerCase().trim());
        if (!matched?.id) return null;
        return {
          ingredientId: matched.id,
          name: matched.name,
          unit: matched.unit,
          quantity: Math.max(1, Math.round(rec.quantity)),
        };
      })
      .filter(Boolean) as { ingredientId: number; name: string; unit: string; quantity: number }[];
    setProductRecipeDraft(draft);
    const firstAvail = ingredientStock.find((i) => i.id && !draft.some((d) => d.ingredientId === i.id));
    setNewRecipeIngId(firstAvail?.id ?? 0);
    setEditingProductRecipe(true);
  }

  async function saveProductRecipe() {
    if (!selectedRecipeProduct?.id) return;
    setSavingProductRecipe(true);
    try {
      const res = await updateProductRecipe(
        selectedRecipeProduct.id,
        productRecipeDraft.map((d) => ({ ingredientId: d.ingredientId, quantity: Math.max(1, Math.round(d.quantity)) })),
      );
      setDynamicRecipe(
        res.items.map((item) => ({
          ingredientId: item.ingredientId,
          ingredient: item.name,
          quantity: item.quantity,
          unit: item.unit ? item.unit.toLowerCase() : "ml",
        })),
      );
      setEditingProductRecipe(false);
      setNotice(`✓ Đã lưu công thức mới cho món ${selectedRecipeProduct.name}.`);
    } catch (err: any) {
      setNotice(`Lỗi lưu công thức món: ${err?.message || "Không thể lưu"}`);
    } finally {
      setSavingProductRecipe(false);
    }
  }

  async function openToppingRecipeModal(topping: BackendTopping) {
    setSelectedTopping(topping);
    setToppingRecipeDraft([]);
    setLoadingToppingRecipe(true);
    try {
      const res = await getToppingRecipe(topping.id);
      const draft = (res.items || []).map((i) => ({
        ingredientId: i.ingredientId,
        name: i.name,
        unit: i.unit ? i.unit.toLowerCase() : "g",
        quantity: i.quantity,
      }));
      setToppingRecipeDraft(draft);
      const firstAvail = ingredientStock.find((i) => i.id && !draft.some((d) => d.ingredientId === i.id));
      setNewToppingIngId(firstAvail?.id ?? 0);
    } catch (err: any) {
      setNotice(`Không tải được công thức topping: ${err?.message || "Lỗi kết nối"}`);
    } finally {
      setLoadingToppingRecipe(false);
    }
  }

  async function saveToppingRecipe() {
    if (!selectedTopping) return;
    setSavingToppingRecipe(true);
    try {
      await updateToppingRecipe(
        selectedTopping.id,
        toppingRecipeDraft.map((d) => ({ ingredientId: d.ingredientId, quantity: Math.max(1, Math.round(d.quantity)) })),
      );
      setNotice(`✓ Đã lưu công thức cho topping ${selectedTopping.name}.`);
      setSelectedTopping(null);
    } catch (err: any) {
      setNotice(`Lỗi lưu công thức topping: ${err?.message || "Không thể lưu"}`);
    } finally {
      setSavingToppingRecipe(false);
    }
  }

  // Chức năng: Lấy dữ liệu RecipeForProduct. Cách hoạt động: Truy vấn dữ liệu và trả về kết quả đã định dạng.
  function getRecipeForProduct(productName: string): RecipeIngredient[] {
    if (PRODUCT_RECIPES[productName]) {
      return PRODUCT_RECIPES[productName];
    }
    const foundKey = Object.keys(PRODUCT_RECIPES).find((k) => productName.includes(k) || k.includes(productName));
    if (foundKey) return PRODUCT_RECIPES[foundKey];
    return [
      { ingredient: "Cốt trà đen đã pha", quantity: 150, unit: "ml" },
      { ingredient: "Sữa tươi thanh trùng", quantity: 100, unit: "ml" },
      { ingredient: "Sữa đặc", quantity: 20, unit: "ml" },
    ];
  }

  // Chức năng: Xử lý tính toán / định dạng dữ liệu (calculateProductMaxCups). Cách hoạt động: Biến đổi tham số đầu vào (productName, currentIngredients) thành kết quả chuẩn để hiển thị hoặc tính toán.
  function calculateProductMaxCups(productName: string, currentIngredients: IngredientItem[]): number {
    const recipe = getRecipeForProduct(productName);
    if (!recipe || recipe.length === 0) return 0;
    // Chức năng: Hàm normalize(s). Cách hoạt động: Thực thi logic xử lý nghiệp vụ của module và trả về kết quả cho nơi gọi.
    const normalize = (s: string) => s.toLowerCase().trim();
    let minCups = 999999;
    for (const rec of recipe) {
      const recName = normalize(rec.ingredient);
      const ing = currentIngredients.find((i) => {
        const iName = normalize(i.name);
        return iName === recName || iName.includes(recName) || recName.includes(iName);
      });
      if (!ing || ing.stock <= 0) {
        return 0;
      }
      const cups = Math.floor(ing.stock / rec.quantity);
      if (cups < minCups) {
        minCups = cups;
      }
    }
    return minCups === 999999 ? 0 : Math.max(0, minCups);
  }

  const visibleOrders = orders
    .filter((order) => order.stage === (queueTab === "history" ? "completed" : queueTab))
    .sort((a, b) => b.id - a.id);

  // Chức năng: Hàm scrollTo(id). Cách hoạt động: Thực thi logic xử lý nghiệp vụ của module và trả về kết quả cho nơi gọi.
  const scrollTo = (id: string) => {
    if (typeof document !== "undefined") {
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: "smooth" });
      }
    }
  };

  const isManager = user?.role === "BARISTA" || user?.role === "MANAGER";

  if (authChecked && user && user.role !== "BARISTA" && user.role !== "MANAGER") {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center p-6 text-center">
        <div className="size-16 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-3xl mb-4 shadow-sm">
          🚫
        </div>
        <h1 className="text-xl font-bold text-[#1e3429]">Không có quyền truy cập</h1>
        <p className="mt-2 text-sm text-[#556358] max-w-xs leading-relaxed">
          Khu vực quầy pha chế & quản lý kho chỉ dành riêng cho tài khoản <b>Barista</b> hoặc <b>Manager</b>. Tài khoản hiện tại của bạn là <b>{user.fullName}</b> ({user.role}).
        </p>
        <Link
          href="/"
          className="mt-6 rounded-xl bg-[#174c32] px-5 py-2.5 text-sm font-bold text-white shadow-xs hover:bg-[#124029] transition active:scale-95"
        >
          Về trang chủ thực đơn
        </Link>
      </div>
    );
  }

  if (authChecked && !user) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center p-6 text-center">
        <div className="size-16 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center text-3xl mb-4 shadow-sm">
          🔒
        </div>
        <h1 className="text-xl font-bold text-[#1e3429]">Yêu cầu đăng nhập</h1>
        <p className="mt-2 text-sm text-[#556358] max-w-xs leading-relaxed">
          Vui lòng đăng nhập bằng tài khoản <b>Barista</b> để quản lý hàng đợi và quầy pha chế.
        </p>
        <Link
          href="/login?redirect=/barista"
          className="mt-6 rounded-xl bg-[#174c32] px-5 py-2.5 text-sm font-bold text-white shadow-xs hover:bg-[#124029] transition active:scale-95"
        >
          Đăng nhập Barista
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-[#f7f5ef] text-[#1e3429] pb-8">
      {/* Mobile Barista Subheader */}
      <div className="sticky top-14 md:top-16 z-20 border-b border-[#e2e5dc] bg-[#fbfaf6]/95 backdrop-blur-md px-3 py-2 shadow-2xs">
        <nav aria-label="Khu vực quầy" className="grid grid-cols-3 gap-1 rounded-xl bg-[#edece5] p-1 text-xs font-bold text-center">
          <button
            type="button"
            onClick={() => scrollTo("barista-queue")}
            className="rounded-lg py-2 transition cursor-pointer bg-white text-[#174c32] shadow-xs hover:brightness-95"
          >
            📋 Hàng đợi ({orders.length})
          </button>
          <button
            type="button"
            onClick={() => {
              setInventoryTab("stock");
              scrollTo("barista-inventory");
            }}
            className="rounded-lg py-2 transition cursor-pointer text-[#657067] hover:text-[#174c32] hover:bg-white/50"
          >
            ☕ Tồn món ({stock.length})
          </button>
          <button
            type="button"
            onClick={() => {
              setInventoryTab("ingredients");
              scrollTo("barista-inventory");
            }}
            className="rounded-lg py-2 transition cursor-pointer text-[#657067] hover:text-[#174c32] hover:bg-white/50"
          >
            🥛 NVL ({ingredientStock.length})
          </button>
        </nav>
      </div>

      <main className="px-4 py-4 space-y-6">
        {/* SECTION 1: HÀNG ĐỢI PHA CHẾ */}
        <section id="barista-queue" className="space-y-4 scroll-mt-14">
          {/* Title and Refresh Row */}
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#55715e]">Quầy pha chế mang đi</p>
              <h1 className="text-xl font-extrabold text-[#17432e]">Hàng đợi pha chế</h1>
            </div>
            <button
              type="button"
              onClick={refresh}
              className="flex items-center gap-1 rounded-xl border border-[#d9ddd5] bg-white px-3 py-1.5 text-xs font-bold text-[#1e3429] shadow-2xs hover:bg-[#f5f5ef] active:scale-95 transition cursor-pointer shrink-0"
            >
              ↻ <span>Làm mới</span>
            </button>
          </div>

          {/* Live Status Bar */}
          <div className="flex items-center justify-between rounded-xl bg-white border border-[#e6e8e0] px-3.5 py-2 text-xs text-[#556358] shadow-2xs">
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-[#168451] animate-pulse" />
              <span className="font-semibold text-[#1e3429]">{orders.length} đơn</span>
              <span className="text-[11px] text-[#788078]">· Mang đi</span>
            </div>
            <span className="text-[11px] text-[#788078]">Cập nhật {updatedAt}</span>
          </div>

          {notice && (
            <p role="status" className="rounded-lg border border-[#d4e7d8] bg-[#eef7ef] px-4 py-2.5 text-xs text-[#225c3a] flex items-center justify-between">
              <span>{notice}</span>
              <button type="button" onClick={() => setNotice("")} className="font-bold text-sm cursor-pointer ml-2" aria-label="Đóng thông báo">×</button>
            </p>
          )}

          {/* Status Filter Tabs (Flex Wrap để điện thoại hiển thị đủ tất cả tab) */}
          <div className="flex flex-wrap gap-1.5 pb-1 -mx-1 px-1" role="tablist" aria-label="Trạng thái đơn hàng">
            {(["pending", "cancelled", "preparing", "ready", "history"] as QueueTab[]).map((tab) => {
              const label =
                tab === "pending"
                  ? "Chờ TT"
                  : tab === "cancelled"
                  ? "Đã hủy"
                  : tab === "preparing"
                  ? "Đang làm"
                  : tab === "ready"
                  ? "Làm xong"
                  : "Lịch sử";
              const isActive = queueTab === tab;
              const isAlert = tab === "cancelled" && needingRefundCount > 0;
              return (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setQueueTab(tab)}
                  className={`whitespace-nowrap flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition cursor-pointer ${
                    isActive
                      ? isAlert
                        ? "bg-red-600 text-white shadow-xs"
                        : "bg-[#174c32] text-white shadow-xs"
                      : isAlert
                      ? "bg-red-50 border-2 border-red-400 text-red-700 hover:bg-red-100"
                      : "bg-white border border-[#e3e5dc] text-[#556358] hover:bg-[#f4f5ef]"
                  }`}
                >
                  <span>{label}</span>
                  <span
                    className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                      isActive
                        ? "bg-white/25 text-white"
                        : isAlert
                        ? "bg-red-200 text-red-800"
                        : "bg-[#edece5] text-[#445248]"
                    }`}
                  >
                    {tab === "cancelled"
                      ? (needingRefundCount > 0 ? `${needingRefundCount}` : `${counts.cancelled} xong`)
                      : counts[tab]}
                  </span>
                </button>
              );
            })}
          </div>

          {queueTab === "pending" && <div className="rounded-xl bg-amber-50 border border-amber-200 px-3.5 py-2.5 text-xs text-amber-900 leading-relaxed">Đơn đang chờ khách quét QR hoặc thanh toán. Kiểm tra số dư và bấm &ldquo;Xác nhận đã nhận tiền (PAID)&rdquo;.</div>}
          {queueTab === "cancelled" && <div className="rounded-xl bg-red-50 border border-red-200 px-3.5 py-2.5 text-xs text-red-800">Đơn đã hủy · Không cần pha chế. Tự động đồng bộ mỗi 5 giây.</div>}
          {queueTab === "history" && <div className="rounded-xl bg-[#eeefe9] border border-[#e2e1d7] px-3.5 py-2.5 text-xs text-[#465b4c]">Lịch sử đơn đã giao hoàn tất trong ca làm việc.</div>}

          {visibleOrders.length ? (
            <div className="flex flex-col gap-4 w-full">
              {visibleOrders.map((order) => (
                <article key={order.id} className="overflow-hidden rounded-2xl border border-[#e9e7df] bg-white shadow-[0_2px_8px_rgba(31,47,35,0.04)]">
                  <div className="flex items-start justify-between gap-3 bg-[#f1f0e9] px-4 py-3.5">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-xl font-bold text-[#163f2b]">#{order.id}</h2>
                        <span className="rounded-md bg-[#e1e5dc] px-2 py-0.5 text-[11px] font-semibold text-[#445248]">Mang đi</span>
                      </div>
                      <p className="mt-1 text-sm font-semibold text-[#2c3d32]">{order.customer}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className={`inline-block rounded-md px-2 py-0.5 text-xs font-bold ${
                        order.stage === "cancelled"
                          ? "bg-red-100 text-red-800"
                          : order.rawStatus === "PENDING"
                          ? "bg-amber-100 text-amber-900 border border-amber-300"
                          : order.stage === "preparing" && order.rawStatus === "PAID"
                          ? "bg-[#e2e8f0] text-[#334155]"
                          : order.stage === "preparing"
                          ? "bg-[#e0f2fe] text-[#0369a1]"
                          : order.stage === "ready"
                          ? "bg-[#f3e8ff] text-[#6b21a8]"
                          : "bg-[#d7f5df] text-[#16623a]"
                      }`}>
                        {order.stage === "cancelled"
                          ? "Đã hủy"
                          : order.rawStatus === "PENDING"
                          ? "Chờ thanh toán"
                          : order.rawStatus === "PAID"
                          ? "Chờ làm"
                          : order.rawStatus === "PREPARING"
                          ? "Đang pha"
                          : order.stage === "ready"
                          ? "Chờ lấy"
                          : "Đã giao"}
                      </span>
                      <p className="mt-1.5 text-[11px] text-[#737970]">Đặt lúc {order.placedAt}</p>
                    </div>
                  </div>
                  <div className="space-y-3 p-4">
                    {order.items.map((item, index) => (
                      <div key={`${order.id}-${index}`} className="rounded-xl bg-[#f8f7f3] p-3">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-semibold text-sm">
                            <span className="mr-2 inline-flex size-6 items-center justify-center rounded-md bg-[#b5edc1] text-xs font-bold text-[#154a2c]">{item.quantity}×</span>
                            {item.name}
                          </p>
                          <span className="shrink-0 text-xs font-semibold text-[#35513e]">Size {item.size}</span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {item.options.map((option) => (
                            <span key={option} className="rounded-md bg-[#eeede7] px-2 py-0.5 text-[11px] text-[#555c56]">{option}</span>
                          ))}
                        </div>
                      </div>
                    ))}
                    {order.note && <div className="rounded-xl bg-[#edede8] px-3 py-2 text-xs text-[#4b554e]"><span className="font-semibold text-[#315840]">Ghi chú:</span> {order.note}</div>}
                    {order.stage === "cancelled" ? (
                      <div className="space-y-2 border-t border-red-100 pt-2.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-red-700">Đơn đã hủy · Không cần pha chế</span>
                          {order.hasRefundObligation && (
                            <span className="font-bold text-stone-700">Cần trả lại: {money(order.total)}</span>
                          )}
                        </div>
                        {refundedOrders.includes(order.id) || order.isRefunded || order.refundStatus === "COMPLETED" ? (
                          <div className="flex items-center gap-2">
                            <div className="flex-1 rounded-xl bg-emerald-50 border border-emerald-300 p-2 text-center text-xs font-bold text-emerald-800 flex items-center justify-center gap-1.5">
                              <span>✅</span> Đã hoàn tiền cho khách thành công
                            </div>
                            <button
                              type="button"
                              onClick={() => openRefundModal(order)}
                              className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100 transition cursor-pointer shrink-0"
                            >
                              Xem lại QR
                            </button>
                          </div>
                        ) : order.refundStatus === "FAILED" ? (
                          <div className="space-y-1.5">
                            <div className="rounded-xl bg-red-50 border border-red-300 p-2 text-xs text-red-800">
                              <span className="font-bold">⚠️ Chuyển tiền thất bại:</span> {order.refundExtra || "Tài khoản thụ hưởng không hợp lệ"}
                            </div>
                            <button
                              type="button"
                              onClick={() => openRefundModal(order)}
                              className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-red-700 transition cursor-pointer"
                            >
                              🔄 Xem QR & Thử lại hoàn tiền
                            </button>
                          </div>
                        ) : order.refundStatus === "UNKNOWN" ? (
                          <div className="space-y-1.5">
                            <div className="rounded-xl bg-amber-50 border border-amber-300 p-2 text-xs text-amber-800">
                              <span className="font-bold">🔍 Đang đối soát ngân hàng:</span> {order.refundExtra || "Chờ Napas xử lý"}
                            </div>
                            <button
                              type="button"
                              onClick={() => openRefundModal(order)}
                              className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-amber-700 transition cursor-pointer"
                            >
                              🔍 Xem chi tiết đối soát / Xác nhận
                            </button>
                          </div>
                        ) : order.hasRefundObligation ? (
                          <button
                            type="button"
                            onClick={() => openRefundModal(order)}
                            className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-red-600 to-amber-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:from-red-700 hover:to-amber-700 transition cursor-pointer"
                          >
                            💸 Trả lại tiền cho khách (Hiện mã QR)
                          </button>
                        ) : (
                          <div className="rounded-xl bg-stone-100 p-2 text-center text-xs font-medium text-stone-600">
                            Đơn chưa thanh toán trước khi hủy · Không cần hoàn tiền
                          </div>
                        )}
                      </div>
                    ) : order.stage !== "completed" ? (
                      <div className="flex flex-col gap-2 pt-1">
                        <div className="flex gap-2">
                          {order.rawStatus === "PENDING" && (
                            <button
                              type="button"
                              onClick={() => moveOrder(order.id, "PAID")}
                              className="flex-1 rounded-xl bg-[#168451] px-4 py-3 text-xs font-bold text-white shadow-sm transition hover:bg-[#126b42] cursor-pointer"
                            >
                              ✓ Xác nhận đã nhận tiền (PAID)
                            </button>
                          )}
                          {order.rawStatus === "PAID" && (
                            <button
                              type="button"
                              onClick={() => moveOrder(order.id, "PREPARING")}
                              className="flex-1 rounded-xl bg-[#145332] px-4 py-3 text-xs font-bold text-white shadow-sm transition hover:bg-[#0f4328] cursor-pointer"
                            >
                              ▶ Bắt đầu pha
                            </button>
                          )}
                          {order.rawStatus === "PREPARING" && (
                            <button
                              type="button"
                              onClick={() => moveOrder(order.id, "READY")}
                              className="flex-1 rounded-xl bg-[#145332] px-4 py-3 text-xs font-bold text-white shadow-sm transition hover:bg-[#0f4328] cursor-pointer"
                            >
                              ✓ Đã làm xong
                            </button>
                          )}
                          {order.stage === "ready" && (
                            <button
                              type="button"
                              onClick={() => moveOrder(order.id, "COMPLETED")}
                              className="flex-1 rounded-xl bg-[#145332] px-4 py-3 text-xs font-bold text-white shadow-sm transition hover:bg-[#0f4328] cursor-pointer"
                            >
                              ✓ Đã giao thành công
                            </button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="border-t border-[#eeede7] pt-2.5 text-xs text-[#56705d]">✓ Đã giao thành công · {order.elapsed}</div>
                    )}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-[#d9ddd5] bg-white px-6 py-12 text-center text-sm text-[#737970] space-y-2">
              <p>Chưa có đơn trong mục <b>{queueTab === "preparing" ? "Đang làm" : queueTab === "ready" ? "Làm xong" : queueTab === "cancelled" ? "Đã hủy" : "Lịch sử"}</b>.</p>
            </div>
          )}
        </section>

        {/* SECTION 2: QUẢN LÝ TỒN KHO & NGUYÊN LIỆU (NẰM TRỰC TIẾP DƯỚI HÀNG ĐỢI) */}
        <section id="barista-inventory" className="space-y-4 scroll-mt-14 pt-4 border-t-2 border-[#e6e5dd]">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#55715e]">Quản lý tồn kho tại quầy</p>
              <h2 className="text-xl font-extrabold text-[#17432e]">
                {inventoryTab === "stock"
                  ? "Tồn kho theo món"
                  : inventoryTab === "ingredients"
                  ? "Tồn kho nguyên liệu"
                  : "Công thức Topping"}
              </h2>
            </div>
            <span className="rounded-full bg-[#eef0e9] px-2.5 py-1 text-xs font-bold text-[#35513e]">
              {inventoryTab === "stock"
                ? `${stock.length} món`
                : inventoryTab === "ingredients"
                ? `${ingredientStock.length} loại`
                : `${toppings.length} loại`}
            </span>
          </div>

          {/* Sub Switcher: Món vs Nguyên liệu vs Topping */}
          <div className="grid grid-cols-3 gap-1 rounded-xl bg-[#edece5] p-1 text-xs font-bold text-center">
            <button
              type="button"
              onClick={() => setInventoryTab("stock")}
              className={`rounded-lg py-2 transition cursor-pointer ${
                inventoryTab === "stock" ? "bg-white text-[#174c32] shadow-xs" : "text-[#657067] hover:text-[#174c32]"
              }`}
            >
              ☕ Món ({stock.length})
            </button>
            <button
              type="button"
              onClick={() => setInventoryTab("ingredients")}
              className={`rounded-lg py-2 transition cursor-pointer ${
                inventoryTab === "ingredients" ? "bg-white text-[#174c32] shadow-xs" : "text-[#657067] hover:text-[#174c32]"
              }`}
            >
              🥛 Nguyên liệu ({ingredientStock.length})
            </button>
            <button
              type="button"
              onClick={() => setInventoryTab("toppings")}
              className={`rounded-lg py-2 transition cursor-pointer ${
                inventoryTab === "toppings" ? "bg-white text-[#174c32] shadow-xs" : "text-[#657067] hover:text-[#174c32]"
              }`}
            >
              🧋 Topping ({toppings.length})
            </button>
          </div>

          {inventoryTab === "stock" ? (
            <div className="space-y-3">
              <p className="text-xs text-[#737970] px-1">
                Bấm <b>Tạm hết</b> để ẩn món ngay lập tức khỏi menu khách. Bấm <b>Công thức</b> để xem định lượng và tồn NVL.
              </p>
              <div className="flex flex-col gap-3 w-full">
                {stock.map((item) => {
                  const currentCups = calculateProductMaxCups(item.name, ingredientStock);
                  const targetCups = Math.max(item.target || 20, currentCups);
                  const percentage = targetCups > 0 ? Math.round((currentCups / targetCups) * 100) : 0;
                  const isAvailable = (availability[item.name] ?? availability[item.sku] ?? true) && currentCups > 0;
                  return (
                    <div key={item.sku} className="rounded-2xl border border-[#e6e5dd] bg-white p-4 shadow-2xs space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="rounded-md bg-[#eef0e9] px-2 py-0.5 font-mono text-[11px] font-bold text-[#556358]">{item.sku}</span>
                            <span className="rounded-md bg-[#f0f4ea] px-2 py-0.5 text-[11px] font-medium text-[#3b5e43]">{item.category}</span>
                          </div>
                          <h3 className="mt-1 font-bold text-base text-[#17432e] leading-snug">{item.name}</h3>
                          <p className="mt-0.5 text-xs text-[#737970] line-clamp-1">{item.description}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="font-bold text-sm text-[#183d2c]">{money(item.price)}</span>
                        </div>
                      </div>

                      {/* Stock Progress Bar */}
                      <div className="rounded-xl bg-[#f7f6f1] p-2.5">
                        <div className="flex items-center justify-between text-xs mb-1.5">
                          <span className="text-[#647066] font-medium">Tồn tại quầy:</span>
                          <span className="font-bold text-[#1e3429]">
                            {currentCups} / {targetCups} ly <span className="font-normal text-[#737970]">({percentage}%)</span>
                          </span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-[#e3e2dc]">
                          <div
                            className={`h-full rounded-full transition-all ${
                              currentCups === 0 ? "bg-[#bd3d34]" : currentCups <= 5 ? "bg-[#bc8a2f]" : "bg-[#168451]"
                            }`}
                            style={{ width: `${Math.min(percentage, 100)}%` }}
                          />
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center justify-between gap-2 pt-1 border-t border-[#f0eee6]">
                        <button
                          type="button"
                          onClick={() => setSelectedRecipeProduct(item)}
                          className="flex items-center gap-1 rounded-xl border border-[#d9ddd5] bg-white px-3 py-2 text-xs font-semibold text-[#185332] hover:bg-[#f5f8f5] active:scale-95 transition cursor-pointer"
                        >
                          <span>🔍</span>
                          <span>Công thức</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleAvailability(item.sku)}
                          aria-label={`Chuyển ${item.name} sang ${isAvailable ? "Tạm hết" : "Đang bán"}`}
                          className={`rounded-xl px-3.5 py-2 text-xs font-bold transition active:scale-95 cursor-pointer ${
                            currentCups === 0
                              ? "bg-[#fde4e1] text-[#a5332a] hover:bg-[#fbd3cf]"
                              : isAvailable
                              ? "bg-[#daf4e0] text-[#1e7141] hover:bg-[#cbf0d3]"
                              : "bg-[#fde4e1] text-[#a5332a] hover:bg-[#fbd3cf]"
                          }`}
                        >
                          {currentCups === 0 ? "● Hết hàng" : isAvailable ? "● Đang bán" : "● Tạm hết (Ẩn menu)"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : inventoryTab === "ingredients" ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2 px-1">
                <p className="text-xs text-[#737970]">
                  Nhập kho, kiểm kê hao hụt, sửa ngưỡng cảnh báo hoặc xem thẻ kho.
                </p>
                {isManager && (
                  <button
                    type="button"
                    onClick={() => setCreateIngOpen(true)}
                    className="shrink-0 rounded-xl bg-[#174c32] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#124029] active:scale-95 transition cursor-pointer shadow-xs"
                  >
                    + Thêm NL mới
                  </button>
                )}
              </div>
              <div className="flex flex-col gap-3 w-full">
                {ingredientStock.map((item) => {
                  const status = item.stock === 0 ? "Tạm hết" : item.stock <= item.minimum ? "Sắp hết" : "Còn hàng";
                  const percent = Math.min(Math.round((item.stock / Math.max(item.minimum * 2, 1)) * 100), 100);
                  return (
                    <div key={item.sku} className="rounded-2xl border border-[#e6e5dd] bg-white p-4 shadow-2xs space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="rounded-md bg-[#eef0e9] px-2 py-0.5 font-mono text-[11px] font-bold text-[#556358]">{item.sku}</span>
                            <span
                              className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${
                                status === "Tạm hết"
                                  ? "bg-[#fde4e1] text-[#a5332a]"
                                  : status === "Sắp hết"
                                  ? "bg-[#fff1d5] text-[#805817]"
                                  : "bg-[#daf4e0] text-[#1e7141]"
                              }`}
                            >
                              {status}
                            </span>
                          </div>
                          <h3 className="mt-1 font-bold text-base text-[#17432e] leading-snug">{item.name}</h3>
                          <p className="mt-0.5 text-xs text-[#737970]">{item.detail}</p>
                        </div>
                      </div>

                      {/* Ingredient Stock Bar */}
                      <div className="rounded-xl bg-[#f7f6f1] p-2.5">
                        <div className="flex items-center justify-between text-xs mb-1.5">
                          <span className="text-[#647066] font-medium">Tồn kho hiện tại:</span>
                          <span className="font-bold text-[#1e3429]">
                            {new Intl.NumberFormat("vi-VN").format(item.stock)} {item.unit}
                            <span className="font-normal text-[#737970]"> (Tối thiểu {item.minimum} {item.unit})</span>
                          </span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-[#e3e2dc]">
                          <div
                            className={`h-full rounded-full transition-all ${
                              status === "Tạm hết" ? "bg-[#bd3d34]" : status === "Sắp hết" ? "bg-[#bc8a2f]" : "bg-[#168451]"
                            }`}
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex flex-wrap items-center justify-end gap-1.5 pt-1 border-t border-[#f0eee6]">
                        {item.id && (
                          <>
                            <button
                              type="button"
                              onClick={() => openMovementsModal(item)}
                              className="rounded-xl border border-[#dcdad0] bg-white px-2.5 py-1.5 text-[11px] font-bold text-[#445247] hover:bg-[#f7f6f1] transition cursor-pointer"
                            >
                              Thẻ kho
                            </button>
                            {isManager && (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditIngTarget(item);
                                  setEditIngName(item.name);
                                  setEditIngThreshold(String(item.minimum));
                                }}
                                className="rounded-xl border border-[#dcdad0] bg-white px-2.5 py-1.5 text-[11px] font-bold text-[#445247] hover:bg-[#f7f6f1] transition cursor-pointer"
                              >
                                Sửa
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setAdjustTarget(item);
                                setAdjustActualStock(String(item.stock));
                                setAdjustReason("");
                              }}
                              className="rounded-xl border border-[#ead4a6] bg-[#fff8e7] px-2.5 py-1.5 text-[11px] font-bold text-[#805817] hover:bg-[#ffefc8] transition cursor-pointer"
                            >
                              Kiểm kê
                            </button>
                          </>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setReceivingSku(item.sku);
                            setReceivingAmount("1000");
                          }}
                          className="flex items-center gap-1 rounded-xl bg-[#174c32] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#124029] active:scale-95 transition cursor-pointer shadow-xs"
                        >
                          <span>+ Nhập hàng</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-[#737970] px-1">
                Xem và chỉnh sửa định lượng nguyên liệu trừ kho cho từng phần topping.
              </p>
              {toppings.length === 0 ? (
                <div className="rounded-2xl border border-[#e6e5dd] bg-white p-6 text-center text-xs text-[#737970]">
                  Chưa có dữ liệu topping từ máy chủ.
                </div>
              ) : (
                <div className="flex flex-col gap-2.5 w-full">
                  {toppings.map((tp) => (
                    <div key={tp.id} className="flex items-center justify-between gap-3 rounded-2xl border border-[#e6e5dd] bg-white p-3.5 shadow-2xs">
                      <div>
                        <p className="text-sm font-bold text-[#17432e]">{tp.name}</p>
                        <p className="text-xs text-[#647066]">
                          Giá bán: {new Intl.NumberFormat("vi-VN").format(tp.price)}đ · Mã #{tp.id}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => openToppingRecipeModal(tp)}
                        className="rounded-xl border border-[#cfe0d4] bg-[#f4f8f5] px-3 py-1.5 text-xs font-bold text-[#174c32] hover:bg-[#e4efe7] transition cursor-pointer"
                      >
                        {isManager ? "Xem / Sửa công thức" : "Xem công thức"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      </main>

      {/* MODAL XEM CÔNG THỨC & TỒN KHO NGUYÊN LIỆU CHI TIẾT */}
      {selectedRecipeProduct && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#10251b]/50 backdrop-blur-xs p-4"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setSelectedRecipeProduct(null);
          }}
        >
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl max-h-[85vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between border-b border-[#e9e7df] pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-[#eaf4ed] px-2 py-0.5 text-xs font-bold text-[#145332]">{selectedRecipeProduct.sku}</span>
                  <span className="rounded-md bg-[#f0efe9] px-2 py-0.5 text-xs text-[#5c665e]">{selectedRecipeProduct.category}</span>
                </div>
                <h2 className="mt-2 text-2xl font-bold text-[#17432e]">{selectedRecipeProduct.name}</h2>
                <p className="mt-1 text-xs text-[#6e7870]">Định lượng công thức chuẩn (size M) và tồn kho nguyên liệu hiện tại tại quầy.</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRecipeProduct(null)}
                className="rounded-lg p-2 text-stone-400 hover:bg-stone-100 hover:text-stone-700 text-xl font-bold cursor-pointer"
                aria-label="Đóng popup công thức"
              >
                ×
              </button>
            </div>

            <div className="mt-5">
              <div className="flex items-center justify-between mb-2.5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#495e4f]">
                  Công thức pha chế & Tồn nguyên liệu
                  {loadingRecipe && <span className="ml-2 font-normal text-stone-400 lowercase">(đang tải...)</span>}
                </h3>
                {isManager && selectedRecipeProduct.id && !editingProductRecipe && (
                  <button
                    type="button"
                    onClick={startEditProductRecipe}
                    className="rounded-lg border border-[#cfe0d4] bg-[#f4f8f5] px-2.5 py-1 text-[11px] font-bold text-[#174c32] hover:bg-[#e4efe7] cursor-pointer"
                  >
                    Chỉnh sửa công thức
                  </button>
                )}
              </div>
              {editingProductRecipe ? (
                <div className="space-y-3 rounded-xl border border-[#e6e5dd] bg-[#faf9f5] p-3">
                  {productRecipeDraft.map((row, idx) => (
                    <div key={row.ingredientId} className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-semibold text-[#1e3429] flex-1 truncate">{row.name}</span>
                      <input
                        type="number"
                        min={1}
                        value={row.quantity}
                        onChange={(e) => {
                          const val = Math.max(1, Number(e.target.value) || 1);
                          setProductRecipeDraft((prev) => prev.map((r, i) => (i === idx ? { ...r, quantity: val } : r)));
                        }}
                        className="w-20 rounded-lg border border-[#d6d4cb] bg-white px-2 py-1 text-right font-mono font-bold"
                      />
                      <span className="w-8 text-[#556358]">{row.unit}</span>
                      <button
                        type="button"
                        onClick={() => setProductRecipeDraft((prev) => prev.filter((_, i) => i !== idx))}
                        className="rounded-lg px-2 py-1 text-red-600 hover:bg-red-50 font-bold cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  <div className="flex items-center gap-2 pt-2 border-t border-[#e6e5dd]">
                    <select
                      value={newRecipeIngId}
                      onChange={(e) => setNewRecipeIngId(Number(e.target.value))}
                      className="flex-1 rounded-lg border border-[#d6d4cb] bg-white px-2 py-1.5 text-xs"
                    >
                      <option value={0}>-- Chọn nguyên liệu thêm --</option>
                      {ingredientStock
                        .filter((i) => i.id && !productRecipeDraft.some((d) => d.ingredientId === i.id))
                        .map((i) => (
                          <option key={i.id} value={i.id}>
                            {i.name} ({i.unit})
                          </option>
                        ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => {
                        const ing = ingredientStock.find((i) => i.id === newRecipeIngId);
                        if (!ing?.id) return;
                        setProductRecipeDraft((prev) => [...prev, { ingredientId: ing.id!, name: ing.name, unit: ing.unit, quantity: 10 }]);
                        setNewRecipeIngId(0);
                      }}
                      className="rounded-lg bg-[#e6efe9] px-2.5 py-1.5 text-xs font-bold text-[#174c32] hover:bg-[#d5e6db] cursor-pointer"
                    >
                      + Thêm
                    </button>
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setEditingProductRecipe(false)}
                      className="rounded-lg border border-[#d6d4cb] bg-white px-3 py-1.5 text-xs font-bold text-[#556358] cursor-pointer"
                    >
                      Hủy
                    </button>
                    <button
                      type="button"
                      disabled={savingProductRecipe}
                      onClick={saveProductRecipe}
                      className="rounded-lg bg-[#174c32] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#124029] disabled:opacity-50 cursor-pointer"
                    >
                      {savingProductRecipe ? "Đang lưu..." : "Lưu công thức"}
                    </button>
                  </div>
                </div>
              ) : (
              <div className="overflow-hidden rounded-xl border border-[#e6e5dd]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#f7f6f1] text-[#556358] uppercase font-bold text-[10px]">
                    <tr>
                      <th className="px-3.5 py-2.5">Nguyên liệu</th>
                      <th className="px-3 py-2.5 text-right">Cần / ly (M)</th>
                      <th className="px-3 py-2.5 text-right">Tồn kho quầy</th>
                      <th className="px-3 py-2.5 text-center">Khả năng pha</th>
                      <th className="px-3.5 py-2.5 text-center">Tình trạng</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#eceae3]">
                    {(dynamicRecipe || getRecipeForProduct(selectedRecipeProduct.name)).map((rec, idx) => {
                      // Chức năng: Hàm normalize(s). Cách hoạt động: Thực thi logic xử lý nghiệp vụ của module và trả về kết quả cho nơi gọi.
                      const normalize = (s: string) => s.toLowerCase().trim();
                      const ingInfo =
                        ingredientStock.find((i) => normalize(i.name) === normalize(rec.ingredient)) ||
                        (rec.ingredientId ? ingredientStock.find((i) => i.id === rec.ingredientId) : undefined) ||
                        ingredientStock.find(
                          (i) =>
                            normalize(i.name).includes(normalize(rec.ingredient)) ||
                            normalize(rec.ingredient).includes(normalize(i.name)),
                        );
                      const curStock = ingInfo ? ingInfo.stock : 0;
                      const unit = ingInfo?.unit || rec.unit;
                      const maxCups = Math.floor(curStock / rec.quantity);
                      const isOutOfStock = curStock === 0 || maxCups === 0;
                      const isLow = curStock <= (ingInfo?.minimum ?? 500) || maxCups < 10;
                      return (
                        <tr key={idx} className="hover:bg-[#faf9f5]">
                          <td className="px-3.5 py-3 font-semibold text-[#1e3429]">{rec.ingredient}</td>
                          <td className="px-3 py-3 text-right font-mono font-bold text-[#18462d]">
                            {rec.quantity} {unit}
                          </td>
                          <td className="px-3 py-3 text-right font-mono text-[#434e46]">
                            {new Intl.NumberFormat("vi-VN").format(curStock)} {unit}
                          </td>
                          <td className="px-3 py-3 text-center font-bold text-[#1a5b36]">
                            ~{maxCups} ly
                          </td>
                          <td className="px-3.5 py-3 text-center">
                            <span
                              className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                isOutOfStock
                                  ? "bg-red-100 text-red-800"
                                  : isLow
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-emerald-100 text-emerald-800"
                              }`}
                            >
                              {isOutOfStock ? "Hết hàng" : isLow ? "Sắp hết" : "Dồi dào"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              )}
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[#eeede7] pt-4">
              <div className="flex items-center gap-2">
                <span className="text-xs text-stone-600 font-medium">Trạng thái bán:</span>
                <button
                  type="button"
                  onClick={() => toggleAvailability(selectedRecipeProduct.sku)}
                  className={`rounded-full px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                    (availability[selectedRecipeProduct.name] ??
                    availability[selectedRecipeProduct.sku] ??
                    selectedRecipeProduct.stock > 0)
                      ? "bg-[#daf4e0] text-[#1e7141] hover:brightness-95"
                      : "bg-[#fde4e1] text-[#a5332a] hover:brightness-95"
                  }`}
                >
                  {(availability[selectedRecipeProduct.name] ??
                  availability[selectedRecipeProduct.sku] ??
                  selectedRecipeProduct.stock > 0)
                    ? "● Đang bán (Hiển thị trên menu)"
                    : "● Tạm hết (Đã ẩn khỏi menu khách)"}
                </button>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRecipeProduct(null)}
                className="rounded-xl bg-[#145332] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#0f4328] transition cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POPUP THÊM NGUYÊN LIỆU MỚI */}
      {createIngOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#10251b]/45 p-4" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setCreateIngOpen(false); }}>
          <form onSubmit={handleCreateIngredient} className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl space-y-3">
            <h2 className="text-lg font-bold text-[#17432e]">Thêm nguyên liệu mới</h2>
            <div>
              <label className="block text-xs font-bold text-[#556358] mb-1">Tên nguyên liệu</label>
              <input
                required
                value={newIngName}
                onChange={(e) => setNewIngName(e.target.value)}
                placeholder="VD: Matcha Nhật Bản"
                className="w-full rounded-xl border border-[#d6d4cb] px-3 py-2 text-sm"
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-xs font-bold text-[#556358] mb-1">Đơn vị</label>
                <select value={newIngUnit} onChange={(e) => setNewIngUnit(e.target.value as IngredientUnit)} className="w-full rounded-xl border border-[#d6d4cb] px-2 py-2 text-sm">
                  <option value="G">G (gram)</option>
                  <option value="ML">ML (ml)</option>
                  <option value="PCS">PCS (cái)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-[#556358] mb-1">Tồn ban đầu</label>
                <input type="number" min={0} value={newIngStock} onChange={(e) => setNewIngStock(e.target.value)} className="w-full rounded-xl border border-[#d6d4cb] px-2 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#556358] mb-1">Ngưỡng thấp</label>
                <input type="number" min={0} value={newIngThreshold} onChange={(e) => setNewIngThreshold(e.target.value)} className="w-full rounded-xl border border-[#d6d4cb] px-2 py-2 text-sm" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setCreateIngOpen(false)} className="rounded-xl border border-[#d6d4cb] px-4 py-2 text-xs font-bold text-[#556358] cursor-pointer">Hủy</button>
              <button type="submit" disabled={submittingCreateIng} className="rounded-xl bg-[#174c32] px-4 py-2 text-xs font-bold text-white hover:bg-[#124029] disabled:opacity-50 cursor-pointer">
                {submittingCreateIng ? "Đang tạo..." : "Tạo nguyên liệu"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* POPUP SỬA NGUYÊN LIỆU */}
      {editIngTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#10251b]/45 p-4" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setEditIngTarget(null); }}>
          <form onSubmit={handleUpdateIngredient} className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl space-y-3">
            <h2 className="text-lg font-bold text-[#17432e]">Sửa nguyên liệu #{editIngTarget.id}</h2>
            <div>
              <label className="block text-xs font-bold text-[#556358] mb-1">Tên nguyên liệu</label>
              <input required value={editIngName} onChange={(e) => setEditIngName(e.target.value)} className="w-full rounded-xl border border-[#d6d4cb] px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#556358] mb-1">Ngưỡng cảnh báo hết hàng ({editIngTarget.unit})</label>
              <input type="number" min={0} required value={editIngThreshold} onChange={(e) => setEditIngThreshold(e.target.value)} className="w-full rounded-xl border border-[#d6d4cb] px-3 py-2 text-sm" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEditIngTarget(null)} className="rounded-xl border border-[#d6d4cb] px-4 py-2 text-xs font-bold text-[#556358] cursor-pointer">Hủy</button>
              <button type="submit" disabled={submittingEditIng} className="rounded-xl bg-[#174c32] px-4 py-2 text-xs font-bold text-white hover:bg-[#124029] disabled:opacity-50 cursor-pointer">
                {submittingEditIng ? "Đang lưu..." : "Lưu thay đổi"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* POPUP KIỂM KÊ / BÁO HAO HỤT */}
      {adjustTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#10251b]/45 p-4" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setAdjustTarget(null); }}>
          <form onSubmit={handleAdjustStock} className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl space-y-3">
            <h2 className="text-lg font-bold text-[#17432e]">Kiểm kê / Điều chỉnh tồn kho</h2>
            <p className="text-xs text-[#647066]">{adjustTarget.name} · Hệ thống đang ghi: <b>{adjustTarget.stock} {adjustTarget.unit}</b></p>
            <div>
              <label className="block text-xs font-bold text-[#556358] mb-1">Số tồn thực tế đếm được ({adjustTarget.unit})</label>
              <input type="number" min={0} required value={adjustActualStock} onChange={(e) => setAdjustActualStock(e.target.value)} className="w-full rounded-xl border border-[#d6d4cb] px-3 py-2 text-sm font-mono font-bold" />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#556358] mb-1">Lý do kiểm kê / hao hụt (tối thiểu 3 ký tự)</label>
              <input required minLength={3} value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)} placeholder="VD: Đổ vỡ khi pha chế / Kiểm kê cuối ca" className="w-full rounded-xl border border-[#d6d4cb] px-3 py-2 text-sm" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setAdjustTarget(null)} className="rounded-xl border border-[#d6d4cb] px-4 py-2 text-xs font-bold text-[#556358] cursor-pointer">Hủy</button>
              <button type="submit" disabled={submittingAdjust} className="rounded-xl bg-[#805817] px-4 py-2 text-xs font-bold text-white hover:bg-[#664510] disabled:opacity-50 cursor-pointer">
                {submittingAdjust ? "Đang cập nhật..." : "Xác nhận kiểm kê"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* POPUP LỊCH SỬ THẺ KHO */}
      {movementsTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#10251b]/45 p-4" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setMovementsTarget(null); }}>
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-[#e9e7df] pb-3">
              <div>
                <h2 className="text-lg font-bold text-[#17432e]">Thẻ kho: {movementsTarget.name}</h2>
                <p className="text-xs text-[#647066]">Tồn hiện tại: {movementsTarget.stock} {movementsTarget.unit}</p>
              </div>
              <button type="button" onClick={() => setMovementsTarget(null)} className="text-xl font-bold text-stone-400 hover:text-stone-700 cursor-pointer">×</button>
            </div>
            <div className="mt-3 overflow-y-auto flex-1 space-y-2">
              {loadingMovements ? (
                <p className="text-xs text-center text-[#737970] py-6">Đang tải nhật ký biến động...</p>
              ) : movementsList.length === 0 ? (
                <p className="text-xs text-center text-[#737970] py-6">Chưa có biến động kho nào được ghi nhận.</p>
              ) : (
                movementsList.map((m) => (
                  <div key={m.id} className="flex items-start justify-between gap-2 rounded-xl border border-[#eceae3] bg-[#faf9f5] p-2.5 text-xs">
                    <div>
                      <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-bold ${
                        m.type === "IN" ? "bg-emerald-100 text-emerald-800" : m.type === "OUT" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"
                      }`}>{m.type}</span>
                      <span className="ml-2 font-medium text-[#1e3429]">{m.reason || (m.orderId ? `Đơn #${m.orderId}` : "Biến động kho")}</span>
                      <p className="mt-0.5 text-[10px] text-[#737970]">{new Date(m.createdAt).toLocaleString("vi-VN")}</p>
                    </div>
                    <span className={`font-mono font-bold ${m.quantity >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                      {m.quantity >= 0 ? `+${m.quantity}` : m.quantity} {movementsTarget.unit}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* POPUP XEM / SỬA CÔNG THỨC TOPPING */}
      {selectedTopping && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#10251b]/45 p-4" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setSelectedTopping(null); }}>
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl max-h-[85vh] overflow-y-auto space-y-4">
            <div className="flex items-start justify-between border-b border-[#e9e7df] pb-3">
              <div>
                <h2 className="text-lg font-bold text-[#17432e]">Công thức Topping: {selectedTopping.name}</h2>
                <p className="text-xs text-[#647066]">Định lượng nguyên liệu tiêu hao cho 1 phần topping.</p>
              </div>
              <button type="button" onClick={() => setSelectedTopping(null)} className="text-xl font-bold text-stone-400 hover:text-stone-700 cursor-pointer">×</button>
            </div>
            {loadingToppingRecipe ? (
              <p className="text-xs text-center text-[#737970] py-4">Đang tải công thức...</p>
            ) : (
              <div className="space-y-3">
                {toppingRecipeDraft.length === 0 && (
                  <p className="text-xs text-[#737970]">Chưa có nguyên liệu nào trong công thức.</p>
                )}
                {toppingRecipeDraft.map((row, idx) => (
                  <div key={row.ingredientId} className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-semibold text-[#1e3429] flex-1 truncate">{row.name}</span>
                    {isManager ? (
                      <>
                        <input
                          type="number"
                          min={1}
                          value={row.quantity}
                          onChange={(e) => {
                            const val = Math.max(1, Number(e.target.value) || 1);
                            setToppingRecipeDraft((prev) => prev.map((r, i) => (i === idx ? { ...r, quantity: val } : r)));
                          }}
                          className="w-20 rounded-lg border border-[#d6d4cb] px-2 py-1 text-right font-mono font-bold"
                        />
                        <span className="w-8 text-[#556358]">{row.unit}</span>
                        <button
                          type="button"
                          onClick={() => setToppingRecipeDraft((prev) => prev.filter((_, i) => i !== idx))}
                          className="rounded-lg px-2 py-1 text-red-600 hover:bg-red-50 font-bold cursor-pointer"
                        >
                          ✕
                        </button>
                      </>
                    ) : (
                      <span className="font-mono font-bold text-[#18462d]">{row.quantity} {row.unit}</span>
                    )}
                  </div>
                ))}
                {isManager && (
                  <div className="flex items-center gap-2 pt-2 border-t border-[#e6e5dd]">
                    <select
                      value={newToppingIngId}
                      onChange={(e) => setNewToppingIngId(Number(e.target.value))}
                      className="flex-1 rounded-lg border border-[#d6d4cb] bg-white px-2 py-1.5 text-xs"
                    >
                      <option value={0}>-- Chọn nguyên liệu thêm --</option>
                      {ingredientStock
                        .filter((i) => i.id && !toppingRecipeDraft.some((d) => d.ingredientId === i.id))
                        .map((i) => (
                          <option key={i.id} value={i.id}>
                            {i.name} ({i.unit})
                          </option>
                        ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => {
                        const ing = ingredientStock.find((i) => i.id === newToppingIngId);
                        if (!ing?.id) return;
                        setToppingRecipeDraft((prev) => [...prev, { ingredientId: ing.id!, name: ing.name, unit: ing.unit, quantity: 10 }]);
                        setNewToppingIngId(0);
                      }}
                      className="rounded-lg bg-[#e6efe9] px-2.5 py-1.5 text-xs font-bold text-[#174c32] hover:bg-[#d5e6db] cursor-pointer"
                    >
                      + Thêm
                    </button>
                  </div>
                )}
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setSelectedTopping(null)} className="rounded-xl border border-[#d6d4cb] px-4 py-2 text-xs font-bold text-[#556358] cursor-pointer">Đóng</button>
                  {isManager && (
                    <button
                      type="button"
                      disabled={savingToppingRecipe}
                      onClick={saveToppingRecipe}
                      className="rounded-xl bg-[#174c32] px-4 py-2 text-xs font-bold text-white hover:bg-[#124029] disabled:opacity-50 cursor-pointer"
                    >
                      {savingToppingRecipe ? "Đang lưu..." : "Lưu công thức"}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* POPUP NHẬP HÀNG NGUYÊN LIỆU */}
      {receivingSku && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#10251b]/45 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setReceivingSku(null); }}>
          <form onSubmit={receiveIngredient} className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-xl font-bold text-[#17432e]">Nhập hàng nguyên liệu</h2>
            <p className="mt-1 text-sm text-[#737970]">{ingredientStock.find((item) => item.sku === receivingSku)?.name}</p>
            <label className="mt-5 block text-sm font-semibold" htmlFor="ingredient-receive-amount">Số lượng nhập ({ingredientStock.find((item) => item.sku === receivingSku)?.unit})</label>
            <input autoFocus id="ingredient-receive-amount" type="number" min="1" step="1" value={receivingAmount} onChange={(event) => setReceivingAmount(event.target.value)} className="mt-2 w-full rounded-lg border border-[#d9ddd5] px-3 py-2.5 outline-none focus:border-[#267143] focus:ring-2 focus:ring-[#267143]/15"/>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setReceivingSku(null)} className="rounded-lg px-4 py-2 text-sm font-semibold text-[#59645b] hover:bg-[#f3f3ee] cursor-pointer">Hủy</button>
              <button type="submit" className="rounded-lg bg-[#145332] px-4 py-2 text-sm font-bold text-white hover:bg-[#0f4328] cursor-pointer">Xác nhận nhập</button>
            </div>
          </form>
        </div>
      )}

      {/* POPUP HOÀN TIỀN CHO KHÁCH (THEO CHUẨN THIẾT KẾ TASK 5) */}
      {refundOrder && (() => {
        const isValidAccount = Boolean(
          refundAccount &&
          /^\d{6,19}$/.test(refundAccount.trim()) &&
          refundAccount.trim() !== "00000000" &&
          !refundAccount.toLowerCase().includes("file")
        );

        const isFailed = refundOrder.refundStatus === "FAILED";
        const isUnknown = refundOrder.refundStatus === "UNKNOWN";

        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs"
            role="presentation"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setRefundOrder(null);
            }}
          >
            <div className="w-full max-w-sm max-h-[85vh] flex flex-col overflow-hidden rounded-2xl bg-[#141414] border border-[#262626] text-white shadow-2xl">
              {/* Header (always visible) */}
              <div className="shrink-0 flex items-center justify-between border-b border-[#262626] px-4 py-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                    Hoàn tiền đơn #{refundOrder.id}
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                      isFailed
                        ? "bg-red-950/80 text-red-400 border-red-800"
                        : isUnknown
                          ? "bg-amber-950/80 text-amber-400 border-amber-800"
                          : "bg-[#2d1804] text-[#f97316] border-[#9a3412]/60"
                    }`}
                  >
                    {isFailed
                      ? "Chuyển thất bại"
                      : isUnknown
                        ? "Đang đối soát"
                        : "Chờ hoàn tiền"}
                  </span>
                  <button
                    type="button"
                    onClick={() => setRefundOrder(null)}
                    aria-label="Đóng"
                    className="rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-white text-sm font-bold px-2.5 py-1 cursor-pointer ml-1 transition"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Scrollable Body */}
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">

              {/* SỐ TIỀN CẦN HOÀN */}
              <div className="text-center py-1">
                <p className="text-[11px] font-bold tracking-widest uppercase text-neutral-400">
                  SỐ TIỀN CẦN HOÀN
                </p>
                <p className="text-3xl font-black text-white mt-1 tracking-tight">
                  {money(refundOrder.total)}
                </p>
              </div>

              {/* 1. Thông tin khách đã cung cấp */}
              <div className="space-y-2 border-t border-[#262626] pt-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                    1. Thông tin khách đã cung cấp
                  </h4>
                  {!isEditingAccount ? (
                    <button
                      type="button"
                      onClick={() => setIsEditingAccount(true)}
                      className="text-[10px] text-neutral-400 hover:text-white underline cursor-pointer"
                    >
                      Xác minh / Cập nhật STK
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsEditingAccount(false)}
                      className="text-[10px] text-emerald-400 hover:text-emerald-300 font-semibold cursor-pointer"
                    >
                      ✓ Khóa lại
                    </button>
                  )}
                </div>

                {!isEditingAccount ? (
                  <div className="space-y-1.5 rounded-xl bg-neutral-900/90 border border-neutral-800 p-3 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-neutral-400">Ngân hàng</span>
                      <span className="font-bold text-white">
                        {BANK_NAMES[refundBank] || refundBank}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-neutral-400">Số tài khoản</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-white">
                          {showFullAccount
                            ? refundAccount
                            : refundAccount
                              ? `•••• ${refundAccount.slice(-4)}`
                              : "(Chưa cung cấp)"}
                        </span>
                        {refundAccount && (
                          <button
                            type="button"
                            onClick={() => setShowFullAccount(!showFullAccount)}
                            className="text-[10px] text-neutral-400 hover:text-white underline cursor-pointer"
                          >
                            {showFullAccount ? "Ẩn" : "Hiện"}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2 rounded-xl bg-neutral-900 border border-neutral-700 p-3 text-xs">
                    <div>
                      <label className="block text-neutral-400 mb-1">Ngân hàng thụ hưởng:</label>
                      <select
                        value={refundBank}
                        onChange={(e) => setRefundBank(e.target.value)}
                        className="w-full rounded-lg bg-neutral-800 border border-neutral-700 text-white p-2 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      >
                        <option value="MB">MB Bank (Quân Đội)</option>
                        <option value="VCB">Vietcombank</option>
                        <option value="TCB">Techcombank</option>
                        <option value="TPB">TPBank</option>
                        <option value="VPB">VPBank</option>
                        <option value="ACB">ACB</option>
                        <option value="ICB">VietinBank</option>
                        <option value="BIDV">BIDV</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-neutral-400 mb-1">Số tài khoản mới:</label>
                      <input
                        type="text"
                        value={refundAccount}
                        onChange={(e) => setRefundAccount(e.target.value)}
                        placeholder="Nhập số tài khoản hợp lệ..."
                        className="w-full rounded-lg bg-neutral-800 border border-neutral-700 text-white p-2 text-xs font-mono font-bold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>
                  </div>
                )}
                <p className="text-[11px] text-neutral-500 italic">
                  Chỉ đọc. Nếu thông tin sai, yêu cầu khách cập nhật và xác minh lại.
                </p>
              </div>

              {/* 2. Chuyển khoản hoàn tiền */}
              <div className="space-y-2 border-t border-[#262626] pt-3">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                  2. Chuyển khoản hoàn tiền
                </h4>
                <p className="text-[11px] text-neutral-400 leading-relaxed">
                  Hiển thị VietQR sau khi STK hợp lệ. Barista dùng ứng dụng ngân hàng để chuyển khoản.
                </p>

                {isValidAccount ? (
                  <div className="flex flex-col items-center justify-center p-3.5 rounded-xl bg-neutral-900 border border-neutral-800">
                    <img
                      src={`https://img.vietqr.io/image/${refundBank}-${refundAccount.trim()}-compact2.png?amount=${refundOrder.total}&addInfo=Hoan%20tien%20don%20${refundOrder.id}`}
                      alt="Mã VietQR hoàn tiền"
                      className="w-44 h-44 object-contain rounded-xl bg-white p-1.5 shadow-md"
                    />
                    <p className="text-xs text-neutral-300 mt-2 font-mono text-center">
                      Nội dung chuyển khoản: <strong className="text-emerald-400">Hoan tien don #{refundOrder.id}</strong>
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center p-6 rounded-xl bg-neutral-900/60 border border-dashed border-neutral-800 text-center">
                    <div className="text-2xl text-neutral-500 mb-1.5 font-mono">
                      ⛶
                    </div>
                    <p className="text-xs font-semibold text-neutral-300">
                      Vị trí mã VietQR của khách
                    </p>
                    <p className="text-[10px] text-neutral-500 mt-1 max-w-xs leading-normal">
                      {refundAccount && refundAccount !== "00000000"
                        ? `STK "${refundAccount}" không phải số tài khoản hợp lệ. Chặn tạo QR để đảm bảo an toàn.`
                        : "Chưa có số tài khoản hợp lệ từ khách. Barista vui lòng liên hệ khách để bổ sung."}
                    </p>
                  </div>
                )}
              </div>

              {/* 3. Ghi nhận kết quả chuyển khoản */}
              <div className="space-y-2.5 border-t border-[#262626] pt-3">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                  3. Ghi nhận kết quả chuyển khoản
                </h4>

                <div>
                  <label className="block text-[11px] text-neutral-400 mb-1">
                    Mã giao dịch ngân hàng
                  </label>
                  <input
                    type="text"
                    value={refundProof}
                    onChange={(e) => setRefundProof(e.target.value)}
                    placeholder="Nhập sau khi ngân hàng xác nhận thành công"
                    className="w-full rounded-xl bg-neutral-900 border border-neutral-800 text-white placeholder:text-neutral-600 p-2.5 text-xs font-mono font-bold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <label className="flex items-start gap-2 text-[11px] text-neutral-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isVerifiedWithBank}
                    onChange={(e) => setIsVerifiedWithBank(e.target.checked)}
                    className="mt-0.5 rounded border-neutral-700 bg-neutral-900 text-emerald-600 focus:ring-emerald-600 cursor-pointer"
                  />
                  <span className="leading-snug">
                    Tôi đã đối chiếu lịch sử giao dịch trên App ngân hàng và xác nhận tiền đã trừ thành công.
                  </span>
                </label>

                <button
                  type="button"
                  disabled={isRefunding || !refundProof.trim() || !isVerifiedWithBank}
                  onClick={() => handleConfirmRefund(refundOrder.id)}
                  className="w-full rounded-xl bg-emerald-800 hover:bg-emerald-700 py-2.5 text-xs font-bold text-white transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <span>✓</span>
                  <span>{isRefunding ? "Đang xử lý..." : "Xác nhận đã hoàn tiền thành công"}</span>
                </button>
              </div>

              {/* Lựa chọn thay thế: Hoàn trả bằng điểm thưởng */}
              <div className="rounded-xl border border-amber-800/50 bg-amber-950/25 p-3 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-amber-300">Hoặc hoàn bằng điểm thưởng</span>
                  <span className="font-mono font-bold text-amber-200">
                    +{Math.ceil(refundOrder.total / 10).toLocaleString("vi-VN")} điểm
                  </span>
                </div>
                <p className="text-[11px] text-amber-200/75 leading-snug">
                  Quy đổi {money(refundOrder.total)} thành điểm tích lũy (1 điểm = 10đ) cộng thẳng vào tài khoản khách mà không cần chuyển khoản ngân hàng.
                </p>
                <button
                  type="button"
                  disabled={isRefunding}
                  onClick={() => handleRefundPoints(refundOrder.id)}
                  className="w-full rounded-xl bg-amber-700 hover:bg-amber-600 py-2 text-xs font-bold text-white transition disabled:opacity-40 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>🎁</span>
                  <span>{isRefunding ? "Đang xử lý..." : "Hoàn trả bằng điểm thưởng cho khách"}</span>
                </button>
              </div>

              {/* Xử lý sự cố */}
              <div className="space-y-2.5 border-t border-[#262626] pt-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-neutral-400">Gặp sự cố chuyển tiền?</span>
                  <button
                    type="button"
                    onClick={() => setShowTroubleshoot(!showTroubleshoot)}
                    className="font-bold text-neutral-200 hover:text-white underline cursor-pointer"
                  >
                    {showTroubleshoot ? "Ẩn xử lý sự cố ▲" : "Xử lý sự cố"}
                  </button>
                </div>

                {showTroubleshoot && (
                  <div className="rounded-xl bg-neutral-900/90 border border-neutral-800 p-3 space-y-2.5 animate-in fade-in">
                    <p className="text-[11px] font-bold text-neutral-300">
                      Chọn thao tác xử lý sự cố chuyển tiền:
                    </p>

                    {isUnknown ? (
                      <div className="p-3 rounded-lg bg-amber-950/40 border border-amber-800/80 text-xs text-amber-200 space-y-1.5">
                        <div className="flex items-center gap-1.5 font-bold text-amber-300">
                          <span>⚠️</span>
                          <span>Đang trong diện đối soát ngân hàng (UNKNOWN)</span>
                        </div>
                        <p className="text-[11px] text-amber-300/80 leading-relaxed">
                          Hệ thống đã khóa nút chuyển lại (Retry) để ngăn ngừa chuyển tiền trùng lặp cho khách hàng.
                          Vui lòng kiểm tra sao kê ngân hàng. Nếu xác nhận tiền đã trừ, hãy nhập mã giao dịch ở Mục 3 và xác nhận thành công.
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        <button
                          type="button"
                          disabled={isRefunding}
                          onClick={() => handleFailRefund(refundOrder.id)}
                          className="rounded-xl border border-red-900/70 bg-red-950/30 p-2.5 text-left text-red-300 hover:bg-red-950/60 transition cursor-pointer"
                        >
                          <div className="font-bold flex items-center gap-1">
                            <span>⚠️</span>
                            <span>Ngân hàng báo thất bại</span>
                          </div>
                          <p className="text-[10px] text-red-400/80 mt-1 leading-normal">
                            Sai STK, tài khoản khóa. Tiền chưa chuyển đi. Cho phép cập nhật STK & thử lại.
                          </p>
                        </button>

                        <button
                          type="button"
                          disabled={isRefunding}
                          onClick={() => handleHoldRefund(refundOrder.id)}
                          className="rounded-xl border border-amber-900/70 bg-amber-950/30 p-2.5 text-left text-amber-300 hover:bg-amber-950/60 transition cursor-pointer"
                        >
                          <div className="font-bold flex items-center gap-1">
                            <span>🔍</span>
                            <span>Chưa rõ kết quả / Treo lệnh</span>
                          </div>
                          <p className="text-[10px] text-amber-400/80 mt-1 leading-normal">
                            App mất mạng, treo lệnh, chưa rõ tiền đã chuyển hay chưa. Khóa chuyển lại để đối soát.
                          </p>
                        </button>
                      </div>
                    )}

                    {isFailed && (
                      <div className="pt-2 border-t border-neutral-800">
                        <button
                          type="button"
                          disabled={isRefunding}
                          onClick={() => handleRetryRefund(refundOrder.id)}
                          className="w-full rounded-xl border border-blue-900/60 bg-blue-950/40 p-2 text-xs font-bold text-blue-300 hover:bg-blue-950/70 transition cursor-pointer text-center"
                        >
                          🔄 Xác nhận STK mới & Cho phép chuyển tiền lại (Retry)
                        </button>
                      </div>
                    )}
                  </div>
                )}

              </div>
              </div>

              {/* Sticky Footer */}
              <div className="shrink-0 border-t border-[#262626] bg-[#141414] px-4 py-2.5">
                <button
                  type="button"
                  onClick={() => setRefundOrder(null)}
                  className="w-full py-2 rounded-xl border border-neutral-700 bg-neutral-900 text-xs font-semibold text-neutral-200 hover:text-white hover:bg-neutral-800 transition cursor-pointer"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
