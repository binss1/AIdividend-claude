import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Navigation from "@/components/Navigation";
import { AuthProvider } from "@/components/AuthProvider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI Dividend - 미국 배당주 스크리닝",
  description:
    "AI 기반 미국 배당주 및 ETF 스크리닝 플랫폼. Q-LEAD 모델을 활용한 지능형 배당 투자 분석.",
  keywords: ["배당주", "미국주식", "ETF", "스크리닝", "AI", "배당투자"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-gray-950 text-white">
        <AuthProvider>
          <Navigation />
          <main className="flex-1 pt-16">{children}</main>
        </AuthProvider>
      </body>
    </html>
  );
}
