<!-- Research archive: Projection_Loom_OODA_Research_Gates.zip / Projection_Loom_OODA_Research_Gates/RESEARCH.md. Historical experimental testimony, not an active model or test fixture. -->

# OODA-HA: Projection Loom registration and evolution research gate

## Observe
Recovered paired report: 12 candidate shared re-ranking; winner #5 in both arms; IoU .74610245; line agreement .50117836. No independently evolving populations or calibrated camera. Current branch PR #84 remains unchanged.

## Orient — golden rules from prior art
1. **A registered witness is not a free parameter of candidate fitness.** Optimize camera parameters in a separate, frozen calibration stage using independent landmarks/held-out comparisons; otherwise geometry may improve by exploiting camera mismatch. Differentiable rendering and pose-estimation research shows why silhouette agreement depends on camera pose.
2. **Errors outside the reference count.** Use full-frame union-based IoU for the primary shape objective; when using weighted regions, retain a nonzero exterior loss.
3. **Feasibility is lexicographically prior to aesthetic fitness.** Boolean union and void connectivity must pass before elite selection. OpenCascade fuzzy tolerances can bridge nearly coincident geometries; preserve strict/fuzzy settings in receipts and do not silently upgrade a failed joint.
4. **Explore phenotypes, not simply genomes.** MAP-Elites archive cells encode architectural traits derived from geometry. Preserve operator-reviewable diversity and avoid single-winner collapse.
5. **No test leakage from generated views.** Self-rendered masks can serve as stability hints, but not independent objective evidence. Hold out camera views and source landmarks.
6. **Comparable computation, comparable trials.** Matched numbers of CAD evaluations, identical initial populations and random-stream controls; subsequent treatment and control lineages must evolve independently. Multiple seeds and confidence intervals before declaring a winner.

## Anti-patterns and guards
- Region masking that discards false positive geometry -> exterior-weighted union loss.
- Rubber-camera / pose-genome co-adaptation -> freeze registered camera before evolution.
- Comparing only selected candidates from the same pool -> independent evolutionary rollouts with matched budgets.
- A single seed and small sample sold as a result -> replicate paired seeds, archive all candidates.
- Fuzzy Boolean rescue promoted as sound engineering -> record tolerances and reject unapproved repairs.
- Edge glint worship -> compare low-weight orientation families and test against held-out human architectural evaluation.
- Using the same render as both fitness source and ground truth -> independent reference provenance.
- Soft scores accepting invalid solids or disconnected rooms -> hard feasibility gates.

## Decide
Do not promote edge guidance to GitHub PR #84 until calibrated and evaluated independently. Adopt the scoring and provenance preflight gates immediately as standalone test helpers.

## Act
Implemented `preflight.py`, eight deterministic unit tests, and a conservative promotion check. This is a scoring/protocol improvement, not another CAD evolution run. No PR modifications.

## Aftermath
The experimental protocol is now falsifiable. Next operational experiment: calibrate oblique camera with independently identified master-image landmarks, fix it, and run >=3 paired independent evolutionary trials with equal BRep budgets, genotype ancestry logs, held-out multi-view score, and blind sheets.

## Sources
- OpenCascade Boolean specification: https://www.occt3d.com/dev/doc/overview/html/specification__boolean_operations.html
- Mouret & Clune MAP-Elites: https://arxiv.org/abs/1504.04909
- Silhouette pose inversion: https://www.sciencedirect.com/science/article/abs/pii/S1047320320301851
