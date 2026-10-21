"use client";

// The closing theater: a 200vh scroll region pulled up 100vh behind the
// section above, a masked wrapper that shows only its bottom half, and a
// sticky stage inside. Scrolling sweeps that hard-edged window up over
// the stage while it pins, so the statement rises into view through the
// opening; a slow scrub adds a little depth inside the window and draws
// the closing rule once the headline has cleared.
import { useEffect, useRef } from "react";
import gsap from "gsap";
import { scrollToId } from "@/lib/scroll";
import BandsBackdrop from "@/components/BandsBackdrop";

export default function ClosingTheater() {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const stage = ref.current?.querySelector(".closing-sticky");
    const ctx = gsap.context(() => {
      // The hold: the region pins when its
      // top reaches the viewport top and releases when its bottom reaches
      // the viewport bottom. The mask window sweeps over exactly that
      // interval. Scrub is exact, never smoothed: what moves on screen
      // is a pure function of the scroll position, so it cannot lag.
      // The stage only takes pointer events once the window has opened
      // over it; masked out, it travels behind the section above and
      // must not shadow that section's own links.
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: ref.current,
          start: "top top",
          end: "bottom bottom",
          scrub: true,
          onUpdate: (self) => {
            stage?.classList.toggle("is-open", self.progress > 0.5);
          },
          onLeaveBack: () => {
            stage?.classList.remove("is-open");
          },
        },
      });
      tl.fromTo(
        ".closing .closing-content",
        { yPercent: 16 },
        { yPercent: 0, duration: 1, ease: "none" }
      ).fromTo(
        ".closing .closure",
        { scaleY: 0 },
        { scaleY: 1, duration: 0.35, ease: "none" },
        0.55
      );
    }, ref);
    // Re-anchoring the scrub when the layout settles (journal rows, fonts,
    // media) is owned by the ResizeObserver in the motion core, so every
    // trigger on the page re-anchors together.
    return () => ctx.revert();
  }, []);

  return (
    <section className="closing" ref={ref} aria-label="Closing statement">
      <div className="closing-masked">
        <div className="closing-sticky">
          <BandsBackdrop />
          <span className="radial-overlay" aria-hidden="true" />
          <span className="gradient-overlay" aria-hidden="true" />
          <div className="closing-content">
            <h2 className="line1">Every item, sorted</h2>
            <h2 className="line2">in a single pass</h2>
            <p className="closing-desc">
              One rule runs the whole line: read each item once, route it on
              the rules, and write it down.
            </p>
            <button className="cta" onClick={() => scrollToId("line")}>
              Run the line again ↓
            </button>
            <span className="closure" aria-hidden="true" />
          </div>
        </div>
      </div>
    </section>
  );
}
