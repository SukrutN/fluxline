"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { scrollToId } from "@/lib/scroll";
import { useLine, formatWallClock } from "@/lib/sim/store";

const CHAPTERS = [
  { id: "signal", num: "01", label: "Signal" },
  { id: "line", num: "02", label: "The line" },
  { id: "stations", num: "03", label: "Stations" },
  { id: "ledger", num: "04", label: "Ledger" },
  { id: "hosted", num: "05", label: "Host requests" },
  { id: "unit", num: "06", label: "Operating rules" },
];

// ── wall clock ──────────────────────────────────────────────
// The clock's hands belong to the platform rather than to React state: the
// component subscribes to wall time via useSyncExternalStore instead of
// running a timer that mirrors Date.now() into an effect. The snapshot is
// cached so React sees a stable value between the 1 Hz ticks (a fresh
// Date.now() on every read would look like an always-changing store and
// can loop renders). The server snapshot is 0, so SSR renders "--:--:--"
// and the very first client paint cannot disagree with it.
let wallCache = 0;

function subscribeWallClock(onChange: () => void): () => void {
  wallCache = Date.now();
  const t = setInterval(() => {
    wallCache = Date.now();
    onChange();
  }, 1000);
  return () => clearInterval(t);
}

function getWallSnapshot(): number {
  return wallCache;
}

function getWallServerSnapshot(): number {
  return 0;
}

function Clock() {
  const nowMs = useSyncExternalStore(
    subscribeWallClock,
    getWallSnapshot,
    getWallServerSnapshot
  );
  return (
    <span suppressHydrationWarning>
      {nowMs ? formatWallClock(new Date(nowMs)) : "--:--:--"}
    </span>
  );
}

function StatusChip() {
  const snap = useLine();
  const state = snap.estopped
    ? "E-stop"
    : snap.jammed
      ? "Jam"
      : snap.running
        ? "Running"
        : "Standby";
  const tone = snap.estopped ? "redled" : snap.jammed ? "warnled" : snap.running ? "okled" : "off";
  return (
    <span className="chip">
      <span className={"led " + tone} />
      <span>{state}</span>
    </span>
  );
}

// One line per chapter for the hover panel, with a live value where the
// line has one running.
function chapterPanel(
  id: string,
  snap: ReturnType<typeof useLine>
): { summary: string; live: string } {
  const oee = Math.round(snap.oee.a * snap.oee.p * snap.oee.q * 1000) / 10;
  switch (id) {
    case "signal":
      return { summary: "The demo and how to start it.", live: "Simulated end to end" };
    case "line":
      return {
        summary: "The sorter you can run: four sensors, four gates, one pass.",
        live: snap.estopped ? "E-stop latched" : snap.jammed ? "Jammed" : snap.running ? "Running" : "Standby",
      };
    case "stations":
      return {
        summary: "What each station reads, and the rule it feeds.",
        live: `${snap.detected} items detected`,
      };
    case "ledger":
      return {
        summary: "Every count the line keeps, live while it runs.",
        live: `OEE ${oee}%, ${snap.routed} routed`,
      };
    case "hosted":
      return {
        summary: "The host's requests, and the rules that answer them.",
        live: "Fixed shift replay",
      };
    case "unit":
      return {
        summary: "The rules the program runs on real hardware.",
        live: "github.com/SukrutN/fluxline",
      };
    default:
      return { summary: "", live: "" };
  }
}

// ── chrome: the page furniture, in Fluxline's words ──
// A thin anchors bar pinned to the top with the reading progress under it,
// a hover panel that opens under it with each chapter's one-liner and a
// live value, and a floating menu pill pinned to the bottom center
// carrying the wordmark, the line's live state, the plant clock, and the
// one CTA.
export default function Chrome() {
  const [active, setActive] = useState("signal");
  const [hover, setHover] = useState<string | null>(null);
  const observed = useRef(false);
  const progressRef = useRef<HTMLSpanElement>(null);
  const snap = useLine();

  useEffect(() => {
    if (observed.current) return;
    observed.current = true;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActive(e.target.id);
        }
      },
      { rootMargin: "-38% 0px -52% 0px" }
    );
    for (const c of CHAPTERS) {
      const el = document.getElementById(c.id);
      if (el) io.observe(el);
    }
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        const p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
        if (progressRef.current) {
          progressRef.current.style.transform = `scaleX(${p})`;
        }
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <>
      <div className="anchors" aria-label="Chapters">
        <button className="page-tab" onClick={() => scrollToId("signal")}>
          Fluxline
          <span className="underline" />
        </button>
        <nav
          className="anchor-list"
          onMouseLeave={() => setHover(null)}
        >
          {CHAPTERS.map((c) => (
            <button
              key={c.id}
              className={active === c.id ? "active" : ""}
              onClick={() => {
                setHover(null);
                scrollToId(c.id);
              }}
              onMouseEnter={() => setHover(c.id)}
              aria-current={active === c.id ? "true" : undefined}
            >
              {c.label}
            </button>
          ))}
        </nav>
        <span className="progress" ref={progressRef} />
      </div>

      <div
        className={"anchor-panel" + (hover ? " open" : "")}
        aria-hidden={!hover}
      >
        {hover && (
          <>
            <span className="ap-title">
              {CHAPTERS.find((c) => c.id === hover)?.label}
            </span>
            <span className="ap-summary">{chapterPanel(hover, snap).summary}</span>
            <span className="ap-live">{chapterPanel(hover, snap).live}</span>
          </>
        )}
      </div>

      <nav className="menu-pill" aria-label="Line controls">
        <span className="pill-logo">FLUXLINE&#174;</span>
        <StatusChip />
        <span className="pill-clock mono">
          <Clock />
        </span>
        <button className="pill-cta" onClick={() => scrollToId("line")}>
          Run the line
        </button>
      </nav>
    </>
  );
}
