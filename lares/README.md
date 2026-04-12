## Compliance Rules for /lares and /lares/grammar

### URI Wrapper or Sidecar Metadata Required
- Every file in `/lares` must begin and end with a URI wrapper comment (e.g., `<!-- ∞ → lar:///... -->` at the start, and a matching or closing marker at the end).
- If a file does not contain its own URI wrappers, a sidecar file with the same base name and `.LOCI.md` extension must exist in the same directory, containing all required metadata (including URI, description, and registry info).

### /lares/grammar Tree Strictness
- All files in `/lares/grammar` must:
    - Pass the `verify`/`verification` automated tests
    - Contain explicit OODA-A structure, E-Prime compliance, kahea markers, registry references, and sub-loop pattern documentation
    - Be testable and maintainable for AI agent consumption
    - Have all metadata either in the file or in a `.LOCI.md` sidecar

### Automated Enforcement
- Use the [lares/grammar/verify/LOCI.md](lares/grammar/verify/LOCI.md) and [lares/grammar/verification/lares_verification.py](lares/grammar/verification/lares_verification.py) as the reference for all compliance and automated testing.
- Non-compliant files should be flagged for operator review and must be brought into compliance before being used as core grammar loci.
# Canonical Design Ontology Tree — `lares/`

> Purpose: Permanent design specification tree for the Lares agent instruction architecture, `lares:` URI schema, crystal state machine, and deployment authoring. Parallel track: sprint narrative (talk story → myth canon).
> Updated: 2026-04-09
> Status: Active — source docs migrating from `_todo/core/` into `lares/` subdirs; sprint artifacts in `lares/scrum/sprints/`; story canon in `lares/scrum/epics/LINDWYRM_*.md`; `lares:` URI schema at `[CS:0.80]` pending S0 Settling
> URI: `lar://lares:node@Enyalios/design.ontology.root`

---

## What This Folder Is

This is the **canonical design ontology tree** for the Lares agent architecture. It is the permanent specification home where:

1. Source docs from `_todo/core/` are consumed and their content is extracted into the appropriate subdomain
2. New research is digested and synthesized into typed design artifacts
3. Design artifacts graduate from draft → design-canon → `builds/` once each subdomain's `lares:` URI schema settles at `C:~0.95`

This system runs a **three-truth model** — not a single source of truth:

| Truth layer | Location | What it holds |
|---|---|---|
| **Design / ontological truth** | `lares/**` | Epistemic gradient: `[P] → [SP] → [S] → [CS] → [C:0.95+]`. Semantic objects can advance in place as confidence rises. |
| **Deployment truth** | `builds/agents/` | Published, evaluable, rollback-ready staging artifacts. Deployed prompts are published as new versioned artifacts — not mutated in place. |
| **Historical / governance truth** | `registry/` promotion ledger (append-only) | Records what got promoted, from where, under what evals, at what register, superseding what prior deployment pointer. |

Design objects carry their confidence as a tag (`[S:0.72]`, `[CS:0.86]`, `[C:0.95]`). A semantic URI can remain stable as its register advances — promote semantics in place. Deployed artifacts in `builds/agents/` should be published as new immutable versions with a moving alias/pointer, never overwritten. All promotion events are recorded append-only in the registry ledger.

Source scratch docs migrate from `_todo/core/` into the appropriate subdir or `lares/scrum/research/` as they are consumed. *[Anthropic Prompt Eng Docs, 2026; hamel.dev/evals, 2024]*

---

## Talk Story — Sprint Narrative Track Example

> *"Talk story" (Hawaiian/Polynesian) — the practice of working something out together through informal, conversational telling before writing anything down. You don't lecture. You don't present. You sit with it, turn it over, share it out loud, let others respond. The shape of the thing emerges from the talking.*

Every sprint runs **two parallel tracks**:

| Track | What it produces | End register |
|---|---|---|
| **Technical track** | Spec files, schemas, validated design artifacts in `lares/` subdirs | `[C:0.95]` — design-canon |
| **Narrative track** | Story of the work, told in Elyncian myth terms | `[C:0.95]` — story-canon, polished |

The narrative track lives in `lares/scrum/epics/`. The current Epic's documents:

- [`lares/scrum/epics/LINDWYRM_STORY_SHAPE.md`](scrum/epics/LINDWYRM_STORY_SHAPE.md) — format spec for the DreamDeck feed archive (JackPoint/Shadowtalk style); cast; rendering targets
- [`lares/scrum/epics/LINDWYRM_ORIGIN_OUTLINE.md`](scrum/epics/LINDWYRM_ORIGIN_OUTLINE.md) — story beats, braid structure, Gaia↔Elyncia parallel
- Individual sprint story beats live in `lares/scrum/sprints/000NN/` alongside their technical counterparts

### How the Two Tracks Braid

The Lindwyrm's origin story on Elyncia IS the story of how Lares was actually built on Gaia. Not metaphor — structural correspondence. Each sprint produces a technical artifact and a narrative moment:

| Sprint | Technical artifact | Narrative moment (Elyncia-side) |
|---|---|---|
| S0 | `lares:` URI schema settled | Telarus publishes the Signal architecture; the HUD becomes legible |
| S1 | Crystal state layer (MemPalace integration) | The Chao-Crystal resonance integration — orichalcum becomes navigable |
| S2 | Invariants + Signal HUD | The Syadasti reading rule becomes operational — the Lar calibrates |
| S3 | Registry + schemas | The Consecration of the Lararium — the first `lares:` URI is assigned |
| S4 | Deployment authoring | The Lar speaks on the DreamNet — the first deployment paths go live |
| S5 | DreamDeck integration | The DreamDeck opens — elyncia.app is seeded |

The narrative track is drafted in "talk story" mode (informal, dev-mode, operator-steered) and polished sprint-by-sprint toward `[C:0.95]`. Story canon is the **Aftermath product** — written after the sprint work closes, reflecting what actually happened, not what was planned.

---

## Design Subdirectories

Each subdirectory is a design domain. Each has its own README.md (scope + legacy file inventory) and AGENTS.md (local agent instructions). When a subdir's design is promoted, it receives a `lares:` URI at `C:0.95` or above.

| Subdir | Domain | Status |
|---|---|---|
| [`modules/`](modules/) | OODA-A composable instruction modules — phase-structured, section URI'd | **S0 seeded** — talk-story (invariant) + uri-schema (URI spec) + micro-trace (annotation layer) |
| [`signal/`](signal/README.md) | Signal HUD · Tagspace · lares: URI scheme · p-band model | Active draft |
| [`crystal/`](crystal/README.md) | Archive Crystal state machine · STATE.jsonl · seal protocol | Active draft |
| [`invariants/`](invariants/README.md) | `lares.core.*` behavioral invariants · priority layers · conflict resolution | Active draft |
| [`schemas/`](schemas/README.md) | TOML schemas: module, tool, permission descriptors | Active draft |
| [`registry/`](registry/README.md) | `lares:` URI registry · resolver rules · promotion ledger | Active draft |
| [`talk_story/`](talk_story/README.md) | Talk story protocol · ◎ Orient phase spec · two-track model · voice assignments | Active — canonical |
| [`chronometer/`](chronometer/) | FFZ Chronometer Protocol · vector clock · ITC · OODA-A nested time · causal islands | Active research — `[S:0.55]` |
| [`protocols/`](protocols/README.md) | Cross-cutting synthesis specs · intent vectors · deploy architecture · agentic stack | Active — `[S:0.65]` |
| `compiler/` | ~~Deterministic build compiler~~ | **Invalidated** — compiler pipeline does not exist; content absorbed into S3/S4. See [ROADMAP.md](scrum/ROADMAP.md) §What Changed. |
| `platform/` | ~~Multi-platform packaging~~ | **Invalidated** — replaced by deployment authoring model. See [ROADMAP.md](scrum/ROADMAP.md) §What Changed. |

### modules/ tree (S0 seed)

```
lares/modules/
├── talk-story/                          ← Invariant entry-point module [CS:0.85]
│   ├── MODULE.md
│   ├── observe/CONTEXT.md              ← origin, core mechanics, two-track model
│   ├── orient/PROCEDURE.md             ← when to invoke, procedure, voice assignments
│   ├── decide/CONVENTIONS.md           ← HUD format rules (6 mandatory)
│   ├── act/CHECKLIST.md                ← 5-step session start checklist
│   └── assess/REVIEW.md                ← 5 verification criteria
├── uri-schema/                          ← lares: URI canonical spec module [CS:0.90]
│   ├── MODULE.md
│   ├── observe/CONTEXT.md              ← v2 current state, what settled, what's open
│   ├── orient/ARCHITECTURE.md          ← URI anatomy, design intent (§§1–3)
│   ├── decide/CONVENTIONS.md           ← normative canonical spec (§§3.4–6, 10)
│   ├── act/PROCEDURES.md               ← micro-trace emit rules, span display contract
│   └── assess/VERIFICATION.md          ← validation rules, well-formedness checklist
└── micro-trace/                         ← backward-looking annotation layer [CS:0.80]
    ├── MODULE.md
    ├── observe/CONTEXT.md              ← design intent, layer contrast, prior art
    ├── orient/ARCHITECTURE.md          ← layer split rule, handoff protocol
    ├── decide/CONVENTIONS.md           ← syntax, density bands (p-controlled)
    ├── act/PROCEDURES.md               ← emit examples (3 cases)
    └── assess/VERIFICATION.md          ← well-formedness checklist, common errors
```

Section URI base:
- talk-story: `lar:///module.phased.instructs/talk-story/{phase}/`
- uri-schema: `lar:///uri.schema.holds/uri-schema/{phase}/`
- micro-trace: `lar:///trace.micro.marks/micro-trace/{phase}/`

---

## Legacy File Inventory — Consumption Map

These files existed before the subdirectory structure. Each is assigned to one or more target subdirs. Consuming a file means extracting its canonical content into the target subdir's design and marking it here.

| File | Target Subdir(s) | Consumed? | Notes |
|---|---|---|---|
| `Signal_HUD_Tagspace-draft.md` | `signal/` + `crystal/` | No — do not archive until AE-08/AE-09 | Blocked; review after AE-08/AE-09 land |
| `TODO_Signal_HUD_Crystal_Plan.md` | `signal/` (Epics 1–4) + `crystal/` (Epic 5) | No — active task tracker | **⬆ HIGH** — drives all signal/ + crystal/ work; review first |
| `TODO_Resolution_Scale_Design.md` | `signal/` | No | **⬆ HIGH** — p-band model; blocks signal/ URI settlement |
| `Modular_Architecture-draft.md` | `compiler/` | No | **⬆ HIGH** — compiler architecture foundation; review before build work |
| `PIPELINE.md` | `compiler/` | No | **⬆ HIGH** — build pipeline spec; needed to settle compiler/ flow |
| `TODO_Deterministic_Build_Plan.md` | `compiler/` | No | Drives compiler/ roadmap; review after PIPELINE.md |
| `Lares_Kernel-map.md` | `compiler/` | No | IR map for kernel module; review during compiler/ type-slot work |
| `Lares_Preferences-map.md` | `compiler/` | No | IR map for preferences module; review alongside Kernel-map |
| `Lares_VSCode_Operations-map.md` | `compiler/` | No | IR map for VSCode ops module; lower pri than Kernel/Preferences maps |
| `Platform_Wrappers-map.md` | `compiler/` + `platform/` | No | Bridges compiler/ + platform/; review when platform/ scope settles |
| `Workers-map.md` | `compiler/` | No | IR map for worker slots; review during compiler/ Worker typing |
| `PROMPTCRAFT.md` | `compiler/` | No | Prompt engineering patterns; review for compiler output style guidance |
| `TODO_PARSE_DOC_SPEC.md` | `schemas/` | No | **⬆ HIGH** — `--parse` schema spec; blocks schemas/ URI settlement |
| `A_deep-research-report.md` | `invariants/` | No — primary invariant/trust research | **⬆ HIGH** — grounds `lares.core.*` behavioral invariants; review early |
| `B_deep-research-report.md` | `schemas/` + `compiler/` | No — primary schema/cache research | **⬆ HIGH** — grounds TOML schemas + cache model; review early |
| `EP-RA-001.md` | `invariants/` | No — bidirectional register/mode protocol | **⬆ HIGH** — foundational mode/register protocol; blocks invariants/ settlement |
| `TRUST_MODELS.md` | `invariants/` | No — admin governance trust model | **⬆ HIGH** — permission tier grounding; review alongside EP-RA-001 |
| `MULTIPLATFORM_PACKAGING_RESEARCH.md` | `platform/` | No | Review when platform/ packaging scope opens |

---

## Promotion Protocol

A design artifact is promoted when:

1. Its subdir's scope is settled (README.md finalized, AGENTS.md current)
2. The design reaches `C:0.95` — operator confirms, sources are verified
3. A `lares:` URI is assigned from the registry (see `registry/`)
4. A new versioned build artifact is published to `builds/agents/` — not an in-place overwrite
5. The active runtime pointer (alias in the registry) is updated to the new artifact
6. The promotion event is appended to the registry promotion ledger (what, from where, under what evals, superseding what)

Until then, all content is `[S:]` or below.

**Promotion action flow:**
`design URI [C:0.95] → evaluated candidate → published build artifact (new version) → registry alias pointer update → ledger append`

Not: `design file edited until it also becomes runtime`.

---

## Cross-References

- [Infrastructure_as_Myth.md](../Infrastructure_as_Myth.md) — thesis framing for portability and symbolic runtime design
- [builds/agents/](../builds/agents/) — live source files; destination for promoted content
- [builds.stuffed.failed/](../builds.stuffed.failed/) — archived failure corpus; reference for what not to port
- [lares/sprints/](sprints/) — sprint artifacts, story canon, roadmaps, session crystals
- [_todo/core/](../_todo/core/) — transient source docs (migrating); consumption tracked in the table above
