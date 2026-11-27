"use client";

import React, { Suspense } from "react";
import { useParams } from "next/navigation";
import { OrderConfirmationView } from "@/components/order-confirmation-view";

// Chức năng: Component giao diện OrderDetailContent. Cách hoạt động: Quản lý trạng thái hiển thị bằng React hooks và render cấu trúc JSX tương ứng.
function OrderDetailContent() {
  const params = useParams<{ id: string }>();
  const orderId = params?.id || "1042";

  return <OrderConfirmationView orderId={orderId} />;
}

// Chức năng: Component giao diện OrderConfirmationPage. Cách hoạt động: Quản lý trạng thái hiển thị bằng React hooks và render cấu trúc JSX tương ứng.
export default function OrderConfirmationPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-stone-50 flex items-center justify-center p-6">
          <div className="w-10 h-10 border-4 border-amber-800 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <OrderDetailContent />
    </Suspense>
  );
}

