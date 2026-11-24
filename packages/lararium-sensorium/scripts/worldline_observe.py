#!/usr/bin/env python3
"""worldline_observe — the DEMUX step 1b: read a captured transcript, build its worldline fork-DAG.

capture_session lands turns FLAT into content_io; nothing yet stands the braid the demux climbs. This
observer reads the transcript PROVENANCE and feeds worldline_io the edges that reconstruct the rhizome:

  · the MAIN linear chain — each turn links to its `parentUuid` predecessor, so `worldline_of` climbs
    the main session up to its root. A turn whose `parentUuid` reads null roots at the RUN node (the
    session id) — the braid-anchor.
  · the SPAWN fork      — a session's `<session>/subagents/agent-<id>.jsonl` names a spirit's whole
    worldline. Each spirit forks `run -> <run>.<agentId>` (the handle deriveHandle mints); the spirit's
    own turns chain UNDER that handle, so a spirit turn climbs handle -> run -> the session root.
  · the ROUND close     — a REAL report in the main transcript joins `<run>.<agentId>` into the main turn
    that received it; the fork stays open, since the spirit persists past its round. A report reads as
    a `<task-notification>` reporting `completed` with a `<result>` report, an `<agent-message>`
    carrying `[Subagent hand-back]`, or an Agent tool result reporting `completed`. A notification
    whose result says the agent has not reported yet (or relays to the agent-message) closes nothing,
    and a readable spirit transcript proves no handback.
  · the END             — a notification reporting killed, failed or stopped ends a round without a
    report: the summary names it, and no edge moves history.
  · the MESSAGE         — a SendMessage whose tool result reports success rides an `inform` edge from
    the sending turn to the recipient spirit's handle (the main resuming a spirit, or a spirit reaching
    its sibling); a `queued` delivery lands at the agent's next tool round, and the record places it at
    the send. An undelivered message, or one naming an agent with no transcript, records nothing.
  · RETIREMENT          — no Claude transcript carries a retirement act, so the observer closes no fork.

SPAWN keys to the spirit's first turn. TWO choices shape this observer:

  1. NODE SPACE. The compare feed (`capture_session.subagent_edges`) emits prov triples in handle-space.
     This observer lives in worldline_io's TURN-KEY space so `worldline_of` / `roots` / kapae read
     the SAME keys content_io lands under (lar_turn_key). The fork still runs `run -> handle` (the task's
     edge); the spirit's own turns then chain under the handle so the demux reaches them.
  2. CLOCK. This observer rides worldline_io's tick discipline: a caller LOGICAL ORDINAL, monotonic in transcript read-order. NO host wall-time
     touches the edge path (clock-purity, the sighting ward) — this module imports no clock, and the
     transcript's own timestamps never reach an edge.

The worldline stays LOCAL — a py-local worldline_io fork-DAG, never a federated/meshed doc.

Meme: lar:///ha.ka.ba/lararium/api/agent-worldline#attribution
"""
from __future__ import annotations

import itertools
import json
import os
import re
from dataclasses import dataclass, field

from worldline_veil import veiled_root


# --- transcript provenance readers (ported from subagent-mine.ts) -----------


def run_id_of(transcript_path: str) -> str:
    """The worldline RUN-root for a session transcript — its basename minus `.jsonl` (the session id)."""
    return re.sub(r"\.jsonl$", "", os.path.basename(transcript_path))


def agent_id_of(agent_file: str) -> str:
    """The agent id an `agent-<id>.jsonl` basename carries, else `unknown`."""
    m = re.match(r"^agent-(.+)\.jsonl$", os.path.basename(agent_file))
    return m.group(1) if m else "unknown"


def spirit_subagent_dir(transcript_path: str) -> str:
    """The `<session>/subagents` directory that holds a session's tasked-spirit transcripts."""
    return re.sub(r"\.jsonl$", "", transcript_path) + "/subagents"


def list_spirit_files(transcript_path: str) -> list:
    """Every `agent-*.jsonl` tasked-spirit transcript a session spawned (absolute paths, sorted), else []."""
    d = spirit_subagent_dir(transcript_path)
    if not os.path.isdir(d):
        return []
    try:
        return sorted(os.path.join(d, f) for f in os.listdir(d)
                      if re.match(r"^agent-.*\.jsonl$", f))
    except OSError:
        return []


def derive_handle(run: str, agent_id: str) -> str:
    """The lineage HANDLE `<root>.<agentId>` — `run` here reads the VEILED worldline-root (`wl-<hash>`,
    worldline_veil, C1b), so the handle rides opaque too. The cross-system worldline binding rides
    `lar_turn_key` (the turn uuid, unchanged), NOT this handle string — so veiling the root leaks nothing
    while the demux still joins a landed drawer to its braid by turn-key."""
    return f"{run}.{agent_id}"


@dataclass
class TurnLink:
    """One transcript turn's braid position — its own uuid + the parentUuid it descends from (or None)."""
    uuid: str
    parent: "str | None"


def read_chain(path: str) -> list:
    """Read a transcript's user/assistant turns into a `parentUuid` chain (in file order).

    Keeps every row carrying a `uuid` (text-empty tool rows included) so a chain never breaks where a
    later turn descends from a bodyless predecessor. Reads no timestamp — the edge path stays clock-pure."""
    out: list = []
    try:
        # errors="replace": one non-UTF8 byte substitutes U+FFFD, never crashes the observe pass on a
        # single line (matches capture_sources / structure_router); the edge path stays clock-pure.
        with open(path, encoding="utf-8", errors="replace") as fh:
            for line in fh:
                line = line.strip()
                if not line:
                    continue
                try:
                    row = json.loads(line)
                except json.JSONDecodeError:
                    continue
                if row.get("type") not in ("user", "assistant"):
                    continue
                uuid = row.get("uuid")
                if not uuid:
                    continue
                parent = row.get("parentUuid")
                out.append(TurnLink(uuid=str(uuid), parent=(str(parent) if parent else None)))
    except OSError:
        return []
    return out


@dataclass
class SpiritEdges:
    """A spirit's derived worldline shape — the handle it forks into + its own turn chain."""
    handle: str
    agent_id: str
    agent_file: str
    chain: list = field(default_factory=list)


def derive_subagent_edges(transcript: str, run: str) -> list:
    """Derive every spirit's fork shape from a session transcript — PURE (reads files, writes nothing).
    `run` = the VEILED worldline-root the caller minted; each spirit's handle = `<run>.<agentId>`. Empty
    when none spawned."""
    out: list = []
    for af in list_spirit_files(transcript):
        agent_id = agent_id_of(af)
        chain = read_chain(af)
        if not chain:
            continue  # a spirit with no readable turns anchors no edge
        out.append(SpiritEdges(handle=derive_handle(run, agent_id), agent_id=agent_id,
                               agent_file=af, chain=chain))
    return out


_TASK_ID = re.compile(r"<task-id>\s*([^<\s]+)\s*</task-id>")
_TASK_STATUS = re.compile(r"<status>\s*([^<]+?)\s*</status>")
_TASK_RESULT = re.compile(r"<result>(.*?)</result>", re.S)
_AGENT_MESSAGE = re.compile(r'<agent-message from="([^"]+)">\s*\[Subagent hand-back\]')
# A finished notification whose <result> carries no report: the agent still waits on its own background
# work, or its report reached the session as an agent-message (which counts once, where it lands).
_NO_REPORT = ("This agent has not reported yet", "This agent's report was delivered to you as a message")
# A notification status that ends a round without a report: an end, never a message.
_END_STATUSES = ("killed", "failed", "stopped")


def _texts(content) -> list:
    """The plain-text spans of a message body (a bare string, or the `text` blocks of a list)."""
    if isinstance(content, str):
        return [content]
    if isinstance(content, list):
        return [b.get("text", "") for b in content if isinstance(b, dict) and b.get("type") == "text"]
    return []


def _notification_event(text: str, known: set, turn: str) -> "dict | None":
    """Read one `<task-notification>` for a known agent: a round close where it carries a real report, an
    end where it reports killed/failed/stopped, and nothing where the result says no report came."""
    m = _TASK_ID.search(text)
    if not m or m.group(1) not in known:
        return None
    st = _TASK_STATUS.search(text)
    status = st.group(1) if st else ""
    if status in _END_STATUSES:
        return {"kind": "end", "agent": m.group(1), "turn": turn, "status": status}
    res = _TASK_RESULT.search(text)
    if status != "completed" or not res or res.group(1).lstrip().startswith(_NO_REPORT):
        return None
    return {"kind": "handback", "agent": m.group(1), "turn": turn, "status": "completed"}


def read_spirit_events(path: str, agents) -> list:
    """Read the REAL launch, handback, end and message events a transcript records for the known `agents`
    (agent ids with a spirit transcript), in file order — PURE, clock-free, deduped.

      {"kind": "launch", "agent": id, "turn": <assistant row holding the Agent tool_use>}
        · an Agent tool_use whose tool result names `agentId: id` (launched async, or completed inline).
      {"kind": "handback", "agent": id, "turn": <receiving row uuid>, "status": "completed"}
        · a `<task-notification>` reporting `completed` with a `<result>` report (not the "has not
          reported yet" wait, not the "delivered to you as a message" relay), or
        · an `<agent-message from="id">` carrying `[Subagent hand-back]` (a SubagentHandback delivery), or
        · a user row whose `toolUseResult` reports `status: completed` with `agentId: id`.
      {"kind": "end", "agent": id, "turn": <row uuid>, "status": "killed" | "failed" | "stopped"}
        · a notification reporting that status: the round ends without a report, and no message moves.
      {"kind": "message", "agent": id, "turn": <sending row uuid>, "delivery": "resumed" | "queued"}
        · an assistant SendMessage tool_use whose tool result reports `success: true`; the recipient reads
          from `resumedAgentId` / `pin.id`, else the tool input's `to`. `queued` names a message the harness
          holds for the agent's next tool round: the record places its receive at the send.

    An event naming an agent outside `agents` records nothing — the observer never invents a spirit."""
    known = set(agents)
    sends: dict = {}
    launches: dict = {}
    seen: set = set()
    out: list = []

    def emit(key, event) -> None:
        if key not in seen:
            seen.add(key)
            out.append(event)

    try:
        with open(path, encoding="utf-8", errors="replace") as fh:
            for line in fh:
                line = line.strip()
                if not line:
                    continue
                try:
                    row = json.loads(line)
                except json.JSONDecodeError:
                    continue
                uuid = row.get("uuid")
                if not uuid or row.get("type") not in ("user", "assistant"):
                    continue
                uuid = str(uuid)
                msg = row.get("message") if isinstance(row.get("message"), dict) else {}
                content = msg.get("content")
                if row.get("type") == "assistant":
                    for b in content if isinstance(content, list) else []:
                        if not (isinstance(b, dict) and b.get("type") == "tool_use"):
                            continue
                        if b.get("name") == "SendMessage":
                            to = (b.get("input") or {}).get("to")
                            sends.setdefault(b.get("id"), (uuid, str(to) if to else ""))
                        elif b.get("name") in ("Agent", "Task"):
                            launches.setdefault(b.get("id"), uuid)
                    continue
                result = row.get("toolUseResult") if isinstance(row.get("toolUseResult"), dict) else {}
                for b in content if isinstance(content, list) else []:
                    if not (isinstance(b, dict) and b.get("type") == "tool_result"):
                        continue
                    tid = b.get("tool_use_id")
                    if tid in launches and result.get("agentId") in known:
                        emit(("launch", result["agentId"]), {"kind": "launch", "agent": result["agentId"], "turn": launches[tid]})
                    if tid in sends and result.get("success") is True:
                        turn, to = sends[tid]
                        agent = result.get("resumedAgentId") or (result.get("pin") or {}).get("id") or to
                        if agent in known:
                            queued = "queued for delivery" in str(result.get("message") or "")
                            emit(("message", tid), {"kind": "message", "agent": agent, "turn": turn,
                                                    "delivery": "queued" if queued else "resumed"})
                if result.get("status") == "completed" and result.get("agentId") in known:
                    emit(("handback", result["agentId"], uuid),
                         {"kind": "handback", "agent": result["agentId"], "turn": uuid, "status": "completed"})
                for text in _texts(content):
                    if "<task-notification>" in text:
                        ev = _notification_event(text, known, uuid)
                        if ev:
                            emit((ev["kind"], ev["agent"], uuid), ev)
                    for m in _AGENT_MESSAGE.finditer(text):
                        if m.group(1) in known:
                            emit(("handback", m.group(1), uuid),
                                 {"kind": "handback", "agent": m.group(1), "turn": uuid, "status": "completed"})
    except OSError:
        return []
    return out


# --- the wire: feed the derived shape into worldline_io ---------------------


def _add_chain(store, chain: list, root_anchor: str, tick) -> int:
    """Add a transcript's linear chain to the rhizome, rooting a null-parent turn at `root_anchor`
    (the RUN for a main chain, the HANDLE for a spirit chain). Returns the edges added-or-seen count.

    Every turn links `parent -> uuid`; a null parentUuid links `root_anchor -> uuid`, so the chain hangs
    off the braid-anchor and `worldline_of` climbs to ONE session root. `tick` = the caller ordinal.

    PHANTOM-ROOT GUARD: a first turn whose `parentUuid` points OUTSIDE this transcript's own uuid-set
    (a RESUMED session descending from a prior-session turn NOT in this file) ALSO roots at `root_anchor`
    — else that phantom parent, never a `to` of any edge, would surface as a spurious braid-root in
    `roots()`. Descent stays local: a parent counts only when it names a turn this transcript carries."""
    own = {link.uuid for link in chain}   # the transcript's OWN uuids — a parent outside them phantoms
    added = 0
    for link in chain:
        frm = link.parent if (link.parent and link.parent in own) else root_anchor
        store.linear(frm, link.uuid, next(tick))
        added += 1
    return added


def observe_worldline(store, transcript: str, *, tick0: int = 1, veil_secret: "bytes | str | None" = None,
                      veil_context: str = "", identity_dir: "str | None" = None) -> dict:
    """Read `transcript` and build its whole worldline into `store` (a worldline_io.WorldlineStore).

    The braid-anchor rides the VEILED worldline-root (`wl-<hash>`, worldline_veil C1b), NEVER the bare
    session basename — so the graph carries an opaque, owner-recomputable root. `veil_secret` injects the
    local secret (a witness passes an explicit test salt; None resolves the on-disk persona/worldline-salt).

    Order: the main linear chain (rooted at the RUN node) · per spirit — the SPAWN fork (`run -> handle`)
    and the spirit's own chain (rooted at the HANDLE) · then the main transcript's real handback and
    message events · then each spirit's messages to its siblings. Every edge
    takes a caller LOGICAL ORDINAL tick (monotonic in read-order), so a re-run mints the identical
    (frm, to, relation, tick) tuples and worldline_io's sink-idempotence dedups them — no duplicate edges.

    Returns a summary: the veiled run-root, the main-chain length, the observed spirit handles, the
    round closes (handle, receipt turn, reported status) and the messages (sending turn, recipient)."""
    tick = itertools.count(tick0)  # the pure logical ordinal — no host clock rides the edge path
    run = veiled_root(run_id_of(transcript), veil_context, secret=veil_secret, identity_dir=identity_dir)

    # 1. the MAIN linear chain — a null-parent main turn roots at the RUN node (the session braid-anchor).
    main_chain = read_chain(transcript)
    main_edges = _add_chain(store, main_chain, run, tick)

    # 2. per spirit — the SPAWN fork and the spirit chain under the handle.
    spirits = derive_subagent_edges(transcript, run)
    handles = {s.agent_id: s.handle for s in spirits}
    for spirit in spirits:
        store.fork(run, spirit.handle, next(tick))            # SPAWN: run -> <run>.<agentId>
        _add_chain(store, spirit.chain, spirit.handle, tick)  # the spirit's turns chain under the handle

    # 3. the main transcript's REAL events — a round close joins the spirit into the receiving turn and
    #    leaves its fork open; a delivered message informs the spirit from the sending turn.
    rounds: list = []
    messages: list = []
    ends: list = []
    for ev in read_spirit_events(transcript, handles):
        handle = handles[ev["agent"]]
        if ev["kind"] == "handback":
            store.handback(run, handle, next(tick), receipt=ev["turn"])
            rounds.append({"handle": handle, "receipt": ev["turn"], "status": ev["status"]})
        elif ev["kind"] == "message":
            store.inform(ev["turn"], handle, next(tick))
            messages.append({"from": ev["turn"], "to": handle, "delivery": ev["delivery"]})
        elif ev["kind"] == "end":
            ends.append({"handle": handle, "turn": ev["turn"], "status": ev["status"]})

    # 4. each spirit's delivered messages to its siblings.
    for spirit in spirits:
        for ev in read_spirit_events(spirit.agent_file, handles):
            if ev["kind"] != "message" or ev["agent"] == spirit.agent_id:
                continue
            store.inform(ev["turn"], handles[ev["agent"]], next(tick))
            messages.append({"from": ev["turn"], "to": handles[ev["agent"]], "delivery": ev["delivery"]})

    return {"run": run, "main_turns": main_edges, "spirits": [s.handle for s in spirits],
            "rounds": rounds, "messages": messages, "ends": ends}


def detect_rewind(store, drawers) -> "str | None":
    """Compare a re-derived transcript's content-hash-chain to the STORED drawers' `lar_chain`, returning
    the first turn-key where they DIVERGE — the rewind-point (an edited or diverged prefix); None when the
    chain holds. The cid keys on source+index (content-INDEPENDENT), so an edit re-derives the SAME cid and
    `is_landed` would skip it silently; the chain surfaces the tamper, so the caller kāpae-prunes from the
    rewind-point (the retraction — the cascade re-projects downstream). `drawers` = the freshly re-derived
    (cid, text, metadata) tuples for one source; a genuinely new tail turn (no stored drawer) reads as
    growth, not a rewind."""
    for cid, _text, meta in drawers:
        stored = store.get(cid)
        if stored is None:
            continue                                       # a new tail turn — growth, not a rewind
        if (stored.get("metadata") or {}).get("lar_chain") != meta.get("lar_chain"):
            return meta.get("lar_turn_key")                # the chain diverged here — the rewind-point
    return None
