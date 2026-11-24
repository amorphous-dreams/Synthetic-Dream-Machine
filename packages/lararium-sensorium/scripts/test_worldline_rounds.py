"""Rounds + messages witness — the observer records a round-close only where a real handback event
appears, records every delivered message, and never invents either.

A spirit persists past its handback: a round-close joins the spirit into the parent's receiving turn
and leaves the fork open; retirement takes its own act (`WorldlineStore.retire`). A message rides an
`inform` edge (sender turn -> recipient handle) that no spawn-tree walk follows, so kapae and the ∥
verdict keep their branch reach.

Real events read from a Claude session (fixtures copy the harness's own row shapes):
  · a `<task-notification>` reporting `completed` with a `<result>` report   -> a round-close
  · an `<agent-message from=…>` carrying `[Subagent hand-back]`              -> a round-close
  · an Agent tool result carrying `status: completed`                        -> a round-close
  · a notification whose result says the agent has not reported yet, or that its report came as a
    message                                                                  -> nothing (no round closed)
  · a notification reporting `killed`, `failed` or `stopped`                 -> an end, never a message
  · a SendMessage whose tool result reports success                          -> a message, its delivery
    named `resumed` (the agent resumed on it) or `queued` (it lands at the agent's next tool round)

    PYTHONPATH=mempalace ./.venv/bin/python -m pytest packages/lararium-sensorium/scripts/test_worldline_rounds.py -q
"""
import json

import worldline_io as wl
from worldline_observe import derive_handle, observe_worldline, read_spirit_events
from worldline_veil import veiled_root

_SECRET = b"witness-worldline-rounds"


def _row(uuid, parent, role, content, **extra):
    return json.dumps({"type": role, "uuid": uuid, "parentUuid": parent, "sessionId": "sess-r",
                       "message": {"role": role, "content": content}, **extra})


def _text(uuid, parent, role, text):
    return _row(uuid, parent, role, [{"type": "text", "text": text}])


_NOTE = ("<note>A task-notification fires each time this agent stops with no live background children of its own. "
         "The user can send it another message and resume it, so the same task-id may notify more than once.</note>")


def _notification(uuid, parent, agent_id, status, summary, result=None):
    body = (f"<task-notification>\n<task-id>{agent_id}</task-id>\n<tool-use-id>toolu_x</tool-use-id>\n"
            f"<output-file>/tmp/tasks/{agent_id}.output</output-file>\n<status>{status}</status>\n"
            f"<summary>{summary}</summary>\n{_NOTE}\n"
            + (f"<result>{result}</result>\n" if result is not None else "")
            + "</task-notification>")
    return _row(uuid, parent, "user", body)


def _notify(uuid, parent, agent_id):
    """A finished round: the report rides the notification's <result>."""
    return _notification(uuid, parent, agent_id, "completed", 'Agent "Scout" finished', "## Findings\n\nThe seam holds.")


def _waiting(uuid, parent, agent_id):
    return _notification(uuid, parent, agent_id, "completed", 'Agent "Scout" finished',
                         "This agent has not reported yet: it is waiting on its own background work and will "
                         "deliver its report through SubagentHandback when that finishes.\n")


def _delivered_elsewhere(uuid, parent, agent_id):
    return _notification(uuid, parent, agent_id, "completed", 'Agent "Scout" finished',
                         f'This agent\'s report was delivered to you as a message from "{agent_id}" (its SubagentHandback call).')


def _agent_message(uuid, parent, agent_id):
    body = (f'Another Claude session sent a message:\n<agent-message from="{agent_id}">\n[Subagent hand-back] The text '
            "below is the final report of a subagent this session delegated to.\n  Research complete.\n</agent-message>")
    return _row(uuid, parent, "user", body)


def _ended(uuid, parent, agent_id, status):
    summary = {"killed": 'Agent "Scout" was stopped by user',
               "failed": 'Agent "Scout" failed: Agent terminated early due to an API error',
               "stopped": 'Background agent "Scout" didn\'t finish before the previous session ended'}[status]
    return _notification(uuid, parent, agent_id, status, summary)


def _send(uuid, parent, tool_id, to):
    return _row(uuid, parent, "assistant",
                [{"type": "tool_use", "id": tool_id, "name": "SendMessage", "input": {"to": to, "message": "round two"}}])


def _send_result(uuid, parent, tool_id, agent_id, success=True, queued=False):
    if not success:
        result = {"success": False, "message": "not reachable"}
    elif queued:
        result = {"success": True, "message": f"Message queued for delivery to {agent_id} at its next tool round.",
                  "pin": {"id": agent_id, "name": agent_id}}
    else:
        result = {"success": True, "message": f"Resuming agent {agent_id[:7]}", "resumedAgentId": agent_id,
                  "pin": {"id": agent_id}}
    return _row(uuid, parent, "user", [{"type": "tool_result", "tool_use_id": tool_id, "content": "ok"}],
                toolUseResult=result)


def _agent_done(uuid, parent, tool_id, agent_id):
    return _row(uuid, parent, "user", [{"type": "tool_result", "tool_use_id": tool_id, "content": "done"}],
                toolUseResult={"status": "completed", "agentId": agent_id, "content": "report"})


def _spirit(tmp_path, agent_id, rows):
    subdir = tmp_path / "sess-r" / "subagents"
    subdir.mkdir(parents=True, exist_ok=True)
    (subdir / f"agent-{agent_id}.jsonl").write_text("\n".join(rows) + "\n", encoding="utf-8")


def _session(tmp_path, main_rows, spirits):
    main = tmp_path / "sess-r.jsonl"
    main.write_text("\n".join(main_rows) + "\n", encoding="utf-8")
    for agent_id, rows in spirits.items():
        _spirit(tmp_path, agent_id, rows)
    return str(main)


def _spirit_rows(prefix):
    return [_text(f"{prefix}1", None, "user", "the task"), _text(f"{prefix}2", f"{prefix}1", "assistant", "a finding")]


def _observe(tmp_path, main):
    store = wl.WorldlineStore(str(tmp_path / "worldline"))
    summary = observe_worldline(store, main, veil_secret=_SECRET)
    run = veiled_root("sess-r", secret=_SECRET)
    return store, summary, run, {(e["frm"], e["to"], e["relation"]): e for e in store.dag()["edges"]}


def test_a_readable_spirit_with_no_handback_event_records_no_round_close(tmp_path):
    main = _session(tmp_path, [_text("u1", None, "user", "go")], {"aaa": _spirit_rows("s")})
    store, summary, run, edges = _observe(tmp_path, main)
    handle = derive_handle(run, "aaa")
    assert (run, handle, "fork") in edges
    assert edges[(run, handle, "fork")]["valid_to"] is None
    assert not [k for k in edges if k[2] == "join"]
    assert summary["rounds"] == []


def test_each_notification_closes_a_round_and_the_message_between_resumes_the_spirit(tmp_path):
    main = _session(tmp_path, [
        _text("u1", None, "user", "go"),
        _notify("n1", "u1", "aaa"),
        _send("a2", "n1", "tu-send", "aaa"),
        _send_result("r2", "a2", "tu-send", "aaa"),
        _notify("n2", "r2", "aaa"),
    ], {"aaa": _spirit_rows("s")})
    store, summary, run, edges = _observe(tmp_path, main)
    handle = derive_handle(run, "aaa")
    assert (handle, "n1", "join") in edges
    assert (handle, "n2", "join") in edges
    assert ("a2", handle, "inform") in edges
    assert edges[(run, handle, "fork")]["valid_to"] is None          # the spirit persists past both rounds
    assert summary["rounds"] == [{"handle": handle, "receipt": "n1", "status": "completed"},
                                 {"handle": handle, "receipt": "n2", "status": "completed"}]
    assert summary["messages"] == [{"from": "a2", "to": handle, "delivery": "resumed"}]


def test_waiting_and_relayed_notifications_close_no_round_and_the_agent_message_does(tmp_path):
    main = _session(tmp_path, [
        _text("u1", None, "user", "go"),
        _waiting("w1", "u1", "aaa"),
        _delivered_elsewhere("d1", "w1", "aaa"),
        _agent_message("h1", "d1", "aaa"),
    ], {"aaa": _spirit_rows("s")})
    _store, summary, run, edges = _observe(tmp_path, main)
    handle = derive_handle(run, "aaa")
    assert [k for k in edges if k[2] == "join"] == [(handle, "h1", "join")]
    assert summary["rounds"] == [{"handle": handle, "receipt": "h1", "status": "completed"}]


def test_killed_failed_and_stopped_read_as_ends_never_as_messages(tmp_path):
    main = _session(tmp_path, [
        _text("u1", None, "user", "go"),
        _ended("k1", "u1", "aaa", "killed"),
        _ended("f1", "k1", "aaa", "failed"),
        _ended("t1", "f1", "aaa", "stopped"),
    ], {"aaa": _spirit_rows("s")})
    _store, summary, run, edges = _observe(tmp_path, main)
    handle = derive_handle(run, "aaa")
    assert not [k for k in edges if k[2] in ("join", "inform")]
    assert summary["rounds"] == []
    assert summary["ends"] == [{"handle": handle, "turn": "k1", "status": "killed"},
                               {"handle": handle, "turn": "f1", "status": "failed"},
                               {"handle": handle, "turn": "t1", "status": "stopped"}]
    assert edges[(run, handle, "fork")]["valid_to"] is None   # an end retires nothing; a message may resume it


def test_a_queued_message_names_its_delivery_apart(tmp_path):
    main = _session(tmp_path, [
        _text("u1", None, "user", "go"),
        _send("a2", "u1", "tu-q", "aaa"),
        _send_result("r2", "a2", "tu-q", "aaa", queued=True),
    ], {"aaa": _spirit_rows("s")})
    _store, summary, run, _edges = _observe(tmp_path, main)
    assert summary["messages"] == [{"from": "a2", "to": derive_handle(run, "aaa"), "delivery": "queued"}]


def test_a_sync_agent_completion_closes_a_round(tmp_path):
    main = _session(tmp_path, [
        _text("u1", None, "user", "go"),
        _agent_done("r1", "u1", "tu-agent", "bbb"),
    ], {"bbb": _spirit_rows("t")})
    _store, summary, run, edges = _observe(tmp_path, main)
    handle = derive_handle(run, "bbb")
    assert (handle, "r1", "join") in edges
    assert summary["rounds"] == [{"handle": handle, "receipt": "r1", "status": "completed"}]


def test_undelivered_messages_and_unknown_agents_record_nothing(tmp_path):
    main = _session(tmp_path, [
        _text("u1", None, "user", "go"),
        _send("a2", "u1", "tu-fail", "aaa"),
        _send_result("r2", "a2", "tu-fail", "aaa", success=False),
        _notify("n3", "r2", "zzz"),                                  # no transcript names zzz
        _send("a4", "n3", "tu-ghost", "zzz"),
        _send_result("r4", "a4", "tu-ghost", "zzz"),
    ], {"aaa": _spirit_rows("s")})
    _store, summary, _run, edges = _observe(tmp_path, main)
    assert not [k for k in edges if k[2] in ("join", "inform")]
    assert summary["rounds"] == [] and summary["messages"] == []


def test_a_spirit_messages_its_sibling(tmp_path):
    main = _session(tmp_path, [_text("u1", None, "user", "go")], {
        "aaa": [*_spirit_rows("s"), _send("s3", "s2", "tu-sib", "bbb"), _send_result("s4", "s3", "tu-sib", "bbb")],
        "bbb": _spirit_rows("t"),
    })
    _store, summary, run, edges = _observe(tmp_path, main)
    assert ("s3", derive_handle(run, "bbb"), "inform") in edges
    assert summary["messages"] == [{"from": "s3", "to": derive_handle(run, "bbb"), "delivery": "resumed"}]


def test_read_spirit_events_dedups_a_repeated_tool_row(tmp_path):
    main = _session(tmp_path, [
        _text("u1", None, "user", "go"),
        _send("a2", "u1", "tu-send", "aaa"),
        _send("a2", "u1", "tu-send", "aaa"),                         # a streamed row lands twice
        _send_result("r2", "a2", "tu-send", "aaa"),
    ], {"aaa": _spirit_rows("s")})
    assert read_spirit_events(main, {"aaa"}) == [{"kind": "message", "agent": "aaa", "turn": "a2", "delivery": "resumed"}]


def test_store_handback_keeps_the_fork_open_and_retire_closes_it(tmp_path):
    store = wl.WorldlineStore(str(tmp_path / "worldline"))
    store.fork("run", "run.a", tick=1)
    store.linear("run.a", "a1", tick=2)
    store.handback("run", "run.a", tick=3, receipt="m1")
    rows = {(e["frm"], e["to"], e["relation"]): e for e in store.dag()["edges"]}
    assert rows[("run.a", "m1", "join")]["valid_from"] == 3
    assert rows[("run", "run.a", "fork")]["valid_to"] is None
    assert store.retire("run", "run.a", tick=4) == {"fork_closed": 1}
    assert {(e["frm"], e["to"], e["relation"]): e for e in store.dag()["edges"]}[("run", "run.a", "fork")]["valid_to"] == 4


def test_store_inform_rides_no_spawn_tree_walk(tmp_path):
    store = wl.WorldlineStore(str(tmp_path / "worldline"))
    store.fork("run", "run.a", tick=1)
    store.fork("run", "run.b", tick=2)
    store.linear("run.a", "a1", tick=3)
    assert store.inform("a1", "run.b", tick=4)["added"] is True
    assert "run.b" not in store.descendants("a1")
    assert store.branch_keys("run.a") == ["run.a", "a1"]
    assert store.are_concurrent("run.a", "run.b")
