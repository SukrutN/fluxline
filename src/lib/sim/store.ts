"use client";

// FLUXLINE telemetry store — a tiny external store bridging the sim engine
// (60 Hz canvas) to React (≈8 Hz snapshots) without re-rendering the canvas.

import { useSyncExternalStore } from "react";
import {
  LineEngine,
  type Density,
  type LaneId,
  type LogEvent,
  type SensorId,
} from "./engine";

export interface Snapshot {
  running: boolean;
  estopped: boolean;
  jammed: boolean;
  jamLabel: string;
  speedMul: number;
  density: Density;
  time: number;
  counts: Record<LaneId, number>;
  detected: number;
  routed: number;
  throughput: number;
  oee: { a: number; p: number; q: number };
  events: LogEvent[];
  reads: Record<SensorId, string>;
  sensorHot: Record<SensorId, number>;
  gateHot: Record<LaneId, number>;
  watchdogFlash: number;
  history: number[];
  version: number;
}

function fmtUptime(seconds: number): string {
  const s = Math.floor(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return (
    String(h).padStart(2, "0") +
    ":" +
    String(m).padStart(2, "0") +
    ":" +
    String(sec).padStart(2, "0")
  );
}

export function formatUptime(seconds: number): string {
  return fmtUptime(seconds);
}

export function formatWallClock(date: Date): string {
  const h = String(date.getHours()).padStart(2, "0");
  const m = String(date.getMinutes()).padStart(2, "0");
  const s = String(date.getSeconds()).padStart(2, "0");
  return h + ":" + m + ":" + s;
}

const INITIAL: Snapshot = {
  running: false,
  estopped: false,
  jammed: false,
  jamLabel: "",
  speedMul: 1,
  density: "balanced",
  time: 0,
  counts: { lane1: 0, lane2: 0, lane3: 0, reject: 0 },
  detected: 0,
  routed: 0,
  throughput: 0,
  oee: { a: 1, p: 0, q: 1 },
  events: [],
  reads: { PE: "—", HS: "—", ID: "—", LC: "—" },
  sensorHot: { PE: 0, HS: 0, ID: 0, LC: 0 },
  gateHot: { lane1: 0, lane2: 0, lane3: 0, reject: 0 },
  watchdogFlash: 0,
  history: new Array(60).fill(0),
  version: 0,
};

class TelemetryStore {
  private listeners = new Set<() => void>();
  private snap: Snapshot = INITIAL;
  private engine: LineEngine | null = null;

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };

  getSnapshot = (): Snapshot => {
    return this.snap;
  };

  getServerSnapshot = (): Snapshot => {
    return INITIAL;
  };

  getEngine(): LineEngine {
    if (!this.engine) {
      this.engine = new LineEngine();
      this.engine.wirePublish(() => this.ingest());
      this.ingest();
      // QA handle for in-page debugging / scripted demos
      if (typeof window !== "undefined") {
        (window as unknown as Record<string, unknown>).__FLUXLINE = this.engine;
      }
    }
    return this.engine;
  }

  ingest() {
    const e = this.engine;
    if (!e) return;
    this.snap = {
      running: e.running,
      estopped: e.estopped,
      jammed: e.jammed,
      jamLabel: e.jamLabel,
      speedMul: e.speedMul,
      density: e.density,
      time: e.time,
      counts: { ...e.counts },
      detected: e.detected,
      routed: e.routed,
      throughput: e.throughput,
      oee: { a: e.availability, p: e.performance, q: e.quality },
      events: e.events.slice(0, 12),
      reads: { ...e.reads },
      sensorHot: { ...e.sensorHot },
      gateHot: { ...e.gateHot },
      watchdogFlash: e.watchdogFlash,
      history: e.history.slice(),
      version: this.snap.version + 1,
    };
    for (const fn of this.listeners) fn();
  }
}

export const telemetry = new TelemetryStore();

export function useLine(): Snapshot {
  return useSyncExternalStore(
    telemetry.subscribe,
    telemetry.getSnapshot,
    telemetry.getServerSnapshot
  );
}
