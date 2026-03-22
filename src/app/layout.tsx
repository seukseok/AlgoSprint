import type { Metadata } from "next";
import "./globals.css";
import { SafeModeBanner } from "@/components/safe-mode-banner";

export const metadata: Metadata = {
  title: "AlgoSprint BOJ 컴파일러",
  description: "BOJ 풀이 동반용 웹 컴파일러",
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
        <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
