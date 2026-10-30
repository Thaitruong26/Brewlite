"use client";

import { usePathname } from "next/navigation";

export function SiteFooter() {
  const pathname = usePathname();
  if (pathname.startsWith("/barista")) return null;
  return <footer className="border-t border-[#315744] bg-[#183d2c] px-5 py-4 text-center text-[11px] text-[#e3eadf]">
    BrewLite Coffee · Thưởng thức theo cách của bạn
  </footer>;
}
