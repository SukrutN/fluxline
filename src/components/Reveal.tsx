"use client";

// Server-rendered sections mount the reveal engine through this wrapper:
// it gives the engine a root to scan for [data-reveal] and
// [data-reveal-stagger] targets without making the section itself a
// client component.
import { useEffect, useRef } from "react";
import { reveal } from "@/lib/scroll";

export default function Reveal({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    reveal(ref.current);
  }, []);

  return <div ref={ref}>{children}</div>;
}
