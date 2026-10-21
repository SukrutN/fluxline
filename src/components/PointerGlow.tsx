"use client";

// The pointer glow: a soft signal-colored wash that follows the cursor
// across the page, additive over the dark machine room. Direct DOM
// writes on a requestAnimationFrame loop, no state, nothing re-renders.
import { useEffect, useRef } from "react";

export default function PointerGlow() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!window.matchMedia("(hover: hover)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let raf = 0;
    let tx = window.innerWidth / 2;
    let ty = window.innerHeight / 3;
    let x = tx;
    let y = ty;
    let awake = false;

    const move = (e: MouseEvent) => {
      tx = e.clientX;
      ty = e.clientY;
      if (!awake) {
        awake = true;
        el.style.opacity = "1";
      }
    };

    const loop = () => {
      raf = requestAnimationFrame(loop);
      x += (tx - x) * 0.1;
      y += (ty - y) * 0.1;
      el.style.transform = `translate(${x - 320}px, ${y - 320}px)`;
    };

    window.addEventListener("mousemove", move, { passive: true });
    raf = requestAnimationFrame(loop);
    return () => {
      window.removeEventListener("mousemove", move);
      cancelAnimationFrame(raf);
    };
  }, []);

  return <div ref={ref} className="pointer-glow" aria-hidden="true" />;
}
