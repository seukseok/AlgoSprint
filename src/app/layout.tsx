import type { Metadata } from "next";
import "./globals.css";
import { TopNav } from "@/components/top-nav";
import { SafeModeBanner } from "@/components/safe-mode-banner";

export const metadata: Metadata = {
  title: "AlgoSprint C++",
  description: "C++ 알고리즘 학습 워크스페이스",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased">
        <SafeModeBanner />
        <TopNav />
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
