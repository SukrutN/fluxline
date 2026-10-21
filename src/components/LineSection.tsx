"use client";

// 02 · THE LINE, mounted simulation frame, controls, live captions.

import { useCallback, useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { telemetry, useLine, formatUptime } from "@/lib/sim/store";
import { draw, bindFonts, bindPointer } from "@/lib/sim/renderer";
import { reveal } from "@/lib/scroll";
import type { Density } from "@/lib/sim/engine";

const IDLE_CAPTIONS = [
  { tag: "Method", title: "Sensors read each item while the belt is already moving" },
  { tag: "Law", title: "Tall items go to the oversize lane, steel items to the steel loop, off-weight items to the reject chute" },
  { tag: "Quality", title: "An item outside any band is rejected before the belt ends" },
  { tag: "Safety", title: "E-stop holds everything where it is. Reset clears the fault and the line picks back up" },
  { tag: "Ledger", title: "Counts and the ledger figures update live in the panel below" },
];

const SENSORS = [
  { id: "PE", label: "Photo-eye (PE-01)" },
  { id: "HS", label: "Height profile (HS-02)" },
  { id: "ID", label: "Inductive probe (ID-03)" },
  { id: "LC", label: "Load cell (LC-04)" },
] as const;

const GATES = [
  { id: "reject", label: "Reject gate (RJ)" },
  { id: "lane1", label: "Approved gate (L01)" },
  { id: "lane2", label: "Steel gate (L02)" },
  { id: "lane3", label: "Oversize gate (L03)" },
] as const;

export default function LineSection() {
  const snap = useLine();
  const sectionRef = useRef<HTMLElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const visibleRef = useRef(true);
  const [idleIdx, setIdleIdx] = useState(0);

  // ── sim loop ────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    const frame = frameRef.current;
    if (!canvas || !frame) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const engine = telemetry.getEngine();
    if (engine.everStarted === false && engine.time < 0.4) engine.start();
    bindFonts();
    if (document.fonts?.ready) void document.fonts.ready.then(() => bindFonts());

    let raf = 0;
    let last = performance.now();

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = frame.clientWidth;
      const h = frame.clientHeight;
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(frame);
    const unbindPointer = bindPointer(canvas);

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = (now - last) / 1000;
      last = now;
      // always tick the machine, counters and uptime must advance even when
      // the canvas is scrolled away (the ledger reads the same engine)
      engine.tick(dt);
      if (!visibleRef.current) return;
      draw(ctx, engine, frame.clientWidth, frame.clientHeight);
    };
    raf = requestAnimationFrame(loop);

    const io = new IntersectionObserver(
      (entries) => {
        visibleRef.current = entries[0]?.isIntersecting ?? true;
        engine.presence = visibleRef.current;
      },
      { threshold: 0.05 }
    );
    io.observe(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      unbindPointer();
    };
  }, []);

  // ── entrance + section reveal ───────────────────────────────
  useEffect(() => {
    reveal(sectionRef.current);
    const frame = frameRef.current;
    if (!frame) return;
    const ctx = gsap.context(() => {
      gsap.from(frame, {
        scale: 0.94,
        transformOrigin: "50% 60%",
        duration: 1.2,
        ease: "power4.out",
        scrollTrigger: { trigger: frame, start: "top 88%", once: true },
      });
    });
    // timer floor: settle regardless of rAF starvation or later refreshes
    const finalize = () => {
      ctx.revert();
      gsap.set(frame, { clearProps: "all" });
    };
    const finish = setTimeout(finalize, 4500);
    return () => {
      clearTimeout(finish);
      ctx.revert();
    };
  }, []);

  // ── captions: idle rotation ticker ──────────────────────────
  // Ticks the idle caption rotation. The subscription runs at 1/7 Hz and
  // only advances an index, the caption text itself is derived below, an
  // external system feeding React, not React mirroring itself in an
  // effect.
  useEffect(() => {
    const t = setInterval(() => setIdleIdx((i) => i + 1), 7000);
    return () => clearInterval(t);
  }, []);

  // ── captions: derived, never mirrored ───────────────────────
  // The caption is a pure projection of the event snapshot, recomputed on
  // every render, in strict priority order: a live FAULT takes the board,
  // the newest event holds it for 2.4 s, its tail stays on for 5 s, then
  // the idle rotation takes over. Deriving rather than mirroring the
  // snapshot into state removes the setState-in-effect class of bugs . 
  // and with it, two effects that had to race for caption ownership.
  const shiny = snap.events[0];
  const ev = snap.events.find((e) => e.kind !== "INFO");
  const caption =
    shiny && shiny.kind === "FAULT"
      ? { tag: shiny.tag, title: shiny.msg }
      : shiny && snap.time - shiny.t < 2.4
        ? { tag: shiny.tag, title: shiny.msg }
        : ev && snap.time - ev.t < 5
          ? { tag: ev.tag, title: ev.msg }
          : IDLE_CAPTIONS[idleIdx % IDLE_CAPTIONS.length];

  // ── keyboard ────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!visibleRef.current) return;
      const engine = telemetry.getEngine();
      if (e.code === "Space") {
        e.preventDefault();
        engine.toggleRun();
      } else if (e.key === "x" || e.key === "X") {
        engine.pressEstop();
      } else if (e.key === "r" || e.key === "R") {
        engine.reset();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const onSpeed = useCallback((v: string) => {
    telemetry.getEngine().setSpeed(parseFloat(v));
  }, []);

  const onDensity = useCallback((d: string) => {
    telemetry.getEngine().setDensity(d as Density);
  }, []);

  const uptime = formatUptime(snap.time);

  return (
    <section id="line" ref={sectionRef} className="section ink">
      <div className="wide">
        <header className="chapter" data-reveal>
          <span className="num">02</span>
          <span className="label">The line</span>
          <span className="of">Session {uptime}</span>
        </header>

        <div className="manifesto" style={{ maxWidth: "1100px" }} data-reveal>
          <p className="big" style={{ fontSize: "clamp(34px,4.6vw,66px)" }}>
            Each item is measured once, in a single pass, while the belt
            keeps moving.{" "}
            <span className="accent">The gates route it on that one reading alone.</span>
          </p>
        </div>

        <div className="line-wrap" data-reveal>
          <div className="sim-frame" ref={frameRef}>
            <canvas ref={canvasRef} />
            <div className="sim-caption" aria-live="polite">
              <div className="cap-tag">{caption.tag}</div>
              <div className="cap-title" key={caption.tag + caption.title}>
                {caption.title}
              </div>
            </div>
          </div>

          <div className="telemetry">
            <div className="tele-group">
              <span className="tele-head">Sensors</span>
              <div className="tele-cells">
                {SENSORS.map((s) => (
                  <span className="cell" key={s.id}>
                    <span className="cell-top">
                      <span className={"led" + (snap.sensorHot[s.id] > 0.25 ? " hot" : "")} />
                      {s.label}
                    </span>
                    <span className="val">{snap.reads[s.id]}</span>
                  </span>
                ))}
              </div>
            </div>
            <div className="tele-group">
              <span className="tele-head">Gates</span>
              <div className="tele-cells">
                {GATES.map((g) => (
                  <span className="cell" key={g.id}>
                    <span className="cell-top">
                      <span className={"led" + (snap.gateHot[g.id] > 0.2 ? " okled" : "")} />
                      {g.label}
                    </span>
                    <span className="val">{snap.counts[g.id]}</span>
                  </span>
                ))}
              </div>
            </div>
            <div className="tele-group">
              <span className="tele-head">Line</span>
              <div className="tele-cells">
                <span className="cell">
                  <span className="cell-top">
                    <span className="led" style={{ background: snap.estopped ? "#ff0015" : snap.jammed ? "#f90" : "#65f292" }} />
                    Session
                  </span>
                  <span className="val">{uptime}</span>
                </span>
              </div>
            </div>
          </div>

          <div className="controls">
            <button
              onClick={() => telemetry.getEngine().start()}
              disabled={snap.running || snap.estopped || snap.jammed}
            >
              Run
            </button>
            <button
              onClick={() => telemetry.getEngine().stop()}
              disabled={!snap.running || snap.estopped || snap.jammed}
            >
              Halt
            </button>
            <button
              className={"estop" + (snap.estopped || snap.jammed ? " armed" : "")}
              onClick={() => telemetry.getEngine().pressEstop()}
            >
              E-stop ⦸
            </button>
            <button
              onClick={() => telemetry.getEngine().reset()}
              disabled={!snap.estopped && !snap.jammed}
            >
              Reset
            </button>

            <span className="spacer" />

            <label>
              Belt speed
              <input
                type="range"
                min={0.4}
                max={1.6}
                step={0.05}
                value={snap.speedMul}
                onChange={(e) => onSpeed(e.target.value)}
                aria-label="Belt speed"
              />
              <span className="val" style={{ color: "#ffffff", minWidth: 40, textAlign: "right" }}>
                {snap.speedMul.toFixed(2)}×
              </span>
            </label>

            <label>
              item cadence
              <select
                value={snap.density}
                onChange={(e) => onDensity(e.target.value)}
                aria-label="item cadence"
              >
                <option value="sparse">Sparse</option>
                <option value="balanced">Balanced</option>
                <option value="surge">Surge</option>
              </select>
            </label>

            <button onClick={() => telemetry.getEngine().injectDefect()}>
              Inject off-weight item
            </button>
            <button onClick={() => telemetry.getEngine().injectJam()}>
              Inject jam
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
