"use client";

// The console docked to the right: as each
// chapter comes into reading position, the console types out that
// chapter's snippet in the machine's own words. The panel is decorative
// narration (aria-hidden, pointer-light); the page's prose carries the
// human explanation, and this carries the machine's side of the story.
//
// The typing runs in a small external store, the same pattern the chrome
// clock and the sim engine use: the store owns the interval and notifies
// React from the observer's callback, so no effect mirrors state.
import { useEffect, useState, useSyncExternalStore } from "react";

const SNIPPETS: Record<string, string> = {
  signal: `// LINE_01
run(line) {
  belt.start();
  gates.arm();
  ledger.open();
}`,
  line: `// ONE PASS
read(item) {
  photo_eye.register();
  light_curtain.measure();
  probe.check(steel);
  load_cell.weigh();
}`,
  stations: `// ROUTING LAW
tall       -> L03, oversize
steel      -> L02, steel loop
off_weight -> RJ, reject
else       -> L01, approved`,
  ledger: `// LEDGER
a = run_seconds / total;
p = item_rate / ideal;
q = routed_ok / routed;
oee = a * p * q;`,
  hosted: `// HOST REQUEST
host.write(gate: L01);
line.read(item) -> tall;
law.overrules(host.ask);
line.veto(gate: L01);`,
  unit: `// PHASE 02
program = Structured_Text(
  target: OpenPLC
);
page = storyboard(program);`,
};

const TYPE_MS = 34;

class ConsoleTyper {
  private listeners = new Set<() => void>();
  private timer: number | null = null;
  private full = "";
  private i = 0;
  snap = "";

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };

  getSnapshot = (): string => this.snap;

  getServerSnapshot = (): string => "";

  /** Called from the intersection observer's callback, never from render. */
  setChapter = (id: string): void => {
    const text = SNIPPETS[id] ?? "";
    if (text === this.full) return;
    this.full = text;
    this.i = 0;
    if (this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      this.snap = text;
      this.emit();
      return;
    }
    this.snap = "";
    this.emit();
    this.timer = window.setInterval(() => {
      this.i += 1;
      this.snap = text.slice(0, this.i);
      this.emit();
      if (this.i >= text.length && this.timer !== null) {
        window.clearInterval(this.timer);
        this.timer = null;
      }
    }, TYPE_MS);
  };

  private emit(): void {
    for (const fn of this.listeners) fn();
  }
}

const typer = new ConsoleTyper();

export default function ConsolePanel() {
  const [open, setOpen] = useState(true);
  const typed = useSyncExternalStore(
    typer.subscribe,
    typer.getSnapshot,
    typer.getServerSnapshot
  );

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) typer.setChapter(e.target.id);
        }
      },
      { rootMargin: "-38% 0px -52% 0px" }
    );
    for (const id of Object.keys(SNIPPETS)) {
      const el = document.getElementById(id);
      if (el) io.observe(el);
    }
    return () => io.disconnect();
  }, []);

  const lines = (typed || "").split("\n").filter((l) => l.length > 0 || true);

  return (
    <aside className={"console" + (open ? "" : " closed")} aria-hidden="true">
      <div className="console-body">
        <button
          className="console-head"
          onClick={() => setOpen(!open)}
          aria-label={open ? "Close the console" : "Open the console"}
        >
          <span className="console-title">Console.log</span>
          <span className="console-toggle">{open ? "\u2014" : "+"}</span>
        </button>
        <div className="console-scroll">
          <div className="console-inner">
            <span className="console-numbers">
              {lines.map((_, i) => (
                <span key={i}>{String(i + 1).padStart(3, "0")}</span>
              ))}
            </span>
            <span className="console-code">
              {typed}
              <span className="cursor" />
            </span>
          </div>
          <span className="console-fade top" />
          <span className="console-fade bottom" />
        </div>
      </div>
    </aside>
  );
}
