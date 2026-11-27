"use client";

import React, { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { formatVND, verifyVnpayCallbackApi } from "@/lib/api";

function VnpayReturnContent() {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<{
    isSuccess: boolean;
    orderId: number;
    amount: number;
    responseCode: string;
    message: string;
    transactionNo?: string;
  } | null>(null);

  useEffect(() => {
    const params: Record<string, string> = {};
    searchParams.forEach((value, key) => {
      params[key] = value;
    });

    if (Object.keys(params).length === 0) {
      setLoading(false);
      setResult({
        isSuccess: false,
        orderId: 0,
        amount: 0,
        responseCode: "99",
        message: "Không tìm thấy thông tin phản hồi từ cổng VNPay.",
      });
      return;
    }

    verifyVnpayCallbackApi(params)
      .then((res) => {
        setResult(res);
      })
      .catch((err) => {
        setResult({
          isSuccess: false,
          orderId: 0,
          amount: 0,
          responseCode: "99",
          message: err?.message || "Lỗi kiểm tra chữ ký xác thực VNPay.",
        });
      })
      .finally(() => {
        setLoading(false);
      });
  }, [searchParams]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center">
        <div className="size-12 animate-spin rounded-full border-4 border-[#183d2c] border-t-transparent" />
        <h2 className="mt-4 text-base font-bold text-[#183d2c]">
          Đang xác thực giao dịch VNPay...
        </h2>
        <p className="mt-1 text-xs text-[#66736a]">
          Vui lòng đợi giây lát, hệ thống đang đối soát chữ ký bảo mật với máy chủ VNPay Sandbox.
        </p>
      </div>
    );
  }

  const isSuccess = Boolean(result?.isSuccess);

  return (
    <div className="w-full px-4 py-8">
      <div className="rounded-3xl border border-[#e5e7dc] bg-white p-6 text-center shadow-md">
        {isSuccess ? (
          <>
            {/* Icon thành công */}
            <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-emerald-100 text-3xl text-emerald-600 shadow-inner">
              ✓
            </div>
            <span className="mt-4 inline-block rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800">
              VNPay Sandbox 2.1.0
            </span>
            <h1 className="mt-2 text-2xl font-extrabold text-[#183d2c]">
              Thanh toán thành công!
            </h1>
            <p className="mt-1 text-xs text-[#66736a]">
              Đơn hàng của bạn đã được thanh toán và chuyển thẳng vào hàng đợi pha chế.
            </p>

            {/* Bảng chi tiết hóa đơn */}
            <div className="mt-6 space-y-2.5 rounded-2xl bg-[#fbfbf9] p-4 text-left text-xs border border-[#f0f2eb]">
              <div className="flex justify-between">
                <span className="text-[#66736a]">Mã đơn hàng:</span>
                <span className="font-bold text-[#183d2c]">#{result?.orderId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#66736a]">Số tiền thanh toán:</span>
                <span className="font-bold text-emerald-700">
                  {formatVND(result?.amount ?? 0)}
                </span>
              </div>
              {result?.transactionNo && (
                <div className="flex justify-between">
                  <span className="text-[#66736a]">Mã GD VNPay:</span>
                  <span className="font-mono text-neutral-800">{result.transactionNo}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-[#66736a]">Trạng thái:</span>
                <span className="font-semibold text-emerald-600">Đã thanh toán (PAID)</span>
              </div>
            </div>

            {/* Nút hành động */}
            <div className="mt-6 flex flex-col gap-2.5">
              <Link
                href={`/orders/${result?.orderId}`}
                className="w-full rounded-2xl bg-[#183d2c] py-3.5 text-center text-sm font-bold text-white shadow-md hover:bg-[#24563e] active:scale-[0.99] transition"
              >
                Theo dõi tiến trình đơn hàng
              </Link>
              <Link
                href="/menu"
                className="w-full rounded-2xl border border-[#e5e7dc] bg-white py-3 text-center text-xs font-semibold text-[#66736a] hover:bg-[#f9faf7] transition"
              >
                Tiếp tục xem thực đơn
              </Link>
            </div>
          </>
        ) : (
          <>
            {/* Icon thất bại / hủy */}
            <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-red-100 text-3xl text-red-600 shadow-inner">
              ✕
            </div>
            <span className="mt-4 inline-block rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-800">
              Giao dịch chưa hoàn tất
            </span>
            <h1 className="mt-2 text-2xl font-extrabold text-red-700">
              Thanh toán không thành công
            </h1>
            <p className="mt-1.5 text-xs text-[#66736a] leading-relaxed">
              {result?.message || "Giao dịch đã bị gián đoạn hoặc bị hủy bởi người dùng."}
            </p>

            {result?.orderId ? (
              <div className="mt-5 rounded-2xl bg-amber-50 p-3.5 text-xs text-amber-900 border border-amber-200">
                Đơn hàng <strong>#{result.orderId}</strong> của bạn vẫn được lưu ở trạng thái chờ. Bạn có thể thử thanh toán lại bất kỳ lúc nào.
              </div>
            ) : null}

            {/* Nút hành động */}
            <div className="mt-6 flex flex-col gap-2.5">
              <Link
                href="/checkout"
                className="w-full rounded-2xl bg-[#183d2c] py-3.5 text-center text-sm font-bold text-white shadow-md hover:bg-[#24563e] active:scale-[0.99] transition"
              >
                Thử lại thanh toán
              </Link>
              <Link
                href="/orders"
                className="w-full rounded-2xl border border-[#e5e7dc] bg-white py-3 text-center text-xs font-semibold text-[#66736a] hover:bg-[#f9faf7] transition"
              >
                Xem danh sách đơn hàng
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function VnpayReturnPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center p-6 text-sm text-[#66736a]">
          Đang tải dữ liệu phản hồi...
        </div>
      }
    >
      <VnpayReturnContent />
    </Suspense>
  );
}

