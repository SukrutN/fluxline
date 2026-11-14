"""Offline tests: the host command block (docs/06), no PLC needed.

sim/hostblock.py mirrors the ST host block scan by scan; these tests lock
its arbitration - deterministic ingest (event-order strict, timing
tolerant), E-stop precedence, heartbeat timeout -> fallback -> return,
and the veto/refuse/expiry edges. The live counterparts in test_line.py
assert the same contract against a real runtime.
"""

import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from hostblock import (            # noqa: E402
    HostBlock,
    ARMED, ACCEPTED, VETOED, REFUSED, EXPIRED,
    OVERRIDE, PER_LAW,
    INIT, IDLE, RUN, JAM, ESTOP,
)
import hostbench                  # noqa: E402


def hb(t):
    """The host heartbeat word: an incrementing counter."""
    return t % 32000


def kinds(events):
    return [e["event"] for e in events]


def live_block(watchdog_s=5.0):
    """A block with a live host (heartbeat already seen)."""
    m = HostBlock(watchdog_s=watchdog_s, scan_s=1.0)
    m.scan(hb=hb(1))
    return m


# ---------------------------------------------------------------- ingest


def _script(m, pad=0):
    """A fixed command script; returns its transcript, order only.

    `pad` stretches the waits between commands and piece arrivals - the
    command sequence and its order stay identical, only the timing moves.
    """
    events = []
    t = [0]

    def beat(n):
        for _ in range(n + pad):
            t[0] += 1
            events.extend(m.scan(hb=hb(t[0])))

    def step(**kw):
        t[0] += 1
        events.extend(m.scan(hb=hb(t[0]), **kw))

    beat(3)
    step(seq=11, code=OVERRIDE, gate=2)          # arm
    beat(7)
    step(lc_class=2)                             # piece: accepted
    beat(1)
    step(seq=12, code=OVERRIDE, gate=1)          # arm
    step(seq=13, code=PER_LAW)                   # refused: one in flight
    beat(5)
    step(lc_class=1)                             # piece: accepted
    beat(4)
    step(seq=14, code=PER_LAW)                   # arm
    beat(6)
    step(lc_class=3)                             # piece: accepted, class 3
    return [(e["event"], e["seq"], e["gate"], e["class"]) for e in events]


def test_deterministic_ingest_event_order_is_strict():
    a = _script(HostBlock(watchdog_s=5.0))
    b = _script(HostBlock(watchdog_s=5.0))
    assert a == b, "the same command sequence must produce the same events"
    assert a == [
        ("armed", 11, 0, 0),
        ("accepted", 11, 2, 2),
        ("armed", 12, 0, 0),
        ("refused", 13, 0, 0),
        ("accepted", 12, 1, 1),
        ("armed", 14, 0, 0),
        ("accepted", 14, 3, 3),
    ]


def test_deterministic_ingest_is_timing_tolerant():
    # same commands, pieces arriving later: order unchanged, ticks don't
    a = _script(HostBlock(watchdog_s=5.0), pad=0)
    b = _script(HostBlock(watchdog_s=5.0), pad=4)
    assert a == b


def test_writes_inside_one_scan_collapse_to_the_last():
    m = live_block()
    # the host wrote seq 80 then seq 81 between two scans; the program
    # reads the block once per scan and sees only the last write
    ev = m.scan(hb=hb(2), seq=81, code=OVERRIDE, gate=4)
    assert kinds(ev) == ["armed"]
    assert m.ack_seq == 81


def test_malformed_commands_are_refused():
    for bad in ({"code": 0}, {"code": 3}, {"code": OVERRIDE, "gate": 0},
                {"code": OVERRIDE, "gate": 5},
                {"code": OVERRIDE, "gate": 2, "cls": 7},
                {"code": PER_LAW, "cls": -1}):
        m = live_block()
        ev = m.scan(hb=hb(2), seq=70, **bad)
        assert kinds(ev) == ["refused"], bad
        assert m.ack_state == REFUSED and not m.armed


def test_jam_idle_and_init_refuse_ingest():
    for bad_state in (JAM, IDLE, INIT):
        m = live_block()
        ev = m.scan(hb=hb(2), seq=30, code=PER_LAW, state=bad_state)
        assert kinds(ev) == ["refused"], bad_state
        assert not m.armed


def test_never_connected_host_is_not_an_alarm():
    m = HostBlock(watchdog_s=3.0)
    ev = m.scan(seq=40, code=PER_LAW)     # no heartbeat, ever
    assert kinds(ev) == ["refused"]
    assert not m.armed
    assert m.alarm_bit() == 0             # never live: no alarm, no fallback
    assert m.host_state() & 2 == 0        # not live
    assert m.host_state() & 4 == 0


# ------------------------------------------------------------- arbitration


def test_accept_when_request_matches_the_law():
    m = live_block()
    m.scan(hb=hb(2), seq=52, code=OVERRIDE, gate=2, cls=2)
    assert m.ack_state == ARMED
    ev = m.scan(hb=hb(3), lc_class=2)
    assert kinds(ev) == ["accepted"]
    assert m.ack_gate == 2 and m.ack_class == 2
    assert m.host_state() & 8 == 0        # no veto flag


def test_veto_when_requested_gate_disagrees():
    m = live_block()
    m.scan(hb=hb(2), seq=51, code=OVERRIDE, gate=1, cls=0)
    ev = m.scan(hb=hb(3), lc_class=2)     # law says L02, host asked L01
    assert kinds(ev) == ["vetoed"]
    assert m.ack_state == VETOED
    assert m.ack_gate == 2 and m.ack_class == 2   # the piece took the law's gate
    assert m.host_state() & 8                     # veto-since-live


def test_veto_when_claimed_class_disagrees():
    m = live_block()
    m.scan(hb=hb(2), seq=50, code=OVERRIDE, gate=2, cls=2)
    ev = m.scan(hb=hb(3), lc_class=3)     # law measured L03, host claimed L02
    assert kinds(ev) == ["vetoed"]
    assert m.ack_gate == 3 and m.ack_class == 3
    assert m.host_state() & 8


def test_per_law_release_always_takes_the_law_gate():
    m = live_block()
    m.scan(hb=hb(2), seq=53, code=PER_LAW)
    ev = m.scan(hb=hb(3), lc_class=4)
    assert kinds(ev) == ["accepted"]
    assert m.ack_gate == 4 and m.ack_class == 4


def test_per_law_with_wrong_claim_is_vetoed():
    m = live_block()
    m.scan(hb=hb(2), seq=54, code=PER_LAW, cls=1)
    ev = m.scan(hb=hb(3), lc_class=4)
    assert kinds(ev) == ["vetoed"]
    assert m.ack_gate == 4 and m.ack_class == 4


def test_one_release_at_a_time():
    m = live_block()
    m.scan(hb=hb(2), seq=60, code=OVERRIDE, gate=2)
    assert m.ack_state == ARMED
    ev = m.scan(hb=hb(3), seq=61, code=PER_LAW)
    assert kinds(ev) == ["refused"]
    assert ev[0]["seq"] == 61
    assert m.host_acks == 1               # counted, not lost
    assert m.armed and (m.host_state() & 1)
    # the first command still rides its piece and resolves normally
    ev = m.scan(hb=hb(4), lc_class=2)
    assert kinds(ev) == ["accepted"]
    assert ev[0]["seq"] == 60


# ---------------------------------------------------------- E-stop / floor


def test_estop_expires_an_armed_command_the_same_scan():
    m = live_block()
    ev = m.scan(hb=hb(2), seq=21, code=OVERRIDE, gate=3)
    assert kinds(ev) == ["armed"]
    # the chain opens: E-stop wins this scan, no grace period, no replay
    ev = m.scan(hb=hb(3), state=ESTOP)
    assert kinds(ev) == ["expired"]
    assert m.ack_state == EXPIRED and m.ack_seq == 21
    assert not m.armed and (m.host_state() & 1) == 0
    # the line routes by law afterwards - no host effect, no stale arm
    assert m.scan(hb=hb(4), state=ESTOP, lc_class=3) == []
    assert m.scan(hb=hb(5), state=RUN, lc_class=3) == []


def test_estop_refuses_an_ingest_the_same_scan():
    m = live_block()
    ev = m.scan(hb=hb(2), seq=22, code=OVERRIDE, gate=2, state=ESTOP)
    assert kinds(ev) == ["refused"]
    assert m.ack_state == REFUSED and not m.armed


def test_stop_button_expires_an_armed_command():
    m = live_block()
    m.scan(hb=hb(2), seq=23, code=OVERRIDE, gate=2)
    ev = m.scan(hb=hb(3), state=IDLE)
    assert kinds(ev) == ["expired"]
    assert m.ack_state == EXPIRED


# ------------------------------------------------------- heartbeat / fallback


def test_heartbeat_timeout_falls_back_then_recovers():
    m = live_block(watchdog_s=3.0)
    m.scan(hb=hb(2), seq=31, code=OVERRIDE, gate=2)
    assert m.ack_state == ARMED
    # the heartbeat freezes; the watchdog expires it on the 4th frozen scan
    events = []
    for t in range(3, 10):
        events.extend(m.scan(hb=hb(2)))   # frozen: same value
    assert kinds(events) == ["expired"]
    assert m.ack_state == EXPIRED and m.ack_seq == 31
    assert m.host_state() & 4             # fallback bit
    assert m.alarm_bit() == 32            # HOST_STALE, only after being live
    assert not m.live
    # commands while stale are refused, not armed
    ev = m.scan(hb=hb(2), seq=32, code=PER_LAW)
    assert kinds(ev) == ["refused"]
    assert m.host_state() & 4
    # the heartbeat moves again: live, fallback clears, next command arms
    assert m.scan(hb=hb(3)) == []
    assert m.live and (m.host_state() & 4) == 0 and m.alarm_bit() == 0
    ev = m.scan(hb=hb(4), seq=33, code=PER_LAW)
    assert kinds(ev) == ["armed"]


def test_fallback_never_touches_the_law():
    # through a full stale cycle the line keeps law-sorting: pieces keep
    # routing (the model has nothing to veto - no command is armed)
    m = live_block(watchdog_s=2.0)
    m.scan(hb=hb(2))
    for t in range(3, 8):
        ev = m.scan(hb=hb(2), lc_class=(t % 4) + 1)
        assert ev == []                   # law sorts, host block silent
    assert m.host_state() & 4


# -------------------------------------------------------------- bookkeeping


def test_latency_is_counted_in_scans():
    m = live_block()
    m.scan(hb=hb(2), seq=90, code=OVERRIDE, gate=2)   # armed at tick 2
    m.scan(hb=hb(3))
    m.scan(hb=hb(4))
    m.scan(hb=hb(5), lc_class=2)                      # resolved at tick 5
    assert m.last_latency == 3


def test_host_acks_counts_every_resolution():
    m = live_block()
    m.scan(hb=hb(2), seq=95, code=PER_LAW)
    m.scan(hb=hb(3), lc_class=1)          # accepted
    m.scan(hb=hb(4), seq=96, code=OVERRIDE, gate=1)
    m.scan(hb=hb(5), seq=97, code=PER_LAW)  # refused: one in flight
    m.scan(hb=hb(6), lc_class=2)          # 96 resolves as vetoed
    assert m.host_acks == 3               # accepted + refused + vetoed
    assert m.snapshot()["host_acks"] == 3


def test_in_flight_is_published():
    m = live_block()
    m.scan(hb=hb(2), in_flight=5)
    assert m.snapshot()["in_flight"] == 5
    m.scan(hb=hb(3), in_flight=0)
    assert m.snapshot()["in_flight"] == 0


# --------------------------------------------------------------- the bench

def test_bench_is_deterministic_and_honest():
    """Same script, same figures - and the site ports exactly these."""
    a = hostbench.bench()
    b = hostbench.bench()
    assert a == b, "the bench must be reproducible, not a dice roll"
    # the figures the site locks to
    assert a["meta"]["pieces"] == 20
    assert a["meta"]["releases"] == 12
    assert a["verdicts"] == {"accepted": 11, "vetoed": 1}
    assert sum(x["count"] for x in a["latency"]["buckets"]) == 12
    assert a["latency"]["min_ms"] == 4466.7
    assert a["latency"]["max_ms"] == 8800.0
    assert a["latency"]["mean_ms"] == 6808.3
    # every released piece ends on the gate the law chose
    for s in a["latency"]["samples"]:
        assert s["state"] in ("accepted", "vetoed")
        assert s["release_to_divert_ms"] > 0
        if s["state"] == "accepted":
            assert s["gate"] == s["ask"]
    # the walkthrough stays scan-ordered and lands on real gates
    ts = [w["t_s"] for w in a["walkthrough"]]
    assert ts == sorted(ts)
    assert any("VETOED" in w["what"] for w in a["walkthrough"])
    assert len(a["registers"]) == 15
