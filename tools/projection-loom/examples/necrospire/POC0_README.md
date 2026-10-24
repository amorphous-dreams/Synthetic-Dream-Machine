# Necrospire — PoC 0 (minimum illustrated reference)

This seed preserves the exact source files originally supplied by the operator.
It does **not** include a surveyed camera, ground-control points, known scale,
or any assertion that the source painting documents actual physical geometry.

| File | Type | Bytes | SHA-256 |
| --- | --- | ---: | --- |
| `source_rgba.png` | Original RGBA, 1024x1536 | 565775 | `80e1d0ee8ae4bda505c053b42ea1d1f661d71ed4c174f57c15423027872c4f89` |
| `source_alpha_8bit.png` | Independent archived L8 mask, 1024x1536 | 57579 | `78f8d1f0cf44a98b748054ae8b5c8f2229c1354696a8e1173963a7c98bc4fbe7` |

The PNG RGBA alpha and L8 mask agree at **every pixel**. The current project
uses the L8 mask to rank silhouettes and retains RGBA as the independent visual
witness for forthcoming edge/region comparisons. The locked oblique camera
holds a fixed experimental viewport but remains **unverified** against artwork.

The constructive genome governs a root crystal, fortress masses, joining
members, and three carved empty spaces. All proposed models must pass full
OpenCascade single-body/void audits before their image losses can enter any
selection. This PoC intentionally gives the topology grammar only a few authored
choices: its 4 finalists may differ only in dimensions, not overall form.

```sh
python -m projection_loom ooda-run \
  --project examples/necrospire/project.json \
  --out out/poc0 --passes 5 --candidates 12 \
  --exact-budget 8 --detail-budget 5 --control full-speed --seed 20261023
python -m projection_loom ooda-finalists \
  --project examples/necrospire/project.json --epochs out/poc0 \
  --out out/poc0-final --count 4 --size 384 576
```

PoC 0 local experiment receipt (2026-10-23): 5 completed epochs, 60 proposals,
40 exact audits, 25 scored CAD-valid constructions, and 4 diversity-separated
regrown final models (all exported as STEP, OBJ, mesh, and views). Best
provisional silhouette loss: 0.285943. This does not demonstrate calibrated
reconstruction or unrestricted topology innovation. The output of a prior
experiment should not be used as a new independent ground-truth image.
