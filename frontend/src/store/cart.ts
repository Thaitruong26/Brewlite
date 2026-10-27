import { useSyncExternalStore } from "react";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type Size = "S" | "M" | "L";
export type CartTopping = { id: number; name: string; price: number };
export type CartItem = {
  /** Khóa duy nhất của một dòng: cùng sản phẩm + size + bộ topping thì gộp chung một dòng. */
  key: string;
  productId: number;
  name: string;
  imageUrl: string;
  size: Size;
  sizeSurcharge: number;
  toppings: CartTopping[];
  basePrice: number;
  quantity: number;
};

/** Giới hạn theo api.md (POST /orders): mỗi dòng 1–20 phần, tối đa 30 dòng, tối đa 3 topping. */
export const MAX_QTY_PER_ITEM = 20;
export const MAX_CART_LINES = 30;
export const MAX_TOPPINGS = 3;

type NewCartItem = Omit<CartItem, "key" | "quantity">;

type CartState = {
  items: CartItem[];
  /** Thêm món; trả về false nếu giỏ đã đủ số dòng tối đa. */
  addItem: (item: NewCartItem, quantity?: number) => boolean;
  setQuantity: (key: string, quantity: number) => void;
  removeItem: (key: string) => void;
  clearCart: () => void;
};

const clampQty = (qty: number) => Math.max(1, Math.min(MAX_QTY_PER_ITEM, Math.floor(qty)));

export const cartItemKey = (productId: number, size: Size, toppingIds: number[]) =>
  `${productId}-${size}-${[...toppingIds].sort((a, b) => a - b).join(",")}`;

/** Giá 1 phần theo api.md mục 4.1: giá gốc + phụ thu size + tổng giá topping. */
export const itemUnitPrice = (item: Pick<CartItem, "basePrice" | "sizeSurcharge" | "toppings">) =>
  item.basePrice + item.sizeSurcharge + item.toppings.reduce((sum, topping) => sum + topping.price, 0);

export const itemLineTotal = (item: CartItem) => itemUnitPrice(item) * item.quantity;

// Selector dùng chung: tổng số ly (hiện trên biểu tượng giỏ) và tạm tính.
export const selectCartCount = (state: CartState) => state.items.reduce((sum, item) => sum + item.quantity, 0);
export const selectSubtotal = (state: CartState) => state.items.reduce((sum, item) => sum + itemLineTotal(item), 0);
export const selectTotalItems = selectCartCount;
export const selectTotalAmount = selectSubtotal;

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      addItem: (item, quantity = 1) => {
        const key = cartItemKey(item.productId, item.size, item.toppings.map((t) => t.id));
        const items = get().items;
        const existing = items.find((row) => row.key === key);
        if (existing) {
          set({ items: items.map((row) => (row.key === key ? { ...row, quantity: clampQty(row.quantity + quantity) } : row)) });
          return true;
        }
        if (items.length >= MAX_CART_LINES) return false;
        set({ items: [...items, { ...item, key, quantity: clampQty(quantity) }] });
        return true;
      },
      setQuantity: (key, quantity) =>
        set((state) => ({
          items: quantity <= 0
            ? state.items.filter((item) => item.key !== key)
            : state.items.map((item) => (item.key === key ? { ...item, quantity: clampQty(quantity) } : item)),
        })),
      removeItem: (key) => set((state) => ({ items: state.items.filter((item) => item.key !== key) })),
      clearCart: () => set({ items: [] }),
    }),
    {
      name: "brewlite-cart",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ items: state.items }),
    },
  ),
);

/**
 * true khi giỏ hàng đã được nạp lại từ localStorage.
 * Dùng để không hiện "Giỏ hàng trống" (hoặc số 0 trên biểu tượng) trong tích tắc trước khi nạp xong.
 */
export function useCartHydrated() {
  return useSyncExternalStore(
    (onChange) => useCartStore.persist.onFinishHydration(onChange),
    () => useCartStore.persist.hasHydrated(),
    () => false,
  );
}
