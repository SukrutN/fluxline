"use client";

import { useEffect, useRef, useState } from "react";
import { scrollToId } from "@/lib/scroll";
import { useLine, formatWallClock } from "@/lib/sim/store";

const CHAPTERS = [
  { id: "signal", num: "01", label: "SIGNAL" },
  { id: "line", num: "02", label: "THE LINE" },
  { id: "stations", num: "03", label: "STATIONS" },
  { id: "ledger", num: "04", label: "LEDGER" },
  { id: "unit", num: "05", label: "UNIT" },
];

function Clock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <span suppressHydrationWarning>
      {now ? formatWallClock(now) : "--:--:--"}
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
  const tone = snap.estopped ? "redled" : snap.jammed ? "hot" : snap.running ? "okled" : "";
  return (
    <span className="cell">
      <span className={"led " + tone} />
      <span className="val">{state}</span>
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
          >
            <span className="dot" />
            {c.num}&nbsp;<span className="lbl">{c.label}</span>
          </button>
        ))}
      </nav>
    </>
  );
}
