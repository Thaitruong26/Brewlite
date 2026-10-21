"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useAuthStore } from "@/store/auth-store";
import { useCartStore, selectTotalItems } from "@/store/cart-store";

export function SiteHeader() {
  const user = useAuthStore((state) => state.user);
  const signOut = useAuthStore((state) => state.signOut);
  const hydrate = useAuthStore((state) => state.hydrate);
  const totalItems = useCartStore(selectTotalItems);
  useEffect(() => { hydrate(); }, [hydrate]);

  return (
    <header className="sticky top-0 z-30 border-b border-[#e5e7dc]/90 bg-[#fbf8ef]/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:px-10">
        {/* Logo */}
        <Link
          href="/"
          aria-label="BrewLite — Trang chủ"
          className="flex items-center gap-2 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#183d2c]"
        >
          <span className="grid size-9 place-items-center rounded-full bg-[#183d2c] text-lg text-[#fbf8ef]" aria-hidden="true">☕</span>
          <div className="leading-tight">
            <p className="text-base font-bold tracking-tight text-[#183d2c]">BrewLite</p>
            <p className="hidden text-[10px] font-medium text-[#66736a] sm:block">Campus Artisan Coffee</p>
          </div>
        </Link>

        {/* Desktop nav */}
        <nav aria-label="Điều hướng chính" className="hidden items-center gap-1 text-sm font-medium md:flex">
          <Link className="rounded-lg px-3 py-2 text-[#344b3c] transition hover:bg-[#eef2ec] hover:text-[#183d2c]" href="/menu">Thực đơn</Link>
          <Link className="relative rounded-lg px-3 py-2 text-[#344b3c] transition hover:bg-[#eef2ec] hover:text-[#183d2c]" href="/cart">
            Giỏ hàng
            {totalItems > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-[#183d2c] text-[9px] font-bold text-white">
                {totalItems > 9 ? "9+" : totalItems}
              </span>
            )}
          </Link>
          <Link className="rounded-lg px-3 py-2 text-[#344b3c] transition hover:bg-[#eef2ec] hover:text-[#183d2c]" href="/orders">Lịch sử</Link>
        </nav>

        {/* Right: auth */}
        <div className="flex items-center gap-2">
          {user ? (
            <div className="flex items-center gap-2">
              <span className="hidden text-sm font-medium text-[#344b3c] sm:block">{user.fullName.split(" ").pop()}</span>
              <button
                onClick={signOut}
                className="flex size-9 items-center justify-center rounded-full bg-[#183d2c] text-sm font-bold text-white transition hover:bg-[#24563e]"
                aria-label="Đăng xuất"
                title={`Đăng xuất (${user.email})`}
              >
                {user.fullName.charAt(0).toUpperCase()}
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="rounded-full bg-[#183d2c] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#24563e]"
            >
              Đăng nhập
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
