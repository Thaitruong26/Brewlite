import Link from "next/link";
import { ProductImage } from "@/components/products/product-image";

export default function Home() {
  return (
    <section className="mx-auto grid min-h-[calc(100vh-140px)] max-w-7xl items-center gap-12 px-5 py-14 md:grid-cols-2 md:px-10">
      <div className="max-w-xl">
        <p className="mb-5 text-xs font-bold uppercase tracking-[0.22em] text-emerald-800">BrewLite · Cà phê mỗi ngày</p>
        <h1 className="text-5xl font-semibold leading-[1.08] tracking-tight text-[#183d2c] sm:text-6xl">Một khoảng lặng, <span className="font-serif italic">đúng vị bạn.</span></h1>
        <p className="mt-6 max-w-lg text-lg leading-8 text-[#66736a]">Chọn thức uống yêu thích từ thực đơn BrewLite. Đặt món gọn nhẹ, dành thêm thời gian cho điều bạn thích.</p>
        <Link href="/menu" className="mt-8 inline-flex min-h-12 items-center justify-center rounded-full bg-[#183d2c] px-7 font-semibold text-white transition hover:bg-[#24563e] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#183d2c]">Khám phá thực đơn <span aria-hidden="true" className="ml-3">↗</span></Link>
      </div>
      <div className="relative mx-auto w-full max-w-xl">
        <div className="absolute -inset-4 rotate-2 rounded-[2rem] bg-[#e6eadc]" />
        {/* Existing project image used as the landing visual. */}
        <ProductImage src="/img/ca-phe-sua.jpg" alt="Ly cà phê sữa BrewLite" className="relative aspect-[4/3] w-full rounded-[1.7rem] object-cover shadow-xl" />
        <div className="absolute -bottom-5 left-4 rounded-2xl border border-[#e5e7dc] bg-[#fbf8ef] px-5 py-3 shadow-lg sm:left-8"><p className="text-xs uppercase tracking-widest text-[#66736a]">Pha chậm, thưởng thức lâu</p><p className="mt-1 font-semibold text-[#183d2c]">Chào ngày mới cùng BrewLite</p></div>
      </div>
    </section>
  );
}

