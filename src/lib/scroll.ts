"use client";

// FLUXLINE motion core — Lenis smooth scroll driven by the GSAP ticker,
// plus the small reveal helpers sections share.

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";

// registered at module load — effects run bottom-up and some sections
// build ScrollTriggers before SmoothScroll's effect registers the plugin.
gsap.registerPlugin(ScrollTrigger);

let lenis: Lenis | null = null;

export function getLenis(): Lenis | null {
  return lenis;
}

export function scrollToId(id: string) {
  if (typeof document === "undefined") return;
  const el = document.getElementById(id);
  if (!el) return;
  if (lenis) {
    lenis.scrollTo(el, {
      duration: 1.5,
      easing: (t: number) => 1 - Math.pow(1 - t, 4),
    });
  } else {
    el.scrollIntoView({ behavior: "smooth" });
  }
}

export function initSmoothScroll(): () => void {
  gsap.registerPlugin(ScrollTrigger);

  const instance = new Lenis({
    lerp: 0.11,
    smoothWheel: true,
    wheelMultiplier: 1,
  });
  lenis = instance;

  const onScroll = () => ScrollTrigger.update();
  instance.on("scroll", onScroll);

  const raf = (time: number) => instance.raf(time * 1000);
  gsap.ticker.add(raf);
  gsap.ticker.lagSmoothing(0);

  return () => {
    gsap.ticker.remove(raf);
    instance.off("scroll", onScroll);
    instance.destroy();
    lenis = null;
  };
}

/** Slide elements carrying [data-reveal] up once, on section entry. */
export function reveal(root: HTMLElement | null) {
  if (!root) return;
  const targets = root.querySelectorAll("[data-reveal]");
  if (targets.length === 0) return;
  gsap.from(targets, {
    y: 30,
    opacity: 0,
    duration: 0.95,
    stagger: 0.07,
    ease: "power3.out",
    scrollTrigger: {
      trigger: root,
      start: "top 80%",
      once: true,
    },
  });
}
