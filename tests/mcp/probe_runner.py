#!/usr/bin/env python3
"""
Lares Behavioral Test Suite — MCP probe runner
Backend-generic STDIO server using FastMCP.

Env vars:
  LARES_TEST_BACKEND   openai | anthropic  (default: openai)
  LARES_TEST_MODEL     subject model name  (default: gpt-4o / claude-opus-4-5)
  LARES_JUDGE_MODEL    judge model name    (default: gpt-4o-mini / claude-haiku-3-5)
  OPENAI_API_KEY       required if backend=openai
  ANTHROPIC_API_KEY    required if backend=anthropic

Setup:
  source .venv/bin/activate
  pip install -r tests/mcp/requirements.txt
  python tests/mcp/probe_runner.py
"""

import json
import os
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from mcp.server.fastmcp import FastMCP

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

_REPO_ROOT = Path(__file__).parent.parent.parent
AGENTS_MD_PATH = _REPO_ROOT / "AGENTS.md"
RESULTS_DIR = _REPO_ROOT / "tests" / "results"

# ---------------------------------------------------------------------------
# Backend configuration
# ---------------------------------------------------------------------------

BACKEND = os.environ.get("LARES_TEST_BACKEND", "openai").lower()

_DEFAULT_SUBJECT = {
    "openai": "gpt-4o",
    "anthropic": "claude-opus-4-5",
}
_DEFAULT_JUDGE = {
    "openai": "gpt-4o-mini",
    "anthropic": "claude-haiku-3-5",
}

SUBJECT_MODEL = os.environ.get("LARES_TEST_MODEL", _DEFAULT_SUBJECT.get(BACKEND, "gpt-4o"))
JUDGE_MODEL = os.environ.get("LARES_JUDGE_MODEL", _DEFAULT_JUDGE.get(BACKEND, "gpt-4o-mini"))

AGENTS_MD_TEXT: str = AGENTS_MD_PATH.read_text(encoding="utf-8")

# ---------------------------------------------------------------------------
# FastMCP server
# ---------------------------------------------------------------------------

mcp = FastMCP(
    "lares-probe-runner",
    instructions=(
        "Run behavioral probes against a Lares subject model and evaluate responses. "
        "Tools: run_probe, run_multiturn, evaluate_probe, log_result."
    ),
)

# ---------------------------------------------------------------------------
# Backend helpers
# ---------------------------------------------------------------------------


def _subject_call(messages: list[dict], temperature: float = 0.9) -> str:
    """Send messages to the subject model, prepending AGENTS.md as the system prompt."""
    if BACKEND == "anthropic":
        import anthropic

        client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
        result = client.messages.create(
            model=SUBJECT_MODEL,
            max_tokens=2048,
            temperature=temperature,
            system=[
                {
                    "type": "text",
                    "text": AGENTS_MD_TEXT,
                    "cache_control": {"type": "ephemeral"},  # prompt caching: ~90% discount after first call
                }
            ],
            messages=messages,
        )
        return result.content[0].text

    else:  # openai
        import openai

        client = openai.OpenAI(api_key=os.environ["OPENAI_API_KEY"])
        full_messages = [{"role": "system", "content": AGENTS_MD_TEXT}] + messages
        result = client.chat.completions.create(
            model=SUBJECT_MODEL,
            messages=full_messages,
            temperature=temperature,
        )
        return result.choices[0].message.content


def _judge_call(prompt: str) -> dict:
    """Send a structured evaluation prompt to the judge model. Returns {pass, score, rationale}."""
    if BACKEND == "anthropic":
        import anthropic

        client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
        result = client.messages.create(
            model=JUDGE_MODEL,
            max_tokens=512,
            temperature=0,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = result.content[0].text
    else:  # openai
        import openai

        client = openai.OpenAI(api_key=os.environ["OPENAI_API_KEY"])
        result = client.chat.completions.create(
            model=JUDGE_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0,
            response_format={"type": "json_object"},
        )
        raw = result.choices[0].message.content

    try:
        parsed = json.loads(raw)
        result: dict = {
            "pass": bool(parsed.get("pass", False)),
            "score": int(parsed.get("score", 1)),
            "rationale": str(parsed.get("rationale", "")),
        }
        if "exemplar_alignment" in parsed:
            result["exemplar_alignment"] = int(parsed["exemplar_alignment"])
        return result
    except (json.JSONDecodeError, KeyError, ValueError):
        return {"pass": False, "score": 1, "rationale": f"Judge returned unparseable output: {raw[:200]}"}


# ---------------------------------------------------------------------------
# MCP tools
# ---------------------------------------------------------------------------


@mcp.tool()
def run_probe(
    probe_id: str,
    probe_input: str,
    temperature: float = 0.9,
    n_runs: int = 1,
) -> list[dict]:
    """
    Run a single-turn probe against the subject model.

    Args:
        probe_id:    Probe identifier (e.g. "G-01", "R-03").
        probe_input: The probe text to send as a user message.
        temperature: Sampling temperature for the subject model (default 0.9).
        n_runs:      Number of independent runs (default 1; use 3–10 for statistics).

    Returns:
        List of {run_id, response, duration_ms} dicts.
    """
    results = []
    for i in range(n_runs):
        t0 = time.monotonic()
        response = _subject_call(
            messages=[{"role": "user", "content": probe_input}],
            temperature=temperature,
        )
        duration_ms = int((time.monotonic() - t0) * 1000)
        results.append(
            {
                "run_id": f"{probe_id}-run{i+1}",
                "response": response,
                "duration_ms": duration_ms,
            }
        )
    return results


@mcp.tool()
def run_multiturn(
    probe_id: str,
    turns: list[dict],
    temperature: float = 0.9,
) -> str:
    """
    Run a multi-turn scenario against the subject model.

    Args:
        probe_id:    Scenario identifier (e.g. "S-02", "P-06").
        turns:       Alternating user/assistant messages as {role, content} dicts.
                     Do NOT include a system message — the server prepends AGENTS.md.
                     Must start and end with a user message.
        temperature: Sampling temperature (default 0.9).

    Returns:
        The subject model's response to the final user turn.
    """
    t0 = time.monotonic()
    response = _subject_call(messages=turns, temperature=temperature)
    duration_ms = int((time.monotonic() - t0) * 1000)
    return response


@mcp.tool()
def evaluate_probe(
    probe_id: str,
    response: str,
    pass_criteria: str,
    fail_signal: str,
    exemplar_path: str = "",
) -> dict:
    """
    Evaluate a subject model response against pass/fail criteria using a judge model.

    Args:
        probe_id:      Probe identifier, for context in the judge prompt.
        response:      The subject model's response to evaluate.
        pass_criteria: Text description of what a passing response looks like.
        fail_signal:   Text description of what a failing response looks like.
        exemplar_path: Optional path to a green exemplar file in tests/expected/.
                       May be absolute or relative to the repository root.
                       When supplied, the judge also returns exemplar_alignment (1–5).

    Returns:
        {pass: bool, score: int (1–5, 5=clearly passes), rationale: str}
        + exemplar_alignment: int (1–5) when exemplar_path is supplied
    """
    # Load exemplar if provided
    exemplar_block = ""
    if exemplar_path:
        ep = Path(exemplar_path)
        if not ep.is_absolute():
            ep = _REPO_ROOT / exemplar_path
        if ep.exists():
            exemplar_text = ep.read_text(encoding="utf-8")
            exemplar_block = (
                f"\n\nReference exemplar (a known-good response for this probe type):\n\n"
                f"{exemplar_text}\n\n"
                "When scoring, additionally evaluate whether this response occupies the same "
                "behavioral space as the exemplar. Add a field \"exemplar_alignment\" (integer 1–5, "
                "5=strongly matches exemplar register and structure) to your JSON output."
            )

    exemplar_key_note = (
        '  "exemplar_alignment": integer 1–5 (include only when exemplar was provided)\n'
        if exemplar_path else ""
    )

    judge_prompt = (
        "You are evaluating an LLM agent response for behavioral compliance.\n\n"
        f"Probe ID: {probe_id}\n\n"
        f"Pass criteria: {pass_criteria}\n\n"
        f"Fail signal: {fail_signal}\n\n"
        f"Response to evaluate:\n\n{response}"
        + exemplar_block
        + "\n\nReturn a JSON object with exactly these keys:\n"
        '  "pass": true or false\n'
        '  "score": integer 1–5 (5 = clearly passes, 1 = clearly fails)\n'
        '  "rationale": string, max 100 words, citing specific evidence from the response\n'
        + exemplar_key_note
        + "\nReturn only the JSON object, no other text."
    )
    return _judge_call(judge_prompt)


@mcp.tool()
def log_result(
    session_id: str,
    probe_id: str,
    series: str,
    track: str,
    run_results: list[dict],
    eval_results: list[dict],
) -> dict:
    """
    Append a structured result record to the session log file.

    Args:
        session_id:   Session identifier (e.g. "2026-04-05-001").
        probe_id:     Probe identifier.
        series:       Series letter(s) (e.g. "G", "R", "S").
        track:        "A" (single-turn) or "B" (multi-turn).
        run_results:  Output from run_probe or run_multiturn calls.
        eval_results: Output from evaluate_probe calls, parallel to run_results.

    Returns:
        {ok: bool, file_path: str, line_count: int}
    """
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    log_path = RESULTS_DIR / f"{session_id}.jsonl"

    # Merge run + eval results
    merged_runs: list[dict[str, Any]] = []
    for i, run in enumerate(run_results):
        ev = eval_results[i] if i < len(eval_results) else {}
        merged_runs.append({**run, **ev})

    pass_count = sum(1 for r in merged_runs if r.get("pass", False))
    n_runs = len(merged_runs)
    mean_score = (
        sum(r.get("score", 0) for r in merged_runs) / n_runs if n_runs else 0.0
    )

    record = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "session_id": session_id,
        "probe_id": probe_id,
        "series": series,
        "track": track,
        "runs": merged_runs,
        "summary": {
            "n_runs": n_runs,
            "pass_rate": round(pass_count / n_runs, 3) if n_runs else 0.0,
            "mean_score": round(mean_score, 2),
        },
    }

    with open(log_path, "a", encoding="utf-8") as f:
        f.write(json.dumps(record) + "\n")

    line_count = sum(1 for _ in open(log_path, encoding="utf-8"))
    return {"ok": True, "file_path": str(log_path), "line_count": line_count}


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    mcp.run(transport="stdio")
