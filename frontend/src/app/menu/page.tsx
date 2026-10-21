"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { ApiError } from "@/lib/api/client";
import { getProducts } from "@/lib/api/products";
import { getDevelopmentProducts } from "@/lib/api/dev-products";
import type { Product } from "@/lib/api/types";
import { ProductImage } from "@/components/products/product-image";
import { ErrorState } from "@/components/ui/error-state";
import { ProductCardSkeleton } from "@/components/ui/loading-state";

const formatVnd = (price: number) => new Intl.NumberFormat("vi-VN").format(price);

// ─── Badges theo tên sản phẩm (minh họa, thực tế lấy từ API sau) ─────────────
const BADGES: Record<string, { label: string; className: string }> = {
  "Cà phê sữa":   { label: "BEST SELLER", className: "bg-[#fff3cd] text-[#8a6200]" },
  "Americano":    { label: "Đậm vừa",     className: "bg-[#e6f4ea] text-[#2d6a4f]" },
  "Cappuccino":   { label: "Thủ công",    className: "bg-[#f0ecf8] text-[#5e35b1]" },
  "Latte":        { label: "Nhẹ nhàng",   className: "bg-[#fce4ec] text-[#b71c5d]" },
  "Matcha đá xay":{ label: "Mới",         className: "bg-[#e8f5e2] text-[#2d6a4f]" },
};

// ─── Category icons ────────────────────────────────────────────────────────────
const CATEGORY_ICONS: Record<string, string> = {
  "Tất cả": "☕",
  "Cà phê":  "☕",
  "Trà":     "🍃",
  "Đá xay":  "🧊",
};

// ─── Product card (horizontal, theo design) ───────────────────────────────────
function ProductCard({ product }: { product: Product }) {
  const badge = Object.entries(BADGES).find(([k]) => product.name.includes(k))?.[1];

  return (
    <Link
      href={`/products/${product.id}`}
      className="group flex gap-3 rounded-2xl bg-white p-3 shadow-sm transition hover:shadow-md active:scale-[0.99]"
    >
      {/* Ảnh */}
      <div className="relative aspect-square w-28 shrink-0 overflow-hidden rounded-xl bg-[#eceee5]">
        <ProductImage
          src={product.imageUrl}
          alt={product.name}
          className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.06]"
        />
        {/* Rating giả lập */}
        <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5">
          <span className="text-[10px] text-yellow-400">★</span>
          <span className="text-[10px] font-semibold text-white">4.{((product.id * 3) % 9) + 1}</span>
        </div>
        {/* Hết hàng */}
        {!product.inStock && (
          <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/40">
            <span className="text-xs font-semibold text-white">Tạm hết</span>
          </div>
        )}
      </div>

      {/* Thông tin */}
      <div className="flex min-w-0 flex-1 flex-col justify-between py-0.5">
        <div>
          <div className="flex flex-wrap items-center gap-1.5">
            <h2 className="text-sm font-bold text-[#183d2c]">{product.name}</h2>
            {badge && (
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge.className}`}>
                {badge.label}
              </span>
            )}
          </div>
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[#66736a]">
            {product.category === "Cà phê"
              ? "Hạt Robusta Đắk Lắk chọn lọc, rang mộc đậm vị, pha phin truyền thống."
              : product.category === "Trà"
              ? "Nguyên liệu tươi tự nhiên, vị thanh mát, không chất bảo quản."
              : "Kem tươi mát lạnh, hoà quyện cùng hương thơm đặc trưng."}
          </p>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-sm font-bold text-[#183d2c]">{formatVnd(product.price)} đ</span>
          <span className="flex items-center gap-1 text-xs font-semibold text-[#31553e] group-hover:underline">
            Xem chi tiết
            <svg viewBox="0 0 16 16" fill="currentColor" className="size-3.5">
              <path fillRule="evenodd" d="M2 8a.75.75 0 0 1 .75-.75h8.69L8.22 4.03a.75.75 0 0 1 1.06-1.06l4.5 4.25a.75.75 0 0 1 0 1.06l-4.5 4.25a.75.75 0 1 1-1.06-1.06l3.22-3.22H2.75A.75.75 0 0 1 2 8Z" clipRule="evenodd" />
            </svg>
          </span>
        </div>
      </div>
    </Link>
  );
}

// ─── Hero banner ──────────────────────────────────────────────────────────────
function HeroBanner() {
  const [greeting, setGreeting] = useState("Chào buổi sáng!");

  useEffect(() => {
    const hour = new Date().getHours();
    setGreeting(hour < 12 ? "Chào buổi sáng!" : hour < 18 ? "Chào buổi chiều!" : "Chào buổi tối!");
  }, []);

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#1a3d26] to-[#2d6a4f] px-5 py-5">
      {/* Decorative circle */}
      <div className="absolute -right-6 -top-6 size-36 rounded-full bg-white/5" />
      <div className="absolute -bottom-8 right-8 size-24 rounded-full bg-white/5" />

      <div className="relative flex items-center justify-between gap-4">
        <div className="min-w-0">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white/90">
            ☀ Cà phê rang mộc mỗi sáng
          </span>
          <h2 className="mt-2 text-2xl font-bold leading-tight text-white">{greeting}</h2>
          <p className="mt-1 text-xs leading-relaxed text-white/70">
            Nạp năng lượng với cà phê thủ công thơm ngon từ nông trại Đắk Lắk.
          </p>
        </div>
        {/* Ảnh minh họa */}
        <div className="shrink-0">
          <div className="flex size-20 items-center justify-center rounded-2xl bg-white/10 text-4xl">
            ☕
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Search bar ───────────────────────────────────────────────────────────────
function SearchBar({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative flex items-center gap-2">
      <div className="relative flex-1">
        <svg
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[#94a89b]"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
        </svg>
        <input
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Tìm đồ uống yêu thích..."
          className="w-full rounded-xl border border-[#e0e7de] bg-white py-3 pl-10 pr-4 text-sm outline-none transition focus:border-[#5a8066] focus:ring-2 focus:ring-[#d6e5d8]"
        />
      </div>
      {/* Filter button (placeholder — FE1 Sprint 3) */}
      <button
        type="button"
        aria-label="Lọc nâng cao"
        className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-[#e0e7de] bg-white text-[#344b3c] transition hover:bg-[#eef2ec]"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="size-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75" />
        </svg>
      </button>
    </div>
  );
}

// ─── Trang Menu ───────────────────────────────────────────────────────────────
export default function MenuPage() {
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");
  const [showFixtures, setShowFixtures] = useState(false);

  const query = useQuery({
    queryKey: ["products", { category, page: 1, limit: 20 }],
    queryFn: () => getProducts({ category: category || undefined, page: 1, limit: 20 }),
    enabled: !showFixtures,
  });

  const fixtureResult = useMemo(
    () => (showFixtures ? getDevelopmentProducts(category || undefined) : null),
    [category, showFixtures],
  );

  const result = fixtureResult ?? query.data;
  const allProducts = result?.data ?? [];

  // Lọc theo search ở client (API không cần search cho Sprint 1)
  const products = useMemo(
    () =>
      search.trim()
        ? allProducts.filter((p) =>
            p.name.toLowerCase().includes(search.trim().toLowerCase()),
          )
        : allProducts,
    [allProducts, search],
  );

  // Danh sách danh mục từ tất cả products (không lọc theo category)
  const categories = useMemo(() => {
    const all = [
      ...(query.data?.data ?? []),
      ...(showFixtures ? getDevelopmentProducts().data : []),
    ];
    return Array.from(new Set(all.map((p) => p.category)));
  }, [query.data, showFixtures]);

  const isLoading = !showFixtures && query.isPending;
  const isError = !showFixtures && query.isError;

  return (
    <div className="mx-auto max-w-2xl px-4 py-4 md:max-w-7xl md:px-10 md:py-8">

      {/* ── Hero ── */}
      <HeroBanner />

      {/* ── Search ── */}
      <div className="mt-4">
        <SearchBar value={search} onChange={setSearch} />
      </div>

      {/* ── Category pills ── */}
      <div
        className="mt-4 flex gap-2 overflow-x-auto pb-1 scrollbar-none"
        role="tablist"
        aria-label="Lọc theo danh mục"
      >
        {["", ...categories].map((value) => {
          const label = value || "Tất cả";
          const icon = CATEGORY_ICONS[label] ?? "🍹";
          const active = category === value;
          return (
            <button
              key={value || "all"}
              role="tab"
              aria-selected={active}
              onClick={() => setCategory(value)}
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition ${
                active
                  ? "bg-[#183d2c] text-white shadow-sm"
                  : "border border-[#d9e0d7] bg-white text-[#42594a] hover:bg-[#e9f0e9]"
              }`}
            >
              <span aria-hidden="true">{icon}</span>
              {label}
            </button>
          );
        })}
      </div>

      {/* ── Section header ── */}
      <div className="mt-6 flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-base font-bold text-[#183d2c]">
          Món nổi bật hôm nay
          <span className="inline-block size-2 rounded-full bg-emerald-500" aria-hidden="true" />
        </h1>
        <span className="rounded-full bg-[#e8f5e2] px-3 py-1 text-xs font-semibold text-[#2d6a4f]">
          -10% Sinh viên
        </span>
      </div>

      {/* ── Badge dữ liệu mẫu ── */}
      {showFixtures && (
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-[#d2bb78] bg-[#fff7df] px-4 py-2.5 text-xs font-semibold text-[#735f2d]">
          <span>⚠</span>
          <span>Dữ liệu mẫu xem trước · không lấy từ máy chủ</span>
        </div>
      )}

      {/* ── Loading skeleton ── */}
      {isLoading && (
        <div className="mt-4 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <ProductCardSkeleton key={i} />)}
        </div>
      )}

      {/* ── Error ── */}
      {isError && (
        <div className="mt-4 space-y-3">
          <ErrorState
            message={
              query.error instanceof ApiError
                ? query.error.message
                : "Đã xảy ra lỗi khi tải thực đơn."
            }
            onRetry={() => void query.refetch()}
          />
          <div className="text-center">
            <button
              onClick={() => setShowFixtures(true)}
              className="rounded-full border border-[#cbd6ca] px-5 py-2.5 text-sm font-semibold text-[#244532] transition hover:bg-[#e9f0e9]"
            >
              Xem dữ liệu mẫu theo tài liệu API
            </button>
          </div>
        </div>
      )}

      {/* ── Empty state ── */}
      {result && products.length === 0 && !isLoading && (
        <div className="mt-8 rounded-2xl border border-dashed border-[#cbd6ca] bg-white/60 px-6 py-12 text-center">
          <span className="text-3xl" aria-hidden="true">☕</span>
          <h2 className="mt-3 text-base font-semibold text-[#21372b]">
            {search ? `Không tìm thấy "${search}"` : "Chưa có món trong danh mục này"}
          </h2>
          <p className="mt-2 text-sm text-[#66736a]">
            {search ? "Thử tìm với từ khóa khác." : "Thử chọn danh mục khác để khám phá thêm."}
          </p>
          {search && (
            <button
              onClick={() => setSearch("")}
              className="mt-4 rounded-full bg-[#183d2c] px-5 py-2 text-sm font-semibold text-white hover:bg-[#24563e]"
            >
              Xóa tìm kiếm
            </button>
          )}
        </div>
      )}

      {/* ── Product list ── */}
      {result && products.length > 0 && (
        <>
          {/* Mobile: danh sách dọc */}
          <div className="mt-4 space-y-3 md:hidden">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>

          {/* Desktop: lưới 2–4 cột theo thiết kế cũ */}
          <div className="mt-6 hidden gap-4 md:grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {products.map((product) => (
              <DesktopProductCard key={product.id} product={product} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Desktop card (giữ nguyên thiết kế cũ, dạng lưới) ────────────────────────
function DesktopProductCard({ product }: { product: Product }) {
  const badge = Object.entries(BADGES).find(([k]) => product.name.includes(k))?.[1];

  return (
    <Link
      href={`/products/${product.id}`}
      className="group overflow-hidden rounded-[1.4rem] border border-[#e5e7dc] bg-white transition duration-200 hover:-translate-y-1 hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#183d2c]"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-[#eceee5]">
        <ProductImage
          src={product.imageUrl}
          alt={product.name}
          className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
        />
        <span className="absolute left-3 top-3 rounded-full bg-[#fbf8ef]/95 px-3 py-1 text-xs font-medium text-[#345541]">
          {product.category}
        </span>
        {badge && (
          <span className={`absolute right-3 top-3 rounded-full px-2.5 py-1 text-[10px] font-bold ${badge.className}`}>
            {badge.label}
          </span>
        )}
      </div>
      <div className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-semibold text-[#21372b]">{product.name}</h2>
          <span className="shrink-0 text-sm font-bold text-[#183d2c]">{formatVnd(product.price)}đ</span>
        </div>
        <div className="mt-4 flex items-center justify-between border-t border-[#eef0e9] pt-3 text-xs text-[#66736a]">
          <span>{product.inStock ? "Sẵn sàng phục vụ" : "Tạm hết hàng"}</span>
          <span className="font-semibold text-[#31553e] group-hover:underline">Xem món →</span>
        </div>
      </div>
    </Link>
  );
}
