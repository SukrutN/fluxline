"""Tests for the commissioning path: the report's arithmetic (pure, no
hardware), the checklist's shape, and the gate's refusal when no runtime is
up - the same skip-with-a-reason contract test_line.py keeps."""

import json
import subprocess
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from shift_report import build_report  # noqa: E402


class ShiftReportMath(unittest.TestCase):
    def test_a_known_timeline_produces_known_oee(self):
        # 60 samples RUN, 20 down at 0.25 s each: availability 75%
        timeline = [2] * 60 + [4] * 20
        ledger = {"detected": 10, "routed": 9, "missed": 1}
        report = build_report({}, timeline, ledger, {"shift": "test"})
        self.assertAlmostEqual(report["oee"]["availability"], 0.75, places=9)
        self.assertAlmostEqual(report["oee"]["quality"], 0.9, places=9)
        # 10 pieces over 20 s = 30 ppm against the 33.33 ideal
        self.assertAlmostEqual(report["oee"]["performance"], 30.0 / (60.0 / 1.8), places=9)
        self.assertAlmostEqual(
            report["oee"]["oee"], 0.75 * (30.0 / (60.0 / 1.8)) * 0.9, places=9)
        self.assertEqual(report["verdict"], "clean")

    def test_the_report_names_a_disagreeing_register(self):
        timeline = [2] * 80
        ledger = {"detected": 10, "routed": 10}
        # the runtime claims 60% availability; the timeline says 100%
        counters = {"availability": 0.60, "quality": 1.0, "ppm": 30}
        report = build_report(counters, timeline, ledger, {"shift": "test"})
        self.assertEqual(report["verdict"], "disagreements named")
        self.assertTrue(any("availability" in d for d in report["disagreements"]),
                        report["disagreements"])

    def test_an_empty_timeline_refuses_rather_than_dividing_by_zero(self):
        with self.assertRaises(ValueError):
            build_report({}, [], {}, {})

    def test_zero_down_time_is_full_availability(self):
        report = build_report({}, [2] * 40, {"detected": 4, "routed": 4}, {})
        self.assertEqual(report["oee"]["availability"], 1.0)
        self.assertEqual(report["shift"]["downSeconds"], 0.0)

    def test_the_self_check_passes(self):
        out = subprocess.run(
            [sys.executable, str(Path(__file__).parent / "shift_report.py"), "--check"],
            capture_output=True, text=True, timeout=60)
        self.assertEqual(out.returncode, 0, out.stderr)
        self.assertIn("self-check", out.stdout)


class CommissioningGate(unittest.TestCase):
    def test_the_gate_refuses_with_the_reason_when_no_runtime_is_up(self):
        # on a machine without the OpenPLC runtime the gate must refuse with
        # the doc section that fixes it, never crash and never pass
        out = subprocess.run(
            [sys.executable, str(Path(__file__).parent / "commissioning.py")],
            capture_output=True, text=True, timeout=30)
        self.assertNotEqual(out.returncode, 0)
        text = out.stdout + out.stderr
        self.assertIn("GATE_REFUSED", text)
        self.assertIn("docs/03-commissioning.md", text)

    def test_the_checklist_keeps_every_item_and_names_the_physical_ones(self):
        from commissioning import checklist
        items = checklist()
        self.assertEqual(len(items), 10)
        physical = [item for item, kind in items if kind == "physical"]
        self.assertIn("Guard doors interlocked into the E-stop chain", physical)
        self.assertIn("All E-stop devices open the chain", physical)
        # the software items must all have a probe or a scenario proof
        from commissioning import run_gate  # noqa: F401 - import proves the module binds
        software = [item for item, kind in items if kind == "software"]
        self.assertEqual(len(software), 8)


if __name__ == "__main__":
    unittest.main()
