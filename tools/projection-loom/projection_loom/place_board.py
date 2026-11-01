"""Read-only operator board: verified STEP evidence beside frozen-view presentation.

The board supplies no artistic winner, source registration or physical
certification. It independently rebuilds the campaign comparison and native
six-view gallery; HTML only presents those audited results.
"""
from __future__ import annotations
import html
import json
import tempfile
from hashlib import sha256
from pathlib import Path

from .receipt_store import save_once
from .place_comparison import place_comparison
from .place_gallery import render_place_gallery
from .provenance_encoding import canonical_json_sha256


def _read(path):
    return json.loads(Path(path).read_text(encoding="utf8"))


def _html_board(report):
    h=html.escape
    blocks=[]
    for item in report["candidates"]:
        label=h(item["candidate_id"])
        state=h(item["status"])
        n=item["observed_spatial_descriptor"]
        metrics=(
            "Bodies: "+str(item["body_count"])+
            " · Witnessed routes: "+str(len(n["goals"]))+
            " · Shelter: "+str(n["shelter_witness_count"])+
            " · Ascents: "+str(n["ascent_witness_count"])+
            " · Bearings: "+str(n["bearing_witness_count"])
            if n is not None else "No admitted native morphology"
        )
        picture=("<img alt='Native STEP-derived six orthographic views of "+
                 label+"' src='"+h(item["six_view"],quote=True)+"'>"
                 if item["six_view"] else "")
        reason=("<p class='refusal'>"+h(item["reason"])+"</p>"
                if item["reason"] else "")
        emission=item["emitter_receipt"]
        parents=[]
        for ancestry in emission["ancestors"]:
            if "left_candidate_id" in ancestry:
                parents.extend((ancestry["left_candidate_id"],ancestry["right_candidate_id"]))
            else:
                parents.append(ancestry["candidate_id"])
        lineage=("<p class='lineage'>Emitter: "+h(emission["emitter"])+
                 (" · Native parent candidates: "+h(", ".join(parents)) if parents else "")+
                 (" · Deferred proposal: "+h(emission["proposal_deferral"])
                  if emission["proposal_deferral"] else "")+"</p>")
        lines=[]
        for goal in item["goal_consequences"]:
            lines.append("<li>"+h(goal["kind"]+" ("+goal["subject"]+" → "+
                         goal["object"]+")")+": "+h(goal["status"])+
                         (" — "+h(goal["reason"]) if goal["reason"] else "")+"</li>")
        consequences="<ul>"+"".join(lines)+"</ul>"
        blocks.append("<article><header><strong>"+label+"</strong>"
                      +" <small>"+state+"</small></header>"+picture+
                      "<p class='metrics'>"+h(metrics)+"</p>"+lineage+consequences+
                      reason+"</article>")
    deferred="".join("<li>"+h(row["candidate_id"])+" (epoch "+
                     str(row["epoch"])+") · "+h(row["emitter_receipt"]["emitter"])+
                     (" · "+h(row["emitter_receipt"]["proposal_deferral"])
                      if row["emitter_receipt"]["proposal_deferral"] else "")+
                     "</li>" for row in report["deferred"])
    return ("""<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Projection Loom · Place evidence review</title>
<style>
body{font:16px/1.55 system-ui,sans-serif;background:#111922;color:#e4ebef;
max-width:1100px;margin:0 auto;padding:2rem}
h1{font-size:2rem;line-height:1.2}p{max-width:80ch}
aside{border-left:3px solid #91b4b3;padding:0 1rem;color:#c3d1d7}
section{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:1rem}
article{background:#1b2835;border:1px solid #324355;border-radius:12px;padding:1rem}
article header{display:flex;justify-content:space-between;gap:1rem}
article img{width:100%;height:auto;display:block;margin-top:1rem}
small,.metrics{color:#b6c4cc}.refusal{color:#f2c9a0}
a{color:#b8d9e9}footer{margin-top:2rem;color:#b6c4cc}
</style></head><body>
<h1>Living place · Operator review</h1>
<aside><p>Independent native STEP receipts and synthetic fixed-camera
illustrations. No automatic artistic winner, structural load certification,
survey pose or canon promotion.</p></aside>
<p>Location: """+h(report["location"])+""" · Source evidence: """+
h(report["source_evidence_scope"])+""" · Admitted: """+str(report["admitted"])+""" ·
Deferred: """+str(len(report["deferred"]))+"""</p>
<p>Relational proposals: """+str(report["relational_emissions"]["relational_offered"])+
""" · Independently native-audited: """+str(report["relational_emissions"]["relational_native_attempted"])+
""" · Native-admitted: """+str(report["relational_emissions"]["relational_native_admitted"])+
""" · Topology proposals: """+str(report["relational_emissions"]["topology_offered"])+
""" · Topology STEP attempts: """+str(report["relational_emissions"]["topology_native_attempted"])+
""" · Topology native-admitted: """+str(report["relational_emissions"]["topology_native_admitted"])+
""" · Deferred proposals: """+str(report["relational_emissions"]["proposal_deferrals"])+
""" · Rejected source-region combinations: """+str(report["relational_emissions"]["region_pairs_refused_before_birth"])+
""" (proposal attempts only; not STEP auditions)</p>
<section>"""+ "".join(blocks)+"""</section>
<h2>Unattempted proposals</h2><ul>"""+deferred+"""</ul>
<footer>Every viewed alternative retains its source and refusal testimony.
Images present geometry; they do not author it.</footer></body></html>
""")


def render_place_board(campaign, destination):
    root=Path(destination)
    if root.exists():
        raise ValueError("Place board requires an unused immutable destination")
    root.mkdir(parents=True)
    try:
        comparison=place_comparison(campaign,root/"comparison.json")
        gallery=render_place_gallery(campaign,root/"gallery")
        image_by_id={r["candidate_id"]:r for r in gallery["entries"]}
        if set(image_by_id)!={r["candidate_id"] for r in comparison["candidates"]}:
            raise ValueError("Place gallery and comparison disagree on candidates")
        rows=[]
        for candidate in comparison["candidates"]:
            image=image_by_id[candidate["candidate_id"]]
            if (image["native_scene_sha256"]!=
                    (candidate["native_scene"] or {}).get("scene_sha256")):
                raise ValueError("Operator image diverges from independently verified STEP")
            goal_evidence=candidate["final_goal_evidence"] or candidate["original_goal_evidence"]
            consequences=([{"kind":item["goal"]["kind"],
                            "subject":item["goal"]["subject"],
                            "object":item["goal"]["object"],
                            "status":item["status"],
                            "reason":item.get("reason")}
                           for item in goal_evidence["goals"]]
                          if goal_evidence else [])
            rows.append({
                "goal_consequences":consequences,
                "candidate_id":candidate["candidate_id"],
                "epoch":candidate["epoch"],
                "status":candidate["status"],
                "genome_sha256":candidate["genome_sha256"],
                "emitter_receipt":candidate["emitter_receipt"],
                "body_count":candidate["body_count"],
                "observed_spatial_descriptor":candidate["observed_spatial_descriptor"],
                "reason":candidate["reason"],
                "six_view":("gallery/"+image["six_view"] if image["six_view"] else None),
                "image_sha256":image["image_sha256"],
                "native_scene":candidate["native_scene"]})
        body={"schema":"projection-loom/native-place-review-board",
              "location":comparison["location"],
              "source_evidence_scope":comparison["source_evidence_scope"],
              "spatial_intent_sha256":comparison["spatial_intent_sha256"],
              "comparison_sha256":comparison["sha256"],
              "gallery_sha256":gallery["sha256"],
              "camera_sha256":gallery["camera_sha256"],
              "admitted":comparison["admitted"],
              "deferred":comparison["deferred_proposals"],
              "relational_emissions":comparison["relational_emissions"],
              "candidates":rows,
              "illustrations_as_source":False,
              "automatic_artistic_winner":False,
              "automatic_promotion":False,
              "physical_safety_certification":False}
        page=_html_board(body)
        (root/"board.html").write_text(page,encoding="utf8")
        body["html_sha256"]=sha256(page.encode("utf8")).hexdigest()
        result={**body,"sha256":canonical_json_sha256(body)}
        save_once(root/"board.json",result)
        return result
    except Exception:
        (root/"FAILED").write_text("Incomplete native operator board\n",encoding="utf8")
        raise


def verify_place_board(campaign,board):
    root=Path(board)
    receipt=_read(root/"board.json")
    if (root/"FAILED").exists():
        raise ValueError("Incomplete operator board cannot be accepted")
    page=(root/"board.html").read_bytes()
    if sha256(page).hexdigest()!=receipt["html_sha256"]:
        raise ValueError("Operator board HTML changed")
    for row in receipt["candidates"]:
        if row["six_view"]:
            relative=Path(row["six_view"])
            if (relative.is_absolute() or len(relative.parts)!=2
                    or relative.parts[0]!="gallery"
                    or relative.name!=row["candidate_id"]+"_six_view.png"):
                raise ValueError("Operator board image path diverged from verified candidate")
            picture=root/relative
            if not picture.is_file() or sha256(picture.read_bytes()).hexdigest()!=row["image_sha256"]:
                raise ValueError("Operator board image changed")
    with tempfile.TemporaryDirectory(prefix="loom-operator-board-") as td:
        regenerated=render_place_board(campaign,Path(td)/"regenerated")
    if regenerated!=receipt:
        raise ValueError("Operator board changed from its independently replayed source")
    return True
