import type { Metadata } from "next";
import "./globals.css";
import { AppProviders } from "@/components/providers/app-providers";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { BottomNav } from "@/components/layout/bottom-nav";
import { CartBar } from "@/components/layout/cart-bar";

export const metadata: Metadata = {
  title: {
    default: "BrewLite — Cà phê, theo cách của bạn",
    template: "%s | BrewLite",
  },
  description: "Khám phá thực đơn BrewLite và đặt món yêu thích.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="vi">
      <body className="flex min-h-screen flex-col antialiased bg-[#f5f7f2]">
        <AppProviders>
          <SiteHeader />
          {/* pb-32 trên mobile để tránh bị CartBar + BottomNav che nội dung */}
          <main className="flex-1 pb-32 md:pb-0">{children}</main>
          <SiteFooter />
          {/* Chỉ hiện trên mobile (md:hidden bên trong component) */}
          <CartBar />
          <BottomNav />
        </AppProviders>
      </body>
    </html>
  );
}
