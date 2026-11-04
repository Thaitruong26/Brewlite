"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ApiError, api, formatVND } from "@/lib/api";
import { MAX_QTY_PER_ITEM, MAX_TOPPINGS, type Size, itemUnitPrice, useCartStore } from "@/store/cart";
import { useStockStore, checkIsAvailable } from "@/store/stock-store";
import { useAuthStore } from "@/store/auth-store";

type SizeOption = { size: Size; surcharge: number };
type Topping = { id: number; name: string; price: number };
/** Response của GET /products/:id (api.md mục 6.2). Phụ thu size và topping lấy từ đây, không viết cứng. */
type ProductDetail = {
  id: number;
  name: string;
  description?: string | null;
  price: number;
  imageUrl: string;
  category: string;
  stock: number;
  inStock: boolean;
  sizes: SizeOption[];
  toppings: Topping[];
};

const FALLBACK_IMG = "/img/ca-phe-sua.jpg";

function ProductDetailContent() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { data: product, isPending, error, refetch } = useQuery({
    queryKey: ["product", id],
    queryFn: () => api<ProductDetail>(`/products/${id}`),
    retry: (count, err) => !(err instanceof ApiError && err.status < 500) && count < 2,
  });

  if (isPending) return <DetailSkeleton />;
  if (error || !product) {
    const notFound = error instanceof ApiError && (error.status === 404 || error.status === 400);
    return (
      <main className="mx-auto max-w-3xl px-5 py-16">
        <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-800">
          <h1 className="text-lg font-bold">{notFound ? "Không tìm thấy sản phẩm" : "Không tải được sản phẩm"}</h1>
          <p className="mt-1 text-sm">{notFound ? "Sản phẩm không tồn tại hoặc đã ngừng bán." : error?.message}</p>
          {!notFound && (
            <button onClick={() => refetch()} className="mt-4 rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 cursor-pointer">
              Thử lại
            </button>
          )}
        </div>
        <Link href="/menu" className="mt-5 inline-block font-semibold text-amber-900 hover:underline">
          ← Quay lại thực đơn
        </Link>
      </main>
    );
  }
  // key = id: đổi sang sản phẩm khác thì lựa chọn size/topping được đặt lại.
  return <ProductOptions key={product.id} product={product} />;
}

function ProductOptions({ product }: { product: ProductDetail }) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const hydrateAuth = useAuthStore((s) => s.hydrate);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    hydrateAuth();
    setMounted(true);
  }, [hydrateAuth]);

  const isLoggedIn = mounted && Boolean(user || accessToken);

  const availability = useStockStore((s) => s.availability);
  const isAvailable = checkIsAvailable(product, availability);
  const addItem = useCartStore((s) => s.addItem);
  const [size, setSize] = useState<Size>(product.sizes[0]?.size ?? "S");
  const [selected, setSelected] = useState<number[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState<string | null>(null);

  const sizeOption = product.sizes.find((s) => s.size === size);
  const chosenToppings = product.toppings.filter((t) => selected.includes(t.id));
  // Công thức api.md mục 4.1, tính lại ngay mỗi lần đổi lựa chọn.
  const unitPrice = itemUnitPrice({
    basePrice: product.price,
    sizeSurcharge: sizeOption?.surcharge ?? 0,
    toppings: chosenToppings,
  });
  const maxQty = Math.max(1, Math.min(MAX_QTY_PER_ITEM, product.stock));
  const limitReached = selected.length >= MAX_TOPPINGS;

  function toggleTopping(toppingId: number) {
    setAdded(null);
    setSelected((current) =>
      current.includes(toppingId)
        ? current.filter((x) => x !== toppingId)
        : current.length >= MAX_TOPPINGS
        ? current
        : [...current, toppingId],
    );
  }

  function handleAdd() {
    if (!isLoggedIn) {
      router.push(`/login?next=/products/${product.id}`);
      return;
    }
    const ok = addItem(
      {
        productId: product.id,
        name: product.name,
        imageUrl: product.imageUrl,
        basePrice: product.price,
        size,
        sizeSurcharge: sizeOption?.surcharge ?? 0,
        toppings: chosenToppings,
      },
      quantity,
    );
    setAdded(ok ? `Đã thêm ${quantity} × ${product.name} (size ${size}) vào giỏ.` : "Không thể thêm món vào giỏ hàng.");
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <Link href="/menu" className="text-sm font-semibold text-amber-900 hover:underline">
        ← Quay lại thực đơn
      </Link>
      <div className="mt-5 grid gap-8 rounded-3xl border border-stone-200/80 bg-white p-6 shadow-sm md:grid-cols-2 md:p-10 md:items-start">
        {/* Cột trái: Khung ảnh nghệ thuật chuẩn tỷ lệ & Bảng cam kết */}
        <div className="space-y-6 md:sticky md:top-24">
          <div className="relative aspect-4/3 sm:aspect-square w-full overflow-hidden rounded-2xl bg-stone-100 shadow-inner group border border-stone-200/80">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={product.imageUrl || FALLBACK_IMG}
              alt={product.name}
              className="h-full w-full object-cover object-center transition-transform duration-500 group-hover:scale-105"
              onError={(e) => {
                e.currentTarget.src = FALLBACK_IMG;
              }}
            />
            {/* Huy hiệu phân loại */}
            <span className="absolute top-3.5 left-3.5 rounded-full bg-white/90 backdrop-blur-md px-3.5 py-1 text-xs font-bold text-amber-900 shadow-sm border border-stone-200/50">
              {product.category}
            </span>
            {/* Huy hiệu tình trạng */}
            <span
              className={`absolute top-3.5 right-3.5 rounded-full px-3.5 py-1 text-xs font-bold shadow-sm backdrop-blur-md text-white ${
                isAvailable ? "bg-emerald-700/90" : "bg-red-600/90"
              }`}
            >
              {isAvailable ? "● Đang phục vụ" : "● Tạm hết"}
            </span>
          </div>

          {/* Bảng cam kết chuẩn vị BrewLite tạo sự cân đối */}
          <div className="rounded-2xl border border-amber-100 bg-[#fdfbf7] p-5">
            <div className="flex items-center gap-2 text-sm font-bold text-amber-900">
              <span className="text-base">☕</span> Cam kết chuẩn vị BrewLite
            </div>
            <ul className="mt-3 space-y-2 text-xs leading-5 text-stone-600">
              <li className="flex items-start gap-2">
                <span className="text-amber-800">✓</span> Hạt cà phê Robusta & Arabica nguyên chất rang mộc mới mỗi ngày.
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-800">✓</span> Sữa tươi thanh trùng tiệt trùng tiêu chuẩn, nói không với phụ gia độc hại.
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-800">✓</span> Định lượng công thức chính xác từng ml cho hương vị đậm đà nhất.
              </li>
            </ul>
          </div>
        </div>

        {/* Cột phải: Thông tin món, chọn size, topping, số lượng và đặt món */}
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-stone-400">{product.category}</span>
          <h1 className="mt-1 text-3xl font-extrabold text-stone-900">{product.name}</h1>
          <p className="mt-2 text-sm text-stone-600">
            {product.description || "Hương vị cà phê đậm đà được tuyển chọn từ vùng cao nguyên Việt Nam."}
          </p>

          <fieldset className="mt-6">
            <legend className="text-xs font-bold uppercase tracking-wider text-stone-500">1. Chọn size</legend>
            <div className="mt-2 grid grid-cols-3 gap-3">
              {product.sizes.map((s) => {
                const checked = s.size === size;
                return (
                  <button
                    key={s.size}
                    type="button"
                    onClick={() => setSize(s.size)}
                    className={`rounded-2xl border p-3 text-left transition cursor-pointer ${
                      checked
                        ? "border-amber-800 bg-amber-50/50 shadow-sm ring-2 ring-amber-800/20"
                        : "border-stone-200 hover:border-stone-300 bg-white"
                    }`}
                  >
                    <div className="text-base font-bold text-stone-900">Size {s.size}</div>
                    <div className="text-xs text-stone-500 font-medium">{s.surcharge > 0 ? `+${formatVND(s.surcharge)}` : "Chuẩn"}</div>
                  </button>
                );
              })}
            </div>
          </fieldset>

          {product.toppings.length > 0 && (
            <fieldset className="mt-6">
              <div className="flex items-baseline justify-between">
                <legend className="text-xs font-bold uppercase tracking-wider text-stone-500">2. Chọn Topping</legend>
                <span className="text-xs text-stone-500">Tối đa {MAX_TOPPINGS} topping</span>
              </div>
              <div className="mt-2 space-y-2">
                {product.toppings.map((t) => {
                  const checked = selected.includes(t.id);
                  const disabled = !checked && limitReached;
                  return (
                    <label
                      key={t.id}
                      className={`flex items-center justify-between rounded-xl border p-3 text-sm transition cursor-pointer ${
                        checked
                          ? "border-amber-800 bg-amber-50/40 text-stone-900 font-medium"
                          : disabled
                          ? "border-stone-100 bg-stone-50 text-stone-400 cursor-not-allowed"
                          : "border-stone-200 hover:border-stone-300 bg-white"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={disabled}
                          onChange={() => toggleTopping(t.id)}
                          className="h-4 w-4 rounded border-stone-300 text-amber-800 focus:ring-amber-800"
                        />
                        <span>{t.name}</span>
                      </div>
                      <span className="text-xs font-semibold text-stone-700">+{formatVND(t.price)}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          )}

          <div className="mt-6 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-stone-500">3. Số lượng</span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                disabled={quantity <= 1}
                className="flex size-9 items-center justify-center rounded-xl border border-stone-200 bg-stone-50 text-base font-bold text-stone-700 hover:bg-stone-100 disabled:opacity-40 cursor-pointer"
              >
                −
              </button>
              <span className="w-8 text-center font-bold text-stone-900">{quantity}</span>
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.min(maxQty, q + 1))}
                disabled={quantity >= maxQty}
                className="flex size-9 items-center justify-center rounded-xl border border-stone-200 bg-stone-50 text-base font-bold text-stone-700 hover:bg-stone-100 disabled:opacity-40 cursor-pointer"
              >
                +
              </button>
            </div>
          </div>

          <div className="mt-6 border-t border-stone-200 pt-5">
            <div className="flex items-center justify-between">
              <span className="text-stone-600">Thành tiền ({quantity} ly)</span>
              <strong className="text-2xl text-amber-900" aria-live="polite">
                {formatVND(unitPrice * quantity)}
              </strong>
            </div>
            <p className="mt-2 text-xs leading-5 text-stone-500">
              Giá hiển thị là giá dự kiến. Backend sẽ tính lại giá chính thức khi tạo đơn.
            </p>

            {!isLoggedIn ? (
              <div className="mt-5 space-y-2">
                <button
                  type="button"
                  onClick={() => router.push(`/login?next=/products/${product.id}`)}
                  className="w-full rounded-xl bg-[#183d2c] px-5 py-3.5 font-bold text-white hover:bg-[#122e21] shadow-sm transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>🔒</span> Đăng nhập để thêm vào giỏ hàng
                </button>
                <p className="text-center text-xs text-stone-500">
                  Quý khách vui lòng đăng nhập để chọn món và tích lũy điểm thưởng.
                </p>
              </div>
            ) : (
              <button
                disabled={!isAvailable}
                onClick={handleAdd}
                className="mt-5 w-full rounded-xl bg-amber-800 px-5 py-3.5 font-bold text-white hover:bg-amber-900 disabled:cursor-not-allowed disabled:bg-stone-300 shadow-sm transition-colors cursor-pointer"
              >
                {isAvailable ? "Thêm vào giỏ hàng" : "Sản phẩm tạm hết hàng"}
              </button>
            )}

            {added && (
              <div className="mt-4 space-y-2.5">
                <div role="status" className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm font-medium text-emerald-800">
                  ✓ {added}
                </div>
                <Link
                  href="/cart"
                  className="w-full flex items-center justify-center rounded-xl bg-amber-800 px-5 py-3.5 font-bold text-white shadow-sm hover:bg-amber-900 transition-colors cursor-pointer"
                >
                  Xem giỏ hàng →
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

function DetailSkeleton() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6" aria-busy="true" aria-label="Đang tải chi tiết sản phẩm">
      <div className="mt-9 grid animate-pulse gap-8 rounded-3xl border border-stone-200 bg-white p-5 md:grid-cols-2 md:p-8">
        <div className="h-72 rounded-2xl bg-stone-200" />
        <div className="space-y-4">
          <div className="h-4 w-24 rounded bg-stone-200" />
          <div className="h-8 w-2/3 rounded bg-stone-200" />
          <div className="h-16 rounded bg-stone-200" />
          <div className="grid grid-cols-3 gap-3">
            <div className="h-16 rounded-xl bg-stone-200" />
            <div className="h-16 rounded-xl bg-stone-200" />
            <div className="h-16 rounded-xl bg-stone-200" />
          </div>
          <div className="h-32 rounded-xl bg-stone-200" />
        </div>
      </div>
    </main>
  );
}

export default function ProductDetailPage() {
  return (
    <Suspense fallback={<DetailSkeleton />}>
      <ProductDetailContent />
    </Suspense>
  );
}
