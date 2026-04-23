import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import TopTicker from "@/components/layout/TopTicker";
import Navbar from "@/components/layout/Navbar";
import BottomTicker from "@/components/layout/BottomTicker";
import MobileNav from "@/components/layout/MobileNav";

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
    "Red Cívica de Transparencia del Estado Ecuatoriano. Indicadores macroeconómicos en tiempo real, trazabilidad de leyes, contratos y funcionarios. Impulsado por IA autónoma.",
  keywords: ["Ecuador", "transparencia", "gobierno", "Asamblea Nacional", "contraloría", "datos abiertos", "vigilancia ciudadana", "IA"],
  openGraph: {
    title: "EcuaWatch | El Estado bajo la Lupa Digital",
    description: "Superapp de vigilancia ciudadana de Ecuador. Datos del gobierno en tiempo real, reels cívicos generados por IA, comunidades activas.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-[#f8fafc]">
        {/* Top live indicators ticker */}
        <TopTicker />

        {/* Main navigation */}
        <Navbar />

        {/* Page content */}
        <main className="flex-1 w-full relative animate-fade-in-up">
          {children}
        </main>

        {/* Breaking news/alerts bottom ticker */}
        <BottomTicker />

        {/* Mobile bottom navigation */}
        <MobileNav />
      </body>
    </html>
  );
}
