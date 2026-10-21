"use client";

// FLUXLINE motion core: Lenis smooth scroll driven by the GSAP ticker,
// plus the small reveal helpers sections share.

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";

// The plugin is registered at module load because effects run bottom-up and some sections
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

  // QA / demo handle for programmatic scroll choreography
  if (typeof window !== "undefined") {
    (window as unknown as Record<string, unknown>).__LENIS = instance;
  }

  const onScroll = () => ScrollTrigger.update();
  instance.on("scroll", onScroll);

  // The page is alive: the event journal fills in after load, fonts swap,
  // media decodes. Any of those shifts every position below them, so
  // re-anchor all triggers whenever the document's box actually changes,
  // debounced so a burst of journal rows costs one refresh, not one per row.
  let refreshTimer = 0;
  const ro = new ResizeObserver(() => {
    window.clearTimeout(refreshTimer);
    refreshTimer = window.setTimeout(() => ScrollTrigger.refresh(), 150);
  });
  ro.observe(document.body);

  const raf = (time: number) => instance.raf(time * 1000);
  gsap.ticker.add(raf);
  gsap.ticker.lagSmoothing(0);

  return () => {
    gsap.ticker.remove(raf);
    instance.off("scroll", onScroll);
    ro.disconnect();
    window.clearTimeout(refreshTimer);
    instance.destroy();
    lenis = null;
  };
}

/** Rise elements carrying [data-reveal] into view as a function of the
 *  scroll position, and cascade the direct children of
 *  [data-reveal-stagger] containers the same way.
 *
 *  Everything is scrubbed, never timed: content moves exactly as far as
 *  the reader has scrolled, stops the instant they stop, and plays in
 *  reverse on the way back up. There is nothing to catch up after a fast
 *  flick, so it can never read as lag, and there are no from-states that
 *  can stick hidden, because every value renders from the live position. */
export function reveal(root: HTMLElement | null) {
  if (!root) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  // Bind each element once. Effects run twice under StrictMode, and a
  // second from-tween on the same element would both fight the first
  // for every scrub write and measure its trigger range against the
  // first one's applied from-state, 56 px off.
  root.querySelectorAll<HTMLElement>("[data-reveal]:not([data-reveal-bound])").forEach((el) => {
    el.dataset.revealBound = "1";
    gsap.from(el, {
      y: 56,
      autoAlpha: 0,
      duration: 1,
      ease: "none",
      scrollTrigger: {
        trigger: el,
        start: "top bottom",
        end: "top 62%",
        scrub: true,
      },
    });
  });

  root.querySelectorAll<HTMLElement>("[data-reveal-stagger]:not([data-reveal-bound])").forEach((group) => {
    group.dataset.revealBound = "1";
    const kids = group.querySelectorAll(":scope > *");
    if (kids.length === 0) return;
    gsap.from(kids, {
      y: 40,
      autoAlpha: 0,
      duration: 1,
      stagger: 0.08,
      ease: "none",
      scrollTrigger: {
        trigger: group,
        start: "top bottom",
        end: "top 68%",
        scrub: true,
      },
    });
  });
}
