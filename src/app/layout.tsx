import type { Metadata } from "next";
import { Inter, Archivo, JetBrains_Mono, Silkscreen, Pixelify_Sans } from "next/font/google";
import "./globals.css";
import SmoothScroll from "@/components/SmoothScroll";
import Chrome from "@/components/Chrome";
import ConsolePanel from "@/components/ConsolePanel";
import PointerGlow from "@/components/PointerGlow";

// Open faces throughout; none licensed, none bundled: Inter (text),
// Archivo (display), JetBrains Mono (code), Silkscreen and Pixelify Sans
// (raster).
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
});

const mono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

const silkscreen = Silkscreen({
  variable: "--font-silkscreen",
  subsets: ["latin"],
  weight: ["400", "700"],
});

const pixelify = Pixelify_Sans({
  variable: "--font-pixelify",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Fluxline, a smart sorting line",
  description:
    "A sorting line with three lanes and a reject chute, simulated end to end in the browser. Four sensors read each item in one pass, the gates route it, and the ledger counts everything. The program that would run the real line is in this repository.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${archivo.variable} ${mono.variable} ${silkscreen.variable} ${pixelify.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <SmoothScroll>
          <div className="preloader" aria-hidden="true">
            <span>FLUXLINE</span>
          </div>
          <div className="crt-sweep" aria-hidden="true" />
          <Chrome />
          <ConsolePanel />
          <PointerGlow />
          {children}
        </SmoothScroll>
      </body>
    </html>
  );
}
