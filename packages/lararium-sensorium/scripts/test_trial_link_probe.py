"""A Claude delegation requires typed tool linkage and verified child identity."""

import json
from datetime import datetime

from trial_freeze_linked import freeze_linked
from trial_inventory import inventory_claude
from trial_link_probe import probe_linked


def test_typed_delegation_and_free_text_false_positive(tmp_path):
    root = tmp_path / "native"
    project = root / "project"
    child = project / "session" / "subagents" / "agent-abc.jsonl"
    child.parent.mkdir(parents=True)
    main = project / "session.jsonl"
    rows = [
        {"timestamp": "2026-10-07T10:00:00Z", "type": "assistant", "uuid": "call-row",
         "message": {"content": [{"type": "tool_use", "name": "Agent", "id": "tool-1"}]}},
        {"timestamp": "2026-10-07T10:01:00Z", "type": "user", "uuid": "result-row",
         "parentUuid": "call-row", "message": {"content": [
             {"type": "tool_result", "tool_use_id": "tool-1",
              "content": [{"type": "text", "text": "agentId: abc (internal ID)"}]}]}},
        {"timestamp": "2026-10-07T10:02:00Z", "type": "user", "uuid": "mention",
         "message": "agentId: abc appeared in free text"},
    ]
    main.write_text("".join(json.dumps(row) + "\n" for row in rows))
    child.write_text(json.dumps({"timestamp": "2026-10-07T10:03:00Z", "type": "assistant",
                                 "sessionId": "session", "agentId": "abc", "message": "done"}) + "\n")
    inventory = inventory_claude(root, datetime.fromisoformat("2026-10-07T00:00:00Z"),
                                 datetime.fromisoformat("2026-10-14T00:00:00Z"))
    manifest = tmp_path / "inventory.json"
    manifest.write_text(json.dumps(inventory))
    trial = tmp_path / "trial"
    freeze_linked(manifest, main, child, trial)
    result = probe_linked(trial)
    assert len(result["typed_source_declared_edges"]) == 1
    assert result["typed_source_declared_edges"][0]["tool_result_uuid"] == "result-row"
