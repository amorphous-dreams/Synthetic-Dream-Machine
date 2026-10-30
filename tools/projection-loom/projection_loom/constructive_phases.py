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


def audit_closed_constructive_helm(journal, *, candidate_ids):
    """Reconcile the existing OODA-HA journal with its phase event history.

    Does not advance phases or operate another controller. The journal is
    still the authority; this read-only audit refuses a rehashed snapshot
    whose closing evidence lost a child, phase or candidacy.
    """
    loops=journal.data["loops"]
    expected=("observe","orient","decide","act","aftermath","closed")
    if journal.data["status"]!="completed" or "location" not in loops:
        raise ValueError("Constructive OODA-HA location did not close")
    candidates={name for name,node in loops.items() if node["scope"]=="candidate"}
    if candidates!=set(candidate_ids) or len(candidates)!=len(candidate_ids):
        raise ValueError("Constructive journal candidate roster differs from native auditions")
    events=journal.data["events"]
    if [e["seq"] for e in events]!=list(range(1,len(events)+1)):
        raise ValueError("OODA-HA event ordering changed")
    phase_events={}
    for event in events:
        if event["kind"]=="phase":
            phase_events.setdefault(event["loop"],[]).append(event)
    for name,node in loops.items():
        if node["id"]!=name or node["phase"]!="closed":
            raise ValueError("Constructive OODA-HA left an unclosed loop")
        if not isinstance(node["receipts"],dict) or set(node["receipts"])!=set(expected):
            raise ValueError("Constructive OODA-HA lost five-phase/closure testimony")
        trace=phase_events.get(name,[])
        if [event["phase"] for event in trace]!=list(expected):
            raise ValueError("Constructive OODA-HA phase event sequence changed")
        if any(event["detail"]!=node["receipts"][event["phase"]]
               for event in trace):
            raise ValueError("Constructive OODA-HA receipt no longer matches phase event")
        parent=node["parent"]
        if name=="location":
            if parent is not None:
                raise ValueError("Location root unexpectedly has a phase parent")
        elif parent not in loops or name not in loops[parent]["children"]:
            raise ValueError("Constructive loop lost its causal parent")
        for child in node["children"]:
            if child not in loops or loops[child]["parent"]!=name:
                raise ValueError("Constructive phase child diverges from journal tree")
        if len(node["children"])!=len(set(node["children"])):
            raise ValueError("Constructive OODA-HA contains repeated child identities")
    return {"closed_loops":len(loops),"native_candidate_loops":len(candidates),
            "phase_events":sum(len(v) for v in phase_events.values()),
            "phase_authority":"existing-OODAHAJournal"}
