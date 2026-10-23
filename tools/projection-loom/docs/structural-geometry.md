# Construction and structural evidence

Projection Loom holds an architectural *relationship* alongside its visual projection. The project declares foundations, supported masses, secondary members, detail, and explicit exemptions. Evolution, contact analysis, and architectural drawing use the same named parts and shared cameras.

## Construction contract

The `ConstructionGrammar` grows solid primitives from a named parent's surface with an explicit penetration depth. Its `foundation`, `attach_prism`, and `brace` operators emit multipart triangulated geometry. A project can also provide `construction` entries that name a brace, its two anchors, and bounded width/depth parameters; the engine applies those authored operations before evaluation. A brace may change the asset silhouette. The engine never guesses where to insert a structural member.

A `structure` block in a project manifest declares roots, parent-child attachments, semantic roles, and whether invalid joints only get reported or fail the run. For example:

```json
{
  "structure": {
    "policy": "gate",
    "roots": ["foundation"],
    "roles": {"foundation":"foundation", "keep":"primary", "terrace":"secondary", "ornament":"exempt"},
    "attachments": [
      {"parent":"foundation", "child":"keep", "min_ratio":0.055},
      {"parent":"keep", "child":"terrace", "min_ratio":0.055}
    ]
  }
}
```

The support graph must form a rooted directed acyclic graph. Every part must be reachable from a foundation or have an explicit `exempt` role. Each required parent-child contact must have **positive shared interior**, not only matching AABBs or projected edges.

## Evidence and limits

1. Broad-phase AABB gaps reject clearly separated candidates quickly; overlap of bounding boxes **never** certifies a joint.
2. Closed convex parts undergo a numerical Chebyshev-center linear program over their half-spaces, measuring the maximum ball that fits within the intersection. The result supplies a local overlap-radius estimate. Project-level minimums apply both absolute and part-relative thresholds.
3. Open, degenerate, and nonconvex parts produce uncertainty rather than a positive certified verdict from a convex hull approximation. An imported watertight convex mesh can participate without a procedural builder.
4. A supported assembly need not be a single topologically welded mesh. Watertightness of the *joined production solid* requires a Boolean union and separate manifold validation. The numeric contact test measures overlap, not mechanical load strength, stability, or finite-element stress.
5. An explicit `exempt` part may be intentionally levitating; exceptions are named and do not automatically repair failed attachments.

Scale-relative AABB contact graphs and per-view 2D component counts serve as **diagnostic heuristics**, never acceptance evidence for a strict structure policy.

## Evolution and control renders

The search uses cheap AABB *gap penalties* to steer broad exploration. A contender must then pass the exacting convex-solid audit before its parameters replace the accepted parent. `gate` validates the initial structure and the final model; invalid candidates are not inherited. `report` preserves the audit without blocking exports.

The renderer receives graph-owned part roles for its semantic line hierarchy and preserves its four outputs (`silhouette`, `structure`, `lit`, `lit_structure`) unmodified. A separate `diagnostics/VIEW_structural_QA.png` uses green paths for accepted joints and red crosses for insufficient/unknown ones. **These overlays are not image-generation control images.** They do not become printed elements of the drawing unless explicitly composited by the artist.

Use the reference project:

```bash
projection-loom validate --project examples/structural_project.json --out out/validated
projection-loom render --project examples/structural_project.json --out out/control-views
```

The contract is deliberately subject-neutral: projects own their structural roles, margins, and engineering expectations. Numerical contact validity and artistic proportion remain distinct forms of evidence.
