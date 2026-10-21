"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { scrollToId } from "@/lib/scroll";
import { useLine, formatWallClock } from "@/lib/sim/store";

const CHAPTERS = [
  { id: "signal", num: "01", label: "SIGNAL" },
  { id: "line", num: "02", label: "THE LINE" },
  { id: "stations", num: "03", label: "STATIONS" },
  { id: "ledger", num: "04", label: "LEDGER" },
  { id: "unit", num: "05", label: "UNIT" },
];

// ── wall clock ──────────────────────────────────────────────
// The clock's hands belong to the platform, not to React state: the
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
    ? "E-STOP"
    : snap.jammed
      ? "JAM"
      : snap.running
        ? "RUNNING"
        : "STANDBY";
  const tone = snap.estopped ? "redled" : snap.jammed ? "hot" : snap.running ? "okled" : "off";
  return (
    <span className="chip">
      <span className={"led " + tone} />
      <span>{state}</span>
    </span>
  );
}

export default function Chrome() {
  const [active, setActive] = useState("signal");
  const observed = useRef(false);

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

  return (
    <>
      <header className="chrome">
        <span className="wordmark">FLUXLINE&#174;</span>
        <span className="role">
          <span style={{ display: "inline-flex", alignItems: "center", gap: 9, marginRight: 26 }}>
            <StatusChip />
          </span>
          LINE 01 · PLANT FLOOR &nbsp;/&nbsp; <Clock />
        </span>
      </header>

      <nav className="rail" aria-label="Chapters">
        {CHAPTERS.map((c) => (
          <button
            key={c.id}
            className={active === c.id ? "active" : ""}
            onClick={() => scrollToId(c.id)}
            aria-current={active === c.id ? "true" : undefined}
            aria-label={`${c.num} · ${c.label}`}
          >
            <span className="dot" />
            <span className="lbl">{c.num}&nbsp;&nbsp;{c.label}</span>
          </button>
        ))}
      </nav>
    </>
  );
}
