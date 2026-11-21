"""FLUXLINE shift report - the record a commissioning engineer files.

Two halves:

  build_report(...)  pure arithmetic: the runtime's OEE counters, the state
                     timeline, and the twin's ledger become one report with
                     availability, performance, quality, and OEE. Tested
                     offline; no runtime needed.

  run_shift(...)     the live half: drives a scripted mixed shift against the
                     closed loop (runtime + twin), records the timeline, and
                     reads the counters the ST program published. Needs the
                     OpenPLC runtime up; refuses with the reason when it is
                     not, the same way test_line.py does.

CLI:
    python sim/shift_report.py --minutes 2 --out shift.json
    python sim/shift_report.py --check   (arithmetic self-check, no hardware)
"""

import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

POLL = 0.25

# The runtime's published OEE block (docs/02-register-map.md): HR indexes.
HR_AVAILABILITY = 4      # per-mille, run / (run + down)
HR_PPM = 13              # pieces per minute, actual
HR_QUALITY = 6           # per-mille, routed clean / detected


def build_report(counters, timeline, ledger, meta):
    """Pure: counters + timeline + ledger in, one report out.

    Availability is re-derived from the timeline (run vs down seconds) so the
    report can disagree with the runtime's own register out loud - a
    commissioning record that only parrots the PLC is not a record.
    """
    run_s = sum(1.0 for s in timeline if s == 2) * POLL
    down_s = sum(1.0 for s in timeline if s in (3, 4)) * POLL
    idle_s = sum(1.0 for s in timeline if s == 1) * POLL
    span_s = len(timeline) * POLL
    if span_s <= 0:
        raise ValueError("the timeline is empty; a shift with no samples is not a shift")
    availability = run_s / (run_s + down_s) if (run_s + down_s) > 0 else 0.0

    detected = int(ledger.get("detected", 0))
    routed = int(ledger.get("routed", 0))
    missed = int(ledger.get("missed", 0))
    quality = routed / detected if detected > 0 else 0.0

    pieces = int(ledger.get("pieces", detected))
    minutes = span_s / 60.0
    ppm = pieces / minutes if minutes > 0 else 0.0
    # the ST program's ideal rate for the commissioned geometry: one piece
    # per 1.8 s pitch at 100% - the performance term against the actual ppm
    ideal_ppm = 60.0 / 1.8
    performance = ppm / ideal_ppm if ideal_ppm > 0 else 0.0
    oee = availability * performance * quality

    register_availability = counters.get("availability")
    register_quality = counters.get("quality")
    disagreements = []
    if register_availability is not None and abs(register_availability - availability) > 0.02:
        disagreements.append(
            "availability: the runtime's register says %.1f%% but the timeline "
            "derives %.1f%%" % (100 * register_availability, 100 * availability))
    if register_quality is not None and abs(register_quality - quality) > 0.02:
        disagreements.append(
            "quality: the runtime's register says %.1f%% but the ledger "
            "derives %.1f%%" % (100 * register_quality, 100 * quality))

    return {
        "meta": meta,
        "shift": {
            "spanSeconds": round(span_s, 1),
            "runSeconds": round(run_s, 1),
            "downSeconds": round(down_s, 1),
            "idleSeconds": round(idle_s, 1),
        },
        "counters": {
            "detected": detected,
            "routed": routed,
            "missed": missed,
        },
        "oee": {
            "availability": round(availability, 4),
            "performance": round(performance, 4),
            "quality": round(quality, 4),
            "oee": round(oee, 4),
        },
        "registers": {
            "availability": register_availability,
            "ppm": counters.get("ppm"),
            "quality": register_quality,
        },
        "disagreements": disagreements,
        "verdict": "clean" if not disagreements else "disagreements named",
    }


def _runtime_up(host, port, timeout=2.0):
    """True when a Modbus server answers at host:port.

    pymodbus's connect() reports refusal by returning False (it logs, it does
    not raise), so the return value is the whole answer.
    """
    try:
        from pymodbus.client import ModbusTcpClient
        client = ModbusTcpClient(host, port=port, timeout=timeout)
        up = client.connect()
        client.close()
        return bool(up)
    except Exception:
        return False


def run_shift(twin, minutes=2.0, seed=2026):
    """Live: drives a scripted mixed shift and returns (counters, timeline, ledger).

    The shift: start the line, feed a mixed batch at the natural pitch, hold
    the belt until every piece routes, and sample the state every scan-tick
    quarter second. The runtime must be up (docs/03 §1) and polling the twin
    (docs/03 §5); this function refuses with the reason when it is not.
    """
    if not _runtime_up("127.0.0.1", 502):
        raise SystemExit(
            "SHIFT_REFUSED: the OpenPLC runtime is not reachable at 127.0.0.1:502. "
            "Start it per docs/03-commissioning.md section 1 and configure the "
            "master requests per section 5, then run the shift again.")

    import scenarios
    twin.set_feed(False)
    scenarios.start_line(twin)

    span_s = minutes * 60.0
    t0 = time.time()
    timeline = []
    while time.time() - t0 < span_s:
        timeline.append(twin.store.getValues(3, 2, 1)[0])
        time.sleep(POLL)
    snapshot = twin.flush()
    ledger = {
        "detected": snapshot.get("detected", 0),
        "routed": snapshot.get("routed", 0),
        "missed": snapshot.get("missed", 0),
        "pieces": snapshot.get("detected", 0),
    }
    counters = {
        "availability": twin.store.getValues(3, HR_AVAILABILITY, 1)[0] / 1000.0,
        "quality": twin.store.getValues(3, HR_QUALITY, 1)[0] / 1000.0,
        "ppm": twin.store.getValues(3, HR_PPM, 1)[0],
    }
    return counters, timeline, ledger


def main(argv):
    args = list(argv)
    out_path = None
    minutes = 2.0
    if "--check" in args:
        self_check()
        return 0
    if "--minutes" in args:
        i = args.index("--minutes")
        minutes = float(args[i + 1])
        del args[i:i + 2]
    if "--out" in args:
        i = args.index("--out")
        out_path = args[i + 1]
        del args[i:i + 2]

    from twin import Twin
    t = Twin(seed=2026)
    t.start()
    try:
        counters, timeline, ledger = run_shift(t, minutes=minutes)
    finally:
        t.close()

    report = build_report(
        counters, timeline, ledger,
        {"shift": "scripted mixed shift", "minutes": minutes, "seed": 2026})
    text = json.dumps(report, indent=2)
    print(text)
    if out_path:
        Path(out_path).write_text(text + "\n", encoding="utf-8")
        print("wrote " + out_path)
    return 0 if report["verdict"] == "clean" else 1


def self_check():
    """Offline arithmetic proof: a known timeline must produce known OEE."""
    # 20 s at 0.25 s per sample: 60 samples RUN, 20 down
    timeline = [2] * 60 + [4] * 20 + [1] * 0
    ledger = {"detected": 10, "routed": 9, "missed": 1}
    report = build_report({}, timeline, ledger, {"shift": "self-check"})
    a = report["oee"]["availability"]
    q = report["oee"]["quality"]
    assert abs(a - 60.0 / 80.0) < 1e-9, a
    assert abs(q - 0.9) < 1e-9, q
    # performance: 10 pieces over 20 s = 30 ppm against the 33.3 ideal
    p = report["oee"]["performance"]
    assert abs(p - 30.0 / (60.0 / 1.8)) < 1e-9, p
    assert report["verdict"] == "clean"
    print("self-check: availability %.3f, performance %.3f, quality %.3f, oee %.3f"
          % (a, p, q, report["oee"]["oee"]))


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
