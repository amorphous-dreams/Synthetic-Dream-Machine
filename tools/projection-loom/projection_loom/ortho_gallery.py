"""Read-only native six-view gallery for any completed Experiment Zero review.

Regrow candidate CAD and polymesh, check archive mask/camera receipts, then
render with frozen shared cameras. Source genotype and operator decisions
never change. No experimental generations are bundled into this module.
"""
from pathlib import Path
import json
from hashlib import sha256

from PIL import Image, ImageDraw, ImageFont
from .pipeline import Project
from .capability_stack import CapabilityCompositor, CapabilityRecipe
from .cameras import Camera
from .evidence_receipts import CompoundAuditReceipt
from .render import render_controls
from .epochs import _hash, _atomic
from .campaign import visual_descriptor
import numpy as np

VIEWS=("oblique","front","r-side","back","l-side","top")
ALIASES={"oblique":"OBLIQUE","front":"FRONT","r-side":"RIGHT",
         "back":"BACK","l-side":"LEFT","top":"TOP"}
DARK=(13,22,34,255)
BLUE=(184,215,234,255)
SUBTLE=(156,174,190,255)
ACCENT=(132,207,224,255)


def font(size):
    for path in ("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
                 "/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf"):
        if Path(path).is_file():
            return ImageFont.truetype(path,size)
    return ImageFont.load_default()


def board(title,items,*,lit):
    cell_w,cell_h=180,256
    top=84
    gap=8
    label_h=55
    width=12+len(VIEWS)*(cell_w+gap)
    height=top+len(items)*(cell_h+label_h+gap)+12
    out=Image.new("RGBA",(width,height),DARK)
    d=ImageDraw.Draw(out)
    d.text((18,12),title,font=font(23),fill=(234,241,249,255))
    d.text((18,48),"ACTUAL NATIVE CAD  |  seed-frozen cameras  |  no candidate-specific reframe",
           font=font(12),fill=SUBTLE)
    for index,view in enumerate(VIEWS):
        d.text((14+index*(cell_w+gap)+7,69),ALIASES[view],
               font=font(12),fill=ACCENT)
    for row,item in enumerate(items):
        top_y=top+row*(cell_h+label_h+gap)
        for col,view in enumerate(VIEWS):
            x=12+col*(cell_w+gap)
            content=item["lit"][view] if lit else item["silhouettes"][view]
            if content.size!=(160,240):
                raise ValueError("Panel dimension mismatch")
            tile=Image.new("RGBA",(cell_w,cell_h),(23,36,51,255))
            tile.alpha_composite(content.convert("RGBA"),(10,6))
            out.alpha_composite(tile,(x,top_y))
        text=(f'#{item["rank"]:02d}  {item["family"].upper()}  '
              f'GEN {item["epoch"]}  /  IoU {item["alpha_iou"]:.3f}  '
              f'/  global loss {item["global_loss"]:.3f}')
        d.text((17,top_y+cell_h+7),text,font=font(14),fill=BLUE)
    return out.convert("RGB")


def make(root,project_path,recipe_path,output,seats=3):
    if type(seats) is not int or not 2<=seats<=5:
        raise ValueError('Native ortho gallery seats must be 2..5')
    root=Path(root)
    output=Path(output)
    report=json.loads((root/"experiment_zero_review"/"review.json").read_text())
    if report["sha256"] != _hash({k:v for k,v in report.items() if k!="sha256"}):
        raise ValueError("Native review report digest mismatch")
    project=Project.load(project_path)
    recipe=CapabilityRecipe.load(recipe_path)
    required=set(VIEWS)
    if required-set(project.cameras) or required-set(report['cameras']):
        raise ValueError('Review lacks required shared six-view camera set')
    if project.seed_entity is not None and recipe.seed_entity_sha256 != project.seed_entity.sha256:
        raise ValueError('Review recipe does not bind the named source seed')
    compositor=CapabilityCompositor(project,recipe,size=(64,96),
                                     source_mask=project.source_mask((64,96)))
    cameras={name:Camera.from_dict(report["cameras"][name]) for name in VIEWS}
    candidates=report["candidates"][:seats]
    if len(candidates)<2:
        raise ValueError("Require at least two independently reviewed descendants")
    cards=[]
    for candidate in candidates:
        built=compositor.grow(candidate["genome"])
        if not CompoundAuditReceipt.from_native(built.audit).render_admissible:
            raise ValueError("Native regrowth failed")
        mesh=built.scene.render_mesh()
        lit={}
        silhouettes={}
        for view in VIEWS:
            raster=render_controls(mesh,cameras[view],size=(160,240),
                style={"supersample":1,"work_width":160,
                       "linework_mode":"semantic","line_supersample":1})
            lit[view]=raster["lit_structure"]
            mask_file=root/candidate["views"][view]["image"]
            if not mask_file.is_file():
                raise FileNotFoundError(mask_file)
            # Existing archived native renderer mask, resized for board ONLY.
            with Image.open(mask_file) as archived:
                native_mask=np.asarray(archived.convert("L"))>96
            if visual_descriptor(native_mask)["mask_sha256"]!=candidate["views"][view]["mask_sha256"]:
                raise ValueError("Archived silhouette differs from native mask receipt")
            # Hash the *archived canonical JSON*, not a typed Camera round-trip.
            # Camera.from_dict legitimately normalizes integer angles to floats;
            # 0 and 0.0 render identically but have different JSON digests.
            archived_camera=report["cameras"][view]
            if _hash(archived_camera)!=candidate["views"][view]["camera_sha256"]:
                raise ValueError("Archived review camera differs from frozen camera")
            if cameras[view].to_dict()!=archived_camera:
                raise ValueError("Parsed review camera differs from archived values")
            mask=Image.fromarray(native_mask.astype(np.uint8)*255,"L").resize(
                (160,240),Image.Resampling.NEAREST)
            board_mask=Image.new("RGBA",(160,240),(0,0,0,0))
            board_mask.paste((210,224,239,255),(0,0,160,240),mask=mask)
            silhouettes[view]=board_mask
        cards.append({
            "id":candidate["id"],"rank":candidate["rank"],
            "family":candidate["family"],"epoch":candidate["epoch"],
            "alpha_iou":1-float(candidate["losses"]["silhouette"]),
            "global_loss":float(candidate["combined_loss"]),
            "native_witness_id":candidate["native_witness_id"],
            "extra_fraction":candidate["observation"]["extra_fraction"],
            "lit":lit,"silhouettes":silhouettes,
            "brutalist_bands":candidate["genome"].get("brutalist.bands"),
            "brutalist_piers":candidate["genome"].get("brutalist.piers")
        })
    if output.exists() and any(output.iterdir()):
        raise ValueError("Write gallery into a new empty directory; do not overwrite receipts")
    output.mkdir(parents=True,exist_ok=True)
    first=board(f"{project.location.upper()}  /  NATIVE OODA-HA  /  SHADED ORTHOGRAPHICS",
                cards,lit=True)
    second=board(f"{project.location.upper()}  /  NATIVE OODA-HA  /  VERIFIED SILHOUETTES",
                 cards,lit=False)
    files={"shaded_orthos":"native_shaded_orthos.png",
           "silhouette_orthos":"native_silhouette_orthos.png"}
    first.save(output/files["shaded_orthos"],optimize=True)
    second.save(output/files["silhouette_orthos"],optimize=True)
    summary={
        "schema":"projection-loom/native-review-ortho-gallery",
        "source_seed_name":project.seed_entity.pet_name if project.seed_entity else None,
        "source_seed_sha256":project.seed_entity.sha256 if project.seed_entity else None,
        "recipe_sha256":recipe.sha256,
        "original_source_review_sha256":report["sha256"],
        "reference_camera":"provisional painting alignment",
        "reference_frame":project.reference_view,
        "epochs":report["passes"],
        "reviewed":len(cards),
        "images":{k:{"file":v,"sha256":sha256((output/v).read_bytes()).hexdigest()}
                  for k,v in files.items()},
        "views":[{"name":n,"camera_sha256":_hash(cameras[n].to_dict())}
                 for n in VIEWS],
        "survivors":[{k:v for k,v in row.items()
                     if k not in ("lit","silhouettes")} for row in cards],
        "render_source":"Independent native CAD/mesh regrowth, depth-tested lit_structure and archived silhouette masks",
        "operator_authority":"advisory only; no survivor promoted",
        "lineage_policy":"read-only post-campaign rendering; no generation promotion"
    }
    summary["sha256"]=_hash(summary)
    _atomic(output/"summary.json",summary)
    return summary


