"use client";

// 05 · HOSTED, a supervisor may ask; the floor's law keeps the last word.
// Figures are ported from fluxline-plc's seeded bench and locked by
// src/lib/hosted.test.ts, the page never invents a number.

import { useEffect, useRef } from "react";
import { reveal } from "@/lib/scroll";
import {
  BUCKETS,
  ENGINE,
  LATENCY_NOTE,
  LAW,
  MAX_MS,
  MEAN_MS,
  MIN_MS,
  PIECES,
  REGISTERS,
  RELEASES,
  VERDICTS,
  WATCHDOG_S,
  WALKTHROUGH,
  asSeconds,
  bucketTotal,
} from "@/lib/hosted";

function Histogram() {
  const max = Math.max(1, ...BUCKETS.map((b) => b.count));
  const W = 220;
  const H = 92;
  const bw = W / BUCKETS.length;
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: H, display: "block" }} aria-hidden="true">
        <line x1="0" y1={H - 1} x2={W} y2={H - 1} stroke="var(--rule)" />
        {BUCKETS.map((b, i) => {
          const h = (b.count / max) * (H - 14);
          return (
            <rect
              key={b.fromMs}
              x={i * bw + 7}
              y={H - 1 - h}
              width={bw - 14}
              height={h}
              fill={b.count === 0 ? "var(--rule)" : "var(--ink)"}
            />
          );
        })}
      </svg>
      <div style={{ display: "flex", marginTop: 8 }}>
        {BUCKETS.map((b) => (
          <span
            key={b.fromMs}
            className="mono"
            style={{ flex: 1, textAlign: "center", fontSize: 9, color: "var(--muted-2)", letterSpacing: "0.08em" }}
          >
            {b.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function HostedSection() {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    reveal(ref.current);
  }, []);

  return (
    <section id="hosted" ref={ref} className="section ledger-paper">
      <div className="wide">
        <header className="chapter" data-reveal>
          <span className="num">05</span>
          <span className="label">HOSTED</span>
          <span className="of">THE HOST ASKS. THE LINE DECIDES</span>
        </header>

        <div className="manifesto" style={{ maxWidth: 980, marginBottom: "clamp(40px,6vw,80px)" }} data-reveal>
          <p className="big" style={{ fontSize: "clamp(30px,3.8vw,54px)" }}>
            The host asks over Modbus.{" "}
            <span className="accent">The line decides which lane the piece takes.</span>
          </p>
        </div>

        <p className="mono" style={{ color: "var(--muted)", fontSize: 11, letterSpacing: "0.1em", margin: "0 0 34px" }} data-reveal>
          THE LAW · {LAW}
          <br />
          <span style={{ color: "var(--muted-2)" }}>
            SEEDED SHIFT · {PIECES} PIECES · {RELEASES} RELEASES · WATCHDOG {WATCHDOG_S} S · {ENGINE}
          </span>
        </p>

        <div className="hosted-grid">
          <div className="hosted-latency" data-reveal>
            <p className="metric-big">RELEASE → DIVERT. {RELEASES} RELEASES</p>
            <Histogram />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginTop: 18 }}>
              {[
                ["MIN", asSeconds(MIN_MS)],
                ["MEAN", asSeconds(MEAN_MS)],
                ["MAX", asSeconds(MAX_MS)],
              ].map(([k, v]) => (
                <div key={k} style={{ borderTop: "1px solid var(--rule)", paddingTop: 8 }}>
                  <p className="mono" style={{ color: "var(--muted)", margin: 0 }}>{k}</p>
                  <p className="mono" style={{ fontSize: 13, margin: "4px 0 0", color: "var(--ink)" }}>{v}</p>
                </div>
              ))}
            </div>
            <p className="mono" style={{ color: "var(--muted-2)", marginTop: 22, fontSize: 10, lineHeight: 1.7 }}>
              ACCEPTED {VERDICTS.accepted} · VETOED {VERDICTS.vetoed} · REFUSED 0 · EXPIRED 0
              <br />
              {bucketTotal(BUCKETS)} OF {RELEASES} PIECES BUCKETS. NONE EATEN
            </p>
          </div>

          <div className="hosted-regs lanes-block" data-reveal>
            <p className="metric-big">HOST COMMAND BLOCK. WORDS AT SHIFT END</p>
            {REGISTERS.map((r) => (
              <div className="lane-row" key={r.addr}>
                <span>
                  {r.addr} · {r.name}
                  <br />
                  <span style={{ color: "var(--muted-2)", fontSize: 9, textTransform: "none", letterSpacing: "0.06em" }}>
                    {r.writer === "host" ? "HOST WROTE" : "LINE WROTE"} · {r.note}
                  </span>
                </span>
                <b style={{ fontVariantNumeric: "tabular-nums" }}>{r.value}</b>
              </div>
            ))}
          </div>

          <div className="hosted-walk" data-reveal>
            <p className="metric-big">SCAN BY SCAN. THE VETO, THEN THE ASK HONORED</p>
            <ul className="event-list">
              {WALKTHROUGH.map((w, i) => (
                <li key={`${w.tS}-${i}`} className={i >= 5 ? "ok" : ""}>
                  <span className="t">{w.tS.toFixed(1)}s</span>
                  <span className="kind">{w.who.toUpperCase()}</span>
                  <span style={{ flex: 1 }}>{w.what}</span>
                </li>
              ))}
            </ul>
            <p className="mono" style={{ color: "var(--muted-2)", marginTop: 20, fontSize: 10, lineHeight: 1.7 }}>
              {LATENCY_NOTE}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
