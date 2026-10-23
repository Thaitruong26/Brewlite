"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { useAuthStore } from "@/store/auth-store";
import { useCartStore, selectTotalItems } from "@/store/cart-store";

const NAV_LINKS = [
  { href: "/menu",   label: "Thực đơn" },
  { href: "/cart",   label: "Giỏ hàng", hasCart: true },
  { href: "/orders", label: "Lịch sử" },
];

/**
 * SiteHeader — Client Component (cần usePathname, useAuthStore, useCartStore).
 * Tất cả màu sắc dùng Tailwind utility classes để đảm bảo tương phản cao
 * và không bị override bởi CSS base rules.
 */
export function SiteHeader() {
  const user    = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const hydrate = useAuthStore((s) => s.hydrate);
  const totalItems = useCartStore(selectTotalItems);
  const pathname   = usePathname();

  useEffect(() => { hydrate(); }, [hydrate]);

  return (
    <header className="sticky top-0 z-30 border-b border-[#315744] bg-[#183d2c] text-[#fbf8ef]">
      <div className="mx-auto grid h-[68px] max-w-7xl grid-cols-[1fr_auto] items-center px-4 sm:px-8 md:grid-cols-[1fr_auto_1fr] md:px-10">
        <Link
          href="/"
          aria-label="BrewLite — Trang chủ"
          className="flex w-fit items-center gap-2.5 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#d2e6d2]"
        >
          <Image src="/img/brewlite-mark.svg" alt="" width={38} height={38} unoptimized priority />
          <div className="leading-tight">
            <p className="text-base font-bold tracking-tight text-[#fffdf6]">BrewLite</p>
            <p className="hidden text-[10px] font-medium text-[#d4e1d6] sm:block">Campus Artisan Coffee</p>
          </div>
        </Link>

        <nav aria-label="Điều hướng chính" className="hidden h-full items-center gap-1 md:flex">
          {NAV_LINKS.map(({ href, label, hasCart }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={[
                  "relative flex h-full items-center px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-5px] focus-visible:outline-[#d2e6d2]",
                  active
                    ? "font-semibold text-[#d2e6d2]"
                    : "text-[#f6f3e8]/90 hover:text-white",
                ].join(" ")}
                aria-current={active ? "page" : undefined}
              >
                {label}
                {active && <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-[#b9ddb9]" aria-hidden="true" />}
                {hasCart && totalItems > 0 && (
                  <span className="absolute right-0 top-2 flex size-4 items-center justify-center rounded-full bg-[#fbf8ef] text-[9px] font-bold text-[#183d2c]">
                    {totalItems > 9 ? "9+" : totalItems}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="col-start-2 flex items-center justify-end gap-2 md:col-start-3">
          {user ? (
            <div className="flex items-center gap-2">
              <span className="hidden text-sm font-medium text-[#f6f3e8] sm:block">
                {user.fullName.split(" ").pop()}
              </span>
              <button
                onClick={signOut}
                className="flex size-9 items-center justify-center rounded-full bg-[#fbf8ef] text-sm font-bold text-[#183d2c] transition-colors hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d2e6d2]"
                aria-label="Đăng xuất"
                title={`Đăng xuất (${user.email})`}
              >
                {user.fullName.charAt(0).toUpperCase()}
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="rounded-full bg-[#fbf8ef] px-5 py-2 text-sm font-semibold text-[#183d2c] shadow-sm transition-colors hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d2e6d2]"
              style={{ color: "#183d2c" }}
            >
              Đăng nhập
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
