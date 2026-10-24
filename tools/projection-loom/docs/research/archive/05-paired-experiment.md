<!-- Research archive: Projection_Loom_OODA_Paired_Experiment.zip / paired_ooda/REPORT.md. Historical experimental testimony, not an active model or test fixture. -->

# Projection Loom — paired evidence experiment / OODA-HA

## Experimental design
Twelve identical saved genomes were passed through the same CAD construction, fused-solid audit, oblique silhouette and semantic-line renderer. Control A ranks by full-image silhouette loss (1-IoU). Treatment B ranks by the same loss plus `0.08 * (1-mean(zone-line-agreement))`. Sources are the preserved Necrospire RGBA and exact alpha files. Random seed: 20261023. Image comparison resolution: 128 x 192.

## Result
All twelve constructed candidates passed the current audit. The two scoring arms selected the **same candidate #5**. Its full-frame silhouette loss was 0.25389755 (IoU 0.74610245), mean line agreement 0.50117836, and combined ranking objective 0.29380328. Thus no measurable selection improvement was demonstrated for this candidate set.

## Critical caveats
* This is a **shared-population paired re-ranking**, not two independently evolving populations. Follow-up mutations/epochs have not been run.
* Source and CAD output occupy same raster dimensions, but independent camera-registration parameters were not calibrated. Treat visual scores as exploratory, not externally validated architectural agreement.
* The evidence module's zone silhouette score weights only source-mask pixels. It can falsely ignore extraneous model silhouette outside the source. The comparison script therefore uses full-frame IoU as the primary objective. Repair the region metric before promotion.
* Edge gradients can track illumination, color seams or magical effects, not solely constructive features. The edge score remains experimental and does not enter the active PR.
* Void claims are tested by assembly audit; no character-navigation clearance proof has been added.

## Decision
No promotion of edge-guided evolution yet. Correct region scoring, register camera, then run actual paired closed-loop evolution with repeated fixed-seed trials and blinded architecture review. PR #84 was not modified.
