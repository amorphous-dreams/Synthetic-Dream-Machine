"""The CI contract for the Python sensorium holder suite.

This suite lives beside the holder modules rather than in the workspace's
TypeScript test command.  Keep the workflow invocation explicit, so a green
CI run cannot silently omit the holder tests again.
"""

from pathlib import Path


_ROOT = Path(__file__).resolve().parents[3]
_CI = _ROOT / ".github" / "workflows" / "ci.yml"


def test_ci_runs_the_sensorium_python_suite_from_the_holder_venv() -> None:
    workflow = _CI.read_text(encoding="utf-8")

    assert "Run lararium-sensorium Python suite" in workflow
    assert (
        "~/.venv/bin/python3 -m pytest packages/lararium-sensorium/scripts -q"
        in workflow
    )
