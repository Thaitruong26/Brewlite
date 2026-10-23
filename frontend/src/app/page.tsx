import Link from "next/link";
import { ProductImage } from "@/components/products/product-image";

const HIGHLIGHTS = [
  { icon: "☕", label: "100% Rang thủ công" },
  { icon: "🌿", label: "Nguyên liệu tươi" },
  { icon: "⏱", label: "Đặt trong 30 giây" },
];

export default function Home() {
  return (
    <section className="mx-auto grid min-h-0 max-w-[1200px] items-center gap-10 px-5 py-12 sm:px-8 md:gap-12 md:px-10 md:py-12 lg:min-h-[calc(100svh-116px)] lg:grid-cols-[1.05fr_0.95fr] lg:gap-14 xl:gap-16">
      <div className="flex flex-col items-start">
        <p className="mb-5 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-[#183d2c]">
          <span className="size-2 rounded-full bg-emerald-500" aria-hidden="true" />
          BrewLite · Cà phê mỗi ngày
        </p>

        <h1 className="max-w-xl text-[2.75rem] font-bold leading-[1.02] tracking-tight text-[#183d2c] sm:text-5xl lg:text-[3.5rem] xl:text-[3.75rem]">
          <span className="xl:whitespace-nowrap">Một khoảng lặng,</span>
          <br />
          <span className="font-serif font-semibold italic">đúng vị bạn.</span>
        </h1>

        <p className="mt-5 max-w-lg text-[15px] leading-7 text-[#66736a] sm:text-base">
          Chọn thức uống yêu thích từ thực đơn BrewLite. Đặt món gọn nhẹ, dành thêm thời gian cho điều bạn thích.
        </p>

        <Link
          href="/menu"
          className="group mt-7 inline-flex min-h-12 items-center justify-center gap-3 rounded-full bg-[#183d2c] px-7 text-sm font-semibold text-[#fffdf6] shadow-md transition-colors hover:bg-[#24563e] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#183d2c]"
          style={{ color: "#fffdf6" }}
        >
          Khám phá thực đơn
          <span aria-hidden="true" className="transition-transform group-hover:translate-x-1">↗</span>
        </Link>

        <ul className="mt-8 grid w-full max-w-[540px] grid-cols-1 divide-y divide-[#dfe3d8] border-y border-[#dfe3d8] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {HIGHLIGHTS.map(({ icon, label }) => (
            <li key={label} className="flex min-h-12 items-center gap-2.5 px-2 py-2.5 text-xs font-medium text-[#385747] sm:justify-center sm:px-3">
              <span aria-hidden="true" className="text-sm text-[#315f47]">{icon}</span>
              <span>{label}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="relative mx-auto w-full max-w-[560px] px-2 py-2 sm:px-3">
        <div className="absolute inset-0 rotate-[1.5deg] rounded-[2rem] bg-[#e5eadc]" aria-hidden="true" />
        <div className="relative overflow-hidden rounded-[1.65rem] bg-[#d8d2c3] shadow-xl">
          <ProductImage
            src="/img/ca-phe-sua.jpg"
            alt="Cà phê sữa BrewLite được pha phin"
            className="aspect-[1.2/1] w-full object-cover sm:aspect-[1.24/1]"
          />
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/45 to-transparent" aria-hidden="true" />
          <div className="absolute bottom-4 left-4 max-w-[calc(100%-2rem)] rounded-xl border border-[#e7e4d9] bg-[#fffdf6] px-4 py-2.5 shadow-lg sm:bottom-5 sm:left-5 sm:px-5">
            <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[#65766a] sm:text-[10px]">
              Pha chậm, thưởng thức lâu
            </p>
            <p className="mt-1 text-sm font-semibold text-[#183d2c] sm:text-base">Chào ngày mới cùng BrewLite</p>
          </div>
        </div>
      </div>
    </section>
  );
}
