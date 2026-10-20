import type { Metadata } from "next";
import { Fraunces, Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import SmoothScroll from "@/components/SmoothScroll";
import Chrome from "@/components/Chrome";
import Hero from "@/components/Hero";
import LineSection from "@/components/LineSection";
import Stations from "@/components/Stations";
import LedgerSection from "@/components/LedgerSection";
import UnitSection from "@/components/UnitSection";

const serif = Fraunces({
  variable: "--font-serif",
  subsets: ["latin"],
});

const grotesk = Space_Grotesk({
  variable: "--font-grotesk",
  subsets: ["latin"],
});

const mono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FLUXLINE\u00AE — Line 01 · Smart Sorting Systems",
  description:
    "A smart 3-way sorting line simulated end to end in the browser — sensors, gates, faults and its operating ledger. Made to sort. Built to last.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${serif.variable} ${grotesk.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <SmoothScroll>
          <Chrome />
          {children}
        </SmoothScroll>
      </body>
    </html>
  );
}
