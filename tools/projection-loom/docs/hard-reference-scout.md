# Hard-reference scout — PoC 0 and next reference trials

This record separates **verified source metadata** from **local data possession**.
A published downloadable model is not necessarily a metric scan, a watertight
CAD body, or a license to use it as an AI-generation input. All of these need
independent review before ingestion. This shortlist remains provisional until
the Operator selects two references in the talk-story floor.

## Contenders and source links

| Candidate | Concept | Source type | Source license | Assessment |
| --- | --- | --- | --- | --- |
| [Ziggurat of Ur / Lagash Project](https://sketchfab.com/3d-models/ziggurat-of-ur-01a917691d344f3d801f67151de6b2f0) | Sumerian | Actual Penn Museum Lagash 2021 drone photogrammetry, 1.9M triangles, downloadable | CC BY-NC | **Strong scan baseline**, terraced geometry, actual monument; download and commercial/AI rights need checking |
| [E-dub-lal-mah at Ur](https://web.sas.upenn.edu/lagash/2021/12/30/the-e-dub-lal-mah-at-ur/) | Sumerian | Lagash drone scan, public simplified Sketchfab | inspect model license | Smaller structure and possible control for the Ziggurat; archive source not yet inspected |
| [Ur Ziggurat stylized asset](https://www.fab.com/listings/8eb88c31-30fe-4242-bb33-6f28430b476a) | Sumerian | Game-ready modular source, FBX/GLB | Fab license, **AI use prohibited** | Architectural examples only; do not ingest as generative source |
| [Ur reference modeling package](https://www.artstation.com/marketplace/p/DnYek/ziggurat-of-ur) | Sumerian | Paid STL/OBJ/PLY/DXF/GLB + procedural Blender | Paid extended commercial | Strong CAD-format variety; not measured evidence, licensing requires purchase |
| [Brutalist architecture models / nosycat](https://opengameart.org/content/brutalist-architecture-models) | Brutalist | Small source OpenSCAD scripts plus STL packs | **CC0** | **Strong reproducibility/control baseline**; stylized authored architecture, not real site survey |
| [Barbican Estate Model / artfletch](https://sketchfab.com/3d-models/barbican-estate-model-a7d82450d00b49d1b5ffeab759e28a46) | Brutalist | 340-photo photogrammetry of a **1:22 architectural scale model**, ~318k triangles | CC BY | Promising geometric hierarchy, but a scan of a physical model—not a surveyed full-size estate |
| [Barbican Estate / mohamedhussien](https://sketchfab.com/3d-models/barbican-estate-and-barbican-centre-5728720dc00d4dbebebee83125f68299) | Brutalist | Downloadable 460k-triangle scene | CC BY | Useful scene-scale composition; data provenance/metric quality unverified |
| [Brutalist concrete TriCorner / Kilstrup](https://sketchfab.com/3d-models/building-brutalist-tricorner-a0923ae832474539bc856a8c6d3acc00) | Brutalist | Modular authored 586k-triangle 3D asset | CC BY-NC plus third-party texture restrictions | Design grammar reference, not scientific measurement |
| [Future Brutalism kit / Vishchun](https://sketchfab.com/3d-models/future-brutalism-c9043d3066954260aef09877526f5b16) | Brutalist | ~20k-triangle modular environment kit | CC BY | Lightweight generative assembly, non-metric |
| [Øm Jættestue Passage Grave / Balabanian](https://sketchfab.com/3d-models/passage-grave-m-jttestue-denmark-fe5da7d5202a4bfaa6b48e0096d4c6fd) | Megalithic | 610-image RealityCapture survey, indoor passage+chamber, 100k triangles; **[Zenodo 4.9 MB GLB mirror](https://zenodo.org/records/10303394)** | CC BY | **Strong navigable-void reference**; supports outside/inside/door/room distinctions |
| [Dólmen do Rapido III](https://sketchfab.com/3d-models/dolmen-do-rapido-iii-4210a4d4822c42be88afa4facd6f0ad1) | Megalithic | DJI Mini2 photogrammetry, ~1.9M triangles | CC BY | Chamber/corridor topology, heavier data; metric registration unverified |
| [Stonehenge laser-scan report](https://historicengland.org.uk/research/results/reports/32-2012) | Megalithic | Professional 2011 survey and public archaeological analysis | Source scan not openly located | Valuable standards/ground truth, **report alone does not supply downloadable scan geometry** |
| [Çatalhöyük North Area / OpenHeritage3D](https://www.openheritage3d.org/project.php?id=0xe0-7v64) | Neolithic (adjacent category) | Published ~5.7GB terrestrial LiDAR | project-specific CC license | Massive real building-void dataset; too heavy for first PoC baseline |

## Provisional pair by *method coverage*

1. **Ziggurat of Ur:** real aerial-photogrammetry of stepped Sumerian architecture, with a rights caveat (CC BY-NC). Validate mesh unit/scale/orientation before claiming metric evidence.
2. **CC0 Brutalist OpenSCAD/STL collection:** small and reproducible, allows grammar reconstruction versus exact procedural inputs. Does **not** prove real-site photogrammetric accuracy.

## Alternative pair by *architectural relations*

1. Ziggurat of Ur, as above.
2. Øm Passage Grave, for negative-space and circulation inference, with actual interior capture. Both sources use image-derived surface reconstruction rather than executable CAD grammar.

The Øm source also has an unusually easy directly published GLB (Zenodo DOI 10.5281/zenodo.10303394). The current Loom surface-witness adapter accepts digest-checked GLB and OBJ scenes as sampled evidence, not as CAD solids. Neither pair is operator-locked. The Operator may prioritize either complementary
methods (scan + parametric source) or complementary architecture (terrace + chamber).

## Ingestion boundary

These linked datasets have NOT been downloaded into the repository. The
source-archive links sometimes require a service login; OpenHeritage3D
requires an emailed download link and regularly contains multi-GB sets.
Credit authors, preserve license metadata, and avoid distributing BY-NC or
NoAI datasets under an incompatible license. Meshes enter as witness evidence,
not as already-valid construction solids.
