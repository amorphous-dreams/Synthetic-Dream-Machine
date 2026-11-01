"""Source-frozen six-view illustration of verified multi-body native locations.

This gallery only presents CAD. Mesh concatenation serves raster projection;
it never fuses independent construction or promotes rendered images as source.
"""
from pathlib import Path
import json
from hashlib import sha256
import tempfile
import cadquery as cq
import trimesh
from .place_comparison import place_comparison
from .place_genome import PlaceGenome
from .developmental import compile_growth
from .intent_evolution import fixed_inspection_cameras
from .gallery_artifacts import VIEWS,native_six_view_sheet
from .receipt_store import save_once
from .provenance_encoding import canonical_json_sha256


def _read(path):
    return json.loads(Path(path).read_text(encoding="utf8"))


def _joined_preview(meshes):
    if not meshes:
        raise ValueError("No validated native body can enter a location gallery")
    # Trimesh concatenate creates disconnected presentation triangles only.
    return trimesh.util.concatenate(meshes)


def _original_mesh(genome):
    bodies=[]
    for body in genome.bodies:
        build=compile_growth(body.program)
        build.audit()
        mesh=build.assembly.tessellate(union=True)
        part=trimesh.Trimesh(vertices=mesh.vertices,faces=mesh.faces,process=False)
        part.apply_translation(body.translation)
        bodies.append(part)
    return _joined_preview(bodies)


def _native_mesh(root,manifest):
    result=[]
    for row in manifest["bodies"]:
        model=cq.importers.importStep(str(root/row["step_path"])).val()
        if not model.isValid() or len(model.Solids())!=1:
            raise ValueError("Gallery refuses malformed independent STEP solid")
        points,faces=model.tessellate(.28)
        if not points or not faces:
            raise ValueError("STEP body has no visible triangulated representation")
        vertices=[(float(p.x),float(p.y),float(p.z)) for p in points]
        result.append(trimesh.Trimesh(vertices=vertices,faces=faces,process=False))
    return _joined_preview(result)


def render_place_gallery(campaign,destination,*,size=(160,120)):
    if size!=(160,120):
        raise ValueError("Frozen location-gallery evidence dimensions required")
    root=Path(campaign)
    folder=Path(destination)
    if folder.exists():
        raise ValueError("A native location gallery needs a fresh destination")
    folder.mkdir(parents=True)
    with tempfile.TemporaryDirectory(prefix="loom-gallery-") as td:
        comparison=place_comparison(root,Path(td)/"comparison.json")
    prereg=_read(root/"pre_registration.json")
    original=PlaceGenome.from_dict(prereg["original_genome"])
    cameras=fixed_inspection_cameras(_original_mesh(original),size=size)
    freeze={name:cameras[name].to_dict() for name in VIEWS}
    camera_sha=canonical_json_sha256(freeze)
    entries=[]
    for row in comparison["candidates"]:
        item={"candidate_id":row["candidate_id"],"status":row["status"],
              "native_scene_sha256":None,"six_view":None,"image_sha256":None}
        if row["status"]=="admitted":
            scene=row["native_scene"]
            workspace=root/"candidates"/row["candidate_id"]/"workspace"
            native_root=workspace/"scene"
            manifest=_read(native_root/"manifest.json")
            if manifest["sha256"]!=scene["scene_sha256"]:
                raise ValueError("Native gallery source changed")
            mesh=_native_mesh(native_root,manifest)
            sheet=native_six_view_sheet(mesh,cameras,size)
            name=row["candidate_id"]+"_six_view.png"
            sheet.save(folder/name)
            item.update(native_scene_sha256=manifest["sha256"],
                        six_view=name,image_sha256=sha256((folder/name).read_bytes()).hexdigest())
        entries.append(item)
    body={"schema":"projection-loom/place-native-gallery",
          "original_genome_sha256":original.identity,
          "source_evidence_scope":comparison["source_evidence_scope"],
          "camera_sha256":camera_sha,"frozen_cameras":freeze,
          "candidate_count":len(entries),"entries":entries,
          "claim_scope":"synthetic-fixed-orthographic-presentation-only",
          "source_camera_registration":False,
          "load_certification":False,"automatic_winner":False}
    document={**body,"sha256":canonical_json_sha256(body)}
    save_once(folder/"manifest.json",document)
    return document


def verify_place_gallery(campaign,gallery):
    folder=Path(gallery)
    receipt=_read(folder/"manifest.json")
    for item in receipt["entries"]:
        if item["six_view"] is not None:
            path=folder/item["six_view"]
            if not path.is_file() or sha256(path.read_bytes()).hexdigest()!=item["image_sha256"]:
                raise ValueError("Native gallery illustration changed")
    with tempfile.TemporaryDirectory(prefix="loom-gallery-replay-") as td:
        expected=render_place_gallery(campaign,Path(td)/"regenerated")
    if receipt!=expected:
        raise ValueError("Gallery differs from original native geometry and frozen cameras")
    return True
