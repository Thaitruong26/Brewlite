"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useState, useRef } from "react";
import { useAuthStore } from "@/store/auth-store";
import { useCartStore, selectTotalItems } from "@/store/cart-store";

const NAV_LINKS = [
  { href: "/menu",   label: "Thực đơn" },
  { href: "/cart",   label: "Giỏ hàng", hasCart: true },
  { href: "/orders", label: "Lịch sử" },
];

/**
 * SiteHeader — Client Component
 */
function SiteHeaderContent() {
  const user     = useAuthStore((s) => s.user);
  const signOut  = useAuthStore((s) => s.signOut);
  const hydrate  = useAuthStore((s) => s.hydrate);
  const totalItems = useCartStore(selectTotalItems);
  const pathname   = usePathname();

  // State cho Dropdown Menu Khách hàng
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => { hydrate(); }, [hydrate]);

  // Xử lý click ra ngoài để đóng Dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Hàm format tiền tệ VNĐ
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(amount);
  };

  return (
    <header className="sticky top-0 z-30 border-b border-[#e5e7dc] bg-[#f5f7f2]/95 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:px-10">

        {/* ── Logo ─────────────────────────────────────────── */}
        <Link
          href="/"
          aria-label="BrewLite — Trang chủ"
          className="flex items-center gap-2.5 rounded-lg transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#183d2c]"
        >
          <span
            className="grid size-9 place-items-center rounded-full bg-[#183d2c] text-lg text-[#fbf8ef]"
            aria-hidden="true"
          >
            ☕
          </span>
          <div className="leading-tight">
            <p className="text-base font-bold tracking-tight text-[#183d2c]">BrewLite</p>
            <p className="hidden text-[10px] font-medium text-[#66736a] sm:block">
              Campus Artisan Coffee
            </p>
          </div>
        </Link>

        {/* ── Desktop nav ──────────────────────────────────── */}
        <nav aria-label="Điều hướng chính" className="hidden items-center gap-0.5 md:flex">
          {NAV_LINKS.map(({ href, label, hasCart }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={[
                  "relative rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-[#e9f0e9] font-semibold text-[#183d2c]"
                    : "text-[#4a6155] hover:bg-[#eef2ec] hover:text-[#183d2c]",
                ].join(" ")}
              >
                {label}
                {hasCart && totalItems > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-[#183d2c] text-[9px] font-bold text-white">
                    {totalItems > 9 ? "9+" : totalItems}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* ── Auth ─────────────────────────────────────────── */}
        <div className="flex items-center gap-2.5">
          {user?.role === "BARISTA" && (
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