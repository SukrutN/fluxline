"use client";

import { useEffect, type ReactNode } from "react";
import { initSmoothScroll } from "@/lib/scroll";

export default function SmoothScroll({ children }: { children: ReactNode }) {
  useEffect(() => initSmoothScroll(), []);
  return <>{children}</>;
}
