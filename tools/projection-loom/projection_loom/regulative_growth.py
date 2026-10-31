"""Native site-responsive developmental control under the one OODA-HA helm.

A local support's measured CAD bounds constrain proposed child dimensions.
This is a bounded and deliberately limited regulation mechanism, not a
physical/structural solver, camera survey, or independent evolutionary helm.
"""
from __future__ import annotations

from dataclasses import replace
from pathlib import Path
import json
import math

from .developmental import GrowthProgram, compile_growth
from .fractal_ooda_ha import OODAHAJournal
from .provenance_encoding import canonical_json_sha256


def regulate(program: GrowthProgram, *, fill=0.52):
    """Regrow child sizes against actual locally derived support capacities.

    Every accepted partial prefix is native-compiled; the resulting site
    capacities derive from accepted CAD, not from a global Z assumption.
    """
    if type(fill) not in (int, float) or not math.isfinite(fill) or not 0.10 <= fill <= 0.85:
        raise ValueError("Regulative fill must be finite, bounded support fraction")
    nodes = [program.nodes[0]]
    activations = []
    for node in program.nodes[1:]:
        if node.op not in ("spawn", "split"):
            nodes.append(node)
            continue
        parent = compile_growth(GrowthProgram(tuple(nodes)))
        matches = [site for site in parent.sites.values()
                   if site.producer == node.parent and site.face == node.face]
        if len(matches) != 1:
            # Repeated parents/complex joint inheritance need a distinct
            # declared site identity, not an approximate fallback.
            raise ValueError("Regulation requires one unequivocal local support site")
        site = matches[0]
        size = list(node.size)
        if node.face == "up":
            dims = (0, 1)
        elif node.face in ("east", "west"):
            dims = (1, 2)
        else:
            dims = (0, 2)
        for index, capacity in zip(dims, site.capacity):
            size[index] = round(max(.15, float(capacity) * float(fill)), 5)
        changed = replace(node, size=tuple(size))
        nodes.append(changed)
        activations.append({"rule": node.key, "site": site.address,
                            "producer": site.producer, "orientation": site.normal,
                            "capacity": list(site.capacity),
                            "old_size": list(node.size), "regulated_size": size,
                            "authority": "native-site-bounds-only"})
    result = GrowthProgram(tuple(nodes))
    compile_growth(result).audit()
    return result, activations


def _trial_arm(program):
    try:
        result = compile_growth(program)
        audit = result.audit()
    except ValueError as exc:
        return {"state": "native-rejected", "reason": str(exc),
                "program_sha256": program.identity}
    except Exception as exc:
        return {"state": "operational-error", "reason": repr(exc),
                "program_sha256": program.identity}
    return {"state": "native-valid", "program_sha256": program.identity,
            "native": {"valid": audit["valid"], "union_valid": audit["union_valid"],
                       "parts": audit["parts"], "joints": audit["joints"]},
            "site_count": len(result.sites)}


def matched_trial(program: GrowthProgram, out, *, fill=.52):
    """Fixed versus regulative development, exactly one native audition each.

    The Journal alone owns Observe/Orient/Decide/Act/Aftermath. No part of
    the experiment selects or promotes an elite; results are testimony.
    """
    if not isinstance(program, GrowthProgram):
        raise TypeError("Matched trial requires an authored growth program")
    out = Path(out)
    if out.exists() and any(out.iterdir()):
        raise ValueError("Matched experiment requires an unused output location")
    out.mkdir(parents=True, exist_ok=True)
    run_id = canonical_json_sha256({"input": program.identity, "fill": fill,
                                    "comparison": "equal-single-native-audition"})
    journal = OODAHAJournal(out / "session.json",
                            identity={"location": "independent-regulative-control",
                                      "run": run_id,
                                      "score_state": "no-source-camera"},
                            initial={}, autonomy=1.)
    session = "location/e000"
    journal.begin(session, parent="location", scope="epoch",
                  evidence={"run_id": run_id}, parent_phase="act")
    journal.transition(session, "orient", {"fixed": "authored input",
                                            "regulative": "native local support"})
    journal.transition(session, "decide", {"exact_audition_budget_per_arm": 1})
    journal.transition(session, "act", {"criterion": "native BRep validity only"})
    regulated = None
    activations = []
    try:
        regulated, activations = regulate(program, fill=fill)
        regulated_result = _trial_arm(regulated)
    except ValueError as exc:
        regulated_result = {"state": "native-rejected", "reason": str(exc)}
    except Exception as exc:
        regulated_result = {"state": "operational-error", "reason": repr(exc)}
    fixed_result = _trial_arm(program)
    report = {"schema": "projection-loom/regulative-matched-control",
              "run_id": run_id, "exact_attempts_per_arm": 1,
              "arms": {"fixed": fixed_result, "regulative": regulated_result},
              "rule_activations": activations,
              "source_fitness": None, "operator_preference": None,
              "physical_load_certification": False, "automatic_promotion": False}
    (out / "report.json").write_text(json.dumps(report, indent=2,
                                               sort_keys=True, allow_nan=False) + "\n",
                                     encoding="utf8")
    journal.transition(session, "aftermath", {
        "fixed": fixed_result["state"], "regulative": regulated_result["state"],
        "activations": len(activations)})
    journal.transition(session, "closed")
    journal.transition("location", "aftermath", {
        "native_attempts": 2, "errors": sum(
            arm["state"] == "operational-error" for arm in report["arms"].values())})
    journal.transition("location", "closed")
    journal.data["status"] = "completed" if all(
        x["state"] != "operational-error" for x in report["arms"].values()) else "failed"
    journal.save()
    if journal.data["status"] == "failed":
        raise RuntimeError("Operational error during matched native comparison")
    return report
