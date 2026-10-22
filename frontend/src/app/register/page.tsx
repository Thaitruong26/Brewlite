"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { register } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { LoadingState } from "@/components/ui/loading-state";
import type { User } from "@/lib/api/types";

export default function RegisterPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ fullName?: string; email?: string; password?: string }>({});
  const [formError, setFormError] = useState("");
  const [createdUser, setCreatedUser] = useState<User | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors: typeof errors = {};
    const trimmedName = fullName.trim();
    if (trimmedName.length < 2 || trimmedName.length > 100) nextErrors.fullName = "Họ tên cần có từ 2 đến 100 ký tự.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || email.trim().length > 150) nextErrors.email = "Vui lòng nhập email hợp lệ (tối đa 150 ký tự).";
    if (password.length < 8 || password.length > 64 || !/[A-Za-zÀ-ỹ]/.test(password) || !/\d/.test(password)) nextErrors.password = "Mật khẩu cần có 8–64 ký tự, gồm ít nhất một chữ cái và một chữ số.";
    setErrors(nextErrors);
    setFormError("");
    if (Object.keys(nextErrors).length) return;

    setSubmitting(true);
    try {
      const user = await register({ fullName: trimmedName, email: email.trim(), password });
      setCreatedUser(user);
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : "Không thể tạo tài khoản lúc này. Vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  }

  if (createdUser) return <section className="mx-auto flex min-h-[calc(100vh-140px)] max-w-xl items-center px-5 py-10"><div role="status" className="w-full rounded-[2rem] border border-[#dbe5d9] bg-white p-8 text-center shadow-sm sm:p-12"><span className="mx-auto grid size-14 place-items-center rounded-full bg-[#e9f0e9] text-2xl text-[#24563e]" aria-hidden="true">✓</span><h1 className="mt-5 text-3xl font-semibold text-[#183d2c]">Tài khoản đã sẵn sàng</h1><p className="mt-3 leading-7 text-[#66736a]">Chào mừng, {createdUser.fullName}. Bạn có thể đăng nhập bằng email đã đăng ký.</p><Link href="/login" className="mt-7 inline-flex min-h-12 items-center justify-center rounded-full bg-[#183d2c] px-7 font-semibold text-white hover:bg-[#24563e]">Đến đăng nhập</Link></div></section>;

  return <section className="mx-auto grid min-h-[calc(100vh-140px)] max-w-6xl items-center gap-10 px-5 py-10 md:grid-cols-2 md:px-10">
    <div className="hidden rounded-[2rem] bg-[#e9f0e9] p-10 md:block"><p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-800">Góc nhỏ của riêng bạn</p><h1 className="mt-5 text-4xl font-semibold leading-tight text-[#183d2c]">Bắt đầu ngày mới với điều bạn yêu thích.</h1><p className="mt-4 leading-7 text-[#66736a]">Tạo tài khoản BrewLite để đồng hành cùng những hương vị quen thuộc.</p></div>
    <div className="mx-auto w-full max-w-md">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-800">Tài khoản BrewLite</p><h2 className="mt-3 text-3xl font-semibold text-[#183d2c]">Tạo tài khoản</h2><p className="mt-2 text-sm text-[#66736a]">Điền thông tin cơ bản để đăng ký.</p>
      {formError && <div role="alert" className="mt-5 rounded-xl border border-[#e8c5b5] bg-[#fff8f3] px-4 py-3 text-sm text-[#713d2a]">{formError}</div>}
      <form onSubmit={handleSubmit} noValidate className="mt-7 space-y-4">
        <div><label htmlFor="fullName" className="mb-2 block text-sm font-semibold text-[#344b3c]">Họ và tên</label><input id="fullName" name="fullName" autoComplete="name" value={fullName} onChange={(event) => setFullName(event.target.value)} aria-invalid={!!errors.fullName} className="w-full rounded-xl border border-[#d9e0d7] bg-white px-4 py-3 outline-none focus:border-[#5a8066] focus:ring-2 focus:ring-[#d6e5d8]" placeholder="Nguyễn Văn An" />{errors.fullName && <p className="mt-1.5 text-sm text-[#a1452d]">{errors.fullName}</p>}</div>
        <div><label htmlFor="email" className="mb-2 block text-sm font-semibold text-[#344b3c]">Email</label><input id="email" name="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} aria-invalid={!!errors.email} className="w-full rounded-xl border border-[#d9e0d7] bg-white px-4 py-3 outline-none focus:border-[#5a8066] focus:ring-2 focus:ring-[#d6e5d8]" placeholder="ban@email.com" />{errors.email && <p className="mt-1.5 text-sm text-[#a1452d]">{errors.email}</p>}</div>
        <div><label htmlFor="password" className="mb-2 block text-sm font-semibold text-[#344b3c]">Mật khẩu</label><input id="password" name="password" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} aria-invalid={!!errors.password} className="w-full rounded-xl border border-[#d9e0d7] bg-white px-4 py-3 outline-none focus:border-[#5a8066] focus:ring-2 focus:ring-[#d6e5d8]" placeholder="8–64 ký tự, có chữ và số" />{errors.password && <p className="mt-1.5 text-sm text-[#a1452d]">{errors.password}</p>}</div>
        <button type="submit" disabled={submitting} className="flex min-h-12 w-full items-center justify-center rounded-full bg-[#183d2c] px-5 font-semibold text-white transition hover:bg-[#24563e] disabled:cursor-wait disabled:opacity-70">{submitting ? "Đang tạo tài khoản..." : "Đăng ký"}</button>
      </form>
      {submitting && <LoadingState label="Đang tạo tài khoản..." />}
      <p className="mt-6 text-center text-sm text-[#66736a]">Đã có tài khoản? <Link href="/login" className="font-semibold text-[#24563e] underline underline-offset-4">Đăng nhập</Link></p>
    </div>
  </section>;
}
