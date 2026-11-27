"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useState, useRef } from "react";
import { useAuthStore } from "@/store/auth-store";
import { useCartStore, selectTotalItems } from "@/store/cart-store";
import { api, getAccessToken, saveSession } from "@/lib/api";

// Chức năng: Component giao diện SiteHeaderContent. Cách hoạt động: Quản lý trạng thái hiển thị bằng React hooks và render cấu trúc JSX tương ứng.
function SiteHeaderContent() {
  const user     = useAuthStore((s) => s.user);
  const signOut  = useAuthStore((s) => s.signOut);
  const hydrate  = useAuthStore((s) => s.hydrate);
  const totalItems = useCartStore(selectTotalItems);
  const pathname   = usePathname();
  const signedIn   = Boolean(user);

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    hydrate();
    if (signedIn) {
      api<any>("/auth/me")
        .then((fresh) => {
          if (fresh && typeof fresh.loyaltyPoints === "number") {
            const token = getAccessToken();
            if (token) {
              saveSession(token, fresh);
              useAuthStore.setState({ user: fresh });
            }
          }
        })
        .catch(() => {});
    }
  }, [hydrate, signedIn, pathname]);

  useEffect(() => {
    // Chức năng: Xử lý sự kiện ClickOutside. Cách hoạt động: Nhận sự kiện từ giao diện, cập nhật state hoặc gọi API xử lý nghiệp vụ tương ứng.
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Chức năng: Xử lý tính toán / định dạng dữ liệu (formatCurrency). Cách hoạt động: Biến đổi tham số đầu vào (amount) thành kết quả chuẩn để hiển thị hoặc tính toán.
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(amount);
  };

  return (
    <header className="sticky top-0 inset-x-0 z-30 w-full border-b border-[#e5e7dc] bg-[#f5f7f2]/95 backdrop-blur-md shrink-0">
      <div className="flex h-14 md:h-16 w-full max-w-7xl mx-auto items-center justify-between px-3.5 sm:px-6 lg:px-8">

        {/* ── Logo ─────────────────────────────────────────── */}
        <Link
          href="/"
          aria-label="BrewLite — Trang chủ"
          className="flex items-center gap-2 rounded-lg transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-[#183d2c]"
        >
          <span
            className="grid size-8 md:size-9 place-items-center rounded-full bg-[#183d2c] text-base md:text-lg text-[#fbf8ef]"
            aria-hidden="true"
          >
            ☕
          </span>
          <div className="leading-tight">
            <p className="text-sm md:text-base font-bold tracking-tight text-[#183d2c]">BrewLite</p>
            <p className="text-[9px] md:text-[10px] font-medium text-[#66736a]">
              Artisan Coffee
            </p>
          </div>
        </Link>

        {/* ── Desktop Navigation Links ────────────────────── */}
        <nav aria-label="Điều hướng trang web" className="hidden md:flex items-center gap-8">
          <Link
            href="/"
            className={[
              "text-sm font-semibold transition-colors hover:text-[#183d2c]",
              pathname === "/" ? "text-[#183d2c] border-b-2 border-[#183d2c] pb-1" : "text-[#55695d]",
            ].join(" ")}
          >
            Trang chủ
          </Link>
          <Link
            href="/menu"
            className={[
              "text-sm font-semibold transition-colors hover:text-[#183d2c]",
              pathname === "/menu" ? "text-[#183d2c] border-b-2 border-[#183d2c] pb-1" : "text-[#55695d]",
            ].join(" ")}
          >
            Thực đơn
          </Link>
          <Link
            href="/orders"
            className={[
              "text-sm font-semibold transition-colors hover:text-[#183d2c]",
              pathname === "/orders" ? "text-[#183d2c] border-b-2 border-[#183d2c] pb-1" : "text-[#55695d]",
            ].join(" ")}
          >
            Lịch sử đơn
          </Link>
        </nav>

        {/* ── Auth & Desktop Cart ─────────────────────────── */}
        <div className="flex items-center gap-2.5">
          {/* Nút giỏ hàng trên Desktop */}
          <Link
            href="/cart"
            className="hidden md:flex items-center gap-2 rounded-full border border-[#d6ddd3] bg-white px-3.5 py-1.5 text-xs font-bold text-[#183d2c] shadow-2xs hover:bg-[#eef3eb] transition-all"
            aria-label="Giỏ hàng"
          >
            <span className="relative flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="size-4.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" />
              </svg>
              {totalItems > 0 && (
                <span className="absolute -top-2 -right-2 flex size-4 items-center justify-center rounded-full bg-emerald-600 text-[10px] font-bold text-white">
                  {totalItems > 9 ? "9+" : totalItems}
                </span>
              )}
            </span>
            <span>Giỏ hàng</span>
          </Link>
          {(user?.role === "BARISTA" || user?.role === "MANAGER") && (
            <Link
              href="/barista"
              className={[
                "flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold transition-all shadow-sm",
                pathname === "/barista"
                  ? "bg-amber-700 text-white shadow-inner"
                  : "bg-amber-100 text-amber-900 hover:bg-amber-200",
              ].join(" ")}
            >
              <span>👨‍🍳</span> Quầy Barista
            </Link>
          )}
          
          {user ? (
            <div className="flex items-center gap-2">
              <span className="hidden text-sm font-medium text-[#344b3c] sm:block">
                {user.fullName.split(" ").pop()}
              </span>
              
              {/* Vùng Dropdown */}
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="flex size-9 items-center justify-center rounded-full bg-[#183d2c] text-sm font-bold text-white transition-colors hover:bg-[#24563e] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#183d2c]"
                  aria-label="Tài khoản"
                  aria-expanded={isDropdownOpen}
                >
                  {user.fullName.charAt(0).toUpperCase()}
                </button>

                {isDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-64 origin-top-right rounded-xl border border-[#e5e7dc] bg-white p-2 shadow-lg ring-1 ring-black/5 focus:outline-none">
                    {/* Thông tin User */}
                    <div className="border-b border-[#e5e7dc] px-3 py-2">
                      <p className="text-sm font-bold text-[#183d2c]">{user.fullName}</p>
                      <p className="truncate text-xs text-[#66736a]">{user.email}</p>
                    </div>

                    {/* Điểm thưởng */}
                    <div className="border-b border-[#e5e7dc] px-3 py-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-[#4a6155]">Điểm thưởng:</span>
                        {/* CHÚ Ý: Đổi 'user.points' thành tên trường lưu điểm trong DB của bạn nếu khác */}
                        <span className="font-bold text-[#183d2c]">{user.loyaltyPoints ?? 0} điểm</span>
                      </div>
                      <div className="mt-1 flex items-center justify-between text-xs">
                        <span className="text-[#66736a]">Quy đổi:</span>
                        <span className="font-semibold text-green-600">
                          {formatCurrency((user.loyaltyPoints ?? 0) * 10)}
                        </span>
                      </div>
                    </div>

                    {/* Đăng xuất */}
                    <div className="pt-1">
                      <button
                        onClick={() => {
                          setIsDropdownOpen(false);
                          signOut();
                        }}
                        className="flex w-full items-center justify-center rounded-lg px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
                      >
                        Đăng xuất
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <Link
              href="/login"
              className="rounded-full bg-[#183d2c] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#24563e] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#183d2c]"
            >
              Đăng nhập
            </Link>
          )}
        </div>

      </div>
    </header>
  );
}

// Chức năng: Component giao diện SiteHeader. Cách hoạt động: Quản lý trạng thái hiển thị bằng React hooks và render cấu trúc JSX tương ứng.
export function SiteHeader() {
  return (
    <Suspense
      fallback={
        <header className="sticky top-0 z-30 h-16 border-b border-[#e5e7dc] bg-[#f5f7f2]/95 backdrop-blur-md" />
      }
    >
      <SiteHeaderContent />
    </Suspense>
  );
}