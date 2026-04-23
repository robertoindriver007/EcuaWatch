import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";

import TopTicker from "@/components/layout/TopTicker";
import Navbar from "@/components/layout/Navbar";
import BottomTicker from "@/components/layout/BottomTicker";
import OutbrainWidget from "@/components/ads/OutbrainWidget";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "EcuaWatch | El Estado bajo la Lupa Digital",
  description:
    "Red Cívica de Transparencia del Estado Ecuatoriano. Indicadores macroeconómicos en tiempo real, trazabilidad de leyes, contratos y funcionarios.",
  keywords: ["Ecuador", "transparencia", "gobierno", "Asamblea Nacional", "contraloría", "datos abiertos"],
  openGraph: {
    title: "EcuaWatch | El Estado bajo la Lupa Digital",
    description: "Plataforma ciudadana de vigilancia estatal de Ecuador.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <head>
        {/* ── Google AdSense (replace with your real publisher ID) ── */}
        <Script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-XXXXXXXXXXXXXXXX"
          crossOrigin="anonymous"
          strategy="lazyOnload"
        />
      </head>
      <body className="min-h-full flex flex-col bg-[#f8fafc]">
        {/* Top live indicators ticker */}
        <TopTicker />

        {/* Main navigation */}
        <Navbar />

        {/* Page content */}
        <main className="flex-1 w-full relative animate-fade-in-up">
          {children}
        </main>

        {/* Outbrain recommendation widget (passive revenue, non-invasive) */}
        <OutbrainWidget />

        {/* Breaking news/alerts bottom ticker */}
        <BottomTicker />
      </body>
    </html>
  );
}
