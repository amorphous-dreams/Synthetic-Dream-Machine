# Fracture-pattern capability · reusable scientific prior

This is an independently useful generation capability, not yet a structural
damage or physically predictive collapse solver. Every output is bounded by
image pixels, tessellation cells, fragment count and minimum fragment size.
Its 2D synthetic crack network, junction degrees and sampled finite fragment
populations can inform later CAD-detail operators without contaminating the
current base Necrospire genome.

Primary sources:
- Emmanuel Villermaux, Fragmentation: Principles versus Mechanisms,
  Physical Review Letters 135, 228201 (2025), DOI 10.1103/r7xz-5d9c.
  Under specified randomness/conservation assumptions, fragment number-size
  distributions follow dimension-dependent power laws with cutoffs.
- Gabor Domokos et al., Plato's Cube and the Natural Geometry of Fragmentation,
  PNAS (2020), DOI 10.1073/pnas.2001037117.
  Natural fragment geometry exhibits statistical shape attractors.
- Silver et al., Decoding Planetary Surfaces by Counting Cracks,
  PNAS (2025), DOI 10.1073/pnas.2411738122.
  Junction topology provides insight into 2D fracture histories.

Run a reproducible synthetic prior and its digest-bound PNG:

    cd tools/projection-loom
    python -m projection_loom fracture-pattern --out out/fracture-example \
      --size 128 192 --cells 36 --dimension 3 --fragments 64 \
      --min-size 1 --max-size 64 --seed 41

The sampled fragment-size spectrum uses a truncated inverse CDF, not a
guarantee that each morphology fits the paper's applicable regime.
The crack field uses a bounded Voronoi cell tessellation, optional anisotropy,
and scikit-image skeletonization. Junction observations count clustered
degree-3 and degree-4+ raster nodes, deliberately NOT invented causal T/Y/X
labels. Detailed path propagation under loads requires a separate,
independently validated physical model.

Installed core dependency: scikit-image. Optional package extras are
fragment-geometry (manifold3d), inspection (PyVista), and stress-research
(scikit-fem + meshio). Their availability and licensing should be verified
under the deployment environment before adoption as a native evidence
authority. None is allowed to bypass CadQuery BRep/void or hybrid attachment
audits. Their library versions will be captured by the existing CI environment
receipt and hash of the active construction/runtime implementation.

The ruin event DAG, destructive CAD partitioning, material disposition and
repair remain explicitly post-base capabilities; no such structural effects
are claimed by this statistical pattern generator.
