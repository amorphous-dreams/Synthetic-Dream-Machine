"""One OODA-HA child-phase vocabulary shared by both developmental frontends.

These functions delegate directly to the existing OODAHAJournal, preserving
its sole phase authority, parent anchors, receipts, and immutable identity.
They introduce no second state machine, phase cycle, or mutation policy.
"""
from __future__ import annotations


def open_child(journal,loop_id,*,parent,scope,evidence,orient,decide,act):
    if scope not in ("epoch","candidate"):
        raise ValueError("Shared constructive child must name epoch or candidate")
    journal.begin(loop_id,parent=parent,scope=scope,evidence=evidence,
                  parent_phase="act")
    journal.transition(loop_id,"orient",orient)
    journal.transition(loop_id,"decide",decide)
    journal.transition(loop_id,"act",act)
    return loop_id


def close_child(journal,loop_id,*,aftermath):
    journal.transition(loop_id,"aftermath",aftermath)
    journal.transition(loop_id,"closed")
