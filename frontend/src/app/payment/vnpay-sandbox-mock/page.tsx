"use client";

import React, { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { formatVND, getOrderByIdApi, simulateVnpayCompleteApi } from "@/lib/api";

type Step = "SELECT_METHOD" | "NCB_CARD" | "NCB_OTP" | "QR_CODE";

function VnpayMockContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const txnRef = searchParams.get("vnp_TxnRef") || "";
  const orderId = parseInt(txnRef.split("_")[0] || "0", 10);
  const rawAmount = parseInt(searchParams.get("vnp_Amount") || "0", 10);
  const amount = rawAmount > 0 ? rawAmount / 100 : 0;

  const [step, setStep] = useState<Step>("SELECT_METHOD");
  const [cardNumber, setCardNumber] = useState("9704198526191432198");
  const [cardHolder, setCardHolder] = useState("NGUYEN VAN A");
  const [issueDate, setIssueDate] = useState("07/15");
  const [otp, setOtp] = useState("123456");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isWaitingBarista, setIsWaitingBarista] = useState(false);
  const [isConfirmedPaid, setIsConfirmedPaid] = useState(false);
  const [confirmedMessage, setConfirmedMessage] = useState("");

  // Tự động Polling kiểm tra trạng thái đơn:
  // CHỈ KHI Barista bấm "Xác nhận đã nhận tiền (PAID)" trên màn hình Barista (/barista)
  // thì mới cho phép chuyển trang hoàn tất!
  useEffect(() => {
    if (!orderId || isConfirmedPaid) return;

    let ignore = false;
    const pollInterval = setInterval(async () => {
      try {
        const data = await getOrderByIdApi(orderId);
        if (ignore) return;

        if (
          data &&
          (data.status === "PAID" ||
            data.status === "PREPARING" ||
            data.status === "READY" ||
            data.status === "COMPLETED")
        ) {
          clearInterval(pollInterval);
          setIsConfirmedPaid(true);
          setConfirmedMessage(
            `Quầy Barista đã xác nhận nhận đủ ${formatVND(amount)} cho đơn #${orderId}!`
          );

          try {
            const { query } = await simulateVnpayCompleteApi(
              orderId,
              txnRef,
              rawAmount,
              "00"
            );
            setTimeout(() => {
              router.push(`/payment/vnpay-return?${query}`);
            }, 1200);
          } catch {
            setTimeout(() => {
              router.push(`/orders/${orderId}`);
            }, 1200);
          }
        }
      } catch {
        // Bỏ qua lỗi tạm thời khi polling
      }
    }, 2000);

    return () => {
      ignore = true;
      clearInterval(pollInterval);
    };
  }, [orderId, isConfirmedPaid, txnRef, rawAmount, amount, router]);

  const handlePay = async (responseCode: string = "00") => {
    if (responseCode !== "00") {
      setIsProcessing(true);
      try {
        const { query } = await simulateVnpayCompleteApi(
          orderId,
          txnRef,
          rawAmount,
          responseCode
        );
        router.push(`/payment/vnpay-return?${query}`);
      } catch {
        router.push(
          `/payment/vnpay-return?vnp_ResponseCode=${responseCode}&vnp_TxnRef=${txnRef}&vnp_Amount=${rawAmount}`
        );
      } finally {
        setIsProcessing(false);
      }
      return;
    }

    // Chuyển sang màn hình chờ Barista đối soát và bấm xác nhận
    setIsWaitingBarista(true);
  };

  return (
    <div className="min-h-screen bg-[#f3f4f6] flex flex-col items-center justify-center p-3 sm:p-6 text-stone-800 font-sans">
      {/* ── Main VNPAY Card ── */}
      <div className="w-full max-w-[540px] bg-white rounded-2xl shadow-xl border border-stone-200 overflow-hidden flex flex-col">
        {/* Top Header Bar */}
        <div className="px-5 py-3.5 border-b border-stone-100 flex items-center justify-between text-xs text-stone-600">
          <button
            type="button"
            onClick={() => {
              if (step === "SELECT_METHOD") {
                router.push("/checkout");
              } else {
                setStep("SELECT_METHOD");
              }
            }}
            className="flex items-center gap-1.5 hover:text-stone-900 transition font-medium cursor-pointer"
          >
            <span>‹</span>
            <span>Quay lại</span>
          </button>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-stone-700">
            <span className="text-sm">🇻🇳</span>
            <span>Vi</span>
          </div>
        </div>

        {/* Logos Header */}
        <div className="pt-5 pb-4 px-6 flex items-center justify-center gap-4 border-b border-stone-50">
          <div className="flex items-center gap-2">
            <span className="text-xl font-black tracking-tight text-[#ff007a]">Vikki</span>
            <span className="text-stone-300 font-light">|</span>
            <div className="flex items-center gap-1.5">
              <div className="flex flex-col">
                <span className="text-[8px] font-black tracking-widest text-[#005ba6] uppercase leading-none">CỔNG THANH TOÁN</span>
                <span className="text-base font-black tracking-tight text-[#ed1c24] leading-none">VNPAY<span className="text-[#005ba6] text-xs align-super">QR</span></span>
              </div>
            </div>
          </div>
        </div>

        {/* Order Info Strip */}
        <div className="bg-[#f8fafc] px-6 py-2.5 border-b border-stone-100 flex items-center justify-between text-xs">
          <span className="text-stone-500">Đơn hàng #{orderId}</span>
          <span className="font-extrabold text-[#005ba6] text-sm">{formatVND(amount)}</span>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 flex-1">
          {/* Banner xác nhận nhận được tiền mới chuyển trang */}
          {isConfirmedPaid && (
            <div className="mb-4 p-4 rounded-xl bg-emerald-50 border-2 border-emerald-500 text-center text-xs font-bold text-emerald-950 space-y-1 animate-pulse">
              <p className="text-sm font-black">✓ ĐÃ XÁC NHẬN NHẬN ĐƯỢC TIỀN THÀNH CÔNG!</p>
              <p className="text-emerald-800">{confirmedMessage}</p>
              <p className="text-[10px] text-emerald-700">Đang chuyển trang cho quý khách...</p>
            </div>
          )}

          {isWaitingBarista ? (
            <div className="py-6 px-2 text-center space-y-4 animate-in fade-in duration-200">
              <div className="size-14 mx-auto rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-2xl shadow-inner">
                ⏳
              </div>
              <div className="space-y-1">
                <h2 className="text-base font-black text-stone-900 uppercase tracking-tight">
                  Đang chờ Barista xác nhận tiền
                </h2>
                <p className="text-xs text-stone-600 max-w-sm mx-auto leading-relaxed">
                  Yêu cầu thanh toán đơn hàng <strong>#{orderId}</strong> ({formatVND(amount)}) đã được gửi đến quầy Barista.
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-amber-50/90 border border-amber-200 text-left space-y-2 text-xs">
                <div className="flex items-center gap-2 text-amber-900 font-bold">
                  <span className="size-2 rounded-full bg-amber-500 animate-ping" />
                  <span>Trạng thái: Đang chờ Barista đối soát và bấm nhận tiền...</span>
                </div>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  📌 <strong>Quy định:</strong> Để tránh thất thoát, nhân viên Barista cần kiểm tra tài khoản và bấm <strong>&ldquo;✓ Xác nhận đã nhận tiền (PAID)&rdquo;</strong> trên màn hình Barista (<code>/barista</code>) thì hệ thống mới chuyển sang trang hoàn tất cho quý khách.
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setIsWaitingBarista(false)}
                  className="w-full text-center py-1.5 text-xs font-semibold text-stone-500 hover:text-stone-700 cursor-pointer"
                >
                  ← Quay lại chọn cách thanh toán khác
                </button>
              </div>
            </div>
          ) : (
            <>
              {step === "SELECT_METHOD" && (
            <div className="space-y-4">
              <h2 className="text-center text-sm font-bold text-stone-800">
                Chọn phương thức thanh toán
              </h2>

              <div className="space-y-2.5">
                {/* Method 1: VNPAY-QR */}
                <button
                  type="button"
                  onClick={() => setStep("QR_CODE")}
                  className="w-full flex items-center justify-between p-3.5 rounded-xl border border-stone-200 bg-white hover:border-[#005ba6] hover:bg-blue-50/30 transition text-left cursor-pointer group shadow-2xs"
                >
                  <span className="text-xs font-semibold text-stone-800 group-hover:text-[#005ba6]">
                    App Ngân hàng và Ví điện tử (<span className="text-[#ed1c24] font-bold">VNPAY</span><span className="text-[#005ba6] font-bold">QR</span>)
                  </span>
                  <div className="size-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center text-sm shrink-0">
                    📷
                  </div>
                </button>

                {/* Method 2: Domestic ATM Card (NCB) */}
                <button
                  type="button"
                  onClick={() => setStep("NCB_CARD")}
                  className="w-full flex items-center justify-between p-3.5 rounded-xl border-2 border-[#005ba6] bg-blue-50/40 hover:bg-blue-50 transition text-left cursor-pointer group shadow-2xs"
                >
                  <div>
                    <span className="text-xs font-bold text-[#005ba6] block">
                      Thẻ nội địa và tài khoản ngân hàng (NCB)
                    </span>
                    <span className="text-[10px] text-blue-700">Thẻ nội địa NCB</span>
                  </div>
                  <div className="size-7 rounded-lg bg-blue-600 text-white flex items-center justify-center text-sm shrink-0">
                    🏛️
                  </div>
                </button>

                {/* Method 3: International Cards */}
                <button
                  type="button"
                  onClick={() => setStep("NCB_CARD")}
                  className="w-full flex items-center justify-between p-3.5 rounded-xl border border-stone-200 bg-white hover:border-[#005ba6] hover:bg-blue-50/30 transition text-left cursor-pointer group shadow-2xs"
                >
                  <span className="text-xs font-semibold text-stone-800 group-hover:text-[#005ba6]">
                    Thẻ thanh toán quốc tế
                  </span>
                  <div className="size-7 rounded-lg bg-stone-100 text-stone-600 flex items-center justify-center text-sm shrink-0">
                    💳
                  </div>
                </button>

                {/* Method 4: VNPAY App */}
                <button
                  type="button"
                  onClick={() => setStep("QR_CODE")}
                  className="w-full flex items-center justify-between p-3.5 rounded-xl border border-stone-200 bg-white hover:border-[#005ba6] hover:bg-blue-50/30 transition text-left cursor-pointer group shadow-2xs"
                >
                  <span className="text-xs font-semibold text-stone-800 group-hover:text-[#005ba6]">
                    Ví điện tử VNPAY
                  </span>
                  <div className="size-7 rounded-lg bg-red-50 text-red-600 flex items-center justify-center text-sm shrink-0">
                    📱
                  </div>
                </button>
              </div>
            </div>
          )}

          {step === "NCB_CARD" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-stone-100 pb-2">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-xs text-blue-900 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                    NCB
                  </span>
                  <span className="text-xs font-bold text-stone-800">Ngân hàng TMCP Quốc Dân</span>
                </div>
                <span className="text-[11px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-full">
                  Cổng trực tuyến
                </span>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                    Số thẻ ngân hàng:
                  </label>
                  <input
                    type="text"
                    value={cardNumber}
                    onChange={(e) => setCardNumber(e.target.value)}
                    placeholder="9704 1985 2619 1432 198"
                    className="w-full rounded-xl border border-stone-300 px-3 py-2.5 font-mono text-sm font-bold text-stone-900 focus:border-[#005ba6] focus:ring-1 focus:ring-[#005ba6] outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                      Tên chủ thẻ:
                    </label>
                    <input
                      type="text"
                      value={cardHolder}
                      onChange={(e) => setCardHolder(e.target.value)}
                      placeholder="NGUYEN VAN A"
                      className="w-full rounded-xl border border-stone-300 px-3 py-2.5 text-xs font-bold text-stone-900 uppercase focus:border-[#005ba6] focus:ring-1 focus:ring-[#005ba6] outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                      Ngày phát hành (MM/YY):
                    </label>
                    <input
                      type="text"
                      value={issueDate}
                      onChange={(e) => setIssueDate(e.target.value)}
                      placeholder="07/15"
                      className="w-full rounded-xl border border-stone-300 px-3 py-2.5 font-mono text-xs font-bold text-stone-900 focus:border-[#005ba6] focus:ring-1 focus:ring-[#005ba6] outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setStep("NCB_OTP")}
                  className="w-full rounded-xl bg-[#005ba6] py-3 text-xs font-bold text-white hover:bg-[#004782] transition shadow-md cursor-pointer"
                >
                  Tiếp tục xác thực OTP →
                </button>
              </div>
            </div>
          )}

          {step === "NCB_OTP" && (
            <div className="space-y-4">
              <div className="text-center space-y-1">
                <p className="text-xs text-stone-500">Mã xác thực OTP đã được gửi về số điện thoại đăng ký.</p>
                <p className="text-xs font-semibold text-stone-700">Mã OTP xác thực: <span className="font-mono font-bold text-blue-700">123456</span></p>
              </div>

              <div className="max-w-[200px] mx-auto">
                <input
                  type="text"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  className="w-full text-center tracking-[0.4em] font-mono text-xl font-black py-2.5 rounded-xl border-2 border-[#005ba6] text-stone-900 outline-none"
                />
              </div>

              <div className="space-y-2 pt-2">
                <button
                  type="button"
                  onClick={() => handlePay("00")}
                  disabled={isProcessing}
                  className="w-full rounded-xl bg-[#005ba6] py-3 text-xs font-bold text-white hover:bg-[#004782] transition shadow-md cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isProcessing ? "Đang xử lý giao dịch..." : `Xác nhận thanh toán ${formatVND(amount)}`}
                </button>
                <button
                  type="button"
                  onClick={() => handlePay("24")}
                  disabled={isProcessing}
                  className="w-full rounded-xl border border-stone-200 py-2 text-xs font-semibold text-stone-500 hover:bg-stone-50 transition cursor-pointer"
                >
                  Hủy giao dịch
                </button>
              </div>
            </div>
          )}

          {step === "QR_CODE" && (
            <div className="text-center space-y-3">
              <div className="p-3 bg-white rounded-2xl border-2 border-[#005ba6]/40 inline-block shadow-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`https://img.vietqr.io/image/VCB-1040263376-compact2.png?amount=${amount}&addInfo=${encodeURIComponent(
                    `BREWLITE DH${orderId}`,
                  )}&accountName=BREWLITE%20COFFEE`}
                  alt="Mã VietQR Vietcombank 1040263376"
                  className="w-48 h-48 object-contain rounded-xl mx-auto"
                />
              </div>

              <div className="rounded-xl bg-stone-50 border border-stone-200 p-3 text-left space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-stone-500">Ngân hàng:</span>
                  <span className="font-bold text-stone-900">Vietcombank (VCB)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">Số tài khoản:</span>
                  <span className="font-mono font-bold text-[#005ba6]">1040263376</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">Số tiền:</span>
                  <span className="font-bold text-stone-900">{formatVND(amount)}</span>
                </div>
                <div className="flex justify-between border-t border-stone-200/80 pt-1.5">
                  <span className="text-stone-500">Nội dung (mã đơn):</span>
                  <span className="font-mono font-black text-red-600">BREWLITE DH{orderId}</span>
                </div>
              </div>

              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  onClick={() => handlePay("00")}
                  disabled={isProcessing}
                  className="w-full rounded-xl bg-[#005ba6] py-3 text-xs font-bold text-white hover:bg-[#004782] transition shadow-md cursor-pointer disabled:opacity-50"
                >
                  {isProcessing ? "Đang xác nhận nhận tiền..." : "✓ Xác nhận đã nhận tiền (Hoàn tất)"}
                </button>
                <button
                  type="button"
                  onClick={() => setStep("SELECT_METHOD")}
                  className="w-full text-center py-1.5 text-xs font-semibold text-stone-500 hover:text-stone-800"
                >
                  ← Chọn phương thức khác
                </button>
              </div>
            </div>
          )}
          </>
        )}
        </div>

        {/* Card Footer */}
        <div className="px-6 py-3 bg-[#fafafa] border-t border-stone-100 flex items-center justify-between text-[11px] text-stone-500">
          <a href="mailto:hotrovnpay@vnpay.vn" className="flex items-center gap-1.5 hover:text-stone-800">
            <span>✉</span>
            <span>hotrovnpay@vnpay.vn</span>
          </a>
          <div className="flex items-center gap-2">
            <span className="bg-white border border-stone-200 px-1.5 py-0.5 rounded text-[9px] font-bold text-stone-600">
              🔒 GlobalSign
            </span>
            <span className="bg-white border border-stone-200 px-1.5 py-0.5 rounded text-[9px] font-bold text-stone-600">
              PCI DSS
            </span>
          </div>
        </div>
      </div>

      {/* Outside Page Footer */}
      <p className="mt-4 text-[11px] text-stone-400">
        Phát triển bởi VNPAY © 2026
      </p>
    </div>
  );
}

export default function VnpayMockPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#f3f4f6] flex items-center justify-center text-xs text-stone-500">
          Đang kết nối cổng VNPAY...
        </div>
      }
    >
      <VnpayMockContent />
    </Suspense>
  );
}
