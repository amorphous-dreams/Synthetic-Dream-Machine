#!/usr/bin/env python3
"""handle_gauge — how many file handles does this process hold right now?

WHY THIS EXISTS, AND WHY IT COMES BEFORE ANY FIX. A palace holder reaches chroma through
`mempalace.palace.get_collection`, which caches one PersistentClient per palace directory on a
module-level backend. Chromadb frees the rust-side SQLite and HNSW handles only on an explicit
close; a bare dereference leaves them open. So a process that pours many sensoriums accumulates
handles with the number of palaces it touched rather than with its concurrency.

That much has been suspected for a long while, carried as a figure — a peak against a larger
earlier peak — whose measurement method nobody wrote down. A figure without its method cannot say
whether it read a peak under load, a steady state, or one unlucky pour. So the first thing this
module produces is not a cure. It is a BASELINE, taken by a stated method, that a later reading can
be compared against.

THE INSTRUMENT DECIDES WHAT COUNTS AS PROGRESS. Absence of finding and absence of looking generate
identically, and for as long as nothing counted handles the question could not move in either
direction — a fix would have looked the same as no fix. Counting is what turns it into a loop.

READS ONLY, COSTS NOTHING. A directory listing of the process's own descriptor table. No chroma, no
sqlite, no imports beyond the standard library, so a caller may take a reading from anywhere,
including from inside a failure path.

Meme: lar:///ha.ka.ba/lararium/api/sensorium-runbook
"""

from __future__ import annotations

import os
import select
import time


def open_handle_count() -> "int | None":
    """Open descriptors held by THIS process, or None where the platform will not say.

    Linux answers through `/proc/self/fd`. Everywhere else returns None rather than a guess — a
    fabricated count would read like a measurement and compare like one.
    """
    try:
        return len(os.listdir("/proc/self/fd"))
    except OSError:
        return None


def handles_available() -> bool:
    """Can this platform answer at all? Callers skip rather than assert when it cannot."""
    return open_handle_count() is not None


def open_handles() -> "dict[int, str] | None":
    """Descriptor number → what it points at, for THIS process, or None where the platform will not say."""
    try:
        names = os.listdir("/proc/self/fd")
    except OSError:
        return None
    table = {}
    for name in names:
        try:
            table[int(name)] = os.readlink(f"/proc/self/fd/{name}")
        except OSError:
            continue  # closed between the listing and the read
    return table


def new_handles(before: "dict[int, str]") -> "dict[int, str]":
    """Descriptors open now that the `before` table did not hold (same number, same target).

    Reads what a block ADDED and ignores what it saw close. A descriptor some earlier work was
    still releasing may close in the middle of a measurement; a plain count reads that as a handle
    given back and the block's own residue shrinks by it. This reading cannot move that way.
    One blind spot stays: anonymous targets (`anon_inode:[eventfd]`) repeat as strings, so a new one
    that lands on the number of a same-kind descriptor freed mid-block reads as old. File targets
    never collide that way, since each path differs.
    """
    now = open_handles()
    if now is None:
        raise OSError("the descriptor table stopped answering mid-measurement")
    return {fd: target for fd, target in now.items() if before.get(fd) != target}


def thread_ids() -> "frozenset[int] | None":
    """Native ids of the threads THIS process runs right now, or None where the platform will not say.

    The set counts every OS thread, Rust and C ones included, not only the ones `threading` knows.
    """
    try:
        return frozenset(int(tid) for tid in os.listdir("/proc/self/task"))
    except OSError:
        return None


def _thread_name(tid: int) -> str:
    try:
        with open(f"/proc/self/task/{tid}/comm", encoding="utf-8") as fh:
            return f"{fh.read().strip()}[{tid}]"
    except OSError:
        return f"?[{tid}]"


_PIDFD_THREAD = os.O_EXCL  # Linux 6.9+: a pidfd that names ONE thread and wakes on that thread's exit


def join_threads_started_since(before: "frozenset[int]", timeout: float = 60.0) -> "list[str]":
    """Block until every thread this process started after the `before` snapshot has exited.

    WHY A COUNT NEEDS THIS. A close that hands its release to a worker thread returns before the
    handles go back: chromadb drops its SQLite pool, and each connection's own `sqlx-sqlite-worker`
    thread closes the database file AFTER `close()` has already returned. A count taken at that
    moment reads handles that are still closing. A thread exits only after its last statement ran,
    so the thread's exit marks the close's completion, and joining it turns a race into a
    happens-before. That covers a release that runs on a thread started after the snapshot; one
    handed to a pooled thread that outlives it stays outside the join.

    Joins through a thread pidfd where the kernel offers one, else watches the thread's own
    `/proc/self/task` entry go. Returns the names of threads still alive at the deadline (an empty
    list means every one joined). The deadline only ever turns an answer red: it names a thread the
    window started and that never exited, which for the palace cycle (as measured) belongs to a
    client that never closed.
    """
    now = thread_ids()
    if now is None:
        raise OSError("the thread table stopped answering: nothing can be joined")
    deadline = time.monotonic() + timeout
    pending = {}
    for tid in now - before:
        try:
            pending[tid] = os.pidfd_open(tid, _PIDFD_THREAD)
        except ProcessLookupError:
            continue  # exited between the listing and the open
        except (AttributeError, OSError):
            pending[tid] = None  # no thread pidfd on this kernel: watch the task entry instead
    try:
        while pending:
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                break
            watched = {fd: tid for tid, fd in pending.items() if fd is not None}
            if len(watched) == len(pending):
                poller = select.poll()
                for fd in watched:
                    poller.register(fd, select.POLLIN)
                for fd, _event in poller.poll(int(remaining * 1000) + 1):
                    del pending[watched[fd]]  # readable: that thread has exited
                    os.close(fd)
            else:
                for tid in [t for t in pending if not os.path.exists(f"/proc/self/task/{t}")]:
                    fd = pending.pop(tid)
                    if fd is not None:
                        os.close(fd)
                if pending:
                    time.sleep(min(0.01, remaining))
        return sorted(_thread_name(tid) for tid in pending)
    finally:
        for fd in pending.values():
            if fd is not None:
                os.close(fd)


class HandleReading:
    """A before/after pair around a block, so a caller reads the DELTA rather than a total.

    A total says little — an interpreter holds descriptors for its own reasons and the number drifts
    with imports. What a leak hunt wants is what a block left behind after it claimed to be done.

        with HandleReading() as r:
            ... open and close some palaces ...
        assert r.delta == 0
    """

    def __init__(self) -> None:
        self.before: "int | None" = None
        self.after: "int | None" = None

    def __enter__(self) -> "HandleReading":
        self.before = open_handle_count()
        return self

    def __exit__(self, *_exc) -> "bool":
        self.after = open_handle_count()
        return False

    @property
    def delta(self) -> "int | None":
        """Descriptors the block did not give back, or None when the platform stayed silent."""
        if self.before is None or self.after is None:
            return None
        return self.after - self.before

    def __repr__(self) -> str:
        return f"HandleReading(before={self.before}, after={self.after}, delta={self.delta})"
