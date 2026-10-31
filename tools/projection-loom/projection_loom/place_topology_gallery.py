"""Verified native six-view operator gallery for matched spatial topology.

Fixed cameras reuse the existing Loom illustration engine. This gallery can
render geometry that failed an architectural goal, but never changes the
original STEP audit, chooses an artistic winner, or suppresses a refusal.
"""
from __future__ import annotations
from hashlib import sha256
from html import escape
import json
from pathlib import Path
import tempfile
import cadquery as cq
from PIL import Image,ImageDraw
from .place_gallery import _original_mesh,_native_mesh
from .gallery_artifacts import VIEWS
from .intent_evolution import fixed_inspection_cameras
from .render import silhouette
from .place_topology_study import verify_topology_study
from .generalized_campaign import save_once
from .provenance_encoding import canonical_json_sha256


def _read(path):
    return json.loads(Path(path).read_text(encoding="utf8"))


def _page(pre,report,entries):
    cards=[]
    for row in entries:
        goal=" · ".join(str(x["kind"])+": "+str(x["status"])
                        for x in row["goal_statuses"])
        if row["image_file"] is not None:
            visual='<img alt="'+escape(row["pattern"])+' native six-view silhouette" src="'+escape(row["image_file"])+'">'
        else:
            visual='<p class="refusal">Construction refused; no native STEP audition or image exists.</p>'
        reason=('<p class="refusal">'+escape(row["construction_refusal"])+'</p>'
                if row["construction_refusal"] else "")
        axes=" → ".join(row["axes"]) if row["axes"] else "unwitnessed"
        cards.append('<section><h2>'+escape(row["pattern"])+'</h2>'+
                     visual+'<p>Measured hops: '+escape(str(row["hops"]))+
                     ' · Axes: '+escape(axes)+'</p><p>Spatial status: '+
                     escape(row["state"])+'</p><p>Original goal consequences: '+
                     escape(goal)+'</p>'+reason+'</section>')
    return ("""<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>Projection Loom · source-bound topology review</title>
<style>body{background:#151b24;color:#e5e9f0;font:16px system-ui;max-width:1020px;
margin:auto;padding:24px}h1,h2{color:#f5dfad}main{display:grid;grid-template-columns:
repeat(auto-fit,minmax(390px,1fr));gap:20px}section{padding:18px;background:#222b38;
border:1px solid #445266;border-radius:10px}img{display:block;max-width:100%;
height:auto;background:#0f141c}.refusal{color:#ffb6ab}p{line-height:1.5}
footer{margin-top:35px;color:#c4ccd5}</style></head><body>
<h1>Projection Loom · native topology alternatives</h1>
<p>Original source: """+escape(pre["original_genome_sha256"])+
""" · Source goal scope: """+escape(pre["spatial_intent_sha256"])+
"""</p><p>Alternatives offered: """+str(report["topology_alternatives_offered"])+
""" · Actual independent STEP auditions: """+str(report["native_attempts"])+
""" · Construction refusals: """+str(len(report["construction_refusals"]))+
""" · Witnessed route layouts: """+str(report["observed_distinct_route_layouts"])+
"""</p><main>"""+"".join(cards)+"""</main><footer>
Native STEP evidence and source-bound goal receipts govern this study.
These images only illustrate independently reimported native bodies;
no aesthetic choice, source camera registration, engineering certification
or operator approval follows from this gallery.</footer></body></html>""")


def render_topology_gallery(original,spatial,study,destination,*,
                            location,goal_index,corner_prefix,size=(160,120)):
    if size!=(160,120):
        raise ValueError("Frozen native topology gallery camera dimensions required")
    root=Path(study)
    report=verify_topology_study(original,spatial,root,
              location=location,goal_index=goal_index,corner_prefix=corner_prefix)
    pre=_read(root/"preregistration.json")
    folder=Path(destination)
    if folder.exists():
        raise ValueError("Native topology gallery requires a fresh destination")
    folder.mkdir(parents=True)
    try:
        cameras=fixed_inspection_cameras(_original_mesh(original),size=size)
        frozen={name:cameras[name].to_dict() for name in VIEWS}
        entries=[]
        for row in report["arms"]:
            pattern=row["turn"]
            filename=None
            image_sha=None
            native_id=None
            if row["state"]!="construction-refused":
                native_root=root/pattern/"scene"
                manifest=_read(native_root/"manifest.json")
                if manifest["sha256"]!=row["native_evidence"]["native_scene_sha256"]:
                    raise ValueError("Topology image source does not match independently audited STEP")
                mesh=_native_mesh(native_root,manifest)
                sheet=Image.new("RGB",(3*size[0],2*(size[1]+22)),(15,20,27))
                pen=ImageDraw.Draw(sheet)
                for i,name in enumerate(VIEWS):
                    view=Image.fromarray(silhouette(mesh,cameras[name],size),"L").convert("RGB")
                    x=(i%3)*size[0]
                    y=(i//3)*(size[1]+22)
                    sheet.paste(view,(x,y+22))
                    pen.text((x+4,y+5),name,fill=(230,236,245))
                filename=pattern+"_six_view.png"
                sheet.save(folder/filename)
                image_sha=sha256((folder/filename).read_bytes()).hexdigest()
                native_id=manifest["sha256"]
            proof=row["witnessed_route"]
            entries.append({"pattern":pattern,"state":row["state"],
                "construction_refusal":row.get("construction_refusal"),
                "goal_statuses":[{"kind":x["goal"]["kind"],"status":x["status"]}
                                 for x in row["goal_statuses"]],
                "hops":None if proof is None else proof["hops"],
                "axes":None if proof is None else proof["ordered_route_axes"],
                "native_scene_sha256":native_id,"image_file":filename,
                "image_sha256":image_sha})
        html=_page(pre,report,entries)
        (folder/"review.html").write_text(html,encoding="utf8")
        body={"schema":"projection-loom/native-topology-review-gallery",
              "original_genome_sha256":original.identity,
              "source_intent_sha256":spatial.identity,
              "native_study_sha256":report["sha256"],
              "frozen_cameras":frozen,
              "camera_sha256":canonical_json_sha256(frozen),
              "entries":entries,"review_html_sha256":sha256(html.encode("utf8")).hexdigest(),
              "image_authority":"fixed-camera-presentation-only",
              "automatic_artistic_winner":False,
              "source_camera_registration":False,
              "structural_safety_certification":False}
        result={**body,"sha256":canonical_json_sha256(body)}
        save_once(folder/"manifest.json",result)
        return result
    except Exception:
        (folder/"FAILED").write_text("Unfinished native topology review; no acceptance\n")
        raise


def verify_topology_gallery(original,spatial,study,gallery,*,
                            location,goal_index,corner_prefix):
    root=Path(gallery)
    if (root/"FAILED").exists():
        raise ValueError("An unfinished native topology gallery cannot enter review")
    receipt=_read(root/"manifest.json")
    html=(root/"review.html").read_bytes()
    if sha256(html).hexdigest()!=receipt["review_html_sha256"]:
        raise ValueError("Native topology board HTML diverged from frozen presentation")
    for row in receipt["entries"]:
        if row["image_file"]:
            image=root/row["image_file"]
            if not image.is_file() or sha256(image.read_bytes()).hexdigest()!=row["image_sha256"]:
                raise ValueError("Native topology gallery image no longer matches independently audited STEP")
    with tempfile.TemporaryDirectory(prefix="loom-native-topology-gallery-") as tmp:
        expected=render_topology_gallery(original,spatial,study,
                   Path(tmp)/"replayed",location=location,
                   goal_index=goal_index,corner_prefix=corner_prefix)
    if receipt!=expected:
        raise ValueError("Native topology gallery changed independently replayed sources")
    return True
