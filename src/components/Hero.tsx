"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { scrollToId } from "@/lib/scroll";

const TICKER = [
  "PHOTO-EYE · OK",
  "HEIGHT PROFILE · ARMED",
  "INDUCTIVE TAG · SCANNING",
  "LOAD CELL · 240 Hz",
  "3-WAY GATE CASCADE · ACTIVE",
  "WATCHDOG · BEATING",
  "OEE LEDGER · OPEN",
  "MADE TO SORT",
];

export default function Hero() {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const ctx = gsap.context(() => {
      gsap.from(".hero .line-inner", {
        yPercent: 112,
        duration: 1.25,
        stagger: 0.13,
        ease: "power4.out",
        delay: 0.2,
      });
      gsap.from(".hero .eyebrow > *", {
        opacity: 0,
        y: 12,
        duration: 0.8,
        stagger: 0.08,
        delay: 0.1,
        ease: "power2.out",
      });
      gsap.from(".hero .lede > *", {
        opacity: 0,
        y: 18,
        duration: 0.9,
        stagger: 0.1,
        delay: 0.75,
        ease: "power3.out",
      });
      gsap.from(".marquee", { opacity: 0, duration: 1.2, delay: 1.1 });
    }, el);
    return () => ctx.revert();
  }, []);

  return (
    <div ref={root} id="signal">
      <div className="hero wide">
        <div className="eyebrow">
          <span className="mono">01 / SIGNAL</span>
          <span className="mono">SMART SORTING LINE — WEB SANDBOX</span>
          <span className="mono">EST. 2026 — REV 0.9</span>
        </div>

        <h1 className="display">
          <span style={{ display: "block", overflow: "hidden" }}>
            <span className="line-inner" style={{ display: "block" }}>
              Made to <span className="accent">sort.</span>
            </span>
          </span>
          <span style={{ display: "block", overflow: "hidden" }}>
            <span className="line-inner" style={{ display: "block" }}>
              Built to <span className="accent">last.</span>
            </span>
          </span>
        </h1>

        <div className="lede">
          <p>
            A 3-way smart sorting line, simulated end to end in your browser —
            four sensors, three gates, a reject chute, a watchdog and its own
            operating ledger. One pass down the belt. Four verdicts. No
            spreadsheet, no server.
          </p>
          <button className="cta" onClick={() => scrollToId("line")}>
            RUN THE LINE ↓
          </button>
        </div>
      </div>

      <div className="marquee" aria-hidden="true">
        <div className="track">
          {Array.from({ length: 2 }).map((_, dup) =>
            TICKER.concat(TICKER.slice(0, 4)).map((t, i) => (
              <span key={dup * 100 + i}>{t} —</span>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
