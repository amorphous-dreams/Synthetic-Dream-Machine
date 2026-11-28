"""Read-only post-campaign Experiment Zero review and attributed survivor choice.

Shortlist uses only CAD-admitted, scored source-bound epochs. Orthographic
views freeze against the parent seed, never candidate-specific auto-fit.
The review is evidence; only the Operator can accept a survivor.
"""
from __future__ import annotations

from pathlib import Path
import json
import numpy as np
from PIL import Image, ImageDraw
from .capability_stack import CapabilityCompositor
from .evidence_receipts import CompoundAuditReceipt
from .epochs import _atomic, _hash
from .exploration import ExplorationBudget, measure_exploration, stable_orthographic_cameras
from .campaign import visual_descriptor
from .render import silhouette


def eligible_rows(output, passes):
    rows=[]
    for epoch in range(1,passes+1):
        checkpoint=json.loads((Path(output)/f"epoch_{epoch:03d}.json").read_text())
        if checkpoint.get("snapshot_sha256")!=_hash({
                k:v for k,v in checkpoint.items() if k!="snapshot_sha256"}):
            raise ValueError("Checkpoint changed before review")
        for ident,result in sorted(checkpoint["results"].items()):
            if result["state"]!="scored":
                continue
            if not result.get("audit",{}).get("valid") or "extra_observations" not in result:
                raise ValueError("Only native scored candidates with outer evidence can be reviewed")
            proposal=checkpoint["proposals"][ident]
            parts=proposal["emitter"].split(":")
            if len(parts)!=3 or parts[0]!="family":
                raise ValueError("Review requires source-bound family emitter")
            rows.append({"id":f"{epoch:04d}/{ident}","epoch":epoch,
                         "family":parts[1],"emitter":proposal["emitter"],
                         "parent":proposal.get("parent"),"ancestry":proposal.get("ancestry"),
                         "genome":proposal["genome"],"native_witness_id":result["witness_id"],
                         "combined_loss":result["combined_loss"],"losses":result["losses"],
                         "observation":result["extra_observations"]})
    return rows


def choose_review(rows, seats=6):
    """Keep a global champion; then distinct outer silhouettes and family coverage."""
    if type(seats) is not int or not 1<=seats<=12:
        raise ValueError("Review seats must be 1..12")
    ordered=sorted(rows,key=lambda r:(r["combined_loss"],r["id"]))
    if not ordered:return []
    chosen=[ordered.pop(0)]
    while len(chosen)<seats and ordered:
        seen={r["observation"]["outer_mask_sha256"] for r in chosen}
        families={r["family"] for r in chosen}
        ordered.sort(key=lambda r:(r["observation"]["outer_mask_sha256"] in seen,
                                   r["family"] in families,
                                   -r["observation"]["extra_fraction"],
                                   r["combined_loss"],r["id"]))
        chosen.append(ordered.pop(0))
    return chosen


def write_review(project, recipe, output, budget:ExplorationBudget, *, passes, seats=6):
    out=Path(output)
    folder=out/"experiment_zero_review"
    receipt=folder/"review.json"
    identity=budget.record()["sha256"]
    if receipt.exists():
        saved=json.loads(receipt.read_text())
        if (saved.get("budget_sha256")!=identity or
                saved.get("passes")!=passes or saved.get("seats")!=seats):
            raise ValueError("Review identity changed; fork the output")
        if saved["sha256"]!=_hash({k:v for k,v in saved.items() if k!="sha256"}):
            raise ValueError("Review receipt digest mismatch")
        return saved
    pool=eligible_rows(out,passes)
    chosen=choose_review(pool,seats)
    if not chosen:
        raise ValueError("No native scored candidates available for review")
    fixed=project.cameras[project.reference_view]
    compositor=CapabilityCompositor(project,recipe,camera=fixed,size=budget.score_size,
                                     source_mask=project.source_mask(budget.score_size))
    seed_mesh=compositor.grow(recipe.initial).scene.render_mesh()
    cameras=stable_orthographic_cameras(project,seed_mesh,budget.review_size)
    labels=[]
    records=[]
    folder.mkdir(parents=True,exist_ok=True)
    w,h=budget.review_size
    for rank,row in enumerate(chosen,1):
        built=compositor.grow(row["genome"])
        if not CompoundAuditReceipt.from_native(built.audit).render_admissible:
            raise ValueError("Regrown candidate failed independent native audit")
        mesh=built.scene.render_mesh()
        observation=measure_exploration(mesh,fixed,seed_mesh,budget)
        if observation!=row["observation"]:
            raise ValueError("Regrown morphology differs from scored receipt")
        target=folder/f"candidate_{rank:02d}"
        target.mkdir(exist_ok=True)
        views={}
        for name,cam in sorted(cameras.items()):
            mask=silhouette(mesh,cam,budget.review_size)>96
            image=Image.fromarray(mask.astype(np.uint8)*255,"L")
            image.save(target/f"{name}.png")
            views[name]={"image":str((target/f"{name}.png").relative_to(out)),
                         "mask_sha256":visual_descriptor(mask)["mask_sha256"],
                         "camera_sha256":_hash(cam.to_dict())}
            if name==project.reference_view:
                labels.append((image.copy(),row["family"]+" "+row["id"]))
        built.witness().save(target/"relations.json")
        evidence={**row,"rank":rank,"audit":built.audit,"views":views,
                  "relations":str((target/"relations.json").relative_to(out)),
                  "review_authority":"CAD-native and render diagnostic; not survey or selection"}
        _atomic(target/"evidence.json",evidence)
        records.append(evidence)
    sheet=Image.new("RGB",(len(labels)*w,h+25),(25,27,32))
    draw=ImageDraw.Draw(sheet)
    for i,(image,label) in enumerate(labels):
        sheet.paste(image.convert("RGB"),(i*w,25))
        draw.text((i*w+3,4),label,fill=(235,235,238))
    sheet.save(folder/"contact_sheet.png")
    report={"schema":"projection-loom/experiment-zero-review",
            "budget_sha256":identity,"passes":passes,"seats":seats,
            "eligible":len(pool),"reviewed":len(records),
            "cameras":{n:c.to_dict() for n,c in cameras.items()},
            "candidates":records,"contact_sheet":str((folder/"contact_sheet.png").relative_to(out)),
            "selection_basis":"source champion, outer mask novelty, family coverage, overscan occupancy",
            "evidence_state":"provisional source, other views synthetic diagnostic"}
    report["sha256"]=_hash(report)
    _atomic(receipt,report)
    return report


def select_survivor(output, *, proposal, actor, rationale):
    root=Path(output)/"experiment_zero_review"
    review=json.loads((root/"review.json").read_text())
    if review["sha256"]!=_hash({k:v for k,v in review.items() if k!="sha256"}):
        raise ValueError("Review digest mismatch")
    candidates={r["id"]:r for r in review["candidates"]}
    if proposal not in candidates or actor not in ("operator","adviser"):
        raise ValueError("Selection requires a reviewed lineage and attributed actor")
    if not isinstance(rationale,str) or not 1<=len(rationale.strip())<=1000:
        raise ValueError("Selection needs a concise substantive reason")
    selected=candidates[proposal]
    data={"schema":"projection-loom/experiment-zero-selection",
          "review_sha256":review["sha256"],"proposal":proposal,"actor":actor,
          "rationale":rationale.strip(),
          "authority":"operator-selected" if actor=="operator" else "advisory-only",
          "genome":selected["genome"],"native_witness_id":selected["native_witness_id"]}
    data["sha256"]=_hash(data)
    target=root/("selection-"+actor+".json")
    if target.exists() and json.loads(target.read_text())!=data:
        raise ValueError("A recorded decision must not be silently overwritten")
    _atomic(target,data)
    return data
