"use client";

import { useEffect, useState } from "react";

const API_URL = "http://localhost:4000/api";

type PaymentResponse = {
  paymentId: number;
  orderId: number;
  amount: number;
  method: string;
  status: string;
  expiresAt: string;
  message?: string;
};

export default function PaymentPage() {
  const [orderId, setOrderId] = useState("");
  const [amount, setAmount] = useState<number | null>(null);
  const [paymentId, setPaymentId] = useState<number | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [status, setStatus] = useState("WAITING");
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("orderId");

    if (!id || !Number.isInteger(Number(id)) || Number(id) <= 0) {
      setError("Mã đơn hàng không hợp lệ.");
      return;
    }

    setOrderId(id);
  }, []);

  useEffect(() => {
    if (!orderId) return;

    let cancelled = false;

    async function createPayment() {
      try {
        const token = localStorage.getItem("access_token");

        if (!token) {
          setError("Ông cần đăng nhập trước khi thanh toán.");
          return;
        }

        const response = await fetch(`${API_URL}/payments`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
           "Authorization": `Bearer ${token}`,
            "Idempotency-Key": crypto.randomUUID(),
          },
          body: JSON.stringify({
            orderId: Number(orderId),
            method: "MOMO",
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || "Không thể tạo phiên thanh toán.");
        }

        if (cancelled) return;

        const payment = data as PaymentResponse;

        setPaymentId(payment.paymentId);
        setAmount(payment.amount);
        setExpiresAt(payment.expiresAt);
        setStatus(payment.status);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Có lỗi xảy ra."
          );
        }
      }
    }

    createPayment();

    return () => {
      cancelled = true;
    };
  }, [orderId]);

  useEffect(() => {
    if (!expiresAt || status !== "PROCESSING") return;

    const updateTimer = () => {
      const remaining = Math.max(
        0,
        Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000)
      );

      setTimeLeft(remaining);

      if (remaining <= 0) {
        setStatus("EXPIRED");
      }
    };

    updateTimer();
    const timer = setInterval(updateTimer, 1000);

    return () => clearInterval(timer);
  }, [expiresAt, status]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;

    return` ${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  return (
    <main className="min-h-screen bg-stone-100 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-lg p-6 w-full max-w-md text-center">
        <h1 className="text-2xl font-bold text-amber-900">
          Thanh toán MoMo
        </h1>

        <p className="text-gray-500 mt-2">
          Quét mã QR để chuyển khoản
        </p>

        {error ? (
          <p className="mt-6 text-red-600">{error}</p>
        ) : !paymentId ? (
          <p className="mt-6 text-gray-500">Đang tạo phiên thanh toán...</p>
        ) : (
          <>
            <div className="my-6 border rounded-xl p-3">
              <img
                src="/img/momo-qr.jpg"
                alt="MoMo QR"
                className="w-full max-w-[280px] mx-auto"
              />
            </div>

            <div className="text-left space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-500">Mã đơn hàng</span>
                <strong>{orderId}</strong>
              </div>

              <div className="flex justify-between">
                <span className="text-gray-500">Mã thanh toán</span>
                <strong>{paymentId}</strong>
              </div>

              <div className="flex justify-between">
                <span className="text-gray-500">Số tiền</span>
                <strong>
                  {amount?.toLocaleString("vi-VN")} đ
                </strong>
              </div>

              <div className="flex justify-between">
                <span className="text-gray-500">Thời gian còn lại</span>
                <strong className={status === "EXPIRED" ? "text-red-600" : "text-amber-800"}>
                  {formatTime(timeLeft)}
                </strong>
              </div>
            </div>

            {status === "EXPIRED" ? (
              <p className="mt-6 text-red-600 font-semibold">
                Phiên thanh toán đã hết hạn.
              </p>
            ) : (
              <p className="mt-6 text-sm text-gray-500">
                Vui lòng chuyển khoản và chờ nhân viên xác nhận.
              </p>
            )}
          </>
        )}

        <p className="text-xs text-gray-400 mt-4">
          BrewLite Coffee System
        </p>
      </div>
    </main>
  );
}
