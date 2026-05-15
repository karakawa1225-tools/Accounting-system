import type { Metadata } from "next";
import { Noto_Serif_JP, Outfit } from "next/font/google";
import "./globals.css";

const notoSerifJP = Noto_Serif_JP({
  subsets: ["latin"],
  weight: ["500", "600", "700", "900"],
  variable: "--font-sans",
  display: "swap",
});

const outfit = Outfit({
  subsets: ["latin"],
  weight: ["700", "800", "900"],
  variable: "--font-brand",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Silverjet",
  description: "Double-entry AR/AP and master data for lean finance teams.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" className={`${notoSerifJP.variable} ${outfit.variable}`}>
      <body className="min-h-screen font-sans text-[17px] font-semibold leading-relaxed tracking-[0.06em] text-[#102131] antialiased">
        {children}
      </body>
    </html>
  );
}
