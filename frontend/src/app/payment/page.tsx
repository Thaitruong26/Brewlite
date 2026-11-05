"use client";

import React, { Suspense, useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ApiError, cancelOrderApi, formatVND, getOrderByIdApi } from "@/lib/api";
import { OrderResponse } from "@/types/order";

function PaymentContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId");

  const [order, setOrder] = useState<OrderResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [timeLeft, setTimeLeft] = useState<number>(15 * 60);
  const [isCancelling, setIsCancelling] = useState<boolean>(false);
  const [isSuccessRedirecting, setIsSuccessRedirecting] = useState<boolean>(false);

  // 1. Tải thông tin đơn hàng lần đầu
  const fetchOrder = useCallback(async () => {
    if (!orderId) {
      setError("Thiếu mã đơn hàng hợp lệ.");
      setIsLoading(false);
      return;
    }

    try {
      const data = await getOrderByIdApi(orderId);
      setOrder(data);
      setError(null);

      // Nếu đơn đã PAID sẵn rồi, chuyển luôn sang trang chờ lấy nước
      if (data.status === "PAID") {
        setIsSuccessRedirecting(true);
        setTimeout(() => {
          router.push(`/orders/${data.id}`);
        }, 1000);
      }
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Không thể tải thông tin đơn hàng."
      );
    } finally {
      setIsLoading(false);
    }
  }, [orderId, router]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  // 2. Đồng hồ đếm ngược 15 phút (tính từ thời điểm order.createdAt)
  useEffect(() => {
    if (!order || order.status !== "PENDING") return;

    const createdAtMs = new Date(order.createdAt).getTime();
    const expireTimeMs = createdAtMs + 15 * 60 * 1000;

    const timer = setInterval(() => {
      const now = Date.now();
      const remainingSec = Math.max(0, Math.floor((expireTimeMs - now) / 1000));
      setTimeLeft(remainingSec);

      // Quá 15 phút mà khách chưa chuyển tiền -> Tự động hủy đơn hàng
      if (remainingSec <= 0) {
        clearInterval(timer);
        void handleAutoCancel();
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [order]);

  // 3. Tự động thăm dò (Polling mỗi 2 giây) để phát hiện khi Barista bấm "Đã nhận tiền"
  useEffect(() => {
    if (!orderId || isSuccessRedirecting) return;

    let ignore = false;
    const pollInterval = setInterval(async () => {
      try {
        const data = await getOrderByIdApi(orderId);
        if (ignore) return;

        setOrder(data);

        // Barista đã bấm xác nhận tiền (đơn chuyển sang PAID)
        if (data.status === "PAID") {
          clearInterval(pollInterval);
          setIsSuccessRedirecting(true);
          setTimeout(() => {
            router.push(`/orders/${data.id}`);
          }, 1200);
        }
      } catch {
        // Bỏ qua lỗi mạng chớp nhoáng khi polling
      }
    }, 2000);

    return () => {
      ignore = true;
      clearInterval(pollInterval);
    };
  }, [orderId, isSuccessRedirecting, router]);

  // Xử lý tự động hủy đơn khi hết 15 phút
  const handleAutoCancel = async () => {
    if (!orderId) return;
    try {
      await cancelOrderApi(orderId);
      const updated = await getOrderByIdApi(orderId);
      setOrder(updated);
    } catch {
      // Bỏ qua nếu đơn đã hủy
    }
  };

  // Khách chủ động hủy đơn
  const handleManualCancel = async () => {
    if (!orderId || isCancelling) return;
    if (!confirm("Bạn có chắc chắn muốn hủy đơn hàng này không?")) return;

    setIsCancelling(true);
    try {
      await cancelOrderApi(orderId);
      const updated = await getOrderByIdApi(orderId);
      setOrder(updated);
    } catch (err: any) {
      alert(err?.message || "Không thể hủy đơn hàng.");
    } finally {
      setIsCancelling(false);
    }
  };

  const copyToClipboard = (text: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const formatCountdown = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center p-6">
        <div className="w-10 h-10 border-4 border-amber-800 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-sm font-medium text-stone-600">Đang chuẩn bị mã thanh toán QR...</p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-2xl border border-stone-200 p-8 text-center shadow-sm">
          <div className="text-4xl mb-3">⚠️</div>
          <h1 className="text-lg font-bold text-stone-900">Không tìm thấy đơn hàng</h1>
          <p className="text-sm text-stone-600 mt-2">{error || "Mã đơn hàng không hợp lệ."}</p>
          <div className="mt-6 flex flex-col gap-2">
            <Link
              href="/menu"
              className="w-full py-2.5 px-4 rounded-xl bg-amber-800 text-white text-sm font-semibold hover:bg-amber-900 transition-colors"
            >
              Quay lại Thực đơn
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const isExpired = timeLeft <= 0 || order.status === "CANCELLED";

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 flex flex-col">
      {/* Header */}
      <header className="border-b border-stone-200 bg-white/90 backdrop-blur sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold text-xl tracking-tight text-amber-900">
            <span className="text-2xl">☕</span>
            <span>BrewLite</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/menu" className="text-sm font-medium text-stone-600 hover:text-amber-800">
              Thực đơn
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-xl w-full mx-auto px-4 sm:px-6 py-8">
        <div className="bg-white rounded-3xl border border-stone-200 p-6 sm:p-8 shadow-sm text-center relative overflow-hidden">
          {/* Thông báo chuyển trang khi thành công */}
          {isSuccessRedirecting && (
            <div className="mb-5 p-4 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-900 flex items-center justify-center gap-2 text-sm font-bold animate-pulse">
              <span>✓</span>
              <span>Barista đã nhận tiền thành công! Đang chuyển tới quầy nhận nước...</span>
            </div>
          )}

          {/* Tiêu đề & Trạng thái */}
          <div className="flex items-center justify-center gap-2 mb-2">
            <span className="text-xl">📱</span>
            <h1 className="text-2xl font-bold text-amber-950">Thanh toán chuyển khoản MoMo</h1>
          </div>
          <p className="text-xs text-stone-500">
            Quét mã QR dưới đây từ ứng dụng MoMo hoặc Ngân hàng của bạn
          </p>

          {isExpired ? (
            <div className="my-8 p-6 rounded-2xl bg-red-50 border border-red-200 text-center space-y-3">
              <div className="text-4xl">⏱️</div>
              <h2 className="text-lg font-bold text-red-900">Đơn hàng đã hết hạn thanh toán</h2>
              <p className="text-xs text-red-700 max-w-sm mx-auto leading-relaxed">
                Đơn hàng <strong>#{order.id}</strong> đã quá thời hạn 15 phút mà chưa nhận được thanh toán nên đã được tự động đổi thành <strong>ĐÃ HỦY ĐƠN HÀNG</strong> và hoàn lại nguyên liệu vào kho.
              </p>
              <div className="pt-2">
                <Link
                  href="/menu"
                  className="inline-block px-5 py-2.5 rounded-xl bg-amber-800 text-white text-xs font-bold hover:bg-amber-900 transition-colors"
                >
                  Đặt lại đơn mới
                </Link>
              </div>
            </div>
          ) : (
            <>
              {/* Ảnh Mã QR MoMo */}
              <div className="my-5 flex flex-col items-center">
                <div className="p-3 bg-stone-50 rounded-2xl border-2 border-amber-200/80 shadow-xs">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/img/momo-qr.jpg"
                    alt="Mã QR Chuyển khoản MoMo BrewLite"
                    className="w-full max-w-[250px] aspect-square object-cover rounded-xl"
                  />
                </div>
                <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-900 text-xs font-semibold">
                  <span className="size-2 rounded-full bg-amber-600 animate-ping" />
                  <span>Đang chờ chuyển khoản · Đơn #{order.id}</span>
                </div>
              </div>

              {/* DÒNG NHẮN NHỎ THEO ĐÚNG YÊU CẦU: KHI CHUYỂN KHOẢN NHỚ KÈM MÃ ĐƠN HÀNG, MÃ QR HIỆN 15P */}
              <div className="my-5 rounded-2xl bg-[#fffcf5] border border-amber-200 p-4 text-left space-y-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-base">📌</span>
                  <p className="text-xs font-bold text-amber-900 uppercase tracking-wider">
                    Lưu ý bắt buộc khi chuyển khoản:
                  </p>
                </div>

                <div className="bg-white rounded-xl p-3 border border-amber-200/80 shadow-2xs flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] text-stone-500">Nội dung chuyển khoản (lời nhắn):</p>
                    <p className="font-mono text-base font-extrabold text-amber-950">
                      BREWLITE #{order.id}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(`BREWLITE #${order.id}`)}
                    className="px-3 py-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 text-xs font-bold transition cursor-pointer"
                  >
                    {copied ? "✓ Đã chép" : "Sao chép"}
                  </button>
                </div>

                <p className="text-xs text-amber-900 leading-relaxed">
                  Khi chuyển khoản nhớ kèm mã đơn hàng là{" "}
                  <strong className="underline text-amber-950 font-bold">#{order.id}</strong>.
                  Mã QR chỉ hiện <strong>15 phút</strong>, đơn sẽ trong trạng thái chờ. Nếu không chuyển sau 15 phút sẽ tự động đổi thành <strong>ĐÃ HỦY ĐƠN HÀNG</strong>.
                </p>
              </div>

              {/* Bảng chi tiết số tiền và thời gian */}
              <div className="rounded-2xl bg-stone-50 border border-stone-200 p-4 space-y-3 text-sm text-left">
                <div className="flex justify-between items-center">
                  <span className="text-stone-600">Số tiền thanh toán:</span>
                  <span className="text-xl font-black text-amber-900">
                    {formatVND(order.total)}
                  </span>
                </div>

                <div className="flex justify-between items-center pt-2 border-t border-stone-200/70">
                  <span className="text-stone-600">Thời gian còn lại:</span>
                  <span
                    className={`font-mono text-base font-bold ${
                      timeLeft < 180 ? "text-red-600 animate-pulse" : "text-amber-900"
                    }`}
                  >
                    ⏱ {formatCountdown(timeLeft)}
                  </span>
                </div>

                <div className="flex justify-between items-center pt-2 border-t border-stone-200/70">
                  <span className="text-stone-600">Trạng thái xác nhận:</span>
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-800 bg-amber-100/70 px-2.5 py-1 rounded-full">
                    <span className="w-2 h-2 rounded-full bg-amber-600 animate-ping" />
                    Chờ Barista nhận tiền...
                  </span>
                </div>
              </div>

              {/* Nút hủy đơn hàng chủ động */}
              <div className="mt-6 pt-4 border-t border-stone-100 flex items-center justify-between gap-3 text-xs">
                <span className="text-stone-500 text-left">
                  Đổi ý không mua nữa?
                </span>
                <button
                  type="button"
                  disabled={isCancelling}
                  onClick={handleManualCancel}
                  className="px-3.5 py-2 rounded-xl border border-red-200 text-red-700 hover:bg-red-50 font-semibold transition cursor-pointer disabled:opacity-50"
                >
                  {isCancelling ? "Đang hủy đơn..." : "✕ Hủy đơn hàng này"}
                </button>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

export default function PaymentPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-stone-50 flex items-center justify-center p-6">
          <div className="w-10 h-10 border-4 border-amber-800 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <PaymentContent />
    </Suspense>
  );
}

