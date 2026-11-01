"""Atomic immutable JSON receipt publication; pure IO below campaign authority.

No evolutionary, geometry, or admission decision belongs to this module.
Identical content and collision refusal retain their established byte contract.
"""
from pathlib import Path
import json
import os
import tempfile


def save_once(path, payload):
    """Publish one immutable JSON receipt without replacing competing writers.

    Unique scratch files and hard-link publication make the final name atomic:
    a competing writer can create it first, but cannot have it overwritten.
    A crash may leave a .pending-* scratch file, never a partial final receipt.
    """
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    content = json.dumps(payload, sort_keys=True, indent=2, allow_nan=False) + "\n"
    if path.exists():
        if path.read_text(encoding="utf8") != content:
            raise ValueError("Replay collides with a different immutable receipt")
        return
    fd, pending = tempfile.mkstemp(prefix="." + path.name + ".pending-", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf8") as stream:
            stream.write(content)
            stream.flush()
            os.fsync(stream.fileno())
        try:
            os.link(pending, path)
        except FileExistsError:
            if path.read_text(encoding="utf8") != content:
                raise ValueError("Replay collides with a different immutable receipt")
    finally:
        Path(pending).unlink(missing_ok=True)


