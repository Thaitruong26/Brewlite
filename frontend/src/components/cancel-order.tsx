"use client";

import { useId, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ApiError, apiRequest, formatVND } from "@/lib/api";

type Props = {
  order: { id: number | string; status: string; total: number; payments?: { status: string }[] };
  disabled?: boolean;
  compact?: boolean;
  onRefresh: () => unknown;
  onCancelled?: () => void;
};

// Chức năng: Component giao diện CancelOrder. Cách hoạt động: Quản lý trạng thái hiển thị bằng React hooks và render cấu trúc JSX tương ứng.
export function CancelOrder({ order, disabled, compact = false, onRefresh, onCancelled }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [cancelled, setCancelled] = useState(false);
  const [bank, setBank] = useState("MB");
  const [account, setAccount] = useState("");
  const cache = useQueryClient();
  const allowed = ["PENDING", "PAYMENT_FAILED", "PAID"].includes(order.status);
  const processing = order.payments?.some((p) => p.status === "PROCESSING");
  const canCancel = allowed && !processing && !disabled && !cancelled;

  // Chức năng: Hàm confirm. Cách hoạt động: Thực thi logic xử lý nghiệp vụ của module và trả về kết quả cho nơi gọi.
  async function confirm() {
    if (busy.current || !canCancel) return;
    if (order.status === "PAID" && !account.trim()) {
      setMessage("Vui lòng nhập số tài khoản ngân hàng để Barista hoàn tiền VietQR.");
      return;
    }
    busy.current = true;
    setPending(true);
    setMessage("");
    try {
      if (order.status === "PAID" && account && typeof window !== "undefined") {
        localStorage.setItem(`refund_account_${order.id}`, account);
        localStorage.setItem(`refund_bank_${order.id}`, bank);
      }
      await apiRequest(`/orders/${order.id}/cancel`, {
        method: "POST",
        body: JSON.stringify(
          order.status === "PAID"
            ? {
                refundBank: bank,
                refundAccount: account.trim(),
              }
            : {},
        ),
      });
      setCancelled(true);
      dialog.current?.close();
      onCancelled?.();
      void cache.invalidateQueries({ queryKey: ["orders-me"] });
      void Promise.resolve(onRefresh()).catch(() => {});
    } catch (err) {
      setMessage(err instanceof ApiError && err.code === "INVALID_TRANSITION"
        ? "Trạng thái đơn đã thay đổi, không thể hủy. Vui lòng kiểm tra lại đơn hàng."
        : err instanceof Error ? err.message : "Chưa hủy được đơn. Vui lòng thử lại.");
      if (err instanceof ApiError && err.statusCode === 409) void Promise.resolve(onRefresh()).catch(() => {});
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  if (cancelled || order.status === "CANCELLED") return <p role="status" className="rounded-2xl bg-[var(--forest-light)] p-4 text-sm font-semibold text-[var(--forest)]">Đơn #{order.id} đã được hủy. Quầy sẽ không tiếp tục xử lý đơn này.</p>;
  return (
    <div className={compact ? "contents" : "space-y-3 text-left"}>
      <p className={compact && allowed ? "sr-only" : "text-sm text-[var(--muted)]"}>{disabled ? "Không thể hủy đơn dữ liệu mẫu." : processing ? "Thanh toán đang được xử lý. Vui lòng chờ giao dịch hoàn tất rồi thử lại." : allowed ? "Bạn có thể hủy đơn trước khi quầy bắt đầu pha chế." : "Đơn đã bắt đầu pha chế hoặc hoàn tất nên không thể hủy."}</p>
      {allowed && <button type="button" disabled={!canCancel} onClick={() => { setMessage(""); dialog.current?.showModal(); }} className={`${compact ? "w-full sm:w-auto text-sm" : "min-h-12"} rounded-xl bg-[#b33e35] px-6 py-3 font-semibold text-white hover:bg-[#96332c] disabled:cursor-not-allowed disabled:opacity-50`}>Hủy đơn hàng</button>}
      <dialog ref={dialog} aria-labelledby={titleId} onCancel={(event) => { if (busy.current) event.preventDefault(); }} className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-2xl bg-[var(--cream)] p-6 text-[var(--foreground)] shadow-xl backdrop:bg-black/40">
        <p className="mb-6 text-xl font-bold text-[var(--forest)]">BREWLITE</p>
        <div className="space-y-6 rounded-2xl bg-white p-6">
          <h2 id={titleId} className="text-2xl font-bold leading-snug">Bạn muốn hủy<br />đơn #{order.id}?</h2>
          <p className="text-sm font-bold text-[var(--forest-hover)]">Hãy kiểm tra trước khi xác nhận</p>
          <p>Đơn hàng sẽ ngừng xử lý. Bạn không thể khôi phục đơn sau khi hủy.</p>
          <p>Tổng thanh toán<br /><strong>{formatVND(order.total)}</strong></p>
          {order.status === "PAID" ? (
            <div className="space-y-2 rounded-xl bg-amber-50/70 border border-amber-200 p-3 text-left">
              <p className="text-xs font-bold text-amber-900">Thông tin nhận hoàn tiền (Để Barista quét mã VietQR chuyển trả lại):</p>
              <div className="grid grid-cols-1 gap-2">
                <select
                  value={bank}
                  onChange={(e) => setBank(e.target.value)}
                  className="w-full rounded-lg border border-amber-300 bg-white p-2 text-xs font-semibold"
                >
                  <option value="MB">MB Bank (Quân Đội)</option>
                  <option value="VCB">Vietcombank</option>
                  <option value="TCB">Techcombank</option>
                  <option value="TPB">TPBank</option>
                  <option value="VPB">VPBank</option>
                  <option value="ACB">ACB</option>
                  <option value="ICB">VietinBank</option>
                  <option value="BIDV">BIDV</option>
                </select>
                <input
                  type="text"
                  placeholder="Nhập số tài khoản ngân hàng của bạn..."
                  value={account}
                  onChange={(e) => setAccount(e.target.value)}
                  className="w-full rounded-lg border border-amber-300 bg-white p-2 text-xs font-semibold"
                  required
                />
              </div>
              <p className="text-xs text-[var(--muted)]">Đơn đã thanh toán: hệ thống sẽ tạo yêu cầu hoàn tiền chuyển khoản VietQR cho Barista và thu hồi điểm thưởng đã tích.</p>
            </div>
          ) : (
            <div className="rounded-xl bg-gray-50 border border-gray-200 p-3 text-left text-xs text-[var(--muted)]">
              Đơn chưa thanh toán: hệ thống sẽ hủy đơn ngay lập tức và hoàn kho nguyên liệu (không cần thông tin hoàn tiền).
            </div>
          )}
          {!canCancel && <p role="alert" className="text-sm text-red-700">Đơn hiện không thể hủy. Hãy quay lại để xem trạng thái mới nhất.</p>}
          {message && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{message}</p>}
          <button autoFocus type="button" disabled={pending} onClick={() => dialog.current?.close()} className="min-h-12 w-full rounded-xl bg-[var(--forest)] p-3 text-white disabled:opacity-50">Giữ đơn</button>
          <button type="button" disabled={pending || !canCancel} onClick={confirm} className="min-h-12 w-full rounded-xl bg-[#b33e35] p-3 text-white disabled:opacity-50">{pending ? "Đang hủy…" : "Xác nhận hủy"}</button>
        </div>
      </dialog>
    </div>
  );
}
