# Semantic linework

Projection Loom renders architectural/technical control imagery from 3D geometry by classifying feature lines **before** choosing opacity or line weight. The categories can remain independent transparent RGBA layers through post-production.

## Render priorities

The named categories, in increasing visual priority, are:

| Category | Carries | Typical appearance |
|---|---|---|
| `detail` | Minor but non-coplanar feature edges | Fine, subdued |
| `material` | Material seams, including visible boundaries between separately constructed parts | Thin, subdued |
| `crease` | Major angular structural edges | Medium, clear |
| `occlusion` | Visible overlapping-part boundaries that genuinely change surface orientation or depth | Medium-heavy |
| `outline` | Whole-object exterior contour and negative-space openings | Heavy, dominant |

Pure triangulation diagonals with coplanar faces are not automatically drawn. Occluded edges do not enter these visible-line passes. If hidden-line drafting is required, produce a **separate** intentionally styled pass rather than including hidden edges in the structural reference.

## Choosing edges

Mesh-edge classification uses undirected face adjacency, the dihedral angle between adjacent face normals, face material IDs, and optional authored part roles. Independent structural parts may intersect without sharing indexed vertices. A separate camera-visible G-buffer pass therefore also detects *interpart* occluding contours and material changes. The raster-derived category is a visual drafting aid, **not proof** that parts fuse physically.

Line lengths are screened at the intended displayed width (not just native export width). The view-space silhouette still governs alpha: out-of-object strokes are clipped to a graded matte, while the structural categories remain separate layers. The combined linework takes the strongest opacity at an overlap rather than accumulating identical-color layers into an artificial bright knot.

## Controls

Production drawings use semantic linework in all four standard outputs (`silhouette`, `structure`, `lit`, `lit_structure`). Configure the `render` settings in the project file. Example:

```json
{
  "render": {
      "linework_mode": "semantic",
      "line_supersample": 2,
      "crease_angle": 33,
      "detail_angle": 14,
      "presentation_width": 540,
      "min_display_length": 1.8,
      "part_roles": {
        "main-mass": "primary",
        "secondary-pier": "secondary",
        "surface-decoration": "detail"
      }
  }
}
```

Four neutral part-role values are available: `primary`, `secondary`, `detail`, `suppress`. The role affects interior stroke emphasis only; suppressing interior edges never removes the part from the global silhouette. Roles may alternatively be carried as `line_role` entries on `mesh.parts`.

The production material is the validated Boolean body after all authored void cuts. Component roles remain in the construction genome; a fused, carved control cannot automatically recover original part materials. The library function `render_line_hierarchy(mesh, camera, size, style=...)` returns independently compositable RGBA images for `outline`, `occlusion`, `crease`, `material`, `detail`, and `structure`, plus numerical diagnostics. A project may export these directly without altering the four-pass CLI contract.

## Suggested QA

1. Inspect the hard silhouette before adding interior geometry.
2. Compare the categorized drawing against an all-edge diagnostic.
3. At the planned printed/displayed size, verify that major masses and entrances remain readable.
4. Measure total inking, per-category inking, outline containment, and small disconnected interior strokes.
5. Keep the lighting buffer independent. Lighting may inform artistic line emphasis, but it does not convert a minor edge into a major structural element.
6. Verify every camera against the same source mesh and scale convention.
7. Save authored roles and style settings with each asset: a visually stronger result must remain reproducible.

## Boundaries

This lightweight classifier does not produce exact CAD-style hidden-line removal or full mesh-mesh intersection curves. Its G-buffer sees *rasterized* boundaries, and its face-adjacency classifier sees indexed geometric edges. For precise B-rep drawings consider OpenCascade hidden-line-removal tools; for comprehensive production NPR line sets, Blender Line Art/Freestyle remain strong optional backends. The built-in path uses only Projection Loom's existing NumPy, OpenCV, Pillow and mesh dependencies.

## References

- F. Cole et al. (2008), *Where Do People Draw Lines?*, SIGGRAPH/ACM TOG: https://gfx.cs.princeton.edu/pubs/cole_2008_wdp/
- P. Bénard and A. Hertzmann (2018), *Line Drawings from 3D Models*: https://arxiv.org/abs/1810.01175
- Blender Manual, Line Art edge types and visibility: https://docs.blender.org/manual/en/4.5/grease_pencil/modifiers/generate/line_art.html
- Trimesh adjacency/dihedral angle documentation: https://trimesh.org/trimesh.html
- U.S. National Park Service, HABS Measured Drawing Guidelines, Section 4.3: https://www.nps.gov/subjects/heritagedocumentation/upload/HABS-Guidelines-Measured-Drawings_508.pdf
- VTK vtkFeatureEdges: https://vtk.org/doc/nightly/release/9.6/html/classvtkFeatureEdges.html
