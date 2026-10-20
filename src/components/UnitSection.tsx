// 05 · UNIT — the operating rules & sign-off.

const SPECS: Array<[string, React.ReactNode]> = [
  [
    "ROUTE LAW",
    "Tall profile → L03 OVERSIZE. Ferrous signature → L02 STEEL LOOP. Weight anomaly → REJECT. Everything in band → L01 APPROVED.",
  ],
  [
    "SENSE",
    "PE-01 photo-eye registry · HS-02 light-curtain profile · ID-03 inductive probe · LC-04 strain-gauge load cell",
  ],
  [
    "ACTUATE",
    "Four cascade diverters with pre-open lead logic — a gate arms before the piece arrives, never while it passes.",
  ],
  [
    "FAIL SAFELY",
    "Field injectable jam; watchdog trips the E-STOP if an obstruction outlives eight seconds. Reset absolves.",
  ],
  [
    "ACCOUNT",
    "OEE (availability × performance × quality) · rolling pieces/min · per-lane verdict counts · timestamped journal",
  ],
  [
    "STACK",
    "Next.js · React · Canvas 2D · GSAP ScrollTrigger · Lenis. No backend, no keys, no accounts — one page, fully client-side.",
  ],
  [
    "PHASE 02",
    "The OpenPLC program — real ladder logic for OpenPLC Runtime, exported to its own repository. The web line is its storyboard.",
  ],
];

export default function UnitSection() {
  return (
    <>
      <section id="unit" className="section">
        <div className="wide">
          <header className="chapter">
            <span className="num">05</span>
            <span className="label">UNIT</span>
            <span className="of">OPERATING RULES — REV 0.9</span>
          </header>

          <div className="manifesto" style={{ maxWidth: 1180 }}>
            <p className="big">
              Sorting is a <span className="accent">contract.</span>
            </p>
            <p className="big">
              Sensors vouch. Gates decide.
            </p>
            <p className="big">
              The ledger <span style={{ fontStyle: "italic", color: "var(--muted-2)" }}>remembers.</span>
            </p>
          </div>

          <div className="spec-table">
            {SPECS.map(([k, v]) => (
              <div className="row" key={k}>
                <span className="k">{k}</span>
                <span className="v">{v}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer>
        <div className="wide foot-grid">
          <div>
            <p className="signoff">
              Made to sort.
              <br />
              Built to last.
            </p>
          </div>
          <div className="mono" style={{ textAlign: "right", lineHeight: 2 }}>
            <span>FLUXLINE&#174; — SMART SORTING LINE · LINE 01</span>
            <small>PHASE 02 · OPENPLC RUNTIME LADDER — SEPARATE REPO, SHIP NEXT</small>
            <small>&#169; 2026 — PLANT FLOOR EDITION</small>
          </div>
        </div>
      </footer>
    </>
  );
}
