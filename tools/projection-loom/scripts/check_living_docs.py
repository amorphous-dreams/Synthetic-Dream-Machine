"""Guard the living Projection Loom documentation boundary after o-takiage.

This static gate uses only Python's standard library and the Git index.
It does not read historical prose as current source or run a CAD kernel.
"""

from __future__ import annotations

import base64
import hashlib
import re
import subprocess
from pathlib import Path
from urllib.parse import unquote, urlsplit

FRONTS = frozenset({
    "tools/projection-loom/README.md",
    "tools/projection-loom/docs/HANDOFF.md",
})
CARRIERS = (
    "bags/lares/ha.ka.ba/lares/api/projection-loom.mem",
    "bags/lares/ha.ka.ba/lares/api/projection-loom-handoff.mem",
    "bags/lares/ha.ka.ba/lares/api/projection-loom-capability-composition.mem",
    "bags/lares/ha.ka.ba/lares/api/projection-loom-research.mem",
    "bags/lares/ha.ka.ba/lares/docs/projection-loom-relational-inheritance-design.mem",
    "bags/lares/ha.ka.ba/lares/docs/projection-loom-native-inheritance-crew-handoff.mem",
)
ASHES_RELEASED = frozenset(CARRIERS[:3])
STX = '<<^ code="&#x0002;">>'
ETX = '<<^ code="&#x0003;">>'
BLOCK_CHECK = re.compile(r'<<\^ code="&#x0003;">>ni:///sha-256;([A-Za-z0-9_-]+)')
MARKDOWN_LINK = re.compile(r'\]\(([^)]*)\)')


def inspect_markdown_set(paths: set[str]) -> list[str]:
    """Exactly two first-party living Markdown fronts, no recursive ledgers."""
    errors: list[str] = []
    for missing in sorted(FRONTS - paths):
        errors.append(f"Living Markdown front missing from Git index: {missing}")
    for extra in sorted(paths - FRONTS):
        errors.append(f"Unexpected tracked Projection Loom Markdown: {extra}")
    return errors


def inspect_markdown_links(front: Path, repo: Path) -> list[str]:
    """Reject absent relative navigation targets, not external Git history URLs."""
    errors: list[str] = []
    if not front.is_file():
        return [f"Missing living Markdown: {front}"]
    text = front.read_text(encoding="utf-8")
    for match in MARKDOWN_LINK.finditer(text):
        target = match.group(1).strip().split(maxsplit=1)[0].strip("<>") if match.group(1).strip() else ""
        if not target or target.startswith("#"):
            continue
        parsed = urlsplit(target)
        if parsed.scheme or parsed.netloc:
            continue
        path_part = unquote(parsed.path)
        if not path_part:
            continue
        resolved = (front.parent / path_part).resolve()
        try:
            resolved.relative_to(repo.resolve())
        except ValueError:
            errors.append(f"{front}: Markdown link escapes repository: {target}")
            continue
        if not resolved.is_file():
            errors.append(f"{front}: Markdown link target missing: {target}")
    return errors


def inspect_carrier(path: Path, *, no_nested_ashes: bool = False) -> list[str]:
    """Verify the canonical STX..ETX byte span and its full RFC 6920 checksum."""
    if not path.is_file():
        return [f"Missing living Lares carrier: {path}"]
    raw = path.read_bytes()
    try:
        text = raw.decode("utf-8")
    except UnicodeDecodeError:
        return [f"Invalid UTF-8 in Lares carrier: {path}"]
    errors: list[str] = []
    if b"\r" in raw:
        errors.append(f"{path}: carrier must have LF line endings")
    if not raw.endswith(b"\n") or raw.endswith(b"\n\n"):
        errors.append(f"{path}: carrier must end with exactly one LF")
    start = text.find(STX)
    checks = list(BLOCK_CHECK.finditer(text))
    if start < 0 or len(checks) != 1 or checks[0].start() < start:
        errors.append(f"{path}: incomplete or ambiguous Lares STX/ETX block check")
    else:
        check = checks[0]
        frame = text[start : check.start() + len(ETX)]
        computed = base64.urlsafe_b64encode(
            hashlib.sha256(frame.encode("utf-8")).digest()
        ).decode("ascii").rstrip("=")
        if check.group(1) != computed:
            errors.append(f"{path}: stale or corrupt Lares frame checksum")
    if no_nested_ashes and "<<~ ahu #/ashes>>" in text:
        errors.append(f"{path}: recursively embedded historical ashes remain")
    return errors


def inspect_living_surface(loom: Path) -> list[str]:
    """Check tracked Markdown, live front links and canonical Lares carriers."""
    repo = loom.resolve().parents[1]
    cmd = ["git", "ls-files", "--cached", "--", "tools/projection-loom"]
    result = subprocess.run(
        cmd, cwd=repo, check=False, capture_output=True, text=True,
    )
    if result.returncode:
        return [f"Could not inspect tracked Markdown via Git index: {result.stderr.strip()}"]
    markdown = {
        line for line in result.stdout.splitlines() if line.endswith(".md")
    }
    errors = inspect_markdown_set(markdown)
    for path in sorted(FRONTS):
        errors.extend(inspect_markdown_links(repo / path, repo))
    for path in CARRIERS:
        errors.extend(inspect_carrier(repo / path, no_nested_ashes=path in ASHES_RELEASED))
    return errors


def main() -> None:
    loom = Path(__file__).resolve().parents[1]
    errors = inspect_living_surface(loom)
    if errors:
        for error in errors:
            print("Loom o-takiage gate: " + error)
        raise SystemExit(1)
    print("Loom o-takiage gate: two living Markdown fronts; links and Lares frames verified")


if __name__ == "__main__":
    main()
