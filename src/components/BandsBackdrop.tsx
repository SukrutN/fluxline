"use client";

// The theater's living backdrop: rows of signal-tinted bars drifting on
// a slow sine, in a plain 2D canvas, quiet enough to sit under the veils.
import { useEffect, useRef } from "react";

export default function BandsBackdrop() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let t = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(canvas.clientWidth * dpr));
      canvas.height = Math.max(1, Math.round(canvas.clientHeight * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const draw = () => {
      raf = requestAnimationFrame(draw);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      ctx.clearRect(0, 0, w, h);
      t += 0.006;
      const cols = Math.max(24, Math.floor(w / 44));
      const bw = w / cols;
      for (let i = 0; i < cols; i++) {
        const n = Math.sin(t + i * 0.55) * 0.5 + 0.5;
        const n2 = Math.sin(t * 0.7 + i * 1.3 + 2) * 0.5 + 0.5;
        const bh = (0.1 + n * 0.16 + n2 * 0.1) * h;
        ctx.fillStyle = `rgba(94, 255, 136, ${(0.05 + n2 * 0.07).toFixed(3)})`;
        ctx.fillRect(i * bw + bw * 0.18, h - bh, bw * 0.64, bh);
      }
    };
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return <canvas ref={ref} className="bands-backdrop" />;
}
