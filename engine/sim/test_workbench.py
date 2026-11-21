"""Tests for the control room server: the routes, the session semantics,
and the refusals. The server runs in-process on an ephemeral port, so these
tests need no network beyond localhost and no running line."""

import json
import os
import sys
import threading
import urllib.error
import urllib.request

import pytest

sys.path.insert(0, os.path.dirname(__file__))

import workbench  # noqa: E402


@pytest.fixture(scope="module")
def base():
    workbench.SESSION.reset()
    server = workbench.ThreadingHTTPServer(("127.0.0.1", 0), workbench.ControlRoom)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    yield "http://127.0.0.1:%d" % server.server_address[1]
    server.shutdown()


def post(base, path, body):
    request = urllib.request.Request(
        base + path,
        data=json.dumps(body).encode("utf-8"),
        headers={"content-type": "application/json"},
        method="POST")
    try:
        with urllib.request.urlopen(request) as response:
            return response.status, json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as failure:
        return failure.code, json.loads(failure.read().decode("utf-8"))


def scan(base, **body):
    payload = {"count": 1, "state": "RUN", "inFlight": 1}
    payload.update(body)
    return post(base, "/v1/scan", payload)


def test_health_is_up(base):
    with urllib.request.urlopen(base + "/health") as response:
        assert response.status == 200
        assert json.loads(response.read().decode("utf-8"))["status"] == "up"


def test_the_control_room_page_is_served(base):
    with urllib.request.urlopen(base + "/") as response:
        assert response.status == 200
        assert "text/html" in response.headers["content-type"]
        page = response.read().decode("utf-8")
    assert "host block control room" in page
    assert "<h1>Fluxline</h1>" in page


def test_the_bench_runs_live(base):
    with urllib.request.urlopen(base + "/v1/bench") as response:
        assert response.status == 200
        figures = json.loads(response.read().decode("utf-8"))
    assert figures["meta"]["releases"] == 12
    assert figures["meta"]["pieces"] == 20
    assert figures["verdicts"] == {"accepted": 11, "vetoed": 1}
    assert len(figures["latency"]["samples"]) == 12
    assert len(figures["registers"]) == 15
    assert any("VETOED" in row["what"] for row in figures["walkthrough"])


def test_a_command_arms_then_the_law_overrules_it(base):
    status, _ = post(base, "/v1/reset", {})
    assert status == 200

    status, reading = scan(
        base,
        command={"seq": 1, "code": "release-override", "gate": 1, "class": 0})
    assert status == 200
    assert [e["event"] for e in reading["events"]] == ["armed"]
    assert reading["armed"] is True
    assert reading["registers"]["ACK_STATE"]["value"] == 0

    # A metal piece at the cell: the law sends it to gate 2, the ask said 1.
    status, reading = scan(base, lcClass=2)
    assert status == 200
    assert [e["event"] for e in reading["events"]] == ["vetoed"]
    assert reading["registers"]["ACK_STATE"]["value"] == 2
    assert reading["registers"]["ACK_GATE"]["value"] == 2
    assert reading["registers"]["ACK_CLASS"]["value"] == 2
    assert reading["registers"]["HOST_ACKS"]["value"] == 1
    assert reading["armed"] is False


def test_a_per_law_command_is_accepted(base):
    post(base, "/v1/reset", {})
    status, reading = scan(
        base,
        command={"seq": 1, "code": "per-law", "gate": 1, "class": 0})
    assert status == 200
    status, reading = scan(base, lcClass=1)
    assert [e["event"] for e in reading["events"]] == ["accepted"]
    assert reading["registers"]["ACK_GATE"]["value"] == 1


def test_a_command_while_jammed_is_refused(base):
    post(base, "/v1/reset", {})
    status, reading = scan(
        base,
        state="JAM",
        command={"seq": 1, "code": "release-override", "gate": 1, "class": 0})
    assert status == 200
    assert [e["event"] for e in reading["events"]] == ["refused"]
    assert reading["registers"]["ACK_STATE"]["value"] == 3


def test_a_dropped_heartbeat_expires_the_armed_command(base):
    post(base, "/v1/reset", {})
    scan(base, command={"seq": 1, "code": "release-override", "gate": 1, "class": 0})
    # The watchdog is 5 s at a 0.1 s scan: fifty scans with no heartbeat.
    status, reading = scan(base, count=60, dropHeartbeat=True)
    assert status == 200
    assert "expired" in [e["event"] for e in reading["events"]]
    assert reading["registers"]["ACK_STATE"]["value"] == 4
    assert reading["hostLive"] is False
    assert reading["alarmHostBit"] == 32


def test_reset_returns_the_block_to_boot(base):
    scan(base, command={"seq": 9, "code": "per-law", "gate": 1, "class": 0})
    status, reading = post(base, "/v1/reset", {})
    assert status == 200
    assert reading["registers"]["ACK_STATE"]["value"] == 0
    assert reading["registers"]["HOST_ACKS"]["value"] == 0
    assert reading["registers"]["HB_HOST"]["value"] == 0


def test_unknown_fields_are_named(base):
    status, problem = scan(base, count=1, extra=1)
    assert status == 400
    assert any("extra" in reason for reason in problem["reasons"])


def test_an_illegal_gate_is_refused_before_the_scan(base):
    status, problem = scan(
        base,
        command={"seq": 1, "code": "release-override", "gate": 9, "class": 0})
    assert status == 400
    assert any("gate" in reason for reason in problem["reasons"])


def test_an_impossible_count_is_refused(base):
    status, problem = scan(base, count=0)
    assert status == 400
    status, problem = scan(base, count=101)
    assert status == 400


def test_invalid_json_is_a_problem(base):
    request = urllib.request.Request(
        base + "/v1/scan", data=b"not json",
        headers={"content-type": "application/json"}, method="POST")
    try:
        urllib.request.urlopen(request)
        raise AssertionError("the server should have refused")
    except urllib.error.HTTPError as failure:
        assert failure.code == 400
        problem = json.loads(failure.read().decode("utf-8"))
    assert "not valid JSON" in problem["detail"]
