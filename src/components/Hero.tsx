"use client";

// 01 · SIGNAL, hero, eyebrow, lede, marquee.
// The entrance choreography is pure CSS (see globals.css) so it can never
// freeze mid-state under background-tab throttling.

import { useEffect, useRef } from "react";
import { scrollToId } from "@/lib/scroll";
import { asset } from "@/lib/asset";

const TICKER = [
  "Photo-eye: OK",
  "Height profile: armed",
  "Inductive probe: scanning",
  "Load cell: sampling at 240 Hz",
  "Gate routing: active",
  "Jam watchdog: armed",
  "Ledger: counting",
  "Belt: running",
];

const HERO_TAGS: Array<{ label: string; ok?: boolean; style: React.CSSProperties }> = [
  { label: "tall item detected!", style: { left: "12%", top: "20%", ["--d" as string]: "1.4s" } },
  { label: "steel detected!", style: { left: "66%", top: "24%", ["--d" as string]: "1.7s" } },
  { label: "off-weight detected!", style: { left: "24%", top: "38%", ["--d" as string]: "2s" } },
  { label: "routed: approved", ok: true, style: { left: "58%", top: "29%", ["--d" as string]: "2.3s" } },
  { label: "routed: oversize", ok: true, style: { left: "40%", top: "14%", ["--d" as string]: "2.6s" } },
  { label: "routed: steel loop", ok: true, style: { left: "76%", top: "52%", ["--d" as string]: "2.9s" } },
];

// Browsers only autoplay muted video, and React's muted attribute does
// not set the muted property, so the play is forced from the ref.
function AmbientLoop() {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = true;
    const tryPlay = () => {
      v.play().catch(() => {});
    };
    if (v.readyState >= 2) tryPlay();
    v.addEventListener("canplay", tryPlay);
    return () => v.removeEventListener("canplay", tryPlay);
  }, []);

  return (
    <video
      ref={videoRef}
      src={asset("/media/hero-loop.mp4")}
      autoPlay
      loop
      muted
      playsInline
      preload="auto"
    />
  );
}

export default function Hero() {
  return (
    <div id="signal">
      <div className="hero wide">
        <div className="background-container" aria-hidden="true">
          <AmbientLoop />
        </div>
        <span className="radial-overlay" aria-hidden="true" />
        <span className="gradient-overlay" aria-hidden="true" />
        <div className="hero-tags" aria-hidden="true">
          {HERO_TAGS.map((t) => (
            <span key={t.label} className={"hero-tag" + (t.ok ? " ok" : "")} style={t.style}>
              <span className="bg" />
              <span className="dot" />
              <span className="label">{t.label}</span>
            </span>
          ))}
        </div>

        <div className="eyebrow">
          <span className="mono">Signal</span>
          <span className="mono">Smart sorting line</span>
          <span className="mono">Demo</span>
        </div>

        <h1 className="display">
          <span style={{ display: "block", overflow: "hidden" }}>
            <span className="line-inner" style={{ display: "block" }}>
              Every item, <span className="accent">sorted</span>
            </span>
          </span>
          <span style={{ display: "block", overflow: "hidden" }}>
            <span className="line-inner" style={{ display: "block" }}>
              in a <span className="accent">single pass</span>
            </span>
          </span>
        </h1>

        <div className="lede">
          <div className="lede-copy">
            <p>
              A sorting line has one job: every item goes to the right lane
              the first time, without slowing the belt. Fluxline reads each
              item once while it is already moving, applies the rules you
              configure, and routes it from that one reading, on as many
              lanes as the line needs. The controller program that runs on
              real hardware is available for free on{" "}
              <a
                className="lede-link"
                href="https://github.com/SukrutN/fluxline"
                target="_blank"
                rel="noreferrer"
              >
                GitHub
              </a>
              .
            </p>
          </div>
          <button className="cta" onClick={() => scrollToId("line")}>
            Run the line ↓
          </button>
        </div>
      </div>

      <div className="marquee" aria-hidden="true">
        <div className="track">
          {Array.from({ length: 2 }).map((_, dup) =>
            TICKER.concat(TICKER.slice(0, 4)).map((t, i) => (
              <span key={dup * 100 + i}>{t}</span>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
