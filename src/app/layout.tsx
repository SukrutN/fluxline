import type { Metadata } from "next";
import { Fraunces, Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import SmoothScroll from "@/components/SmoothScroll";
import Chrome from "@/components/Chrome";

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
    "A 3-way sorting line simulated end to end in the browser — sensors, gates, faults and the running counts behind them. Made to sort. Built to last.",
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
