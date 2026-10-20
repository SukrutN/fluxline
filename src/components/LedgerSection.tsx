"use client";

// 04 · LEDGER — OEE, sparkline, lane journal, event stream.

import { useEffect, useRef } from "react";
import { telemetry, useLine, formatUptime } from "@/lib/sim/store";
import { reveal } from "@/lib/scroll";
import type { LaneId } from "@/lib/sim/engine";

const R = 78;
const CIR = 2 * Math.PI * R;

const LANE_ROWS: Array<{ lane: LaneId; label: string; sub: string }> = [
  { lane: "lane1", label: "L01 — Approved", sub: "within every band" },
  { lane: "lane2", label: "L02 — Steel Loop", sub: "ferrous tag present" },
  { lane: "lane3", label: "L03 — Oversize", sub: "height ≥ 165 mm" },
  { lane: "reject", label: "RJ — Reject", sub: "weight anomaly" },
];

function pct(v: number): string {
  return (Math.round(v * 1000) / 10).toFixed(1);
}

function Spark({ data }: { data: number[] }) {
  const max = Math.max(4, ...data);
  const pts = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * 220;
      const y = 44 - (v / max) * 38;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg viewBox="0 0 220 48" style={{ width: "100%", height: 48, display: "block" }} aria-hidden="true">
      <polyline points={pts} fill="none" stroke="var(--ink)" strokeWidth="1.6" />
      <line x1="0" y1="46.5" x2="220" y2="46.5" stroke="var(--rule)" />
    </svg>
  );
}

export default function LedgerSection() {
  const snap = useLine();
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    reveal(ref.current);
    telemetry.getEngine();
  }, []);

  const oee = snap.oee.a * snap.oee.p * snap.oee.q;
  const dash = CIR * (1 - Math.min(1, Math.max(0, oee)));

  return (
    <section id="ledger" ref={ref} className="section ledger-paper">
      <div className="wide">
        <header className="chapter" data-reveal>
          <span className="num">04</span>
          <span className="label">LEDGER</span>
          <span className="of">EVERY VERDICT, ACCOUNTED</span>
        </header>

        <div className="manifesto" style={{ maxWidth: 980, marginBottom: "clamp(40px,6vw,80px)" }} data-reveal>
          <p className="big" style={{ fontSize: "clamp(30px,3.8vw,54px)" }}>
            The line writes <span className="accent">its own books.</span> OEE to the second,
            verdicts to the piece — kept at plant temperature.
          </p>
        </div>

        <div className="ledger-grid">
          <div className="oee-block" data-reveal>
            <p className="metric-big">OEE — ROLLING SESSION</p>
            <div className="oee-ring">
              <svg viewBox="0 0 200 200" width="100%" height="100%" aria-hidden="true">
                <circle cx="100" cy="100" r={R} fill="none" stroke="var(--rule)" strokeWidth="10" />
                <circle
                  cx="100"
                  cy="100"
                  r={R}
                  fill="none"
                  stroke="var(--ink)"
                  strokeWidth="10"
                  strokeDasharray={CIR}
                  strokeDashoffset={dash}
                  transform="rotate(-90 100 100)"
                  strokeLinecap="butt"
                  style={{ transition: "stroke-dashoffset 0.5s linear" }}
                />
                <circle
                  cx="100"
                  cy="100"
                  r={R - 12}
                  fill="none"
                  stroke="var(--amber)"
                  strokeWidth="1"
                  strokeDasharray="2 4"
                  opacity="0.5"
                />
              </svg>
              <div className="fig">{pct(oee)}%</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginTop: 18 }}>
              {[
                ["A", pct(snap.oee.a)],
                ["P", pct(snap.oee.p)],
                ["Q", pct(snap.oee.q)],
              ].map(([k, v]) => (
                <div key={k} style={{ borderTop: "1px solid var(--rule)", paddingTop: 8 }}>
                  <p className="mono" style={{ color: "var(--muted)", margin: 0 }}>{k}</p>
                  <p className="mono" style={{ fontSize: 13, margin: "4px 0 0", color: "var(--ink)" }}>{v}%</p>
                </div>
              ))}
            </div>
          </div>

          <div className="lanes-block" data-reveal>
            <p className="metric-big">PIECES / ROLLING MINUTE — {snap.throughput}</p>
            <div className="spark">
              <Spark data={snap.history.length ? snap.history : new Array(60).fill(0)} />
            </div>
            <div style={{ marginTop: 26 }}>
              {LANE_ROWS.map((r) => (
                <div className="lane-row" key={r.label}>
                  <span>
                    {r.label}
                    <br />
                    <span style={{ color: "var(--muted-2)", fontSize: 9 }}>{r.sub}</span>
                  </span>
                  <b style={{ fontVariantNumeric: "tabular-nums" }}>
                    {snap.counts[r.lane]}
                  </b>
                </div>
              ))}
            </div>
            <p className="mono" style={{ color: "var(--muted-2)", marginTop: 22, fontSize: 10 }}>
              DETECTED {snap.detected} · ROUTED {snap.routed} · SESSION {formatUptime(snap.time)}
            </p>
          </div>

          <div className="events-block" data-reveal>
            <p className="metric-big">EVENT JOURNAL — STREAMING</p>
            <ul className="event-list">
              {snap.events.length === 0 && (
                <li>
                  <span className="t">--:--:--</span>
                  <span className="kind">SYS</span>
                  <span>Journal opens on line start…</span>
                </li>
              )}
              {snap.events.map((e, i) => (
                <li key={`${e.t}-${i}`} className={e.kind === "OK" ? "ok" : ""}>
                  <span className="t">{formatUptime(e.t)}</span>
                  <span className="kind">{e.tag}</span>
                  <span style={{ flex: 1 }}>{e.msg}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
