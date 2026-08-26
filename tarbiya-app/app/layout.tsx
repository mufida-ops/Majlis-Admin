import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Fraunces, Source_Serif_4, Inter } from "next/font/google";
import "./globals.css";

// Three type roles (see lib/theme.ts `fonts`) actually loaded as webfonts --
// previously referenced by name in inline styles but never loaded, so
// everything silently rendered in the system UI font.
const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-display", weight: ["500", "600"] });
const sourceSerif = Source_Serif_4({ subsets: ["latin"], variable: "--font-body" });
const inter = Inter({ subsets: ["latin"], variable: "--font-ui" });

export const metadata: Metadata = {
  title: "Tarbiya",
  description: "AI-assisted Islamic Education lesson planning for teachers -- assembled only from an approved content library.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${sourceSerif.variable} ${inter.variable}`}>
      <body>{children}</body>
    </html>
  );
}
