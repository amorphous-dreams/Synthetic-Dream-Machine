"""CLI round-trips proving each refactored holder's launched interface is unchanged.

These spawn the script EXACTLY as the TS callers do (same subcommands, same
request/response JSON, same serve protocol) and assert the byte-stable contract —
the load-bearing check that the composition refactor (importing holder_caps at
launch) left every CLI surface intact:

  kg_io         --palace P add PF · kapae --turn-key K   (worldline-kg.ts)
  structurepalace_io  serve --palace D  + NDJSON ping/put/get   (structurepalace.ts)

Run under the mempalace venv:

    PYTHONPATH=<repo>/mempalace ~/.venv/bin/python -m pytest \
        packages/lararium-sensorium/scripts/test_holder_cli.py -q
"""

import json
import os
import subprocess
import sys

import pytest

SCRIPTS_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(SCRIPTS_DIR)))
MEMPALACE_DIR = os.path.join(REPO_ROOT, "mempalace")

pytestmark = pytest.mark.skipif(
    not os.path.isdir(MEMPALACE_DIR), reason="mempalace package dir absent"
)


def _env(home):
    env = os.environ.copy()
    env["HOME"] = str(home)
    env["PYTHONPATH"] = MEMPALACE_DIR + os.pathsep + env.get("PYTHONPATH", "")
    return env


def _run(args, *, home, stdin=None, timeout=60):
    return subprocess.run(
        [sys.executable, os.path.join(SCRIPTS_DIR, args[0]), *args[1:]],
        input=stdin,
        capture_output=True,
        text=True,
        env=_env(home),
        timeout=timeout,
    )


def _json_lines(text):
    return [json.loads(x) for x in text.splitlines() if x.strip()]


# ---------------------------------------------------------------------------
# kg_io — add + kapae (clean, no ChromaDB)
# ---------------------------------------------------------------------------


def test_kg_io_add_then_kapae_round_trip(tmp_path):
    palace = tmp_path / "palace"
    palace.mkdir()
    recs = tmp_path / "recs.ndjson"
    recs.write_text(
        json.dumps({"subject": "agent:a", "predicate": "spawned", "object": "agent:b",
                    "turn_key": "t1"}) + "\n"
    )
    add = _run(["kg_io.py", "--palace", str(palace), "add", str(recs)], home=tmp_path)
    assert add.returncode == 0, add.stderr
    assert json.loads(add.stdout)["added"] == 1

    kapae = _run(
        # --ended carries a logical close-mark (a frontier/tick) — the clock-purity hardening requires
        # it, since valid_to rides the bitemporal worldline and must never fall back to a host clock.
        ["kg_io.py", "--palace", str(palace), "kapae", "--turn-key", "t1", "--ended", "5"], home=tmp_path
    )
    assert kapae.returncode == 0, kapae.stderr
    res = json.loads(kapae.stdout)
    assert res["closed"] == 1 and res["turn_key"] == "t1"


# ---------------------------------------------------------------------------
# structurepalace_io serve — ping · put · get over NDJSON (real .structurepalace ChromaDB)
# ---------------------------------------------------------------------------


def test_structurepalace_io_serve_round_trip(tmp_path):
    palace = str(tmp_path / ".structurepalace")
    h = "a" * 64  # the structural hash is sha256-hex (the cheap embed reads it as hex)
    reqs = "\n".join(
        json.dumps(r)
        for r in [
            {"id": 1, "op": "ping"},
            {"id": 2, "op": "put", "hash": h, "ast": "{\"k\":1}",
             "source_file": "f.md", "verbatim_sha": "V1"},
            {"id": 3, "op": "get", "hash": h},
        ]
    ) + "\n"
    proc = _run(["structurepalace_io.py", "serve", "--palace", palace], home=tmp_path, stdin=reqs)
    assert proc.returncode == 0, proc.stderr
    lines = _json_lines(proc.stdout)
    by_id = {ln["id"]: ln for ln in lines}
    assert by_id[1]["result"] == {"ready": True}
    assert by_id[2]["ok"] is True and by_id[2]["result"] == {"hash": h, "count": 1}
    assert by_id[3]["ok"] is True
    got = by_id[3]["result"]
    assert got["hash"] == h and got["ast"] == {"k": 1} and got["count"] == 1
