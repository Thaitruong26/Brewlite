export function LoadingState({ label = "Đang tải..." }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="flex min-h-56 flex-col items-center justify-center gap-4 text-sm text-[#66736a]">
      <span className="size-8 animate-spin rounded-full border-[3px] border-[#dce5dc] border-t-[#183d2c]" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

/** Skeleton card cho trang Menu (mobile horizontal layout). */
export function ProductCardSkeleton() {
  return (
    <div className="flex gap-3 rounded-2xl bg-white p-3 shadow-sm" aria-hidden="true">
      {/* Ảnh */}
      <div className="aspect-square w-28 shrink-0 animate-pulse rounded-xl bg-[#e8ede6]" />
      {/* Nội dung */}
      <div className="flex flex-1 flex-col gap-2 py-1">
        <div className="h-4 w-3/4 animate-pulse rounded-full bg-[#e8ede6]" />
        <div className="h-3 w-full animate-pulse rounded-full bg-[#e8ede6]" />
        <div className="h-3 w-5/6 animate-pulse rounded-full bg-[#e8ede6]" />
        <div className="mt-auto flex items-center justify-between">
          <div className="h-4 w-20 animate-pulse rounded-full bg-[#e8ede6]" />
          <div className="h-4 w-24 animate-pulse rounded-full bg-[#e8ede6]" />
        </div>
      </div>
    </div>
  );
}
