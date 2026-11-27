"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/auth-store";
import { api, getAccessToken, saveSession } from "@/lib/api";

// Chức năng: Component giao diện AccountPage. Cách hoạt động: Quản lý trạng thái hiển thị bằng React hooks và render cấu trúc JSX tương ứng.
export default function AccountPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const hydrate = useAuthStore((s) => s.hydrate);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    hydrate();
    setMounted(true);
    const token = getAccessToken();
    if (token) {
      api<any>("/auth/me")
        .then((fresh) => {
          if (fresh && typeof fresh.loyaltyPoints === "number") {
            saveSession(token, fresh);
            useAuthStore.getState().setSession(token, fresh);
          }
        })
        .catch(() => {});
    }
  }, [hydrate]);

  if (!mounted) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-6 text-sm text-[#66736a]">
        Đang tải thông tin tài khoản...
      </div>
    );
  }

  // Chức năng: Xử lý tính toán / định dạng dữ liệu (formatCurrency). Cách hoạt động: Biến đổi tham số đầu vào (amount) thành kết quả chuẩn để hiển thị hoặc tính toán.
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(amount);
  };

  const points = user?.loyaltyPoints ?? 0;

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-5 max-w-5xl mx-auto flex flex-col gap-6">
      {/* ── Tiêu đề trang ── */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-[#183d2c]">Tài khoản</h1>
        {user && (
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
            Thành viên thân thiết
          </span>
        )}
      </div>

      {user ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          {/* Cột trái: Thông tin cá nhân & Thẻ điểm thưởng */}
          <div className="space-y-6">
            {/* ── Thẻ thông tin cá nhân ── */}
            <div className="flex items-center gap-3.5 rounded-2xl bg-white p-4 border border-[#e5e7dc] shadow-sm">
              <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-[#183d2c] text-xl font-bold text-white shadow-inner">
                {user.fullName ? user.fullName.charAt(0).toUpperCase() : "U"}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-base font-bold text-[#183d2c]">{user.fullName}</p>
                  {(user.role === "BARISTA" || user.role === "MANAGER") && (
                    <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                      {user.role === "MANAGER" ? "Manager" : "Barista"}
                    </span>
                  )}
                </div>
                <p className="truncate text-xs text-[#66736a]">{user.email}</p>
              </div>
            </div>

            {/* ── Thẻ điểm thưởng Loyalty Card ── */}
            <div
              className="relative overflow-hidden rounded-2xl p-5 text-white shadow-md"
              style={{ background: "linear-gradient(135deg, #183d2c 0%, #295c43 100%)" }}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wider text-emerald-200">
                  BrewLite Rewards
                </span>
                <span className="text-lg">☕</span>
              </div>
              <div className="mt-4">
                <p className="text-xs text-emerald-100/80">Điểm thưởng tích lũy</p>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold tracking-tight">{points.toLocaleString("vi-VN")}</span>
                  <span className="text-xs text-emerald-200 font-medium">điểm</span>
                </div>
                <p className="mt-2 text-[11px] text-emerald-100/70">
                  Quy đổi tương đương: <span className="font-semibold text-white">{formatCurrency(points * 1000)}</span> trừ vào đơn hàng.
                </p>
              </div>
            </div>
          </div>

          {/* Cột phải: Danh mục liên kết nhanh & Đăng xuất */}
          <div className="space-y-6">
            <div className="rounded-2xl bg-white border border-[#e5e7dc] overflow-hidden shadow-sm divide-y divide-[#f0f2eb]">
              {(user.role === "BARISTA" || user.role === "MANAGER") && (
                <Link
                  href="/barista"
                  className="flex items-center justify-between p-4 hover:bg-[#fbfbf9] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex size-9 items-center justify-center rounded-xl bg-amber-100 text-base text-amber-800">
                      👨‍🍳
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-[#183d2c]">Màn hình Barista</p>
                      <p className="text-xs text-[#66736a]">Nhận và cập nhật trạng thái chế biến</p>
                    </div>
                  </div>
                  <span className="text-neutral-400">›</span>
                </Link>
              )}

              <Link
                href="/orders"
                className="flex items-center justify-between p-4 hover:bg-[#fbfbf9] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="flex size-9 items-center justify-center rounded-xl bg-emerald-100 text-base text-emerald-800">
                    📋
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-[#183d2c]">Lịch sử đơn hàng</p>
                    <p className="text-xs text-[#66736a]">Xem trạng thái đơn đang pha chế và đơn cũ</p>
                  </div>
                </div>
                <span className="text-neutral-400">›</span>
              </Link>

              <Link
                href="/cart"
                className="flex items-center justify-between p-4 hover:bg-[#fbfbf9] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="flex size-9 items-center justify-center rounded-xl bg-blue-100 text-base text-blue-800">
                    🛒
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-[#183d2c]">Giỏ hàng của bạn</p>
                    <p className="text-xs text-[#66736a]">Kiểm tra món và thanh toán</p>
                  </div>
                </div>
                <span className="text-neutral-400">›</span>
              </Link>

              <Link
                href="/menu"
                className="flex items-center justify-between p-4 hover:bg-[#fbfbf9] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="flex size-9 items-center justify-center rounded-xl bg-amber-100 text-base text-amber-800">
                    ☕
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-[#183d2c]">Thực đơn quán</p>
                    <p className="text-xs text-[#66736a]">Khám phá cà phê, trà và bánh</p>
                  </div>
                </div>
                <span className="text-neutral-400">›</span>
              </Link>
            </div>

            {/* ── Nút đăng xuất ── */}
            <button
              type="button"
              onClick={() => {
                signOut();
                router.push("/menu");
              }}
              className="w-full flex items-center justify-center gap-2 rounded-2xl border border-red-200 bg-white p-3.5 text-sm font-bold text-red-600 hover:bg-red-50 transition active:scale-[0.99] shadow-xs cursor-pointer"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="size-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75" />
              </svg>
              Đăng xuất
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl bg-white p-6 border border-[#e5e7dc] text-center shadow-sm">
            <span className="inline-block text-4xl mb-3">☕</span>
            <h2 className="text-lg font-bold text-[#183d2c]">Chào mừng đến với BrewLite</h2>
            <p className="mt-1.5 text-xs text-[#66736a] leading-relaxed">
              Đăng nhập để tích luỹ điểm thưởng đổi cà phê miễn phí, theo dõi tiến trình đơn hàng và nhận ưu đãi độc quyền.
            </p>
            <div className="mt-5 flex flex-col gap-2.5">
              <Link
                href="/login?next=/account"
                className="w-full flex items-center justify-center rounded-xl bg-[#183d2c] py-3 text-sm font-bold text-white shadow-sm hover:bg-[#24563e] active:scale-[0.99]"
              >
                Đăng nhập
              </Link>
              <Link
                href="/register?next=/account"
                className="w-full flex items-center justify-center rounded-xl border border-[#183d2c] bg-white py-3 text-sm font-bold text-[#183d2c] hover:bg-[#f0f4ee] active:scale-[0.99]"
              >
                Đăng ký tài khoản
              </Link>
            </div>
          </div>

          {/* Quyền lợi thành viên */}
          <div className="rounded-2xl bg-[#eef3ec] p-4">
            <p className="text-xs font-bold text-[#183d2c] uppercase tracking-wider mb-2">Quyền lợi thành viên</p>
            <ul className="space-y-2 text-xs text-[#425a4c]">
              <li className="flex items-center gap-2">
                <span>⭐</span> Tích 1 điểm cho mỗi 1.000đ chi tiêu
              </li>
              <li className="flex items-center gap-2">
                <span>🎁</span> Đổi điểm trực tiếp khi thanh toán đơn mới
              </li>
              <li className="flex items-center gap-2">
                <span>⚡</span> Theo dõi thời gian Barista pha chế theo thời gian thực
              </li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
