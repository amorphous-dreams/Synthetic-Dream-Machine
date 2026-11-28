"""Read-only complete-study re-entry; never a second native/OODA-HA controller.

A completion marker only selects the domain's independent replay verifier.
An incomplete or failed root may never be overwritten or certified by retry.
"""
from pathlib import Path


def replay_completed_or_require_fresh(root, *, completion, verify, occupied_reason):
    """Return None for a virgin root, otherwise verify a completed artifact.

    Verification owns source, STEP and receipt authority. This small guard
    neither publishes evidence nor performs construction on an existing root.
    """
    root=Path(root)
    if not root.exists():
        return None
    if (root/"FAILED").exists() or not (root/completion).is_file():
        raise ValueError(occupied_reason)
    return verify()
