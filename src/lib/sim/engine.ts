// FLUXLINE · single-pass line simulation
// Fixed-step deterministic sorter. Client-side only — no backend, no persistence.
//
// Routing verdict (fixed law, decided at LC-04):
//   tall profile            -> L03 OVERSIZE
//   ferrous tag             -> L02 STEEL LOOP
//   weight anomaly          -> RJ REJECT
//   otherwise               -> L01 APPROVED

export type ItemKind = "standard" | "metal" | "tall" | "offspec";
export type LaneId = "lane1" | "lane2" | "lane3" | "reject";
export type SensorId = "PE" | "HS" | "ID" | "LC";
export type EventKind = "OK" | "WARN" | "FAULT" | "INFO";
export type Density = "sparse" | "balanced" | "surge";

export interface SensorDef {
  id: SensorId;
  x: number;
  label: string;
  index: number;
}

export interface GateDef {
  lane: LaneId;
  x: number;
  label: string;
  name: string;
}

export const SENSOR_DEFS: readonly SensorDef[] = [
  { id: "PE", x: 0.14, label: "PHOTO-EYE", index: 1 },
  { id: "HS", x: 0.34, label: "HEIGHT PROFILE", index: 2 },
  { id: "ID", x: 0.54, label: "INDUCTIVE", index: 3 },
  { id: "LC", x: 0.72, label: "LOAD CELL", index: 4 },
];

export const GATE_DEFS: readonly GateDef[] = [
  { lane: "reject", x: 0.805, label: "RJ", name: "REJECT" },
  { lane: "lane1", x: 0.858, label: "L01", name: "APPROVED" },
  { lane: "lane2", x: 0.903, label: "L02", name: "STEEL" },
  { lane: "lane3", x: 0.946, label: "L03", name: "OVERSIZE" },
];

export const LANE_ORDER: readonly LaneId[] = ["lane1", "lane2", "lane3", "reject"];

export const DENSITY_GAP: Record<Density, number> = {
  sparse: 0.085,
  balanced: 0.058,
  surge: 0.038,
};

export interface Item {
  seq: number;
  tag: string;
  kind: ItemKind;
  lane: LaneId | null;
  x: number;
  w: number;          // visual width, x-units
  hMm: number;        // measured height
  kg: number;         // measured weight
  scanned: Partial<Record<SensorId, boolean>>;
  wob: number;        // per-item motion phase
  routeT: number;     // chute progress 0..1, -1 while on belt
  routeFrom: number;  // gate x when diverted
  binX: number;       // bin x target
  dead: boolean;
}

export interface LogEvent {
  t: number;
  kind: EventKind;
  tag: string;
  msg: string;
}

const IDEAL_GAP = 0.058;
const MAX_EVENTS = 42;

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export class LineEngine {
  // sandbox state
  items: Item[] = [];
  beltPhase = 0;          // x-units travelled (tread offset)
  time = 0;               // session seconds
  startedAt = 0;

  // machine state
  running = false;        // deliberate intent
  everStarted = false;
  estopped = false;
  jammed = false;
  jamLabel = "";
  jamTimer = 0;
  speedMul = 1;
  density: Density = "balanced";
  defectQueue = 0;

  // watchdog / heartbeat
  presence = true;        // sim mounted on screen
  watchdogFlash = 0;
  private lastTickWall = 0;

  // outputs
  counts: Record<LaneId, number> = { lane1: 0, lane2: 0, lane3: 0, reject: 0 };
  detected = 0;
  routed = 0;
  throughput = 0;                       // pieces / rolling minute
  history: number[] = new Array(60).fill(0);
  availability = 1;
  performance = 1;
  quality = 1;
  events: LogEvent[] = [];
  reads: Record<SensorId, string> = { PE: "—", HS: "—", ID: "—", LC: "—" };
  sensorHot: Record<SensorId, number> = { PE: 0, HS: 0, ID: 0, LC: 0 };
  gateHot: Record<LaneId, number> = { lane1: 0, lane2: 0, lane3: 0, reject: 0 };

  // internals
  private seq = 0;
  private spawnGapLeft = 0.9;  // seconds until next spawn
  private runSeconds = 0;
  private downSeconds = 0;
  private routeTimes: number[] = [];
  private historyCursor = 0;
  private historyAccum = 0;
  private historyTimer = 0;
  private lastPublish = 0;
  private lampPulse = 0;
  private publish: () => void = () => {};

  constructor() {
    // line already in production at mount
    this.spawn(0.06, "standard", true);
    this.spawn(0.32, "tall", true);
    this.spawn(0.60, "metal", true);
    this.spawn(0.76, "offspec", true);
    this.log("INFO", "OPS", "line mounted — gates armed");
  }

  wirePublish(fn: () => void) {
    this.publish = fn;
  }

  // ── actions ─────────────────────────────────────────────────

  start() {
    if (this.estopped || this.jammed) return;
    if (this.running) return;
    this.running = true;
    this.everStarted = true;
    this.log("OK", "OPS", "line start — gates armed");
    this.publish();
  }

  stop() {
    if (!this.running) return;
    this.running = false;
    this.log("INFO", "OPS", "line stopped — belt drains");
    this.publish();
  }

  toggleRun() {
    if (this.running) this.stop();
    else this.start();
  }

  pressEstop() {
    if (this.estopped) return;
    this.estopped = true;
    this.jammed = false;
    this.jamLabel = "";
    this.log("FAULT", "SAF", "E-STOP latched — all axes halted");
    this.publish();
  }

  reset() {
    if (!this.estopped && !this.jammed) return;
    this.estopped = false;
    this.jammed = false;
    this.jamTimer = 0;
    this.jamLabel = "";
    this.log("OK", "OPS", "faults cleared — line resuming");
    this.publish();
  }

  setSpeed(v: number) {
    this.speedMul = clamp(v, 0.4, 1.6);
    this.publish();
  }

  setDensity(d: Density) {
    this.density = d;
    this.publish();
  }

  injectDefect() {
    this.defectQueue += 3;
    this.log("INFO", "QC", "test pieces queued — offspec profile");
    this.publish();
  }

  injectJam() {
    if (this.jammed || this.estopped || !this.running) return;
    const stats = SENSOR_DEFS.slice(1); // HS..LC
    const st = stats[Math.floor(Math.random() * stats.length)];
    this.jammed = true;
    this.jamLabel = st.label;
    this.jamTimer = 0;
    this.log("FAULT", st.id, "JAM — material obstructed under " + st.label);
    this.publish();
  }

  private log(kind: EventKind, tag: string, msg: string) {
    this.events.unshift({ t: this.time, kind, tag, msg });
    if (this.events.length > MAX_EVENTS) this.events.length = MAX_EVENTS;
  }

  // ── spawning ────────────────────────────────────────────────

  private pickKind(): ItemKind {
    if (this.defectQueue > 0) {
      this.defectQueue--;
      return "offspec";
    }
    const r = Math.random();
    if (r < 0.62) return "standard";
    if (r < 0.76) return "metal";
    if (r < 0.9) return "tall";
    return "offspec";
  }

  private spawn(atX?: number, kindIn?: ItemKind, preScanned = false) {
    const kind = kindIn ?? this.pickKind();
    this.seq += 1;
    const seqNo = this.seq;
    let hMm = 0;
    let kg = 0;
    switch (kind) {
      case "standard":
        hMm = 96 + Math.random() * 46;         // 96–142
        kg = 3.8 + Math.random() * 2.6;        // 3.8–6.4
        break;
      case "metal":
        hMm = 104 + Math.random() * 38;
        kg = 5.2 + Math.random() * 4.4;        // 5.2–9.6
        break;
      case "tall":
        hMm = 182 + Math.random() * 76;        // 182–258
        kg = 4.4 + Math.random() * 3.2;
        break;
      case "offspec":
        if (Math.random() < 0.3) {
          kg = 0.8 + Math.random() * 0.5;      // featherweight
          hMm = 92 + Math.random() * 40;
        } else {
          kg = 13.6 + Math.random() * 13.8;    // overweight
          hMm = 118 + Math.random() * 44;
        }
        break;
    }
    const item: Item = {
      seq: seqNo,
      tag: "FLX-" + String(seqNo).padStart(4, "0"),
      kind,
      lane: null,
      x: atX ?? -0.06,
      w: kind === "tall" ? 0.03 : 0.034,
      hMm,
      kg,
      scanned: preScanned ? { PE: true, HS: true, ID: true, LC: true } : {},
      wob: Math.random() * Math.PI * 2,
      routeT: -1,
      routeFrom: 0,
      binX: 0,
      dead: false,
    };
    if (preScanned) {
      // plausible scanned state for the mount position
      if (item.x <= 0.14) item.scanned = {};
      else if (item.x <= 0.34) item.scanned = { PE: true };
      else if (item.x <= 0.54) item.scanned = { PE: true, HS: true };
      else if (item.x <= 0.72) item.scanned = { PE: true, HS: true, ID: true };
      else item.lane = this.assignLane(item);
    }
    this.items.push(item);
  }

  private assignLane(item: Item): LaneId {
    if (item.hMm >= 165) return "lane3";
    if (item.kind === "metal") return "lane2";
    if (item.kg < 2.0 || item.kg > 12.0) return "reject";
    return "lane1";
  }

  // ── main loop ───────────────────────────────────────────────

  tick(dtRaw: number) {
    const dt = clamp(dtRaw, 0, 0.05);
    const nowWall = performance.now();
    const gap = nowWall - this.lastTickWall;
    if (this.lastTickWall !== 0 && gap > 1600 && this.presence && this.startedAt > 0) {
      this.watchdogFlash = 2;
      this.log(
        "WARN",
        "WDOG",
        "heartbeat stale " + (gap / 1000).toFixed(1) + " s — re-synced"
      );
    }
    this.lastTickWall = nowWall;

    const step = 1 / 120;
    let acc = dt;
    // sub-step for smooth physics at low frame cost
    while (acc > 0) {
      const s = Math.min(step, acc);
      this.step(s);
      acc -= s;
    }

    // 1 Hz history sample
    this.historyTimer += dt;
    if (this.historyTimer >= 1) {
      this.historyTimer -= 1;
      this.history[this.historyCursor % 60] = this.historyAccum;
      this.historyCursor++;
      this.historyAccum = 0;
    }

    // radioactive decay of indicator heat
    for (const k of ["PE", "HS", "ID", "LC"] as SensorId[]) {
      this.sensorHot[k] = Math.max(0, this.sensorHot[k] - dt * 2.2);
    }
    for (const lane of LANE_ORDER) {
      this.gateHot[lane] = Math.max(0, this.gateHot[lane] - dt * 1.6);
    }
    this.watchdogFlash = Math.max(0, this.watchdogFlash - dt);
    this.lampPulse += dt;

    // rolling throughput probes
    const cutoff = this.time - 60;
    while (this.routeTimes.length > 0 && this.routeTimes[0] < cutoff) {
      this.routeTimes.shift();
    }
    this.throughput = this.routeTimes.length;

    // OEE components
    const total = this.runSeconds + this.downSeconds;
    this.availability = total > 2 ? this.runSeconds / total : 1;
    const halted = !this.running || this.estopped || this.jammed;
    const ideal = (60 / (IDEAL_GAP / 0.058)) * this.speedMul;
    const target = halted ? 0 : clamp(this.throughput / Math.max(1, ideal), 0, 1);
    this.performance += (target - this.performance) * Math.min(1, dt * 1.2);
    if (Math.abs(this.performance) < 0.002) this.performance = 0;
    const lanesOk = this.counts.lane1 + this.counts.lane2 + this.counts.lane3;
    const routedTotal = lanesOk + this.counts.reject;
    this.quality = routedTotal > 0 ? lanesOk / routedTotal : 1;

    // publish throttled
    if (this.time - this.lastPublish > 0.12) {
      this.lastPublish = this.time;
      this.publish();
    }
  }

  private step(dt: number) {
    this.time += dt;

    const halted = !this.running || this.estopped || this.jammed;
    if (this.startedAt === 0 && (this.running || this.estopped)) this.startedAt = this.time;
    if (this.startedAt === 0) this.startedAt = 0.0001;

    if (this.running && !this.estopped && !this.jammed) {
      this.runSeconds += dt;
    }
    if (this.estopped || this.jammed) {
      this.downSeconds += dt;
    }

    const v = 0.058 * this.speedMul;
    const beltV = halted ? 0 : v;
    this.beltPhase += beltV * dt;

    // jam escalation: watchdog trips estop after 8 s obstruction
    if (this.jammed) {
      this.jamTimer += dt;
      if (this.jamTimer > 8) {
        this.jammed = false;
        this.jamLabel = "";
        this.estopped = true;
        this.log("FAULT", "WDOG", "obstruction unresolved — watchdog tripped E-STOP");
      }
    }

    // spawn scheduling
    if (!halted) {
      const gapX = DENSITY_GAP[this.density];
      this.spawnGapLeft -= (beltV * dt) / gapX;
      if (this.spawnGapLeft <= 0) {
        this.spawnGapLeft = 1;
        this.spawn();
      }
    }

    // item motion + stations
    for (const item of this.items) {
      if (item.dead) continue;
      if (item.routeT < 0) {
        const prevX = item.x;
        item.x += beltV * dt;
        if (beltV > 0) item.wob += dt * 9;

        for (const st of SENSOR_DEFS) {
          if (!item.scanned[st.id] && prevX < st.x && item.x >= st.x) {
            this.applyScan(item, st.id);
          }
        }

        if (item.lane !== null) {
          for (const gate of GATE_DEFS) {
            if (gate.lane === item.lane) {
              // pre-heat the gate as the piece approaches
              const lead = gate.x - item.x;
              if (lead > 0 && lead < 0.07) {
                this.gateHot[gate.lane] = Math.max(this.gateHot[gate.lane], 0.6 + (0.07 - lead) * 4);
              }
              if (prevX < gate.x && item.x >= gate.x) {
                item.routeT = 0;
                item.routeFrom = gate.x;
                item.binX = gate.x + (Math.random() - 0.5) * 0.006;
                this.gateHot[gate.lane] = 1;
                break;
              }
            }
          }
        }
      } else {
        item.routeT += dt * 1.35;
        if (item.routeT >= 1 && !item.dead) {
          item.dead = true;
          const lane = (item.lane ?? "lane1") as LaneId;
          this.counts[lane] += 1;
          this.routed += 1;
          this.historyAccum += 1;
          this.routeTimes.push(this.time);
        }
      }
    }

    // reclaim
    this.items = this.items.filter(
      (i) => !(i.dead && i.routeT > 1.25) && !(i.routeT < 0 && i.x > 1.12)
    );
  }

  private applyScan(item: Item, id: SensorId) {
    item.scanned[id] = true;
    this.sensorHot[id] = 1;
    const tag4 = item.tag;

    switch (id) {
      case "PE":
        this.detected += 1;
        this.reads.PE = tag4 + " ACCEPTED";
        break;
      case "HS": {
        const tall = item.hMm >= 165;
        this.reads.HS = item.hMm.toFixed(0) + " MM";
        if (tall) {
          this.log("WARN", "HS-02", tag4 + " height " + item.hMm.toFixed(0) + " mm — tall profile, oversize lane held");
        } else {
          this.log("OK", "HS-02", tag4 + " height " + item.hMm.toFixed(0) + " mm — within band");
        }
        break;
      }
      case "ID": {
        const metal = item.kind === "metal";
        this.reads.ID = metal ? "FERROUS TAG" : "NO TAG";
        if (metal) {
          this.log("OK", "ID-03", tag4 + " inductive N-tag present — steel loop held");
        }
        break;
      }
      case "LC": {
        const bad = item.kg < 2.0 || item.kg > 12.0;
        this.reads.LC = item.kg.toFixed(1) + " KG";
        item.lane = this.assignLane(item);
        if (bad) {
          this.log("WARN", "LC-04", tag4 + " load " + item.kg.toFixed(1) + " kg — out of band, sending to reject");
        } else {
          this.log("OK", "LC-04", tag4 + " load " + item.kg.toFixed(1) + " kg — routing to L0" + (item.lane === "lane1" ? "1" : item.lane === "lane2" ? "2" : "3"));
        }
        break;
      }
    }
  }

  // lamp: what the tower head is doing
  lampState(): "run" | "wait" | "warn" | "estop" {
    if (this.estopped) return "estop";
    if (this.jammed || this.counts.reject > 0 && this.time % 6 < 1.2) return "warn";
    if (this.running) return "run";
    return "wait";
  }
}
