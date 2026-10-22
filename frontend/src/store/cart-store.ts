"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

/** Một dòng trong giỏ hàng. FE2 sẽ mở rộng khi làm trang chi tiết + trang giỏ. */
export interface CartItem {
  /** Khóa duy nhất: `${productId}-${size}-${toppingIds đã sort}` */
  id: string;
  productId: number;
  name: string;
  imageUrl: string;
  size: "S" | "M" | "L";
  toppingIds: number[];
  qty: number;
  /** lineTotal do server tính và trả về; FE chỉ lưu để hiển thị. */
  lineTotal: number;
}

interface CartState {
  items: CartItem[];
  /** Thêm/gộp item. id tự sinh nếu chưa truyền. */
  addItem: (item: Omit<CartItem, "id"> & { id?: string }) => void;
  removeItem: (id: string) => void;
  updateQty: (id: string, qty: number) => void;
  clearCart: () => void;
}

function makeId(item: Pick<CartItem, "productId" | "size" | "toppingIds">) {
  return `${item.productId}-${item.size}-${[...item.toppingIds].sort().join(",")}`;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (item) => {
        const id = item.id ?? makeId(item);
        set((state) => {
          const existing = state.items.find((i) => i.id === id);
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.id === id
                  ? { ...i, qty: i.qty + item.qty, lineTotal: i.lineTotal + item.lineTotal }
                  : i,
              ),
            };
          }
          return { items: [...state.items, { ...item, id }] };
        });
      },

      removeItem: (id) =>
        set((state) => ({ items: state.items.filter((i) => i.id !== id) })),

      updateQty: (id, qty) => {
        if (qty <= 0) { get().removeItem(id); return; }
        set((state) => ({
          items: state.items.map((i) =>
            i.id === id
              ? { ...i, qty, lineTotal: Math.round((i.lineTotal / i.qty) * qty) }
              : i,
          ),
        }));
      },

      clearCart: () => set({ items: [] }),
    }),
    { name: "brewlite.cart" },
  ),
);

/** Tổng số lượng tất cả items trong giỏ. */
export function selectTotalItems(state: CartState) {
  return state.items.reduce((sum, i) => sum + i.qty, 0);
}

/** Tổng tiền giỏ hàng (chỉ để hiển thị; server sẽ tính lại khi đặt đơn). */
export function selectTotalAmount(state: CartState) {
  return state.items.reduce((sum, i) => sum + i.lineTotal, 0);
}
