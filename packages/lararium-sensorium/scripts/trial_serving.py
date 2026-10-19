#!/usr/bin/env python3
"""Compose one disposable, receipt-bearing frozen-evidence serving operation.

The operation root carries its SQLite custody ledger and an owned Sensorium
Content view. Each completed stage has an atomically written receipt, so a
retry can safely re-enter the existing idempotent stage boundaries.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sqlite3
import sys
from pathlib import Path


LAYOUT_VERSION = "sensorium-serving-operation-v1"
_STAGES = ("intake", "typed", "semantic")
_UNSUPPORTED = ["form", "structure", "worldline", "live-capture"]
_MODEL_LOCK = Path(__file__).resolve().parents[1] / "model-assets.json"


def _canonical(value: dict) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()


def _sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _atomic_json(path: Path, value: dict) -> None:
    path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    temp = path.with_name(f".{path.name}.{os.getpid()}.tmp")
    payload = _canonical(value) + b"\n"
    with temp.open("xb") as handle:
        os.chmod(temp, 0o600)
        handle.write(payload)
        handle.flush()
        os.fsync(handle.fileno())
    os.replace(temp, path)
    fd = os.open(path.parent, os.O_RDONLY | getattr(os, "O_DIRECTORY", 0))
    try:
        os.fsync(fd)
    finally:
        os.close(fd)


def _read_json(path: Path) -> dict | None:
    if not path.is_file():
        return None
    with path.open(encoding="utf-8") as handle:
        value = json.load(handle)
    if not isinstance(value, dict):
        raise ValueError(f"operation receipt is not an object: {path.name}")
    return value


def _operation_paths(operation_root: Path, state_root: Path | None = None,
                     sensorium_root: Path | None = None) -> tuple[Path, Path, Path]:
    supplied_root = operation_root.expanduser().absolute()
    if supplied_root.is_symlink():
        raise ValueError("operation root must not be a symlink")
    root = supplied_root.resolve()
    repo_root = Path(__file__).resolve().parents[3]
    if root == repo_root or root.is_relative_to(repo_root):
        raise ValueError("operation root must stay outside the repository")
    if not re.fullmatch(r"sensorium-serving-[A-Za-z0-9][A-Za-z0-9._-]{0,100}", root.name):
        raise ValueError("operation root name must start with sensorium-serving-")
    state_input = (state_root or root / "state").expanduser().absolute()
    sensorium_input = (sensorium_root or root / "sensorium").expanduser().absolute()
    if state_input.is_symlink() or sensorium_input.is_symlink():
        raise ValueError("state and Sensorium roots must not be symlinks")
    state = state_input.resolve()
    sensorium = sensorium_input.resolve()
    if state != root / "state" or sensorium != root / "sensorium":
        raise ValueError("fixed operation layout requires state at ROOT/state and Sensorium at ROOT/sensorium")
    return root, state, sensorium


def _overlaps(left: Path, right: Path) -> bool:
    return left == right or left.is_relative_to(right) or right.is_relative_to(left)


def _model_boundaries(model_home: Path) -> tuple[Path, Path]:
    with _MODEL_LOCK.open(encoding="utf-8") as handle:
        lock = json.load(handle)
    relative = Path(lock["cache_path"])
    if relative.is_absolute() or ".." in relative.parts:
        raise ValueError("pinned model cache path must stay beneath model HOME")
    cache = (model_home / relative).resolve()
    if not cache.is_relative_to(model_home):
        raise ValueError("pinned model cache path leaves model HOME")
    guest = (model_home / ".mempalace").resolve()
    return cache, guest


def _inputs(root: Path, state: Path, sensorium: Path, freeze_receipt: Path,
            intent: str, source_host: str, model_home: Path, device: str) -> dict:
    receipt = freeze_receipt.expanduser().resolve()
    return {"schema": LAYOUT_VERSION, "operation_root": str(root), "state_root": str(state),
            "sensorium_root": str(sensorium), "freeze_receipt": str(receipt),
            "freeze_receipt_sha256": _sha(receipt.read_bytes()), "intent_id": intent,
            "source_host": source_host, "model_home": str(model_home.expanduser().resolve()),
            "device_request": device}


def run_operation(operation_root: Path | str, freeze_receipt: Path | str, intent: str,
                  source_host: str, model_home: Path | str, device: str = "auto") -> dict:
    root, state, sensorium = _operation_paths(Path(operation_root))
    model_home = Path(model_home).expanduser().resolve()
    if Path.home().resolve() != model_home:
        raise ValueError("process HOME must name --model-home before MiniLM imports Chroma")
    operation_file = root / "operation.json"
    existing = _read_json(operation_file)
    if existing is None and root.exists() and any(root.iterdir()):
        raise ValueError("refusing a non-empty directory without this operation's marker")
    script_dir = str(Path(__file__).resolve().parent)
    if script_dir not in sys.path:
        sys.path.insert(0, script_dir)
    from trial_intake import _load_frozen, intake_frozen
    from trial_project import project_observation

    manifest, *_ = _load_frozen(Path(freeze_receipt), source_host)
    native_root = Path(manifest.get("native_root", manifest.get("fixture_root"))).resolve()
    if root.is_relative_to(native_root) or native_root.is_relative_to(root):
        raise ValueError("operation root must stay disjoint from frozen native history")
    if model_home.is_relative_to(root):
        raise ValueError("operation root must not contain model HOME")
    model_cache, guest_root = _model_boundaries(model_home)
    if _overlaps(root, model_cache):
        raise ValueError("operation root must remain disjoint from the pinned model cache")
    if _overlaps(root, guest_root):
        raise ValueError("operation root must remain disjoint from the MemPalace guest root")
    root.mkdir(mode=0o700, parents=True, exist_ok=True)
    if not root.is_dir() or root.is_symlink():
        raise ValueError("operation root must be a real directory")
    values = _inputs(root, state, sensorium, Path(freeze_receipt), intent, source_host,
                     model_home, device)
    existing = existing or _read_json(operation_file)
    if existing is not None:
        if existing.get("inputs") != values:
            raise ValueError("named operation root already belongs to different inputs")
    elif any(root.iterdir()):
        raise ValueError("refusing a non-empty directory without this operation's marker")
    else:
        _atomic_json(operation_file, {"schema": LAYOUT_VERSION, "inputs": values,
                                      "status": "ready", "completed_stages": []})

    doc = _read_json(operation_file) or {}
    doc.update({"status": "running", "failed_stage": None, "error": None})
    _atomic_json(operation_file, doc)
    receipts: dict[str, dict] = {}
    try:
        receipts["intake"] = intake_frozen(state, Path(freeze_receipt), intent,
                                            source_host=source_host)
        _atomic_json(root / "intake-receipt.json", receipts["intake"])
        doc["completed_stages"] = ["intake"]
        _atomic_json(operation_file, doc)

        observation = receipts["intake"]["observation_id"]
        receipts["typed"] = project_observation(state, observation)
        _atomic_json(root / "typed-receipt.json", receipts["typed"])
        doc["completed_stages"] = ["intake", "typed"]
        _atomic_json(operation_file, doc)

        # mempalace narrows sys.path to its package roots. Prime Content first,
        # then restore the script shore for Sensorium's local sibling imports.
        import holder_caps  # noqa: F401
        import content_io  # noqa: F401
        if script_dir not in sys.path:
            sys.path.insert(0, script_dir)
        import sensorium as _sensorium_module  # noqa: F401
        from trial_owned_content import project_owned_content
        receipts["semantic"] = project_owned_content(
            state, sensorium, observation, model_state_root=model_home, device=device)
        _atomic_json(root / "semantic-receipt.json", receipts["semantic"])
        doc["completed_stages"] = list(_STAGES)
        doc["status"] = "complete"
        _atomic_json(operation_file, doc)
        return _result(root, doc, receipts)
    except Exception as exc:
        failed = next((stage for stage, name in (("intake", "intake"), ("typed", "typed"),
                                                 ("semantic", "semantic"))
                       if name not in receipts), "semantic")
        doc.update({"status": "failed", "failed_stage": failed,
                    "error": f"{type(exc).__name__}: {exc}"})
        _atomic_json(operation_file, doc)
        raise


def _result(root: Path, operation: dict, receipts: dict[str, dict]) -> dict:
    intake = receipts.get("intake") or {}
    typed = receipts.get("typed") or {}
    semantic = receipts.get("semantic") or {}
    semantic = receipts.get("semantic") or {}
    return {"schema": "lararium.sensorium.serving-operation-receipt.v1",
            "operation_root": str(root), "operation_status": operation.get("status"),
            "failed_stage": operation.get("failed_stage"), "error": operation.get("error"),
            "model_home": operation.get("inputs", {}).get("model_home"),
            "view_key": semantic.get("view_key"),
            "model_basis_sha256": semantic.get("model_basis_sha256"),
            "observation_id": intake.get("observation_id"),
            "revision_sha256": intake.get("revision_sha256"),
            "content_frontier": typed.get("content_frontier"),
            "semantic_frontier": semantic.get("semantic_frontier"),
            "content_root": str(root / "sensorium" / "content"),
            "receipts": receipts, "unsupported_views": list(_UNSUPPORTED)}


def status_operation(operation_root: Path | str) -> dict:
    root, state, _sensorium = _operation_paths(Path(operation_root))
    operation = _read_json(root / "operation.json")
    if operation is None:
        raise ValueError("named operation has no operation marker")
    receipts = {stage: _read_json(root / f"{name}-receipt.json")
                for stage, name in (("intake", "intake"), ("typed", "typed"),
                                    ("semantic", "semantic"))}
    receipts = {key: value for key, value in receipts.items() if value is not None}
    pending_typed: list[dict] = []
    quarantined_typed: list[dict] = []
    semantic_intents: list[dict] = []
    pending_semantic: list[dict] = []
    content_frontiers: dict[str, int] = {}
    semantic_frontiers: dict[str, dict[str, int]] = {}
    db = state / "trial-intake-v2.sqlite3"
    if db.is_file():
        conn = sqlite3.connect(f"file:{db}?mode=ro", uri=True)
        try:
            pending_typed = [dict(observation_id=row[0], status=row[1], parser_version=row[2])
                             for row in conn.execute("SELECT observation_id,status,parser_version "
                                                     "FROM projection_intent WHERE status='pending' "
                                                     "ORDER BY observation_id")]
            quarantined_typed = [dict(observation_id=row[0], status=row[1], parser_version=row[2])
                                 for row in conn.execute("SELECT observation_id,status,parser_version "
                                                         "FROM projection_intent WHERE status='quarantined' "
                                                         "ORDER BY observation_id")]
            semantic_intents = [dict(observation_id=row[0], sensorium_root=row[1],
                                     status=row[2], model_basis_sha256=row[3])
                                for row in conn.execute("SELECT observation_id,sensorium_root,status,"
                                                        "model_basis_sha256 FROM semantic_projection "
                                                        "ORDER BY observation_id")]
            pending_semantic = [item for item in semantic_intents if item["status"] == "pending"]
            content_frontiers = dict(conn.execute("SELECT o.source_key,o.frontier FROM content_frontier f "
                                                  "JOIN observation o USING(observation_id)"))
            for source_key, view_key, frontier in conn.execute(
                    "SELECT source_key,view_key,frontier FROM semantic_frontier"):
                semantic_frontiers.setdefault(view_key, {})[source_key] = frontier
        finally:
            conn.close()
    latest = receipts.get("semantic") or receipts.get("typed") or receipts.get("intake") or {}
    result = _result(root, operation, receipts)
    result.update({"observation_id": latest.get("observation_id", result["observation_id"]),
                   "revision_sha256": latest.get("revision_sha256", result["revision_sha256"]),
                   "content_frontiers": content_frontiers,
                   "semantic_frontiers": semantic_frontiers,
                   "pending_typed_intents": pending_typed,
                   "quarantined_typed_intents": quarantined_typed,
                   "pending_semantic_intents": pending_semantic,
                   "semantic_intents": semantic_intents,
                   "failed_intent": ({"stage": operation.get("failed_stage"),
                                      "error": operation.get("error")}
                                     if operation.get("status") == "failed" else None),
                   "unsupported_views": list(_UNSUPPORTED)})
    return result


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    run = sub.add_parser("run", help="run or resume one named disposable operation")
    run.add_argument("--operation-root", type=Path, required=True)
    run.add_argument("--state-root", type=Path, required=True)
    run.add_argument("--sensorium-root", type=Path, required=True)
    run.add_argument("--freeze-receipt", type=Path, required=True)
    run.add_argument("--intent", required=True)
    run.add_argument("--source-host", required=True)
    run.add_argument("--model-home", type=Path, required=True)
    run.add_argument("--device", choices=("auto", "cpu", "cuda"), default="auto")
    status = sub.add_parser("status", help="read operation receipts and frontiers without loading MiniLM")
    status.add_argument("--operation-root", type=Path, required=True)
    args = parser.parse_args()
    try:
        if args.command == "status":
            result = status_operation(args.operation_root)
        else:
            root, state, sensorium = _operation_paths(args.operation_root,
                                                       args.state_root, args.sensorium_root)
            result = run_operation(root, args.freeze_receipt, args.intent, args.source_host,
                                   args.model_home, args.device)
        print(json.dumps(result, sort_keys=True))
    except (OSError, sqlite3.Error, KeyError, TypeError, ValueError) as exc:
        parser.error(str(exc))


if __name__ == "__main__":
    main()
