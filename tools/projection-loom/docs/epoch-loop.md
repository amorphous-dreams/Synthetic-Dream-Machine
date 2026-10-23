# Epoch loops

`projection-loom epoch-loop` evolves an asset through a sequence of complete geometry, rendering, and feedback passes. Each pass preserves the model, scored search history, the four render-control modalities for every configured camera, and a feedback receipt. The command keeps a fixed external reference while allowing the accepted output to seed the next pass.

## Five-pass run

```bash
projection-loom epoch-loop \
  --project path/to/project.json \
  --seed-geometry path/to/existing_mesh.npz \
  --out out/epoch-run \
  --passes 5 \
  --burst 64 \
  --survivors 10 \
  --offspring 8 \
  --cycles-per-epoch 1 \
  --feedback-weight 0.12
```

The `--project` declares the cameras, source masks, optional color reference, and geometry builder or seed mesh. The `--seed-geometry` option imports an exact existing mesh and takes precedence over a project's model only for this run. It preserves native face/material/edge/part metadata when supplied in NPZ format. If the project already declares `geometry`, `--seed-geometry` can be omitted.

The default `--handoff mesh` carries the accepted geometry into the next pass, with the next pass's deformation controls centered on that held mesh. `--handoff parametric` carries the previous parameter checkpoint back into a procedural builder without replacing the underlying builder mesh. Direct geometry seeds cannot use parametric handoff.

Use `--resume` with the same configuration to continue after a completed checkpoint, including increasing `--passes` to extend a finished run. An incomplete epoch remains on disk under an `interrupted` name when a resumed run encounters it. Saved results are not silently overwritten.

## Evidence and feedback

The engine reads all four control outputs from each configured camera:

| Control pass | Use in the following epoch |
|---|---|
| `silhouette` | Low-weight secondary target in geometry evolution; compared against the new projection |
| `structure` | Stroke-coverage similarity and acceptance check |
| `lit` | Coarse tonal consistency and acceptance check |
| `lit_structure` | Combined tonal-and-linework consistency and acceptance check |

The new candidate inherits the previous **accepted** mesh, not a discarded candidate. A fixed project target retains priority over generated feedback; if the project provides no target, the runner freezes the initial silhouette controls as immutable anchor references. Internally generated views cannot independently confirm unseen geometry, so linework and lighting comparisons serve as stability checks rather than ground truth.

A new candidate enters the lineage only when its score against the fixed reference stays within the configured evidence tolerance and the four-pass consistency score exceeds the threshold. Rejected candidates remain in their directories for inspection; the following pass restarts from the previous accepted geometry and control set.

The CLI handles changes in evaluation random seed per pass, maintains a stable camera frame, checks projected components and multipart contact groups, and records exact input paths and SHA-256 hashes for each geometry handoff.

## Directory contract

```text
out/epoch-run/
  anchor/
    mesh.npz
    mesh.obj
    controls/{VIEW}_{silhouette,structure,lit,lit_structure}.png
    manifest.json
  epoch_01/
    candidate/
      mesh.npz
      mesh.obj
      controls/*.png
      manifest.json
      search.json
    feedback.json
  epoch_02/
    ...
  epoch_03/
    ...
  epoch_04/
    ...
  epoch_05/
    ...
  state.json
  manifest.json
```

`state.json` commits a pass only after all required candidate and feedback receipts exist. `manifest.json` names the final accepted mesh and controls. Every pass exports at `--export-size` independently of the lower `--fitness-size`, so the resulting controls remain usable as illustration references.

## Boundaries

The pipeline reports projection connected-components and approximate multipart contacts. A single connected silhouette is not proof of a fused, watertight or manifold model. Direct mesh re-entry deforms the vertices of the imported geometry without adding surfaces or inventing missing architecture. A fixed oblique photograph can inform coarse directional lighting, but does not uniquely determine 3D surface geometry.
