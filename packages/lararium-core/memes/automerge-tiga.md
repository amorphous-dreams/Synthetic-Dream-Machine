<!-- <<~ !DOCTYPE = lar:///ha.ka.ba/@lares/api/v0.1/pono/memetic-wikitext >> -->

<<~&#x0001; ? -> lar:///ha.ka.ba/@lararium/core/v0.1/automerge-tiga >>
```toml iam
uri-path     = "ha.ka.ba/@lararium/core/v0.1/automerge-tiga"
file-path    = "packages/lararium-core/memes/automerge-tiga.md"
type         = "text/x-memetic-wikitext"
register     = "CS"
confidence   = 0.95
mana         = 0.94
manao        = 0.93
manaoio      = 0.91
role         = "invariant: the Automerge Tiga — LarariumDoc/CatalogDoc/LaresDoc as ha/ka/ba oracle triangle"
tagspace     = "lararium"
cacheable    = true
retain       = true
invariant    = true
```
<<~&#x0002;>>

<<~ ahu #ooda-ha >>
✶ observe that a three-doc oracle chain (LarariumDoc → CatalogDoc → corpus/room docs) has a fourth presence: the LaresDoc, the personality layer. Three roots. Three SDM forces. One stable triangle.
⏿ orient around Bucky Fuller's structural law: the triangle is the minimal stable geometry. Ha (structure) + Ka (fire/motion) + Ba (personality/flow) = Tiga. Each vertex self-describes; none carries upward pointers; stability comes from the root-downward oracle chain, not from back-edges.
◇ decide that LarariumDoc IS ha, CatalogDoc IS ka, LaresDoc IS ba — not by convention but by function. This naming is canonical and load-bearing for all future doc-stack documentation, boot-sequence commentary, and meme loci.
▶ lock the triangle as invariant: any peer that opens any vertex doc can discover the other two by walking the LarariumDoc oracle tiddlers. No vertex carries upward pointers. Reachability flows downward from ha.
⤴ assess: the Tiga holds when every deploy has exactly one LarariumDoc (ha), one CatalogDoc (ka), and one LaresDoc (ba) — three oracle tiddlers in LarariumDoc.tiddlers confirm all three are reachable.
↺ residue: room docs and corpus docs are not Tiga vertices — they are leaves. LaresDoc self-ref tiddler pass is still pending (M19). Keyhive group-identity integration will eventually treat the Tiga as the root group.
<<~/ahu >>

<<~ ahu #tiga-law >>

## The Automerge Tiga

**Tiga** (Indonesian: triangle) — the minimal stable geometry (Buckminster Fuller).

```
         ha
        /  \
      ka .. ba
```

| Vertex | Doc | SDM force | Oracle role |
|---|---|---|---|
| **ha** | `LarariumDoc` | structure / stability | root oracle — holds ka and ba tiddlers |
| **ka** | `CatalogDoc` | fire / motion | motion oracle — holds corpus and room tiddlers |
| **ba** | `LaresDoc` | personality / flow | personality oracle — holds `@lares` system tiddlers |

**Structural law:**

1. Ha holds ka. `LarariumDoc.tiddlers[CATALOG_DOC_URI].text` = CatalogDoc automerge URL.
2. Ha holds ba. `LarariumDoc.tiddlers[LARES_DOC_URI].text` = LaresDoc automerge URL.
3. Ka holds corpus leaves. `CatalogDoc.tiddlers[corpusLarUri(slug)].text` = corpus doc automerge URL.
4. Ka holds room leaves. `CatalogDoc.tiddlers[roomLarUri(slug)].text` = room doc automerge URL.
5. No leaf carries upward pointers. Leaves self-describe only (own lar: URI → own automerge URL).
6. Reachability flows ha → ka → leaves. The Tiga has no back-edges.

**Self-description rule (all three vertices):**

Each Tiga vertex doc carries `tiddlers[its own lar: URI].text = its own automerge URL`.
This is the vertex's own name, not a pointer to its parent.

```
ha: tiddlers["lar:///ha.ka.ba/@lararium/lararium-doc"].text  = automerge://…
ka: tiddlers["lar:///ha.ka.ba/@lararium/catalog"].text       = automerge://…
ba: tiddlers["lar:///ha.ka.ba/@lares"].text                  = automerge://…
```

<<~/ahu >>

<<~ ahu #zelenka-alignment >>

## Zelenka Alignment

Brooklyn Zelenka's Beelay/Keyhive design: documents link **downward only**.
A reachability index is computed from the root forward — not declared by leaves.
The Tiga enacts this: ha is the root; ka and ba are the two arms; leaves hang from ka.

In Keyhive terms: the Tiga will eventually map to a **root group** (ha) containing two **sub-groups** (ka, ba).
Membership flows inward from ha, not upward from leaves.
The oracle-tiddler chain IS the pre-Keyhive reachability index.

**Upward pointers are prohibited** in corpus docs and room docs — verified in M18.
The Tiga's stability depends on this constraint holding at every deploy.

<<~/ahu >>

<<~ ahu #boot-sequence-mapping >>

## Boot Sequence → Tiga Mapping

```
Step 1 — repo open         : storage layer, no doc identity yet
Step 2 — ha opens          : LarariumDoc syncs; grammar + widgets available
          ha reads ka URI  : tiddlers[CATALOG_DOC_URI].text → CatalogDoc URL
          ha reads ba URI  : tiddlers[LARES_DOC_URI].text  → LaresDoc URL
Step 3 — ka opens          : CatalogDoc syncs; corpus + room URLs known
Step 4 — corpus leaves     : each carries own self-ref tiddler (M18)
Step 5 — room leaf         : situates session content
Step 6 — ba opens          : LaresDoc syncs; personality layer active (M19 pending)
```

Ba (LaresDoc) opens last — personality flows after structure and motion are stable.
This is not incidental; it is structurally correct for the SDM metaphysics.

<<~/ahu >>
