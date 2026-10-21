// 06 · UNIT, the operating rules, the closing theater, and the sign-off.

import ClosingTheater from "@/components/ClosingTheater";
import Reveal from "@/components/Reveal";

const SPECS: Array<[string, React.ReactNode]> = [
  [
    "Routing rules in this demo",
    "A tall item goes to the oversize lane (L03), a steel item to the steel loop (L02), and an off-weight item to the reject chute (RJ). Everything else goes to the approved lane (L01). Those lanes and thresholds are this demo's configuration. On a real line you set your own, and the same rules carry them out.",
  ],
  [
    "Sensors in this demo",
    "A photo-eye (PE-01) registers each item, a light curtain (HS-02) measures its height, an inductive probe (ID-03) checks it for steel, and a load cell (LC-04) weighs it. On a real line the controller reads whatever sensors you have once per item and hands the readings to the same rules.",
  ],
  [
    "Gates",
    "Each gate opens before its item arrives and never while an item passes, so nothing is clipped mid-gate. The demo runs four gates, and a real line runs as many as its lanes need.",
  ],
  [
    "Failure handling",
    "You can inject a jam from the controls to test the line. If an obstruction sits longer than eight seconds, the watchdog latches the E-stop, and Reset clears it.",
  ],
  [
    "The ledger",
    "The ledger keeps overall equipment effectiveness (availability × performance × quality), items per rolling minute, per-lane counts, and a timestamped event journal.",
  ],
  [
    "About this demo",
    <span key="about">
      This page runs one fixed configuration of Fluxline, a sorting-line
      controller you set up for your own lanes, thresholds, and rules.
      Fluxline itself runs the same rules on real hardware, and it is
      available for free on{" "}
      <a
        className="lede-link"
        href="https://github.com/SukrutN/fluxline"
        target="_blank"
        rel="noreferrer"
      >
        GitHub
      </a>
      .
    </span>,
  ],
];

export default function UnitSection() {
  return (
    <>
      <section id="unit" className="section">
        <Reveal>
          <div className="wide">
            <header className="chapter" data-reveal>
              <span className="num">06</span>
              <span className="label">Operating rules</span>
              <span className="of">How the line is governed</span>
            </header>

            <div className="manifesto" style={{ maxWidth: 1180 }} data-reveal>
              <p className="big">One rule runs the whole line.</p>
              <p className="big">
                The line reads the item, picks the lane, and the program{" "}
                <span style={{ color: "var(--accent-soft)" }}>writes it down.</span>
              </p>
            </div>

            <div className="spec-table" data-reveal-stagger>
              {SPECS.map(([k, v]) => (
                <div className="row" key={k}>
                  <span className="k">{k}</span>
                  <span className="v">{v}</span>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </section>

      <ClosingTheater />

      <footer>
        <div className="footer-snippets" aria-hidden="true">
          <p className="s1">{`run(line) {
  belt.start();
  gates.arm();
  ledger.open();
}`}</p>
          <p className="s2">{`oee = a * p * q;
count(item) every pass;`}</p>
        </div>
        <div className="foot-badge" aria-hidden="true">
          <span className="chip-item">IEC 61131-3</span>
          <span className="chip-label">Structured Text</span>
        </div>
        <div className="wide foot-grid">
          <div>
            <p className="signoff">
              FLUXLINE&#174;
              <br />
              <span className="signoff-sub">Smart sorting line</span>
            </p>
          </div>
          <div className="mono" style={{ textAlign: "right", lineHeight: 2 }}>
            <span>FLUXLINE&#174;. Smart sorting line</span>
            <small>
              <a
                className="lede-link"
                href="https://github.com/SukrutN/fluxline"
                target="_blank"
                rel="noreferrer"
              >
                The controller program on GitHub
              </a>
            </small>
            <small>&#169; 2026 Sukrut Nadigotti</small>
          </div>
        </div>
      </footer>
    </>
  );
}
