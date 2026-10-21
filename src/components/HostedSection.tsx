"use client";

// 05 · HOSTED. The host sends requests; the routing law governs the response.
// Figures are read from the program's seeded bench (engine/sim/figures)
// and locked by src/lib/hosted.test.ts, the page never invents a number.

import { useEffect, useRef } from "react";
import { reveal } from "@/lib/scroll";
import {
  BUCKETS,
  MAX_MS,
  MEAN_MS,
  MIN_MS,
  REGISTERS,
  RELEASES,
  VERDICTS,
  WALKTHROUGH,
  asSeconds,
} from "@/lib/hosted";

function Histogram() {
  const max = Math.max(1, ...BUCKETS.map((b) => b.count));
  const W = 220;
  const H = 92;
  const bw = W / BUCKETS.length;
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: H, display: "block" }} aria-hidden="true">
        <line x1="0" y1={H - 1} x2={W} y2={H - 1} stroke="var(--line)" />
        {BUCKETS.map((b, i) => {
          const h = (b.count / max) * (H - 14);
          return (
            <rect
              key={b.fromMs}
              x={i * bw + 7}
              y={H - 1 - h}
              width={bw - 14}
              height={h}
              fill={b.count === 0 ? "var(--line)" : "var(--ink)"}
            />
          );
        })}
      </svg>
      <div style={{ display: "flex", marginTop: 8 }}>
        {BUCKETS.map((b) => (
          <span
            key={b.fromMs}
            className="mono"
            style={{ flex: 1, textAlign: "center", fontSize: 9, color: "var(--deep-green-250)", letterSpacing: "0.08em" }}
          >
            {b.label}
          </span>
        ))}
      </div>
    </div>
  );
}

// Plain-language rendering of the locked walkthrough rows in hosted.ts.
// The rows themselves stay byte-identical (the figure lock in CI holds
// them still); this array only restates them for the page.
const WALKTHROUGH_STORY: Array<{ tS: number; who: string; text: string }> = [
  { tS: 40.2, who: "Host", text: "The host asks for the next item to be released to the approved lane, and tags the request as number 8." },
  { tS: 40.2, who: "Line", text: "The line takes the request in and holds it, ready to act on the next item that arrives." },
  { tS: 41.5, who: "Belt", text: "A tall item reaches the load cell, and the rules read it as tall." },
  { tS: 41.5, who: "Line", text: "The rules send it to the oversize lane instead, so the request is overruled and the line answers request 8 with a veto." },
  { tS: 49.0, who: "Belt", text: "The oversize gate opens, and the item is off the belt." },
  { tS: 55.4, who: "Host", text: "The host asks again, this time for the steel loop, and tags the request as number 12." },
  { tS: 55.4, who: "Line", text: "The line takes the request in and holds it, ready to act on the next item." },
  { tS: 55.9, who: "Belt", text: "A steel item reaches the load cell, and the rules read it as steel." },
  { tS: 55.9, who: "Line", text: "Steel is exactly what the host asked for, so the request is honored and the item goes to the steel loop." },
  { tS: 61.7, who: "Belt", text: "The steel gate opens, and the item is off the belt." },
];

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
          <span className="label">Host requests</span>
          <span className="of">A host asks, and the line answers</span>
        </header>

        <div className="manifesto" style={{ maxWidth: 980, marginBottom: "clamp(40px,6vw,80px)" }} data-reveal>
          <p className="big" style={{ fontSize: "clamp(30px,3.8vw,54px)" }}>
            Any host can ask the line for anything.{" "}
            <span className="accent">The rules you configure keep the final say.</span>
          </p>
        </div>

        <p className="hosted-intro" data-reveal>
          A host is the warehouse or plant computer that tells automated
          equipment what to do next. The program accepts its requests over
          Modbus and answers each one against the rules you configure, so a
          host can ask for anything, and the rules always keep the final
          say. This demo replays one fixed shift where a request that
          breaks the rules is overruled, and one that follows them is
          honored.
        </p>

        <details className="wire-details" data-reveal>
          <summary>Where these figures come from</summary>
          <p>
            One fixed shift, replayed by the program&apos;s offline bench
            (sim/hostblock.py), so the same numbers appear on every load.
          </p>
        </details>

        <div className="hosted-grid">
          <div className="hosted-latency" data-reveal>
            <p className="metric-big">From host request to divert: {RELEASES} requests</p>
            <Histogram />
            <p className="note">
              Each bar counts the requests whose whole trip, from the host&apos;s
              write to the item leaving the belt, fell in that second range.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginTop: 18 }}>
              {[
                ["Fastest", asSeconds(MIN_MS)],
                ["Average", asSeconds(MEAN_MS)],
                ["Slowest", asSeconds(MAX_MS)],
              ].map(([k, v]) => (
                <div key={k} style={{ borderTop: "1px solid var(--line)", paddingTop: 8 }}>
                  <p className="mono" style={{ color: "var(--ink-muted)", margin: 0 }}>{k}</p>
                  <p className="mono" style={{ fontSize: 13, margin: "4px 0 0", color: "var(--ink)" }}>{v}</p>
                </div>
              ))}
            </div>
            <p className="mono" style={{ color: "var(--deep-green-250)", marginTop: 22, fontSize: 10, lineHeight: 1.7 }}>
              Accepted {VERDICTS.accepted}, vetoed {VERDICTS.vetoed}. Nothing was refused and nothing expired.
            </p>
          </div>

          <div className="hosted-regs lanes-block" data-reveal>
            <p className="metric-big">The host command block at shift end</p>
            <p className="note">
              A host talks to the line through Modbus holding registers, the
              standard way industrial equipment exchanges data: the host
              writes commands, and the line writes back acknowledgments and
              its own state.
            </p>
            {REGISTERS.map((r) => (
              <div className="lane-row" key={r.addr}>
                <span>
                  {r.role} ({r.name}, {r.addr})
                  <br />
                  <span style={{ color: "var(--deep-green-250)", fontSize: 9, textTransform: "none", letterSpacing: "0.06em" }}>
                    {r.writer === "host" ? "Host wrote" : "Line wrote"}: {r.note}
                  </span>
                </span>
                <b style={{ fontVariantNumeric: "tabular-nums" }}>{r.value}</b>
              </div>
            ))}
          </div>

          <div className="hosted-walk" data-reveal>
            <p className="metric-big">One request overruled, one honored</p>
            <ul className="event-list">
              {WALKTHROUGH_STORY.map((row, i) => (
                <li key={`${row.tS}-${i}`} className={i >= 5 ? "ok" : ""}>
                  <span className="t">{row.tS.toFixed(1)}s</span>
                  <span className="kind">{row.who}</span>
                  <span style={{ flex: 1 }}>{row.text}</span>
                </li>
              ))}
            </ul>
            <details className="wire-details">
              <summary>The same exchange, as the program logged it</summary>
              <ul className="event-list wire-log">
                {WALKTHROUGH.map((w, i) => (
                  <li key={`raw-${w.tS}-${i}`}>
                    <span className="t">{w.tS.toFixed(1)}s</span>
                    <span className="kind">{w.who.toUpperCase()}</span>
                    <span style={{ flex: 1 }}>{w.what}</span>
                  </li>
                ))}
              </ul>
            </details>
          </div>
        </div>
      </div>
    </section>
  );
}
