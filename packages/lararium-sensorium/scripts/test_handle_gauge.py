"""The handle gauge reads a baseline, and the palace path gets measured against it.

TWO THINGS UNDER TEST, AND THE ORDER MATTERS. First that the instrument FIRES — a gauge that never
moves proves nothing about the thing it watches, and a leak hunt guarded by a dead gauge reads
exactly like a leak hunt that succeeded. Then, and only then, what the palace path actually does.

WHAT THIS TEST DELIBERATELY LEANS AWAY FROM. The conftest's `_close_open_palaces` hook closes every
cached client after each test, so a leaked one cannot poison the next. Good hygiene — and also the
reason the question stayed unanswerable for a month: a rescue that runs everywhere makes a leaking
path and a clean path score identically. Here the palaces open and close inside ONE test, so the
reading belongs to the code rather than to the harness.
"""

from __future__ import annotations

import os
import tempfile
import threading

import pytest

from handle_gauge import (
    HandleReading,
    handles_available,
    join_threads_started_since,
    new_handles,
    open_handle_count,
    open_handles,
    thread_ids,
)

pytestmark = pytest.mark.skipif(
    not handles_available(), reason="this platform does not expose its own descriptor table"
)

SMALL = 2
LARGE = 20


def _palace_module():
    try:
        from mempalace import palace as _p
        return _p
    except Exception:  # noqa: BLE001 — the chroma/venv stack absent
        return None


# ── the instrument, before it gets trusted on anything ──────────────────────────────────────────


def test_the_gauge_answers_a_number():
    n = open_handle_count()
    assert isinstance(n, int)
    assert n > 0, "a live interpreter holds at least its own streams"


def test_the_gauge_fires_on_a_handle_it_can_see():
    """Open a file, watch the count rise; close it, watch the count return. Without this the two
    palace readings below could both be zero for the boring reason."""
    with tempfile.TemporaryDirectory() as tmp:
        path = os.path.join(tmp, "probe")
        with open(path, "w", encoding="utf-8") as fh:
            fh.write("x")
        base = open_handle_count()
        held = [open(path, encoding="utf-8") for _ in range(4)]
        assert open_handle_count() - base == 4, "the gauge did not move on four real handles"
        for fh in held:
            fh.close()
        assert open_handle_count() == base, "the gauge did not return after the handles closed"


def test_the_reading_reports_the_delta_a_block_left_behind():
    with tempfile.TemporaryDirectory() as tmp:
        path = os.path.join(tmp, "probe")
        with open(path, "w", encoding="utf-8") as fh:
            fh.write("x")
        leaked = []
        with HandleReading() as r:
            leaked.append(open(path, encoding="utf-8"))
        assert r.delta == 1
        leaked[0].close()

        with HandleReading() as clean:
            with open(path, encoding="utf-8"):
                pass
        assert clean.delta == 0


def test_the_join_waits_on_a_thread_that_still_holds_its_handle():
    """The join must read liveness, not return on sight. A thread holds a handle and blocks on an
    event nobody has set: the join reports it alive and the handle still counts. Set the event, and
    the join returns only once the thread has closed its handle and gone."""
    with tempfile.TemporaryDirectory() as tmp:
        path = os.path.realpath(os.path.join(tmp, "probe"))  # the descriptor table names real paths
        with open(path, "w", encoding="utf-8") as fh:
            fh.write("x")
        before_threads, base = thread_ids(), open_handles()
        opened, release = threading.Event(), threading.Event()

        def holder():
            with open(path, encoding="utf-8"):
                opened.set()
                release.wait()

        worker = threading.Thread(target=holder)
        worker.start()
        try:
            assert opened.wait(60), "the holder never opened its handle"
            alive = join_threads_started_since(before_threads, timeout=0.2)
            assert any(name.endswith(f"[{worker.native_id}]") for name in alive), (
                f"the join returned while the holder still ran: {alive}"
            )
            assert list(new_handles(base).values()) == [path], (
                "the holder's handle did not count, or a pidfd stayed open"
            )
        finally:
            release.set()
        assert join_threads_started_since(before_threads) == [], "the holder never exited"
        assert new_handles(base) == {}, "the join returned before the holder's handle closed"
        worker.join()


# ── the palace path, measured ───────────────────────────────────────────────────────────────────


def _cycle(p, tmp, n, *, join=True):
    """Open n fresh palaces, close every cached client, and report (opened, residue).

    The residue gets read only after the close has COMPLETED, not when `close_palace` returns.
    chromadb 1.5.9 hands each SQLite connection's release to that connection's own worker thread, so
    the call returns while the database files still sit open; a count taken then reads a backlog of
    handles in flight, and on a slow runner that backlog grows with n and reads like a leak. Joining
    every thread the palaces started orders the count after their last release. As measured, each
    client runs its own threads, so a client that never closes keeps them, and the join names them.

    Both readings count only descriptors the cycle ADDED. A release some earlier work left in flight
    may finish mid-cycle; a plain count would book it against this cycle's residue.
    """
    before, before_threads = open_handles(), thread_ids()
    for i in range(n):
        p.get_collection(os.path.join(tmp, f"pal-{n}-{i}"), create=True, _skip_identity_check=True)
    opened = len(new_handles(before))
    backend = p._DEFAULT_BACKEND
    for path in list(backend._clients):
        backend.close_palace(path)
    if join:
        alive = join_threads_started_since(before_threads)
        assert alive == [], f"threads the {n} palaces started outlived their close: {alive}"
    return opened, len(new_handles(before))


def test_closing_a_palace_gives_its_handles_back_and_the_residue_does_not_scale():
    """THE MEASUREMENT THAT NAMES THE MECHANISM.

    Opening costs handles in proportion to palaces touched — roughly six apiece, measured. The
    question a leak hunt actually needs answered is whether CLOSING gives them back, and the way to
    answer it is a controlled comparison rather than a single reading: run a small cycle and a large
    one in the same process, and compare what each leaves behind.

    A per-palace leak would leave residue growing with n. It does not. The residue reads flat and
    small across an order of magnitude, which is the signature of one-time initialisation — a shared
    log, a telemetry handle — rather than of an accumulating one.

    SO `close_palace` WORKS, and the handle growth this tree has carried as a mystery comes from
    somewhere else entirely: nothing in production ever calls it. Every holder here reaches chroma
    through `get_collection` and none of them close, so a long-lived process accumulates handles with
    the number of palaces it has ever touched. Six per palace makes a few hundred handles the
    expected cost of a few dozen pours — which is the shape of the figures carried in the notes.
    """
    p = _palace_module()
    if p is None:
        pytest.skip("mempalace.palace (chroma stack) not importable")

    with tempfile.TemporaryDirectory() as tmp:
        _cycle(p, tmp, 1, join=False)            # absorb one-time init, lifetime threads included
        small_opened, small_residue = _cycle(p, tmp, SMALL)
        large_opened, large_residue = _cycle(p, tmp, LARGE)

    print(f"\n[handle-gauge] {SMALL:>2} palaces → opened +{small_opened}, residue {small_residue}")
    print(f"[handle-gauge] {LARGE:>2} palaces → opened +{large_opened}, residue {large_residue}")

    assert small_opened > 0 and large_opened > small_opened, (
        "opening palaces cost nothing, or cost the same at both sizes — the gauge or chroma moved"
    )
    # The load-bearing claim: the residue is a CONSTANT, not a per-palace cost. A leak leaves a cost
    # per palace closed (opening costs about six apiece), so it grows with the palaces added; a runner's
    # one-time stragglers move it by a handle or three and never with n. The bound reads that slope:
    # under one handle per two palaces added, far below a leak's per-palace cost.
    assert large_residue - small_residue < (LARGE - SMALL) // 2, (
        f"residue grew with palace count ({small_residue} at n={SMALL} → {large_residue} at "
        f"n={LARGE}) — close_palace is leaking per palace"
    )


def test_production_holders_never_close_what_they_open():
    """The leak's actual route, asserted in source rather than argued in prose.

    Every palace holder opens through `get_collection`. If one of them ever gains a close path this
    test fails, which is the point: the failure is the signal to update the finding above, not a
    defect. Until then it records — checkably — that the growth belongs to an absent call rather
    than to a broken one.
    """
    here = os.path.dirname(os.path.abspath(__file__))
    openers, closers = [], []
    for name in sorted(os.listdir(here)):
        if not name.endswith("_io.py") or name.startswith("test_"):
            continue
        src = open(os.path.join(here, name), encoding="utf-8").read()
        if "get_collection(" in src:
            openers.append(name)
            if "close_palace(" in src:
                closers.append(name)
    assert openers, "no palace holders found — the walk lost its directory"
    print(f"\n[handle-gauge] {len(openers)} holders open a palace; {len(closers)} close one")
    assert closers == [], (
        "a holder now closes its palace — good, and the leak note above wants re-measuring: "
        + ", ".join(closers)
    )
