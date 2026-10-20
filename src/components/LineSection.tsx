"use client";

// 02 · THE LINE — mounted simulation frame, controls, live captions.

import { useCallback, useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { telemetry, useLine, formatUptime } from "@/lib/sim/store";
import { draw, bindFonts } from "@/lib/sim/renderer";
import { reveal } from "@/lib/scroll";
import type { Density } from "@/lib/sim/engine";

const IDLE_CAPTIONS = [
  { tag: "METHOD", title: "Every piece, profiled in a single pass." },
  { tag: "LAW", title: "Tall to oversize. Ferrous to the steel loop." },
  { tag: "QC", title: "Anomalous weight earns the reject chute." },
  { tag: "SAFETY", title: "E-stop latches everything. Reset absolves." },
  { tag: "LEDGER", title: "The line keeps its own books." },
];

const SENSORS = [
  { id: "PE", label: "PE-01 · PHOTO-EYE" },
  { id: "HS", label: "HS-02 · HEIGHT" },
  { id: "ID", label: "ID-03 · INDUCTIVE" },
  { id: "LC", label: "LC-04 · LOAD" },
] as const;

const GATES = [
  { id: "reject", label: "RJ" },
  { id: "lane1", label: "L01" },
  { id: "lane2", label: "L02" },
  { id: "lane3", label: "L03" },
] as const;

export default function LineSection() {
  const snap = useLine();
  const sectionRef = useRef<HTMLElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const visibleRef = useRef(true);
  const [caption, setCaption] = useState(IDLE_CAPTIONS[0]);
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

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = (now - last) / 1000;
      last = now;
      if (!visibleRef.current) return;
      engine.tick(dt);
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
        ease: "power3.out",
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

  // ── captions: live event stream with idle fallback ──────────
  useEffect(() => {
    const ev = snap.events.find((e) => e.kind !== "INFO");
    const shiny = snap.events[0];
    if (shiny && shiny.kind === "FAULT") {
      setCaption({ tag: shiny.tag, title: shiny.msg });
      return;
    }
    if (shiny && snap.time - shiny.t < 2.4) {
      setCaption({ tag: shiny.tag, title: shiny.msg });
      return;
    }
    if (ev && snap.time - ev.t < 6) {
      setCaption({ tag: ev.tag, title: ev.msg });
      return;
    }
  }, [snap.version, snap.time, snap.events]);

  useEffect(() => {
    const t = setInterval(() => setIdleIdx((i) => i + 1), 7000);
    return () => clearInterval(t);
  }, []);

  // rotate to a static caption whenever the stream goes quiet
  const lastEvent = snap.events[0];
  const streamActive = lastEvent ? snap.time - lastEvent.t < 5 : false;
  useEffect(() => {
    if (!streamActive) {
      setCaption(IDLE_CAPTIONS[idleIdx % IDLE_CAPTIONS.length]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idleIdx, streamActive]);

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
          <span className="label">THE LINE</span>
          <span className="of">SRT·SEQ — {uptime}</span>
        </header>

        <div className="manifesto" style={{ maxWidth: "1100px" }} data-reveal>
          <p className="big" style={{ fontSize: "clamp(34px,4.6vw,66px)" }}>
            One belt. Four readers. <span className="accent">One verdict each.</span>
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
            {SENSORS.map((s) => (
              <span className="cell" key={s.id}>
                <span className={"led" + (snap.sensorHot[s.id] > 0.25 ? " hot" : "")} />
                {s.label}
                <span className="val">{snap.reads[s.id]}</span>
              </span>
            ))}
            {GATES.map((g) => (
              <span className="cell" key={g.id}>
                <span className={"led" + (snap.gateHot[g.id] > 0.2 ? " okled" : "")} />
                GATE {g.label}
              </span>
            ))}
            <span className="cell">
              <span className="led" style={{ background: snap.estopped ? "#c8452c" : snap.jammed ? "#ff7f24" : "#3e7d4e" }} />
              <span className="val">{uptime}</span>
            </span>
          </div>

          <div className="controls">
            <button
              onClick={() => telemetry.getEngine().start()}
              disabled={snap.running || snap.estopped || snap.jammed}
            >
              RUN ▸
            </button>
            <button
              onClick={() => telemetry.getEngine().stop()}
              disabled={!snap.running || snap.estopped || snap.jammed}
            >
              HALT ■
            </button>
            <button
              className={"estop" + (snap.estopped || snap.jammed ? " armed" : "")}
              onClick={() => telemetry.getEngine().pressEstop()}
            >
              E-STOP ⦸
            </button>
            <button
              onClick={() => telemetry.getEngine().reset()}
              disabled={!snap.estopped && !snap.jammed}
            >
              RESET ⟲
            </button>

            <span className="spacer" />

            <label>
              BELT
              <input
                type="range"
                min={0.4}
                max={1.6}
                step={0.05}
                value={snap.speedMul}
                onChange={(e) => onSpeed(e.target.value)}
                aria-label="Belt speed"
              />
              <span className="val" style={{ color: "#f2ede3", minWidth: 40, textAlign: "right" }}>
                {snap.speedMul.toFixed(2)}×
              </span>
            </label>

            <label>
              CADENCE
              <select
                value={snap.density}
                onChange={(e) => onDensity(e.target.value)}
                aria-label="Spawn cadence"
              >
                <option value="sparse">SPARSE</option>
                <option value="balanced">BALANCED</option>
                <option value="surge">SURGE</option>
              </select>
            </label>

            <button onClick={() => telemetry.getEngine().injectDefect()}>
              DEFECT ⚠
            </button>
            <button onClick={() => telemetry.getEngine().injectJam()}>
              JAM ✖
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
