"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { login } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { useAuthStore } from "@/store/auth-store";
import { LoadingState } from "@/components/ui/loading-state";

// Chức năng: Component giao diện LoginPage. Cách hoạt động: Quản lý trạng thái hiển thị bằng React hooks và render cấu trúc JSX tương ứng.
export default function LoginPage() {
  const router = useRouter();
  const setSession = useAuthStore((state) => state.setSession);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Chức năng: Xử lý sự kiện Submit. Cách hoạt động: Nhận sự kiện từ giao diện, cập nhật state hoặc gọi API xử lý nghiệp vụ tương ứng.
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors: typeof errors = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) nextErrors.email = "Vui lòng nhập địa chỉ email hợp lệ.";
    if (password.length < 6) nextErrors.password = "Mật khẩu cần có ít nhất 6 ký tự.";
    setErrors(nextErrors);
    setFormError("");
    if (Object.keys(nextErrors).length) return;

    setSubmitting(true);
    try {
      const result = await login(email.trim(), password);
      const token = result.accessToken || (result as unknown as { access_token?: string }).access_token || "";
      setSession(token, result.user);
      const params = new URLSearchParams(window.location.search);
      const requestedPath = params.get("next") || params.get("redirect");
      let destination = requestedPath?.startsWith("/") && !requestedPath.startsWith("//") ? requestedPath : "/menu";
      if ((result.user.role === "BARISTA" || result.user.role === "MANAGER") && (!requestedPath || requestedPath === "/menu")) {
        destination = "/barista";
      }
      router.replace(destination);
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : "Không thể đăng nhập lúc này. Vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  }

  // Chức năng: Hàm fillBarista. Cách hoạt động: Thực thi logic xử lý nghiệp vụ của module và trả về kết quả cho nơi gọi.
  function fillBarista() {
    setEmail("barista@brewlite.com");
    setPassword("Barista@123");
    setErrors({});
    setFormError("");
  }

  // Chức năng: Hàm fillCustomer. Cách hoạt động: Thực thi logic xử lý nghiệp vụ của module và trả về kết quả cho nơi gọi.
  function fillCustomer() {
    setEmail("demo@brewlite.com");
    setPassword("Demo@1234");
    setErrors({});
    setFormError("");
  }

  return <section className="w-full px-4 py-6 flex flex-col gap-6">
    <div className="w-full">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-800">Tài khoản BrewLite</p>
      <h2 className="mt-3 text-3xl font-semibold text-[#183d2c]">Đăng nhập</h2>
      <p className="mt-2 text-sm text-[#66736a]">Nhập thông tin tài khoản của bạn để tiếp tục.</p>
      {formError && <div role="alert" className="mt-5 rounded-xl border border-[#e8c5b5] bg-[#fff8f3] px-4 py-3 text-sm text-[#713d2a]">{formError}</div>}
      
      {/* Quick login demo accounts */}
      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        <span className="text-stone-500 py-1">Tài khoản mẫu:</span>
        <button type="button" onClick={fillCustomer} className="rounded-lg bg-stone-100 px-2.5 py-1 font-medium text-stone-800 hover:bg-stone-200 cursor-pointer">
          👤 Khách hàng
        </button>
        <button type="button" onClick={fillBarista} className="rounded-lg bg-emerald-100 px-2.5 py-1 font-medium text-emerald-800 hover:bg-emerald-200 cursor-pointer">
          ☕ Barista
        </button>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label className="block text-sm font-semibold text-[#183d2c]">Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-2 w-full rounded-xl border border-[#d6ddd6] px-4 py-3 text-sm outline-none focus:border-emerald-700" placeholder="customer@brewlite.com" required />
          {errors.email && <p className="mt-1 text-xs text-[#b94a2f]">{errors.email}</p>}
        </div>
        <div>
          <label className="block text-sm font-semibold text-[#183d2c]">Mật khẩu</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-2 w-full rounded-xl border border-[#d6ddd6] px-4 py-3 text-sm outline-none focus:border-emerald-700" placeholder="••••••••" required />
          {errors.password && <p className="mt-1 text-xs text-[#b94a2f]">{errors.password}</p>}
        </div>
        <button type="submit" disabled={submitting} className="w-full rounded-xl bg-[#183d2c] py-3.5 text-sm font-semibold text-white transition hover:bg-[#122e21] disabled:opacity-60 cursor-pointer">
          {submitting ? "Đang xử lý..." : "Đăng nhập"}
        </button>
      </form>
      <div className="mt-8 border-t border-[#e2e8e2] pt-6 text-sm text-[#66736a]">
        Chưa có tài khoản? <Link href="/register" className="font-semibold text-[#183d2c] hover:underline">Đăng ký ngay</Link>
      </div>
    </div>
  </section>;
}
