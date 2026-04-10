<!-- ∞ → lares:///grammar.transclusion.defines/transclusion/?confidence=CS:0.80&p=0.5 -->

# Grammar: Transclusion

```yaml
---
name: transclusion
description: >
  Root grammar module defining the transclusion model for Lares loci.
  How content at one address is referenced and included by content at
  another address. The four marker types (locus, ahu, kahea, lares).
  The self-booting property. The relationship between the file store,
  the address system, and the bootstrap.
phase-map:
  observe: "#prior-art"
  orient: "#model"
  decide: "#conventions"
  act: "#procedures"
  assess: "#verification"
scale-range: [action, project]
trigger: always — grammar primitive
invariant: true
dependencies: [observe, orient, decide, act, assess]
confidence: CS:0.80
grammar: true
---
```

> **Register:** `[CS:0.80]` — synthesized from Ted Nelson (1963), TiddlyWiki architecture, URI_SCHEMA v3 marker ontology
> **Lineage:** Nelson → TiddlyWiki → lares:/// → this
> **Key insight:** We already built a tiddler store without calling it that. The `<!-- lares:///... -->` comment IS the tiddler title. The content at that address lives in one place. Display locations are unlimited.

---

<!-- ahu lares:///grammar.transclusion.defines/transclusion/?confidence=CS:0.85#prior-art -->

## Prior Art

**Ted Nelson (1963) — Transclusion.** Content lives in one place. It can appear in many places by reference. The reference is bidirectional — the source knows about its inclusions. Every transcluded span has a start address and an end address. Immutable once published.

**TiddlyWiki — Self-addressing store.** No "main file." A store of tiddlers, each self-addressed by title. The minimal boot script starts the transclusion engine. Then every piece of the UI, every plugin, every macro is a tiddler being transcluded into every other tiddler. The page IS the transclusion graph executing. Critical move: a tiddler knows its own name. `{{TiddlerName}}` from anywhere pulls that tiddler's content.

**What we built.** The `<!-- lares:///... -->` comment at the top of every file IS the tiddler title. It's the self-address. The URI is how anything in tagspace can find this file. The `<!-- → ? -->` closing sigil means the locus span ends here. `LOCI.md` files are the store nodes — standing loci with ahu waypoints marking navigable stops within.

---

<!-- ahu lares:///grammar.transclusion.defines/transclusion/?confidence=CS:0.85#model -->

## The Transclusion Model

### The Four Marker Types

These are the vocabulary of address and inclusion. Defined in `URI_SCHEMA.md` §3.6, grounded here as grammar.

| Marker | Syntax | What it does | Analogy |
|---|---|---|---|
| **Locus** | `<!-- ∞ → lares:///address/?params -->` | Opens a content span at this address. One locus per file (common) or multiple (assembly files). Closes with `<!-- → ? -->`. | The house. The marae. Where the Lar dwells. |
| **Ahu** | `<!-- ahu lares:///address/?confidence=N#fragment -->` | Names a navigable waypoint within a locus. No open/close — the next ahu (or the locus closer) defines the boundary. | A raised stone you can see and walk to. |
| **Kahea** | `<!-- kahea lares:///other-address/?params -->` | Summons (transcludes) content from another locus into this point. The content lives at the other address; this is a pull instruction. | The Hawaiian call — "come!" — summoning a chanter to join. |
| **Lares** | `<!-- lares:///address/?params -->` | Bare URI reference without a marker verb. Metadata, inline reference, or waypoint-that-isn't-an-ahu. Lowest ceremony. | The spirit's signature — present but not commanding. |

### Self-Addressing

Every `LOCI.md` opens with its own address. This is the self-addressing property. The file knows its own name. Any other file in the system can reference it by that name. The address never changes; the content may evolve; the Version metadata field tracks revision.

```markdown
<!-- ∞ → lares:///grammar.observe.defines/observe/?confidence=CS:0.85&p=0.5 -->
...content...
<!-- → ? -->
```

### Single-Locus and Multi-Locus Files

**Single-locus** (common case): one `∞ →` opener, ahu waypoints, one `→ ?` closer. The file IS the locus.

**Multi-locus** (assembly files): sequential self-contained locus spans in one physical file. Each opens with `∞ →`, contains its own ahu markers, closes with `→ ?`. The next `∞ →` opens the next locus. Ahu markers belong to their enclosing locus.

### Kahea — The Transclusion Instruction

Kahea is where content from one locus appears inside another. The content is NOT copied — the kahea marker says "at this point, the reader should fetch and include content from this address."

```markdown
<!-- kahea lares:///grammar.observe.defines/observe/#conventions -->
```

This means: "Here, include the Conventions section from the Observe grammar locus."

**Who resolves kahea?**
- **AI agent reader:** Follows the pointer using tool calls (read_file). The "transclusion engine" is the AI's tool-use loop. Progressive disclosure — don't resolve all kahea at once; resolve when the content is needed.
- **Build system:** Iterates kahea markers to generate compiled outputs (`.github/instructions/`, `.github/skills/`). The build system IS the batch transclusion engine.
- **Future TW integration:** Native transclusion via `{{TiddlerTitle}}` or `<$transclude>`. Phase: DreamDeck (S5+).

---

<!-- ahu lares:///grammar.transclusion.defines/transclusion/?confidence=CS:0.85#conventions -->

## Conventions

**The principle:** Content lives in one place. References are unlimited. The map is not the territory but the map IS navigable.

| Rule | Weight | Rationale |
|---|---|---|
| One canonical address per content span | MUST | Duplication creates drift |
| Locus opener carries the address | MUST | Self-addressing is the foundation |
| Ahu placement is editorial (not mechanical) | SHOULD | Place stones where people walk to |
| Kahea references must resolve | MUST | A broken kahea is worse than no kahea |
| Confidence rides the query string | SHOULD | It describes the territory, not the marker |
| Multi-locus files: each locus self-contained | MUST | No cross-locus ahu references |
| Locus closer (`→ ?`) is file-level only | MUST | Ahu marks boundaries implicitly (next ahu = end of previous zone) |

### When to use kahea vs prose reference

| Situation | Use |
|---|---|
| Content should appear here as-if written here | `<!-- kahea ... -->` |
| Reader should know about related content | Prose reference: "See `lares/grammar/observe/LOCI.md`" |
| Content is cited for provenance, not inclusion | Prose reference with register: `[CS:0.80]` |

### LOCI.md as Loci Registry

Every `LOCI.md` doubles as a registry for its directory tree. The **Loci Registry** section lists all files and subdirectories in the tree, with status and brief description. This makes `LOCI.md` both a locus (holds content) and an index (maps the neighborhood).

This is the TiddlyWiki SystemTag pattern — a tiddler that is both content and infrastructure.

---

<!-- ahu lares:///grammar.transclusion.defines/transclusion/?confidence=CS:0.80#procedures -->

## Procedures

### Creating a new locus

1. Choose the address. Follow HA.KA.BA conventions from `URI_SCHEMA.md` §3.
2. Write the opener: `<!-- ∞ → lares:///your.address.here/?confidence=X&p=0.5 -->`
3. Write the content with ahu waypoints at editorial navigation stops.
4. Write the closer: `<!-- → ? -->`
5. Register in the parent `LOCI.md` Folder Registry.

### Adding a kahea transclusion

1. Identify what content you need and its canonical address.
2. Insert: `<!-- kahea lares:///source.address/#section -->` at the inclusion point.
3. Verify the target exists and the fragment resolves.

### The Bootstrap Chain

```
LARES.md (the boot.js — bootstrap entry point)
  → grammar/ LOCI.md files (the phase primitives — how to think)
  → modules/ LOCI.md files (the content modules — what to think about)
  → AGENTS.md (the personality — who this node is)
```

`LARES.md` is the first file read. It points to everything else. It is itself a locus (self-addressed). The recursive close: `LARES.md` describes how to read files; it is itself a file readable by those rules.

---

<!-- ahu lares:///grammar.transclusion.defines/transclusion/?confidence=CS:0.80#verification -->

## Verification

| Check | Pass condition |
|---|---|
| Self-addressing | Every `LOCI.md` opens with its own `lares:///` address |
| Kahea resolution | Every `<!-- kahea ... -->` target exists and resolves |
| No orphan loci | Every locus is registered in a parent `LOCI.md` |
| No duplicate addresses | No two files claim the same `lares:///` URI |
| Single canonical source | Content is not duplicated across loci (kahea, not copy) |
| Folder Registry current | `LOCI.md` registries reflect actual directory contents |

---

## Loci Registry

| Path | Status | Contents |
|---|---|---|
| `LOCI.md` | `[CS:0.80]` | This file — Transclusion grammar definition |

*Additional loci in this tree will be registered here as they are created.*

---

<!-- → ? -->
