"""Source-fixed, exact STEP comparison of two operator-authorized route bends."""
from __future__ import annotations
import json
from pathlib import Path
from .place_genome import PlaceGenome
from .spatial_intent import SpatialIntent
from .place_orthogonal_route import propose_orthogonal_route
from .scene_usd import package_scene
from .place_affordances import assess_place,verify_place_affordances
from .generalized_campaign import save_once
from .provenance_encoding import canonical_json_sha256, first_json_difference

_TURNS=("x-then-y","y-then-x")


def _read(path):
    return json.loads(Path(path).read_text(encoding="utf8"))


def _preregister(genome,spatial,location,corner_id):
    return {"schema":"projection-loom/matched-orthogonal-native-study",
            "original_genome_sha256":genome.identity,
            "spatial_intent_sha256":spatial.identity,
            "original_genome":genome.to_dict(),
            "spatial_intent":spatial.to_dict(),
            "location":location,"corner_id":corner_id,
            "turns":list(_TURNS),"native_budget_per_arm":1,
            "automatic_selection":False,"source_camera_certification":False}


def witnessed_route_layout(genome, native):
    """Describe constructed layout only after independent native STEP witness.

    Scene and receipt hashes do not establish distinct architecture.
    This descriptor cannot certify full shape non-isomorphism or access.
    """
    if not native["all_declared_goals_witnessed"]:
        return None
    goals=native["goals"]
    if len(goals)!=1 or goals[0]["status"]!="geometric-route-proposal":
        raise ValueError("Matched right-angle study requires a native route witness")
    proof=goals[0]["proof"]
    segments=proof.get("segments",[proof])
    return {"body_placements":[{"translation":list(b.translation),
                                "root_size":list(b.program.nodes[0].size)}
                               for b in genome.bodies],
            "ordered_route_axes":[p["principal_axis"] for p in segments],
            "observed_segment_widths":[p["route_width_lower_bound"] for p in segments],
            "observed_segment_rises":[p["deck_to_endpoint_step_upper_bound"] for p in segments],
            "hops":len(segments)}


def verify_orthogonal_study(study,genome,spatial,*,location,corner_id):
    root=Path(study)
    pre=_read(root/"preregistration.json")
    if (root/"FAILED").exists() or pre!=_preregister(genome,spatial,location,corner_id):
        raise ValueError("Orthogonal study changed its original native source or operator choices at "+str(first_json_difference(_preregister(genome,spatial,location,corner_id),pre)))
    report=_read(root/"summary.json")
    actual=[]
    for turn in _TURNS:
        receipt=_read(root/turn/"receipt.json")
        created=propose_orthogonal_route(genome,spatial,turn=turn,corner_id=corner_id)
        if receipt["turn"]!=turn or receipt["result_genome_sha256"]!=created.identity:
            raise ValueError("Matched native bend no longer follows its selected turn")
        native=assess_place(root/turn/"scene",created,spatial)
        if receipt["native_evidence"]!=native:
            raise ValueError("Right-angle matched arm diverged from exact STEP route proof")
        verify_place_affordances(root/turn/"scene",created,spatial,native)
        if receipt["status"]!=("native-route-witnessed" if native[
                "all_declared_goals_witnessed"] else "spatial-unverified"):
            raise ValueError("Matched bend receipt misstates native geometric witness")
        if receipt.get("witnessed_route_layout") != witnessed_route_layout(created,native):
            raise ValueError("Matched route layout differs from independent native construction")
        actual.append(receipt)
    if (report["preregistration_sha256"]!=canonical_json_sha256(pre)
            or report["arms"]!=actual or report["same_original_native_site"] is not True
            or report["automatic_selection"] is not False
            or report["physical_safety_certification"] is not False):
        raise ValueError("Matched bend study changed its provenance or authority")
    # Distinct scene IDs do not prove distinct measured routes.
    layouts=[row["witnessed_route_layout"] for row in actual]
    distinct=(all(x is not None for x in layouts)
              and len({canonical_json_sha256(x) for x in layouts})==len(layouts))
    if report.get("distinct_witnessed_route_layouts") is not distinct:
        raise ValueError("distinct witnessed route layouts misreported")
    return report


def run_orthogonal_study(genome:PlaceGenome,spatial:SpatialIntent,out,*,
                         location,corner_id):
    if not isinstance(genome,PlaceGenome) or not isinstance(spatial,SpatialIntent):
        raise ValueError("Matched bend study requires one typed original location and goal")
    root=Path(out)
    pre=_preregister(genome,spatial,location,corner_id)
    if (root/"summary.json").exists():
        return verify_orthogonal_study(root,genome,spatial,
                                        location=location,corner_id=corner_id)
    if root.exists():
        raise ValueError("Incomplete matched bend study cannot become success")
    root.mkdir(parents=True)
    save_once(root/"preregistration.json",pre)
    outcomes=[]
    try:
        for turn in _TURNS:
            child=propose_orthogonal_route(genome,spatial,turn=turn,corner_id=corner_id)
            folder=root/turn
            package_scene(child.declaration(location),folder/"scene")
            evidence=assess_place(folder/"scene",child,spatial)
            row={"turn":turn,"result_genome_sha256":child.identity,
                 "status":"native-route-witnessed" if evidence[
                     "all_declared_goals_witnessed"] else "spatial-unverified",
                 "native_evidence":evidence,
                 "witnessed_route_layout":witnessed_route_layout(child,evidence),
                 "artistic_winner":None,"automatic_promotion":False}
            save_once(folder/"receipt.json",row)
            outcomes.append(row)
        report={"schema":"projection-loom/matched-orthogonal-native-results",
                "preregistration_sha256":canonical_json_sha256(pre),
                "same_original_native_site":True,
                "native_attempts":len(outcomes),
                "native_budget_per_arm":1,
                "two_distinct_genomes":outcomes[0]["result_genome_sha256"]!=outcomes[1]["result_genome_sha256"],
                "distinct_witnessed_route_layouts":(
                    all(row["witnessed_route_layout"] is not None for row in outcomes)
                    and len({canonical_json_sha256(row["witnessed_route_layout"])
                             for row in outcomes})==len(outcomes)),
                "arms":outcomes,"automatic_selection":False,
                "physical_safety_certification":False}
        save_once(root/"summary.json",report)
        return verify_orthogonal_study(root,genome,spatial,
                                       location=location,corner_id=corner_id)
    except Exception:
        (root/"FAILED").write_text("Native bend study incomplete; no accepted verdict\n")
        raise
