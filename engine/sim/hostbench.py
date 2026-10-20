"""Seeded offline bench: a hosted shift on Line 01.

Drives sim/hostblock.py, the scan-exact reference model of the ST host
block, through a scripted shift: pieces on the belt at a fixed pitch, a
supervisory host requesting releases, one vetoed request, the law
winning. The figures land in sim/figures/hostblock.json and are ported
into the fluxline site (src/lib/hosted.ts), where a test locks them: if
the bench's numbers move, the site moves with them.

Determinism: no wall clock, no RNG; the same script, the same figures.

Latency accounting, stated honestly: release→verdict is what the host
block itself measures (command write to the load cell's word, scan
exact). verdict→divert is the deterministic ride from the load cell to
the gate at belt speed; no model needed, just geometry. Their sum is
the release→divert figure the histogram buckets.
"""

import json
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

from hostblock import HostBlock, OVERRIDE          # noqa: E402
from twin import LC_POS, G_L1, G_L2, G_L3          # noqa: E402

SCAN_S = 0.1               # 100 ms scans - the runtime's configured cycle
BELT_MMS = 120.0           # the compiled default the twin boots with
PITCH = 18                 # scans between pieces (1.8 s)
LC_TRAVEL = 217            # scans from PE to the load cell (2600 mm)
EXIT_TRAVEL = 300          # scans from PE to the belt end (3600 mm)

GATE_POS = {1: G_L1, 2: G_L2, 3: G_L3}
TAIL_S = {g: (GATE_POS[g] - LC_POS) / BELT_MMS for g in GATE_POS}
KIND_CLASS = {"standard": 1, "metal": 2, "tall": 3}

# The shift: pieces enter on the pitch, kinds cycling standard/metal/tall.
# The host releases some of them: (piece index, lead in scans, ask) where
# ask None means "the law's gate" and a number is an explicit override
# request - piece 11 is the veto: a tall piece, asked for L01, law wins.
# Every lead stays under one pitch: the command rides the NEXT piece to
# the load cell, so a longer lead would grab the piece before the target.
RELEASES = [
    (0, 16, None), (1, 7, None), (2, 12, None), (4, 4, None),
    (6, 15, None), (8, 9, None), (9, 3, None), (11, 13, 1),
    (13, 6, None), (15, 17, None), (17, 10, None), (19, 5, None),
]

WATCHDOG_S = 5.0
BUCKET_MS = 1000
BUCKET_FROM_MS = 4000


def bench():
    """Run the scripted shift; return the figures as one dict."""
    n_pieces = max(j for j, _, _ in RELEASES) + 1
    pieces = []
    for j in range(n_pieces):
        kind = ["standard", "metal", "tall"][j % 3]   # a mixed batch, cycling
        pieces.append({
            "j": j,
            "kind": kind,
            "law_class": KIND_CLASS[kind],
            "pe": j * PITCH,
            "lc": j * PITCH + LC_TRAVEL,
            "exit": j * PITCH + EXIT_TRAVEL,
        })

    releases = []
    for idx, (piece_j, lead, ask) in enumerate(RELEASES):
        p = pieces[piece_j]
        releases.append({
            "seq": idx + 1,
            "piece": piece_j,
            "kind": p["kind"],
            "law_class": p["law_class"],
            "veto": ask is not None and ask != p["law_class"],
            "cmd": p["lc"] - lead,
            "lc": p["lc"],
            "ask": ask if ask is not None else p["law_class"],
        })
    # sanity, so a future edit fails loudly instead of refusing silently:
    # each command must land after the previous release resolved (one
    # release in flight at a time), each lead must stay under one pitch
    # (the command rides the next piece to the cell), and non-veto asks
    # must match the law
    prev_resolve = None
    for r in releases:
        if prev_resolve is not None:
            assert r["cmd"] > prev_resolve, \
                "release %d would be refused - still armed" % r["seq"]
        assert r["lc"] - r["cmd"] < PITCH, \
            "release %d would grab the piece before its target" % r["seq"]
        assert 1 <= r["ask"] <= 4, "illegal gate %d" % r["ask"]
        assert r["veto"] or r["ask"] == r["law_class"]
        prev_resolve = r["lc"]

    m = HostBlock(watchdog_s=WATCHDOG_S, scan_s=SCAN_S)
    events = []
    end = pieces[-1]["exit"]
    for t in range(1, end + 1):
        kw = {
            "hb": (t % 32000) + 1,
            "state": 2,   # RUN for the whole shift
            "in_flight": sum(1 for p in pieces if p["pe"] <= t < p["exit"]),
        }
        for r in releases:
            if t == r["cmd"]:
                kw["seq"] = r["seq"]
                kw["code"] = OVERRIDE
                kw["gate"] = r["ask"]
                kw["cls"] = 0
        for p in pieces:
            if t == p["lc"]:
                kw["lc_class"] = p["law_class"]
        for e in m.scan(**kw):
            e = dict(e)
            e["t_s"] = round(t * SCAN_S, 1)
            events.append(e)

    # ---- latency, release to divert, per released piece ----------------
    samples = []
    for r in releases:
        ev = next(e for e in events
                  if e["seq"] == r["seq"] and e["event"] in ("accepted", "vetoed"))
        gate = ev["gate"]                     # the gate the piece took
        to_verdict = (r["lc"] - r["cmd"]) * SCAN_S * 1000.0
        to_divert = to_verdict + TAIL_S[gate] * 1000.0
        samples.append({
            "id": "box-%02d" % r["seq"],
            "kind": r["kind"],
            "state": ev["event"],
            "ask": r["ask"],
            "gate": gate,
            "release_to_verdict_ms": round(to_verdict, 1),
            "verdict_to_divert_ms": round(to_divert - to_verdict, 1),
            "release_to_divert_ms": round(to_divert, 1),
        })

    buckets = []
    first = int(min(s["release_to_divert_ms"] for s in samples) // BUCKET_MS)
    last = int(max(s["release_to_divert_ms"] for s in samples) // BUCKET_MS)
    for b in range(first, last + 1):
        frm = b * BUCKET_MS
        buckets.append({
            "from_ms": frm,
            "label": "%d-%d s" % (frm // 1000, (frm + BUCKET_MS) // 1000),
            "count": sum(1 for s in samples
                         if frm <= s["release_to_divert_ms"] < frm + BUCKET_MS),
        })

    last_cmd = releases[-1]
    snap = m.snapshot()
    registers = [
        {"addr": "%QW2", "name": "state", "writer": "line", "value": 2,
         "note": "RUN for the whole shift"},
        {"addr": "%QW3", "name": "alarm", "writer": "line", "value": 0,
         "note": "bit 5 HOST_STALE never lit - the host never dropped"},
        {"addr": "%QW28", "name": "HOST_WATCHDOG", "writer": "host",
         "value": int(WATCHDOG_S), "note": "1..60 s, clamped"},
        {"addr": "%QW40", "name": "HB_HOST", "writer": "host",
         "value": (end % 32000) + 1, "note": "incremented every scan"},
        {"addr": "%QW41", "name": "CMD_SEQ", "writer": "host",
         "value": last_cmd["seq"], "note": "last command's tag"},
        {"addr": "%QW42", "name": "CMD_CODE", "writer": "host",
         "value": 1, "note": "release-override"},
        {"addr": "%QW43", "name": "CMD_GATE", "writer": "host",
         "value": last_cmd["ask"], "note": "1 L01, 2 L02, 3 L03, 4 RJ"},
        {"addr": "%QW44", "name": "CMD_CLASS", "writer": "host",
         "value": 0, "note": "0 = any - the claim is checked at the load cell"},
        {"addr": "%QW45", "name": "ACK_SEQ", "writer": "line",
         "value": snap["ack_seq"], "note": "seq of the last ingested command"},
        {"addr": "%QW46", "name": "ACK_STATE", "writer": "line",
         "value": snap["ack_state"], "note": "0 armed 1 accepted 2 vetoed 3 refused 4 expired"},
        {"addr": "%QW47", "name": "ACK_GATE", "writer": "line",
         "value": snap["ack_gate"], "note": "the gate the piece actually took"},
        {"addr": "%QW48", "name": "ACK_CLASS", "writer": "line",
         "value": snap["ack_class"], "note": "the law class the cell measured"},
        {"addr": "%QW49", "name": "HOST_STATE", "writer": "line",
         "value": snap["host_state"], "note": "bit1 live + bit3 veto-since-live after the veto"},
        {"addr": "%QW50", "name": "IN_FLIGHT", "writer": "line",
         "value": snap["in_flight"], "note": "0 - the belt is empty at shift end"},
        {"addr": "%QW51", "name": "HOST_ACKS", "writer": "line",
         "value": snap["host_acks"], "note": "every resolved command, since boot"},
    ]

    walkthrough = []
    for r in releases:
        if not r["veto"] and r["seq"] != releases[-1]["seq"]:
            continue
        walkthrough.extend(walkthrough_rows(r, events))

    verdicts = {}
    for s in samples:
        verdicts[s["state"]] = verdicts.get(s["state"], 0) + 1

    return {
        "meta": {
            "engine": "sim/hostblock.py - offline reference model of the ST host block",
            "scan_ms": int(SCAN_S * 1000),
            "belt_mms": BELT_MMS,
            "pieces": len(pieces),
            "releases": len(releases),
            "watchdog_s": WATCHDOG_S,
            "law": "height >= 165 mm -> L03; else metal -> L02; else weight outside 2..12 kg -> RJ; else L01",
            "latency_note": ("release->verdict is measured by the host block model "
                             "(command write to the load cell's word, scan exact); "
                             "verdict->divert is the deterministic ride from the load "
                             "cell to the gate at belt speed"),
        },
        "latency": {
            "kind": "release-to-divert",
            "unit": "ms",
            "bucket_ms": BUCKET_MS,
            "buckets": buckets,
            "min_ms": min(s["release_to_divert_ms"] for s in samples),
            "max_ms": max(s["release_to_divert_ms"] for s in samples),
            "mean_ms": round(sum(s["release_to_divert_ms"] for s in samples) / len(samples), 1),
            "samples": samples,
        },
        "verdicts": verdicts,
        "registers": registers,
        "walkthrough": walkthrough,
    }


def walkthrough_rows(r, events):
    """A scan-ordered excerpt of one release, for the site to narrate."""
    gate_name = {1: "L01", 2: "L02", 3: "L03", 4: "RJ"}
    rows = []
    t = lambda tick: round(tick * SCAN_S, 1)  # noqa: E731
    rows.append({
        "t_s": t(r["cmd"]),
        "who": "host",
        "what": "writes the command block: CMD_SEQ=%d, CMD_CODE=1 (release-override), "
                "CMD_GATE=%d, CMD_CLASS=0" % (r["seq"], r["ask"]),
    })
    armed = next(e for e in events if e["seq"] == r["seq"] and e["event"] == "armed")
    rows.append({
        "t_s": armed["t_s"],
        "who": "line",
        "what": "ingests at the scan boundary: ACK_SEQ=%d, ACK_STATE=0 (armed)" % r["seq"],
    })
    rows.append({
        "t_s": t(r["lc"]),
        "who": "belt",
        "what": "a %s piece reaches the load cell; the law measures class %d"
                % (r["kind"], r["law_class"]),
    })
    ev = next(e for e in events
              if e["seq"] == r["seq"] and e["event"] in ("accepted", "vetoed"))
    if ev["event"] == "accepted":
        rows.append({
            "t_s": ev["t_s"],
            "who": "line",
            "what": "requested gate %d == law gate %d -> ACCEPTED: ACK_STATE=1, "
                    "ACK_GATE=%d, ACK_CLASS=%d" % (r["ask"], ev["gate"], ev["gate"], ev["class"]),
        })
    else:
        rows.append({
            "t_s": ev["t_s"],
            "who": "line",
            "what": "requested gate %d != law gate %d -> VETOED: the piece takes %s. "
                    "ACK_STATE=2, ACK_GATE=%d, ACK_CLASS=%d"
                    % (r["ask"], ev["gate"], gate_name[ev["gate"]], ev["gate"], ev["class"]),
        })
    divert_t = r["lc"] * SCAN_S + TAIL_S[ev["gate"]]
    rows.append({
        "t_s": round(divert_t, 1),
        "who": "belt",
        "what": "gate %s fires - the piece is off the belt" % gate_name[ev["gate"]],
    })
    return rows


def main():
    figures = bench()
    out = os.path.join(os.path.dirname(__file__), "figures")
    os.makedirs(out, exist_ok=True)
    path = os.path.join(out, "hostblock.json")
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        json.dump(figures, f, indent=2)
        f.write("\n")
    print("wrote %s" % path)
    print("releases: %d  histogram: %s" % (
        figures["meta"]["releases"],
        ", ".join("%s:%d" % (b["label"], b["count"]) for b in figures["latency"]["buckets"]),
    ))
    return 0


if __name__ == "__main__":
    sys.exit(main())
