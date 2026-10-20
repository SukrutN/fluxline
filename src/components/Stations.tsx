"use client";

// 03 · STATIONS — the numbered sensor rolls.

import { useEffect, useRef, type ReactNode } from "react";
import { telemetry, useLine } from "@/lib/sim/store";
import { reveal } from "@/lib/scroll";
import type { SensorId } from "@/lib/sim/engine";

const CARDS: Array<{
  sensor: SensorId;
  num: string;
  name: string;
  copy: string;
  rule: string;
  schem: ReactNode;
}> = [
  {
    sensor: "PE",
    num: "01",
    name: "Photo-Eye Signal",
    copy:
      "An infrared beam crosses the belt. Break it and the piece gets named — FLX-0001, FLX-0002, all the way down. Nothing rides the line without a number.",
    rule: "SENSE · REGISTRY",
    schem: (
      <svg viewBox="0 0 140 64" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" aria-hidden="true" className="schem">
        <rect x="18" y="8" width="6" height="48" />
        <rect x="116" y="8" width="6" height="48" />
        <line x1="24" y1="20" x2="116" y2="20" strokeDasharray="3 4" />
        <rect x="58" y="26" width="24" height="16" fill="currentColor" opacity="0.16" />
        <circle cx="24" cy="20" r="2.6" fill="currentColor" />
        <circle cx="116" cy="20" r="2.6" fill="currentColor" />
      </svg>
    ),
  },
  {
    sensor: "HS",
    num: "02",
    name: "Height Profile",
    copy:
      "A light curtain sweeps the piece top to bottom. Anything past 165 mm is tall, and tall goes straight to the oversize lane — that rule beats everything after it.",
    rule: "TALL → L03 OVERSIZE",
    schem: (
      <svg viewBox="0 0 140 64" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" aria-hidden="true" className="schem">
        <path d="M96 8 H100 V26 H104 V34 H108 V56" />
        <line x1="40" y1="6" x2="40" y2="58" strokeDasharray="2 5" />
        <rect x="52" y="30" width="28" height="26" fill="currentColor" opacity="0.16" />
        <line x1="24" y1="56" x2="118" y2="56" />
        <path d="M30 18 L36 14 M30 18 L36 22" />
      </svg>
    ),
  },
  {
    sensor: "ID",
    num: "03",
    name: "Inductive Tag",
    copy:
      "An eddy-current probe under the belt listens for ferrous signatures. If the reading comes back metal, the piece belongs to the steel loop.",
    rule: "TAGGED → L02 STEEL",
    schem: (
      <svg viewBox="0 0 140 64" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" aria-hidden="true" className="schem">
        <path d="M40 44 a20 20 0 0 1 40 0" strokeDasharray="2 4" />
        <path d="M46 44 a14 14 0 0 1 28 0" />
        <rect x="94" y="34" width="24" height="14" fill="currentColor" opacity="0.16" />
        <path d="M104 34 v-6 M100 28 h8 M104 22 v-6" />
        <line x1="24" y1="56" x2="118" y2="56" />
      </svg>
    ),
  },
  {
    sensor: "LC",
    num: "04",
    name: "Load Cell Check",
    copy:
      "Strain gauges hold the piece still and read its weight. Under 2 kg or over 12 kg counts as off-band, and off-band pieces never pass QC.",
    rule: "OUTLIER → REJECT",
    schem: (
      <svg viewBox="0 0 140 64" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" aria-hidden="true" className="schem">
        <path d="M34 44 L106 44 L88 56 L52 56 Z" fill="currentColor" opacity="0.16" />
        <rect x="56" y="26" width="28" height="18" fill="currentColor" opacity="0.16" />
        <path d="M70 6 v10 M66 12 L70 20 L74 12" />
        <path d="M40 44 h-8 M108 44 h8" />
        <text x="86" y="20" fontSize="9" fill="currentColor" className="mono">*</text>
      </svg>
    ),
  },
];

function LiveRead({ sensor }: { sensor: SensorId }) {
  const snap = useLine();
  const hot = snap.sensorHot[sensor] > 0.3;
  return (
    <span className="cell" style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 10 }}>
      <span className={"led" + (hot ? " hot" : "")} />
      <span style={{ color: "var(--muted)" }}>LIVE&nbsp;/</span>
      <span>{snap.reads[sensor]}</span>
    </span>
  );
}

export default function Stations() {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    reveal(ref.current);
    // warm the engine so telemetry is alive on arrival
    telemetry.getEngine();
  }, []);

  return (
    <section id="stations" ref={ref} className="section">
      <div className="wide">
        <header className="chapter" data-reveal>
          <span className="num">03</span>
          <span className="label">STATIONS</span>
          <span className="of">FOUR STATIONS — ONE PASS</span>
        </header>

        <div className="station-grid">
          {CARDS.map((c) => (
            <article className="station" data-reveal key={c.sensor}>
              <div className="head">
                <span className="mono">ST·{c.num}</span>
                <LiveRead sensor={c.sensor} />
              </div>
              {c.schem}
              <h3>{c.name}</h3>
              <p>{c.copy}</p>
              <span className="rule-tag">{c.rule}</span>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
