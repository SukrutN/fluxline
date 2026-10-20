"use client";

// FLUXLINE canvas renderer — draws the simulated line every frame.
// Palette mirrors globals.css; the machine room is dark ink with paper pieces.

import {
  LineEngine,
  SENSOR_DEFS,
  GATE_DEFS,
  type Item,
  type LaneId,
} from "./engine";

const BG = "#1a1611";
const BELT = "#262019";
const BELT_HI = "#4a443a";
const TREAD = "#6f6759";
const MODULE_BG = "#14110c";
const BORDER = "#3a352c";
const PAPER = "#f2ede3";
const MUTED = "#6f6759";
const MUTED2 = "#9a9082";
const AMBER = "#ff7f24";
const STEEL = "#8fb0c4";
const OK_COL = "#3e7d4e";
const DANGER = "#c8452c";
const LED_OFF = "#3a352c";

const LANE_COLOR: Record<LaneId, string> = {
  lane1: "#c9c1ae",
  lane2: STEEL,
  lane3: AMBER,
  reject: DANGER,
};

interface Metrics {
  W: number;
  H: number;
  beltY: number;
  beltH: number;
  modY: number;
  binsY: number;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function cubicAt(
  t: number,
  p0: number,
  p1: number,
  p2: number,
  p3: number
): number {
  const u = 1 - t;
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
}

let fontMono = '500 10px "JetBrains Mono", monospace';
let fontSerif = '400 100px Georgia, serif';

export function bindFonts() {
  if (typeof window === "undefined") return;
  const cs = getComputedStyle(document.body);
  const mono = cs.getPropertyValue("--font-mono").trim();
  const serif = cs.getPropertyValue("--font-serif").trim();
  if (mono) fontMono = `500 10px ${mono}, monospace`;
  if (serif) fontSerif = `400 100px ${serif}, Georgia, serif`;
}

function monoAt(size: number, weight = 500): string {
  return fontMono.replace(/^(\d+\s*)/, `${weight} ${size}px `);
}

export function draw(
  ctx: CanvasRenderingContext2D,
  eng: LineEngine,
  W: number,
  H: number
) {
  const m: Metrics = {
    W,
    H,
    beltY: H * 0.5,
    beltH: H * 0.115,
    modY: H * 0.155,
    binsY: H * 0.8,
  };

  // ── backdrop ────────────────────────────────────────────────
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.globalAlpha = 0.05;
  ctx.strokeStyle = PAPER;
  ctx.lineWidth = 1;
  const step = W / 24;
  for (let x = step; x < W; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  for (let y = 42; y < H; y += 56) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  ctx.restore();

  // ghost wordmark
  ctx.save();
  ctx.globalAlpha = 0.05;
  ctx.fillStyle = PAPER;
  ctx.font = fontSerif.replace(/(\d+)px/, `${Math.round(H * 0.26)}px`);
  ctx.textAlign = "left";
  ctx.fillText("FLUXLINE", W * 0.035, m.binsY + H * 0.1);
  ctx.restore();

  // ── signal tower (left) ─────────────────────────────────────
  drawTower(ctx, eng, m);

  // ── ruler datum ─────────────────────────────────────────────
  drawRuler(ctx, m);

  // ── belt ────────────────────────────────────────────────────
  const phase = (eng.beltPhase % 1) * W;
  ctx.fillStyle = BELT;
  ctx.fillRect(-4, m.beltY, W + 8, m.beltH);
  ctx.strokeStyle = BELT_HI;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-4, m.beltY + 0.8);
  ctx.lineTo(W + 4, m.beltY + 0.8);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-4, m.beltY + m.beltH - 0.8);
  ctx.lineTo(W + 4, m.beltY + m.beltH - 0.8);
  ctx.stroke();

  ctx.save();
  ctx.globalAlpha = 0.22;
  ctx.strokeStyle = TREAD;
  ctx.lineWidth = 2;
  const span = W + 60;
  const spacing = 46;
  for (let s = -60; s < span; s += spacing) {
    const x = ((s + phase) % span + span) % span;
    if (x > W + 12) continue;
    ctx.beginPath();
    ctx.moveTo(x, m.beltY + 4);
    ctx.lineTo(x - 9, m.beltY + m.beltH - 4);
    ctx.stroke();
  }
  ctx.restore();

  // ── stations ────────────────────────────────────────────────
  for (const st of SENSOR_DEFS) {
    drawStation(ctx, eng, st.x, st.label, st.id, m);
  }

  // ── gates, chutes, bins ─────────────────────────────────────
  drawCascade(ctx, eng, m);

  // ── pieces ──────────────────────────────────────────────────
  for (const item of eng.items) {
    if (item.routeT < 0) drawOnBelt(ctx, item, m);
  }
  for (const item of eng.items) {
    if (item.routeT >= 0) drawInChute(ctx, item, m);
  }

  // ── hud ─────────────────────────────────────────────────────
  drawHud(ctx, eng, m);
}

function drawTower(ctx: CanvasRenderingContext2D, eng: LineEngine, m: Metrics) {
  const x = m.W * 0.045;
  const headY = m.H * 0.2;
  ctx.save();
  ctx.strokeStyle = BORDER;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x, headY + 84);
  ctx.lineTo(x, m.beltY - 6);
  ctx.stroke();

  const lenses: Array<{ c: string; state: boolean }> = [];
  const lamp = eng.lampState();
  const blink = (eng.time * 2.4) % 1 < 0.5;
  const slow = (eng.time * 0.9) % 1 < 0.5;
  lenses.push({ c: DANGER, state: lamp === "estop" });
  lenses.push({ c: AMBER, state: lamp === "warn" ? blink : lamp === "wait" && slow });
  lenses.push({ c: OK_COL, state: lamp === "run" });

  let ly = headY;
  for (const ln of lenses) {
    roundRect(ctx, x - 11, ly, 22, 22, 5);
    ctx.fillStyle = MODULE_BG;
    ctx.fill();
    ctx.strokeStyle = BORDER;
    ctx.lineWidth = 1;
    ctx.stroke();
    if (ln.state) {
      ctx.save();
      ctx.shadowColor = ln.c;
      ctx.shadowBlur = 16;
      ctx.fillStyle = ln.c;
      ctx.globalAlpha = 0.95;
      ctx.beginPath();
      ctx.arc(x, ly + 11, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else {
      ctx.fillStyle = LED_OFF;
      ctx.beginPath();
      ctx.arc(x, ly + 11, 5.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ly += 27;
  }
  ctx.restore();
}

function drawRuler(ctx: CanvasRenderingContext2D, m: Metrics) {
  const y = m.beltY + m.beltH + 26;
  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.strokeStyle = BORDER;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(m.W * 0.10, y);
  ctx.lineTo(m.W * 0.74, y);
  ctx.stroke();
  ctx.font = monoAt(8, 400);
  ctx.fillStyle = MUTED;
  ctx.textAlign = "center";
  for (let i = 0; i <= 8; i++) {
    const x = m.W * 0.10 + (m.W * 0.64 * i) / 8;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y + (i % 2 === 0 ? 7 : 4));
    ctx.stroke();
    if (i % 2 === 0) {
      ctx.fillText(`${i * 300}`, x, y + 18);
    }
  }
  ctx.textAlign = "left";
  ctx.fillText("MM", m.W * 0.74 + 8, y + 3);
  ctx.restore();
}

function drawStation(
  ctx: CanvasRenderingContext2D,
  eng: LineEngine,
  sxp: number,
  label: string,
  id: "PE" | "HS" | "ID" | "LC",
  m: Metrics
) {
  const x = sxp * m.W;
  const w = 148;
  const h = 62;
  const mx = Math.min(Math.max(x - w / 2, 10), m.W - w - 10);
  const hot = eng.sensorHot[id];

  // strut
  ctx.strokeStyle = BORDER;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, m.modY + h);
  ctx.lineTo(x, m.beltY - 2);
  ctx.stroke();

  // module
  roundRect(ctx, mx, m.modY, w, h, 8);
  ctx.fillStyle = MODULE_BG;
  ctx.fill();
  ctx.strokeStyle = hot > 0.25 ? AMBER : BORDER;
  ctx.lineWidth = hot > 0.25 ? 1.4 : 1;
  ctx.stroke();

  // led
  ctx.save();
  if (hot > 0.05) {
    ctx.shadowColor = AMBER;
    ctx.shadowBlur = 12 * Math.min(1, hot);
  }
  ctx.fillStyle = hot > 0.05 ? AMBER : LED_OFF;
  ctx.beginPath();
  ctx.arc(mx + 16, m.modY + 16, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.font = monoAt(8, 500);
  ctx.fillStyle = MUTED2;
  ctx.textAlign = "left";
  ctx.fillText(`${id}-0${["PE", "HS", "ID", "LC"].indexOf(id) + 1}`, mx + 27, m.modY + 20);
  ctx.fillText(label, mx + 12, m.modY + h - 12);

  // reading
  ctx.font = monoAt(10.5, 500);
  ctx.fillStyle = PAPER;
  ctx.textAlign = "right";
  ctx.fillText(id === "PE" ? (eng.running ? "ACTIVE" : "IDLE") : eng.reads[id], mx + w - 12, m.modY + 20);

  // scan beam
  if (hot > 0.15 && eng.running) {
    ctx.save();
    ctx.globalAlpha = 0.3 * Math.min(1, hot);
    ctx.fillStyle = AMBER;
    ctx.beginPath();
    ctx.moveTo(mx + w / 2 - 3, m.modY + h);
    ctx.lineTo(x - 17, m.beltY - 2);
    ctx.lineTo(x + 17, m.beltY - 2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

function drawCascade(ctx: CanvasRenderingContext2D, eng: LineEngine, m: Metrics) {
  const binW = Math.max(84, m.W * 0.062);
  const n = GATE_DEFS.length;

  // chutes
  for (let i = 0; i < n; i++) {
    const g = GATE_DEFS[i];
    const x = g.x * m.W;
    const by = m.binsY;
    ctx.save();
    ctx.globalAlpha = 0.5 + eng.gateHot[g.lane] * 0.5;
    ctx.strokeStyle = eng.gateHot[g.lane] > 0.05 ? LANE_COLOR[g.lane] : BORDER;
    ctx.lineWidth = 1 + eng.gateHot[g.lane];
    ctx.setLineDash([3, 5]);
    ctx.beginPath();
    ctx.moveTo(x, m.beltY + m.beltH);
    ctx.lineTo(x, by - 6);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  // gate chevrons on the belt edge
  for (const g of GATE_DEFS) {
    const x = g.x * m.W;
    const hot = eng.gateHot[g.lane];
    ctx.save();
    ctx.globalAlpha = 0.35 + hot * 0.65;
    ctx.fillStyle = hot > 0.05 ? LANE_COLOR[g.lane] : LED_OFF;
    const tri = 7 + hot * 3;
    ctx.beginPath();
    ctx.moveTo(x - tri, m.beltY + m.beltH + 3);
    ctx.lineTo(x + tri, m.beltY + m.beltH + 3);
    ctx.lineTo(x, m.beltY + m.beltH + 3 + tri + 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.font = monoAt(7.5, 500);
    ctx.fillStyle = MUTED;
    ctx.textAlign = "center";
    ctx.fillText(g.label, x, m.beltY + m.beltH + 13);
  }

  // bins
  for (let i = 0; i < n; i++) {
    const g = GATE_DEFS[i];
    const cx = g.x * m.W;
    const x0 = cx - binW / 2;
    const fill = Math.min(1, eng.counts[g.lane] / 40);
    const h = 64;
    roundRect(ctx, x0, m.binsY, binW, h, 7);
    ctx.fillStyle = MODULE_BG;
    ctx.fill();
    ctx.strokeStyle = eng.gateHot[g.lane] > 0.05 ? LANE_COLOR[g.lane] : BORDER;
    ctx.lineWidth = eng.gateHot[g.lane] > 0.05 ? 1.6 : 1;
    ctx.stroke();

    // fill level
    const fh = (h - 8) * fill;
    if (fh > 0) {
      ctx.save();
      ctx.globalAlpha = 0.28;
      ctx.fillStyle = LANE_COLOR[g.lane];
      roundRect(ctx, x0 + 3, m.binsY + h - 3 - fh, binW - 6, fh, 4);
      ctx.fill();
      ctx.restore();
    }

    ctx.fillStyle = PAPER;
    ctx.font = monoAt(17, 500);
    ctx.textAlign = "center";
    ctx.fillText(String(eng.counts[g.lane]), cx, m.binsY + 24);
    ctx.fillStyle = MUTED2;
    ctx.font = monoAt(7, 500);
    ctx.fillText(g.name, cx, m.binsY + 38);

    // mouth tick
    ctx.strokeStyle = LANE_COLOR[g.lane];
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    ctx.moveTo(cx - 10, m.binsY - 6);
    ctx.lineTo(cx + 10, m.binsY - 6);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

function drawOnBelt(ctx: CanvasRenderingContext2D, item: Item, m: Metrics) {
  const x = item.x * m.W;
  const wpx = item.w * m.W;
  const tall = item.kind === "tall";
  const hpx = tall ? m.H * 0.075 : m.H * 0.042;
  const y = m.beltY - hpx;
  const wob = Math.sin(item.wob) * 1.2;
  const y2 = y + wob;

  // shadow
  ctx.save();
  ctx.globalAlpha = 0.3;
  ctx.fillStyle = "#0d0b08";
  ctx.beginPath();
  ctx.ellipse(x, m.beltY + 2, wpx * 0.52, 3.4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  roundRect(ctx, x - wpx / 2, y2, wpx, hpx, 4);
  ctx.fillStyle = PAPER;
  ctx.fill();
  ctx.strokeStyle = "#d8d0bf";
  ctx.lineWidth = 1;
  ctx.stroke();

  // band + stamps
  const bandY = y2 + hpx * 0.52;
  if (item.kind === "metal") {
    ctx.fillStyle = STEEL;
    ctx.beginPath();
    ctx.arc(x, y2 + hpx * 0.3, 3.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.globalAlpha = 0.75;
    ctx.fillStyle = STEEL;
    ctx.fillRect(x - wpx / 2 + 5, bandY, wpx - 10, 3);
    ctx.restore();
  }
  if (item.kind === "offspec") {
    ctx.save();
    ctx.strokeStyle = AMBER;
    ctx.globalAlpha = 0.9;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - wpx / 2 + 6, y2 + hpx - 7);
    ctx.lineTo(x + wpx / 2 - 6, y2 + hpx - 7);
    ctx.stroke();
    ctx.fillStyle = AMBER;
    ctx.beginPath();
    const tx = x + wpx / 2 - 9;
    ctx.moveTo(tx, y2 + 4);
    ctx.lineTo(tx + 3.4, y2 + 9.4);
    ctx.lineTo(tx - 3.4, y2 + 9.4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  if (tall) {
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = MUTED;
    ctx.setLineDash([2, 3]);
    ctx.beginPath();
    ctx.moveTo(x, y2);
    ctx.lineTo(x, y2 + hpx);
    ctx.stroke();
    ctx.restore();
  }

  // stencil
  ctx.font = monoAt(6.5, 400);
  ctx.fillStyle = MUTED;
  ctx.textAlign = "center";
  if (!tall) ctx.fillText(item.tag, x, y2 + hpx - 8);
  else ctx.fillText(item.tag, x, y2 + 12);

  // scan flash
  const near = SENSOR_DEFS.some(
    (s) => Math.abs(item.x - s.x) < 0.012 && item.scanned[s.id]
  );
  if (near) {
    ctx.save();
    ctx.strokeStyle = AMBER;
    ctx.globalAlpha = 0.6;
    ctx.lineWidth = 1.5;
    roundRect(ctx, x - wpx / 2 - 2, y2 - 2, wpx + 4, hpx + 4, 5);
    ctx.stroke();
    ctx.restore();
  }
}

function drawInChute(ctx: CanvasRenderingContext2D, item: Item, m: Metrics) {
  let t = item.routeT;
  if (t > 1.25) return;
  t = Math.min(t, 1);
  const te = 1 - (1 - t) * (1 - t);

  const gx = item.routeFrom * m.W;
  const bx = item.binX * m.W;
  const y0 = m.beltY + m.beltH * 0.4;
  const y1 = m.binsY - 10;
  const midY = (y0 + y1) / 2 + 24;

  const px = cubicAt(te, gx, gx, bx, bx);
  const py = cubicAt(te, y0, midY, midY, y1);
  const dx = cubicAt(te, gx, gx, bx, bx) - cubicAt(Math.max(te - 0.02, 0), gx, gx, bx, bx);
  const dy = cubicAt(te, y0, midY, midY, y1) - cubicAt(Math.max(te - 0.02, 0), y0, midY, midY, y1);
  const ang = Math.atan2(dy, dx) * 0.5;

  const wpx = item.w * m.W * 0.8;
  const hpx = (item.kind === "tall" ? m.H * 0.075 : m.H * 0.042) * 0.8;

  ctx.save();
  ctx.globalAlpha = t > 0.85 ? Math.max(0, 1 - (t - 0.85) / 0.4) : 1;
  ctx.translate(px, py);
  ctx.rotate(ang);
  roundRect(ctx, -wpx / 2, -hpx / 2, wpx, hpx, 4);
  ctx.fillStyle = PAPER;
  ctx.fill();
  ctx.strokeStyle = "#d8d0bf";
  ctx.stroke();
  if (item.kind === "metal") {
    ctx.fillStyle = STEEL;
    ctx.beginPath();
    ctx.arc(0, -hpx / 2 + hpx * 0.3, 2.6, 0, Math.PI * 2);
    ctx.fill();
  }
  if (item.kind === "offspec") {
    ctx.strokeStyle = AMBER;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-wpx / 2 + 4, hpx / 2 - 5);
    ctx.lineTo(wpx / 2 - 4, hpx / 2 - 5);
    ctx.stroke();
  }
  ctx.restore();
}

function drawHud(ctx: CanvasRenderingContext2D, eng: LineEngine, m: Metrics) {
  ctx.save();
  ctx.font = monoAt(8, 400);
  ctx.fillStyle = MUTED;
  ctx.textAlign = "left";
  const status = eng.estopped
    ? "E-STOP LATCHED"
    : eng.jammed
      ? "JAM — " + eng.jamLabel
      : eng.running
        ? "LINE RUNNING"
        : "LINE IDLE";
  ctx.globalAlpha = eng.estopped || eng.jammed ? 0.9 : 0.55;
  ctx.fillStyle = eng.estopped ? DANGER : eng.jammed ? AMBER : PAPER;
  ctx.fillText(status, m.W * 0.11, m.H * 0.09);

  ctx.globalAlpha = 0.45;
  ctx.fillStyle = MUTED2;
  const mPerMin = (eng.speedMul * 7.2).toFixed(1);
  ctx.textAlign = "right";
  ctx.fillText(
    `BELT ${mPerMin} M/MIN · FIXED-STEP 120 Hz`,
    m.W * 0.955,
    m.H * 0.09
  );
  if (eng.watchdogFlash > 0) {
    ctx.globalAlpha = Math.min(1, eng.watchdogFlash);
    ctx.fillStyle = AMBER;
    ctx.textAlign = "left";
    ctx.fillText("WDOG RE-SYNC", m.W * 0.11, m.H * 0.13);
  }
  ctx.restore();
}
