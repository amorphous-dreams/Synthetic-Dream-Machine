# Pair A: Ur modern reconstruction + CC0 Brutalist OpenSCAD

## Why this branch

The Operator selected Pair A, then steered the initial Ur input **away from**
1.9-million-triangle excavation photogrammetry, toward a smaller modern
reconstruction suited to multiple input seeds. This trial branches from PR #84
at `8fda85f` and **does not alter that PR**.

## Hard-source candidates (outside this source tree)

| Input | URL | Rights | Current availability in trial |
| --- | --- | --- | --- |
| Modern Ziggurat based on Ur, History Builds | https://sketchfab.com/3d-models/ziggurat-f2ffb4bd5200400eac37fbce5c010ef0 | CC BY; ~44.7k triangles | **Linked only**; actual model bytes require authenticated download; not scored |
| nosycat Brutalist architecture collection | https://opengameart.org/content/brutalist-architecture-models | CC0; OpenSCAD and STL in `brutalism2.zip` | **Linked only**; archive download unavailable in this isolated environment; not scored |
| Excavation photogrammetry, Lagash/Penn project | https://sketchfab.com/3d-models/ziggurat-of-ur-01a917691d344f3d801f67151de6b2f0 | CC BY-NC; ~1.9M triangles | Deliberately deferred |

Never call an external reference **ingested** until actual local bytes pass digest checks.

## Historical claims and conflicting measurements

- Modern published lower-stage approximation: ~62.5 × 43 × 11 m (see
  https://ancientmeasures.com/temples/ziggurat-of-ur/).
- Another educational summary gives ~64 × 46 m footprint, a meaningfully
  different rounded estimate (https://smarthistory.org/ziggurat-of-ur/).
- The stage-2 36 × 26 m footprint and reconstructed height ~5.7 m derive
  from recorded excavation discussion (https://enenuru.net/pdfs/RlA%2014%205-6%20Uqair%20-%20Uzumua.pdf).
- Woolley's excavation account describes the front's three-stair arrangement:
  https://www.penn.museum/sites/journal/1235/.

All third-stage forms, temple, ramp geometry, and construction details in
`examples/ur/grow.py` **remain interpretive hypotheses**. Do not present these
CAD solids as surveyed or verified historical restorations.

## Executed multi-input/toolchain smoke

To exercise the real adapters without downloaded third-party assets:

1. The Ur builder reads approximate **numeric measurement claims** and grows
   a metric, explicitly speculative construction with three approach members.
2. A **separately authored** simple OpenSCAD Ur fixture compiles to STL. It
   offers known-answer synthetic source geometry in three fixed orthographic
   views, not independent archaeological evidence.
3. A **separately authored** modern Brutalist OpenSCAD source compiles to STL;
   the CAD project grows an independently expressed modular construction with
   a doorway and connected chamber.
4. The Loom's digest-checked STL adapter samples those meshes for approximate
   surface comparison. Every tested model passes the one-solid CAD and void
   gates before visual or geometric scoring.
5. Each subject runs two small epochs of mixed constructive candidates and
   records complete per-epoch receipts. The hard-reference trial remains a
   **tooling preflight** until original source files become available.

No actual Sketchfab download, OpenGameArt ZIP, DEM, or measured camera
registration appears in this trial. The ~0.96/0.999 silhouette overlaps are
against synthetic OpenSCAD controls **created from similar geometry**, not
independent verification of archaeological or Brutalist realism.

## Run

Required: CadQuery/OpenCascade, SciPy, NumPy, OpenCV, Pillow, trimesh and
OpenSCAD command-line. Only locally authored bundled `.scad` fixtures are
compiled, with a process timeout. This does not sandbox arbitrary outside code.

```bash
PYTHONPATH=. pytest -q tests/test_pair_a_first_pass.py tests/test_surface_witness.py
PYTHONPATH=. python examples/run_pair_a.py
```

The script recompiles both fixture STLs, freezes common cameras for comparisons,
checks CAD/void validity, saves per-epoch JSON receipts, and writes a comparison
sheet under `../out/pair_a/`. Red pixels denote source only, green CAD only,
and blue agreement.

## Next real-data handoff

1. Obtain **actual** CC BY model via creator's offered Sketchfab download and
   the original CC0 Brutalist `brutalism2.zip`, preserving attribution, license
   text, and download manifests with SHA-256 hashes.
2. Inspect archive safety, exact units, orientation, mesh bounds, and file count.
   Parse OpenSCAD source as an authored grammar witness without treating an STL
   as a valid CAD-solid construction. Keep original download bytes separate.
3. Establish source-to-model transforms from independent anchors. Otherwise
   retain `provisional` state and avoid claiming metric or historical accuracy.
4. Only then repeat the multi-seed paired epochs with actual external geometry
   and optional reference photographs or plans, retaining multiple viable
   alternatives and operator steering.
