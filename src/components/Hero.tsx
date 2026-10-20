"use client";

// 01 · SIGNAL — hero, eyebrow, lede, marquee.
// The entrance choreography is pure CSS (see globals.css) so it can never
// freeze mid-state under background-tab throttling.

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
  return (
    <div id="signal">
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
