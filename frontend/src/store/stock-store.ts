"use client";

import { create } from "zustand";

const STORAGE_KEY = "brewlite.stock-availability";
const CHANGE_EVENT = "brewlite:stock-availability-change";

function readAvailability(): Record<string, boolean> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}") as Record<string, boolean>;
  } catch {
    return {};
  }
}

interface StockState {
  availability: Record<string, boolean>;
  hydrate: () => void;
  setAvailability: (sku: string, available: boolean) => void;
}

export const useStockStore = create<StockState>((set) => ({
  availability: {},
  hydrate: () => set({ availability: readAvailability() }),
  setAvailability: (sku, available) => {
    set((state) => {
      const next = { ...state.availability, [sku]: available };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      window.dispatchEvent(new Event(CHANGE_EVENT));
      return { availability: next };
    });
  },
}));

export function matchesMenuProduct(sku: string, productName: string) {
  const name = productName.toLocaleLowerCase("vi");
  const keywords: Record<string, string[]> = {
    "CF-001": ["cà phê sữa"],
    "CF-002": ["cà phê đen"],
    "CF-003": ["cà phê muối"],
    "CF-004": ["cold brew"],
    "TR-001": ["trà đào"],
    "TR-002": ["trà vải"],
    "DX-001": ["matcha"],
  };
  return (keywords[sku] ?? []).some((keyword) => name.includes(keyword));
}
