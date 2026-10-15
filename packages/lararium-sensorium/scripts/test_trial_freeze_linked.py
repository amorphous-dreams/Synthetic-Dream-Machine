"""A linked freeze keeps separate identities and refuses a false child relationship."""

import json
from datetime import datetime

import pytest

from capture_sources import _source_key
from trial_freeze_linked import freeze_linked
from trial_inventory import inventory_claude


def test_linked_freeze_keeps_both_sources_and_reports_reference(tmp_path):
    root = tmp_path / "native"
    project = root / "project"
    child = project / "session" / "subagents" / "agent-abc.jsonl"
    child.parent.mkdir(parents=True)
    main = project / "session.jsonl"
    main.write_text('{"timestamp":"2026-10-07T10:00:00Z","type":"user",'
                    '"message":"agent abc returned"}\n')
    child.write_text('{"timestamp":"2026-10-07T10:01:00Z","type":"assistant",'
                     '"sessionId":"session","agentId":"abc","message":"done"}\n')
    inventory = inventory_claude(root, datetime.fromisoformat("2026-10-07T00:00:00Z"),
                                 datetime.fromisoformat("2026-10-14T00:00:00Z"))
    manifest = tmp_path / "inventory.json"
    manifest.write_text(json.dumps(inventory))
    receipt = freeze_linked(manifest, main, child, tmp_path / "trial")
    assert receipt["main_rows"] == receipt["subagent_rows"] == 1
    assert receipt["selected_parent_rows_referencing_agent_id"] == 1
    child_receipt = json.loads((tmp_path / "trial/subagent/freeze-receipt.json").read_text())
    assert _source_key("claude", child_receipt["evidence"]) == _source_key("claude", str(child))
    assert main.read_text().endswith("\n") and child.read_text().endswith("\n")


def test_linked_freeze_refuses_wrong_parent_before_writing(tmp_path):
    root = tmp_path / "native"
    project = root / "project"
    child = project / "other" / "subagents" / "agent-abc.jsonl"
    child.parent.mkdir(parents=True)
    main = project / "session.jsonl"
    main.write_text('{"timestamp":"2026-10-07T10:00:00Z"}\n')
    child.write_text('{"timestamp":"2026-10-07T10:01:00Z"}\n')
    manifest = tmp_path / "inventory.json"
    manifest.write_text(json.dumps(inventory_claude(
        root, datetime.fromisoformat("2026-10-07T00:00:00Z"),
        datetime.fromisoformat("2026-10-14T00:00:00Z"))))
    with pytest.raises(ValueError, match="sub-agent must sit"):
        freeze_linked(manifest, main, child, tmp_path / "trial")
    assert not (tmp_path / "trial").exists()
