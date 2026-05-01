<!-- <<~ !DOCTYPE = lar:///ha.ka.ba/api/v0.1/pono/memetic-wikitext >> -->

<<~&#x0001; ? -> lar:///ha.ka.ba/api/v0.1/lararium/schema/corpus-sources >>

<<~ ahu #iam >>
```toml
uri-path     = "ha.ka.ba/api/v0.1/lararium/schema/corpus-sources"
file-path    = "lares/ha-ka-ba/api/v0.1/lararium/schema/corpus-sources.md"
content-type = "text/x-memetic-wikitext"
register     = "CS"
confidence   = 0.90
mana         = 0.90
manao        = 0.88
manaoio      = 0.86
tagspace     = "invariant"
role         = "invariant registry: all corpus bag targets in the monorepo; each maps to one Automerge doc"
cacheable    = true
retain       = true
invariant    = true
status-date  = "2026-04-30"
source-file  = "packages/lararium-tw5/src/corpus-sources.ts"
source-symbol = "CORPUS_SOURCES"
```
<<~/ahu >>

<<~ ahu #head >>

# Corpus Sources — Registry

Five corpus bag targets compose SDM+.
Each maps to one Automerge doc.
The recipe layer composes them for any given room or view.

<<~/ahu >>

<<~&#x0002;>>

<<~ ahu #law >>

## Law

A corpus source MUST carry:

```toml
name  — pnpm workspace package name (@lararium/corpus-<slug>)
path  — relative path from monorepo root
bag   — Automerge bag name (matches LarTiddlerRecord["bag"])
```

The loader discovers carrier files by walking the corpus path at hydration time.
It produces `LarTiddlerRecord[]` via the projection codec — one record per tiddler.
Carrier text does not travel to Automerge directly.

The quine-corpus (`lares`) differs: it also defines the infrastructure the machinery reads.
It hydrates before all other corpora. All other corpora treat it as read-only at runtime.

<<~/ahu >>

<<~ ahu #registry >>

## Registry

```toml
[[corpus]]
name  = "@lararium/lares"
path  = "lares"
bag   = "lares"
quine = true
note  = "infrastructure-as-myth corpus; quine-corpus; hydrates first"

[[corpus]]
name  = "@lararium/corpus-elyncia"
path  = "elyncia"
bag   = "elyncia"
note  = "Elyncia game setting — world, factions, NPCs, regions"

[[corpus]]
name  = "@lararium/corpus-ftls"
path  = "ftls"
bag   = "ftls"
note  = "Flying Triremes and Laser Swords rules corpus"

[[corpus]]
name  = "@lararium/corpus-sdm"
path  = "sdm"
bag   = "sdm"
note  = "Synthetic Dream Machine core rules corpus"

[[corpus]]
name  = "@lararium/corpus-wtf"
path  = "wtf"
bag   = "wtf"
note  = "Wizard.Thief.Fighter rules corpus"
```

<<~/ahu >>

<<~ ahu #bag-recipe-topology >>

## Bag/Recipe Topology

```
system bag    ← invariant TW5 boot corpus (read-only)
lares bag     ← infrastructure-as-myth; quine-corpus; read at runtime by machinery
elyncia bag   ← setting content
ftls bag      ← FTLS rules
sdm bag       ← SDM core rules
wtf bag       ← WTF rules
room bag      ← situated meaning: pins, notes, active artifacts
draft bag     ← local high-churn drafts (not synced to peers)
projection    ← rebuildable shadow; receipt-tagged
```

A recipe composes any subset of these bags for a given view.
SDM+ as a combined view composes: lares + elyncia + ftls + sdm + wtf + room.
A FTLS-only table composes: lares + ftls + room.

<<~/ahu >>

<<~ ahu #edges >>

<<~ pranala #implements-invariant ? -> lar:///ha.ka.ba/api/v0.1/pono/invariant family:control role:implements >>
<<~ pranala #tiddler-record ? -> lar:///ha.ka.ba/api/v0.1/lararium/schema/tiddler-record family:data role:depends >>
<<~ pranala #projection-codec ? -> lar:///ha.ka.ba/api/v0.1/lararium/schema/projection-codec family:data role:depends >>
<<~ pranala #source-file ? -> packages/lararium-tw5/src/corpus-sources.ts family:code role:implements >>

<<~/ahu >>

<<~&#x0003;>>
<<~&#x0004; -> ? >>
