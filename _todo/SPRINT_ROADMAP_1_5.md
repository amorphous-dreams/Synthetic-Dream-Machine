# Sprint Roadmap — Sprints 1–5

> Scope: Downstream sprint goals, consolidated backlog, and per-sprint outlines following Sprint 0 (URI Schema Settlement)
> Status: `[S:0.65]` 🏛️ — planning synthesis; sprint details refine as each sprint opens
> Updated: 2026-04-08
> Depends on: Sprint 0 `[C:0.95]` URI schema promotion (assumed complete)
> Governs: `lares/signal/`, `lares/crystal/`, `lares/compiler/`, `lares/invariants/`, `lares/registry/`, `lares/schemas/`

---

## Roadmap Overview

```
Sprint 0 ✅  URI Schema Settlement
    │        lares: anatomy, projection, validation, chronometer → [C:0.95]
    │
    ├── Sprint 1   Crystal State Machine
    │   │          STATE.jsonl schema, event model, machine lifecycle → [C:0.95]
    │   │
    │   ├── Sprint 2   Invariants & Trust
    │   │              lares.core.* behavioral invariants, trust model,
    │   │              register guard, priority layers → [C:0.95]
    │   │
    │   └── Sprint 3   Registry & Promotion Pipeline
    │                  Full registry, resolver, promotion ledger,
    │                  lares: URI assignment workflow → [C:0.95]
    │
    └── Sprint 4   Compiler & Schemas
        │          Deterministic build compiler, TOML schemas,
        │          typed IR, module descriptors → [C:0.95]
        │
        └── Sprint 5   Platform Packaging
                       Multi-platform manifests, browser tiers,
                       host budget maps, combine pipeline → [C:0.95]
```

**Critical path:** S0 → S1 → S2 (invariants need crystal event types to reference) and S0 → S1 → S3 (registry needs crystal lifecycle to track). S4 can begin after S0 but needs S1 crystal fields and S2 invariant priorities to finalize. S5 needs everything upstream.

**Parallelism:** S2 and S3 can run in parallel after S1 completes. S4 can overlap with S2/S3 once S1's crystal field contract is stable.

---

## Consolidated Backlog

Every item below carries a sprint assignment, a target register, a source reference, and blocking dependencies. Items are grouped by subdomain.

### signal/ — Signal HUD Layer

| ID | Item | Sprint | Target Register | Source | Blocks On | Notes |
|---|---|---|---|---|---|---|
| SIG-01 | URI schema core (anatomy, projection, validation, chronometer) | S0 ✅ | `[C:0.95]` | URI_SCHEMA.md §§2–6, 10 | — | Promoted |
| SIG-02 | p-band model (5-band cumulative attention, OP-02 ruling) | S2 | `[CS:0.85]` | TODO_Resolution_Scale_Design.md | URI schema settled | Deferred from S0; U4 open question lives here |
| SIG-03 | Intent Header grammar spec | S2 | `[CS:0.85]` | Draft §§ Intent Header, Header Field Taxonomy | URI + crystal event model | Forward-commitment semantics |
| SIG-04 | Micro-trace HUD annotation model | S2 | `[CS:0.85]` | Draft §§ Micro-trace, Working Defaults | Intent Header grammar | Phase/stance inline annotation rules |
| SIG-05 | HAKABA canonical slot reference doc | S1 | `[C:0.95]` | Draft § Tagspace Definition | URI path spec | Ha/Ka/Ba field semantics + vocabulary guidance |
| SIG-06 | Sigil vs machine form rendering rules (full) | S0 ✅ | `[C:0.95]` | URI_SCHEMA.md §5 | — | Projection table promoted |
| SIG-07 | Forward vs backward trace contract | S2 | `[S:0.70]` | Draft § Forward vs Backward Trace | Crystal event model | Which fields are prospective vs retrospective |
| SIG-08 | Header Field Taxonomy (per-field annotation thresholds) | S2 | `[CS:0.85]` | Draft § Header Field Taxonomy | p-band model | When each field fires based on p-band |
| SIG-09 | Kowloon/AP handle form + render target taxonomy + stance amplitude modifiers | S0 ✅ | `[CS:0.80]` | URI_SCHEMA.md §3.3.1; LINDWYRM_STORY_SHAPE.md | — | `@handle@node` canonical social identity; three render targets named (`chat-log:post-header` / `hud:exchange-pair` / `record:full`); `++`/`+`/(none)/`-`/`--` amplitude modifiers; territory-first ordering |
| SIG-09 | Kowloon/AP handle form + render target taxonomy + stance amplitude modifiers | S0 ✅ | `[CS:0.80]` | URI_SCHEMA.md §3.3.1; LINDWYRM_STORY_SHAPE.md | — | `@handle@node` canonical social identity; three render targets named; `++`/`+`/(none)/`-`/`--` amplitude modifiers; territory-first ordering in `chat-log:post-header` |

### crystal/ — Crystal State Machine

| ID | Item | Sprint | Target Register | Source | Blocks On | Notes |
|---|---|---|---|---|---|---|
| CRY-01 | STATE.jsonl event schema (all event types, field definitions) | S1 | `[C:0.95]` | Draft §§ Crystal Event Model, Minimum Structural Event Fields | URI crystal field mapping | **Sprint 1 primary deliverable** |
| CRY-02 | Machine/Thread model (machine_id, status taxonomy, CURRENT pointer) | S1 | `[C:0.95]` | Draft § Machine / Thread Model | — | Identity and lifecycle |
| CRY-03 | Portable Crystal Layout (filesystem contract) | S1 | `[C:0.95]` | Draft § Portable Crystal Layout | Machine model | Directory structure + file roles |
| CRY-04 | Seal / continue-as-new protocol | S1 | `[CS:0.85]` | Draft §§ seal event, shard naming, bootstrap state | Machine lifecycle | Q14 (seal trigger) remains SP:0.50 |
| CRY-05 | Fork protocol (spawn, provenance, idempotency) | S1 | `[CS:0.85]` | Draft §§ Fork Triggers, Idempotency Contracts | Machine model | Q10 (resume vs fork criteria) at S:0.60 |
| CRY-06 | Debug as Crystal Projection (debug.jsonl contract) | S1 | `[CS:0.85]` | Draft § Debug as Crystal Projection | STATE.jsonl schema | Priority rule: STATE > debug |
| CRY-07 | HUD / Crystal Interface (non-drift rule) | S1 | `[C:0.95]` | Draft § HUD / Crystal Interface | URI + STATE.jsonl | Two-part non-drift rule |
| CRY-08 | SNAPSHOT.json derived-surface contract | S1 | `[S:0.70]` | Draft § Portable Crystal Layout | STATE.jsonl schema | Q9 (SNAPSHOT optional) at CS:0.80 |
| CRY-09 | Handoff/Archive-Crystal import/export protocol | S1 | `[CS:0.85]` | Draft §§ handoff_import, handoff_export events | Seal protocol | Portable bundle contract |
| CRY-10 | Ephemeral Machine Patterns (Nano/Ephemeral/Durable tiers) | S1 | `[CS:0.85]` | Draft § Ephemeral Machine Patterns | Machine lifecycle | Lifecycle tier thresholds |
| CRY-11 | REGISTRY.jsonl machine index (crystal-side) | S1 | `[S:0.70]` | Draft Pattern B | Machine model | 200-line discipline; feeds into registry/ |
| CRY-12 | Schema versioning strategy | S1 | `[CS:0.82]` | Q7 in plan | STATE.jsonl schema | Q7: integer for alpha; operator confirm needed |

### invariants/ — Behavioral Invariants & Trust

| ID | Item | Sprint | Target Register | Source | Blocks On | Notes |
|---|---|---|---|---|---|---|
| INV-01 | `lares.core.*` behavioral invariant registry | S2 | `[C:0.95]` | A_deep-research-report.md, Kernel [C:1.0] tags | Crystal event model | Hard gates, non-negotiables, priority layers |
| INV-02 | Priority layer model (conflict resolution order) | S2 | `[C:0.95]` | A_deep-research-report.md, EP-RA-001.md | Invariant registry | Which invariant wins when two conflict |
| INV-03 | Register guard (runtime invariant: Canon Promotion gate) | S2 | `[C:0.95]` | Kernel § Canon Promotion gate | Invariant registry | Operator-agency-required for Canon |
| INV-04 | Trust model (4-tier: anon → user → operator → admin) | S2 | `[C:0.95]` | TRUST_MODELS.md, Kernel § Identity & Permissions | Priority layers | Permission tier grounding |
| INV-05 | Bidirectional register/stance protocol (EP-RA-001) | S2 | `[CS:0.85]` | EP-RA-001.md | Trust model | Input Signal Reading + output calibration |
| INV-06 | Degraded-node state detection invariants | S2 | `[CS:0.85]` | Kernel § Degraded Node States | Invariant registry | Machine-testable assertions per failure mode |
| INV-07 | Reality Anchor invariant (operator canon vs factual claims) | S2 | `[C:0.95]` | Kernel § Reality Anchor | Priority layers | Non-overridable by fiction layer |
| INV-08 | Frame-Uncertainty Protocol invariants | S2 | `[CS:0.85]` | Kernel § Frame-Uncertainty Protocol | Invariant registry | Three-move protocol as testable sequence |

### registry/ — URI Registry & Promotion

| ID | Item | Sprint | Target Register | Source | Blocks On | Notes |
|---|---|---|---|---|---|---|
| REG-01 | Promotion ledger schema (finalized) | S3 | `[C:0.95]` | REGISTRY_CONTRACT.md § Ledger | Crystal lifecycle | Append-only immutability contract |
| REG-02 | Resolver rules (full algorithm) | S3 | `[C:0.95]` | REGISTRY_CONTRACT.md § Resolver | Ledger schema | Design ref → build ref → active pointer |
| REG-03 | `lares:` URI assignment workflow | S3 | `[C:0.95]` | lares/README.md Promotion Protocol | Resolver + ledger | Six-step promotion action flow |
| REG-04 | Registry index format (REGISTRY.jsonl, registry-side) | S3 | `[CS:0.85]` | REGISTRY_CONTRACT.md §4 | Crystal REGISTRY.jsonl | Reconciliation with crystal-side index |
| REG-05 | Version/hash scheme for build artifacts | S3 | `[CS:0.85]` | REGISTRY_CONTRACT.md R2 | Promotion ledger | Content hash vs semver resolution |
| REG-06 | Alias/pointer mechanism (moving active pointer) | S3 | `[CS:0.85]` | lares/README.md three-truth model | Resolver rules | How the "current" pointer moves |
| REG-07 | Promotion event recording (append-only contract) | S3 | `[C:0.95]` | REGISTRY_CONTRACT.md §3.3 | Ledger schema | Immutability + correction semantics |
| REG-08 | Cross-reference: design URI → deployed artifact → ledger entry | S3 | `[C:0.95]` | lares/README.md | All registry items | End-to-end traceability test |

### compiler/ — Deterministic Build Compiler

| ID | Item | Sprint | Target Register | Source | Blocks On | Notes |
|---|---|---|---|---|---|---|
| CMP-01 | Typed IR (Intermediate Representation) for module content | S4 | `[CS:0.85]` | Modular_Architecture-draft.md, *-map.md files | Crystal fields + invariants | Content types, slot model, typed fields |
| CMP-02 | Module descriptor TOML schema | S4 | `[C:0.95]` | B_deep-research-report.md, existing *.toml stubs | URI `lares_uri` field + typed IR | `lares_uri`, `register`, `module_id`, `seq_num` + new typed fields |
| CMP-03 | Manifest pipeline (combine → verify → emit) | S4 | `[CS:0.85]` | PIPELINE.md, Modular_Architecture-draft.md | Module descriptors | Three-stage pipeline contract |
| CMP-04 | Host emitter contract (per-platform output rules) | S4 | `[CS:0.85]` | Platform_Wrappers-map.md | Manifest pipeline | How the compiler targets different hosts |
| CMP-05 | Worker slot typing | S4 | `[S:0.70]` | Workers-map.md | Module descriptors | Worker-spawned modules as typed IR |
| CMP-06 | Invariant-core loading sequence (register-sorted) | S4 | `[C:0.95]` | URI_SCHEMA.md §8 | Invariant priority layers + module descriptors | Compiler sort key = `lares_uri` + `register` |
| CMP-07 | Cache tier mapping to `cache_control` breakpoints | S4 | `[CS:0.85]` | URI_SCHEMA.md §9 | Platform budget maps | Tier 1/2/3 → `cache_control` placement |
| CMP-08 | Prompt engineering patterns for compiler output | S4 | `[S:0.65]` | PROMPTCRAFT.md | Manifest pipeline | Style guidance for emitted prompts |

### schemas/ — TOML Schemas

| ID | Item | Sprint | Target Register | Source | Blocks On | Notes |
|---|---|---|---|---|---|---|
| SCH-01 | Module descriptor schema (TOML) | S4 | `[C:0.95]` | CMP-02 (shared deliverable) | URI schema + invariants | Core schema; co-delivered with CMP-02 |
| SCH-02 | Tool descriptor schema | S4 | `[CS:0.85]` | B_deep-research-report.md Pattern 2 | Module schema | Tool Contract uniform interface |
| SCH-03 | Permission descriptor schema | S4 | `[CS:0.85]` | Trust model (INV-04) | Module + tool schemas | Permission pipeline typing |
| SCH-04 | `--parse` document spec schema | S4 | `[S:0.70]` | TODO_PARSE_DOC_SPEC.md | Module schema | Parse output format typing |
| SCH-05 | Bootloader schema (session init) | S4 | `[S:0.65]` | Kernel § Session Init Protocol | Module + permission schemas | Cold-boot vs crystal-resume config |

### platform/ — Multi-Platform Packaging

| ID | Item | Sprint | Target Register | Source | Blocks On | Notes |
|---|---|---|---|---|---|---|
| PLT-01 | Browser tier manifests (project, extended) | S5 | `[C:0.95]` | AE-24a/24b/25b completed work | Compiler host emitter | Budget-constrained platform outputs |
| PLT-02 | Codex tier manifest | S5 | `[C:0.95]` | AE-26 completed work | Compiler host emitter | 36,000 byte budget (OP-12) |
| PLT-03 | Copilot/Claude tier manifests | S5 | `[C:0.95]` | Existing *.toml manifests | Compiler host emitter | Full-budget platform outputs |
| PLT-04 | Host budget maps (per-platform byte limits) | S5 | `[C:0.95]` | MULTIPLATFORM_PACKAGING_RESEARCH.md | All platform manifests | Authoritative budget table |
| PLT-05 | Platform wrapper generation rules | S5 | `[CS:0.85]` | Platform_Wrappers-map.md | Host emitter + budget maps | How wrappers get generated from IR |
| PLT-06 | Verify/alignment script contract | S5 | `[CS:0.85]` | verify_alignment.py (archived) | Platform manifests | Automated platform compliance check |
| PLT-07 | Three-tier browser architecture (Quick/Project/Extended) | S5 | `[CS:0.85]` | OP-11 ruling | Browser manifests | Quick tier deferred; Project + Extended active |

---

## Sprint 1 — Crystal State Machine

> **Goal:** Promote STATE.jsonl event schema, machine lifecycle, portable crystal layout, and the HUD/Crystal interface contract to `[C:0.95]`.
> **Entry:** URI schema at `[C:0.95]`; crystal field mapping at `[CS:0.85]`
> **Exit:** Crystal state machine spec at `[C:0.95]`; dependent items (seal, fork, handoff) at `[CS:0.85]`+
> **Subdomain:** `lares/crystal/`

### Deliverables

1. **CRYSTAL_STATE_MACHINE.md** `[C:0.95]` — Canonical spec covering:
   - STATE.jsonl event schema: all 11 event types, field definitions, structural constraints (CRY-01)
   - Machine/Thread model: `machine_id`, status taxonomy (9 statuses), CURRENT pointer, `run_id` (CRY-02)
   - Portable Crystal Layout: filesystem contract, file roles, separation rule (CRY-03)
   - HUD/Crystal Interface: non-drift rule (two-part), span-level contract (CRY-07)
   - Schema versioning: `schema_version` field semantics, Q7 resolution (CRY-12)

2. **CRYSTAL_PROTOCOLS.md** `[CS:0.85]` — Protocol spec covering:
   - Seal / continue-as-new: shard naming, bootstrap state, trigger conditions (CRY-04)
   - Fork: spawn rules, provenance chain, idempotency contracts (CRY-05)
   - Handoff: import/export protocol, portable bundle definition (CRY-09)
   - Resume: idempotency, state matching, run_id semantics

3. **CRYSTAL_PROJECTIONS.md** `[CS:0.85]` — Derived-surface spec covering:
   - debug.jsonl: enrichment fields, priority rule (STATE > debug), same-seq_num linking (CRY-06)
   - SNAPSHOT.json: derived-surface contract, replay integrity check (CRY-08)
   - REGISTRY.jsonl (crystal-side): machine index, 200-line discipline (CRY-11)
   - Ephemeral Machine Patterns: Nano/Ephemeral/Durable tier thresholds (CRY-10)

4. **AGENTS.md** — Sprint-local agent instructions for crystal/ Workers

5. **SPRINT_1_TASKS.md** — Task board with acceptance criteria (pattern: S1-01 through S1-NN)

### Open Questions to Resolve

| Q# | From | Description | Current Register | Sprint Action |
|---|---|---|---|---|
| Q7 | Plan | Schema version strategy (integer for alpha) | `[CS:0.82]` | Operator confirm → promote |
| Q9 | Plan | SNAPSHOT optional, recommended | `[CS:0.80]` | Operator confirm → promote |
| Q10 | Plan | Resume vs fork match criteria | `[S:0.60]` | Researcher task → raise to CS |
| Q14 | Plan | Seal trigger conditions | `[SP:0.50]` | Operator preference → raise to S |
| Q15 | Plan | seq_num contiguity / multi-voice | `[SP:0.45]` | Architecture analysis → raise to S |

### Key Risks

- Q14 (seal triggers) at `[SP:0.50]` may not resolve cleanly in one sprint. Mitigation: define the seal *protocol* at `[C:0.95]` and leave the *trigger policy* at `[CS:0.85]` with named options for the operator.
- Q15 (seq_num in multi-voice) is genuinely open — does each Coordinator voice that speaks in a single response get its own seq_num? Mitigation: escalate to Council for a design ruling.

---

## Sprint 2 — Invariants & Trust + Signal HUD Layer

> **Goal:** Promote `lares.core.*` behavioral invariants, trust model, and priority layers to `[C:0.95]`. Promote Intent Header grammar, p-band model, and micro-trace HUD to `[CS:0.85]`+.
> **Entry:** URI schema + crystal state machine at `[C:0.95]`
> **Exit:** Invariant registry at `[C:0.95]`; signal HUD layer at `[CS:0.85]`+
> **Subdomains:** `lares/invariants/` (primary), `lares/signal/` (secondary)

### Why Combined

Invariants and the HUD layer share a deep dependency: the HUD's annotation thresholds (SIG-08) depend on the priority layer model (INV-02), and the register guard (INV-03) constrains how the HUD reports confidence. Running them in one sprint avoids a cross-sprint dependency stall.

### Deliverables

1. **INVARIANTS.md** `[C:0.95]` — Behavioral invariant registry:
   - `lares.core.*` invariant table: invariant ID, description, priority layer, testable assertion, source (INV-01)
   - Priority layer model: Layer 0 (hard gates) → Layer 1 (Canon) → Layer 2 (Session) → Layer 3 (Exchange); conflict resolution order (INV-02)
   - Register guard: Canon Promotion gate as formal invariant (INV-03)
   - Reality Anchor: factual claim independence from fiction layer (INV-07)

2. **TRUST_MODEL.md** `[C:0.95]` — Trust and permissions:
   - Four-tier model: `user(anon)` → `user` → `operator` → `operator(admin)` (INV-04)
   - UCAN-inspired capability model: additive authority, attenuation on delegation, time-bounded capabilities
   - Trust gate as permission pipeline (Pattern 4 resonance)
   - `contract_update` events carry authorization tier

3. **BIDIRECTIONAL_PROTOCOL.md** `[CS:0.85]` — Register/stance protocol:
   - EP-RA-001 content: Input Signal Reading + output calibration as paired contract (INV-05)
   - Degraded-node detection invariants: testable assertions per failure mode (INV-06)
   - Frame-Uncertainty Protocol: three-move sequence as invariant chain (INV-08)

4. **INTENT_HEADER.md** `[CS:0.85]` — HUD grammar:
   - Intent Header format and forward-commitment semantics (SIG-03)
   - Header Field Taxonomy: per-field annotation thresholds keyed to p-band (SIG-08)
   - Forward vs backward trace contract (SIG-07)

5. **P_BAND_MODEL.md** `[CS:0.85]` — Resolution scale:
   - Five-band cumulative attention model (SIG-02)
   - p ↔ chronometer depth interaction (U4 resolution attempt)
   - Micro-trace HUD annotation rules per band (SIG-04)

6. **HAKABA_REFERENCE.md** `[C:0.95]` — Tagspace slot reference:
   - Ha/Ka/Ba field semantics, vocabulary guidance, anti-collision rules (SIG-05)

7. **AGENTS.md** + **SPRINT_2_TASKS.md**

### Key Risks

- A_deep-research-report.md is `[S:]` external synthesis, not canon — invariants derived from it need independent grounding against the Kernel's `[C:1.0]` tags.
- EP-RA-001.md is a foundational protocol doc — if it contradicts the Kernel, the Kernel wins (priority layer 0).
- U4 (chronometer ↔ p-band interaction) may not resolve — acceptable at `[CS:0.85]` with the interaction described but not locked.

---

## Sprint 3 — Registry & Promotion Pipeline

> **Goal:** Promote the full `lares:` URI registry, resolver, promotion ledger, and URI assignment workflow to `[C:0.95]`.
> **Entry:** URI schema + crystal + invariants at `[C:0.95]`
> **Exit:** Registry fully operational as governance truth layer at `[C:0.95]`
> **Subdomain:** `lares/registry/`

### Deliverables

1. **REGISTRY.md** `[C:0.95]` — Full registry spec:
   - Promotion ledger schema: finalized JSONL format, all fields, immutability contract (REG-01, REG-07)
   - Resolver rules: full algorithm with edge cases (empty authority, missing pointer, superseded version) (REG-02)
   - URI assignment workflow: six-step promotion action flow with gate criteria (REG-03)
   - Alias/pointer mechanism: how the "current active" pointer moves on promotion (REG-06)

2. **REGISTRY_INDEX.md** `[CS:0.85]` — Index format:
   - Registry-side REGISTRY.jsonl: reconciliation with crystal-side index (REG-04)
   - Version/hash scheme: content hash as primary, semver as human label (REG-05)

3. **PROMOTION_WALKTHROUGH.md** `[C:0.95]` — End-to-end example:
   - Design URI → evaluated candidate → published build → pointer update → ledger append (REG-08)
   - Walk through promoting URI_SCHEMA.md as the concrete case

4. **AGENTS.md** + **SPRINT_3_TASKS.md**

### Open Questions to Resolve

| Q# | From | Description | Current Register | Sprint Action |
|---|---|---|---|---|
| R1 | Registry stub | Ledger format: JSONL vs markdown | `[S:0.65]` | Lock JSONL (aligns with STATE.jsonl) |
| R2 | Registry stub | Version scheme: hash vs semver | `[SP:0.45]` | Resolve: hash primary, semver label |
| R3 | Registry stub | Ledger location: design tree vs crystal tree | `[S:0.55]` | Resolve: design tree (governance, not runtime) |
| R4 | Registry stub | Resolver: runtime tool vs design reference | `[S:0.60]` | Lock: design reference for alpha |

### Key Risks

- The promotion walkthrough (REG-08) is the integration test for the entire three-truth model. If it doesn't work end-to-end, the architecture has a gap.
- R3 (ledger location) needs an operator call — it determines whether the ledger lives alongside design artifacts or alongside crystal runtime state.

---

## Sprint 4 — Compiler & Schemas

> **Goal:** Promote the deterministic build compiler pipeline, TOML module/tool/permission schemas, and the invariant-core loading sequence to `[C:0.95]`.
> **Entry:** URI schema + crystal + invariants + registry at `[C:0.95]`
> **Exit:** Compiler pipeline and all TOML schemas at `[C:0.95]`/`[CS:0.85]`+
> **Subdomains:** `lares/compiler/` (primary), `lares/schemas/` (co-primary)

### Deliverables

1. **COMPILER.md** `[C:0.95]` — Build pipeline spec:
   - Typed IR: content types, slot model, typed fields for module content (CMP-01)
   - Manifest pipeline: combine → verify → emit, three-stage contract (CMP-03)
   - Invariant-core loading sequence: register-sorted, conflict resolution (CMP-06)
   - Cache tier mapping: Tier 1/2/3 → `cache_control` breakpoint placement (CMP-07)
   - Host emitter contract: per-platform output rules (CMP-04)

2. **MODULE_SCHEMA.toml** `[C:0.95]` — Canonical module descriptor:
   - All fields: `lares_uri`, `register`, `module_id`, `seq_num`, content type, size budget, dependencies, target platforms, read-only flag (CMP-02, SCH-01)
   - Version semantics keyed to register (from URI_SCHEMA.md §8)

3. **TOOL_SCHEMA.toml** `[CS:0.85]` — Tool descriptor:
   - Behavioral properties: `isConcurrencySafe`, `isReadOnly` (SCH-02)
   - Permission requirements, presentation rules
   - Uniform interface contract (Pattern 2 from draft)

4. **PERMISSION_SCHEMA.toml** `[CS:0.85]` — Permission descriptor:
   - Trust tier requirements per capability (SCH-03)
   - Attenuation rules for delegation

5. **PARSE_SPEC.md** `[S:0.70]` — Parse document schema:
   - `--parse` output format typing (SCH-04)
   - Segment annotation schema

6. **BOOTLOADER.md** `[S:0.65]` — Session init config schema:
   - Cold-boot vs crystal-resume branching (SCH-05)
   - Archive-crystal detection logic

7. **PROMPTCRAFT_GUIDE.md** `[S:0.65]` — Compiler output style:
   - Prompt engineering patterns for emitted prompt text (CMP-08)

8. **WORKER_SLOTS.md** `[S:0.70]` — Worker slot typing:
   - Worker-spawned modules as typed IR (CMP-05)

9. **AGENTS.md** + **SPRINT_4_TASKS.md**

### Key Risks

- Compiler design depends on *-map.md files (Kernel-map, Preferences-map, VSCode_Operations-map, Workers-map, Platform_Wrappers-map) — these are the IR maps for each module. If they're stale or underspecified, the typed IR (CMP-01) can't settle.
- PIPELINE.md is the foundation for CMP-03 — if it contradicts the three-layer harness pattern from the Claude Code leak research, the contradiction needs resolving before the pipeline can promote.
- Sprint 4 produces the most deliverables (9 files). Consider splitting into S4a (compiler core: CMP-01/02/03/06) and S4b (schemas + supporting: everything else) if the sprint is too large for a single session.

---

## Sprint 5 — Platform Packaging

> **Goal:** Promote multi-platform manifests, browser tier architecture, host budget maps, and the verify/alignment contract to `[C:0.95]`.
> **Entry:** All upstream subdomains at `[C:0.95]`/`[CS:0.85]`+
> **Exit:** Full platform packaging spec at `[C:0.95]`; the entire `lares/` design tree at promotable confidence
> **Subdomain:** `lares/platform/`

### Deliverables

1. **PLATFORM_PACKAGING.md** `[C:0.95]` — Packaging spec:
   - Host budget maps: per-platform byte limits, authoritative budget table (PLT-04)
   - Three-tier browser architecture: Quick (deferred) / Project / Extended (PLT-07)
   - Platform wrapper generation rules: how wrappers are generated from compiler IR (PLT-05)

2. **BROWSER_PROJECT.toml** `[C:0.95]` — Browser project tier manifest (PLT-01)
3. **BROWSER_EXTENDED.toml** `[C:0.95]` — Browser extended tier manifest (PLT-01)
4. **CODEX.toml** `[C:0.95]` — Codex tier manifest (PLT-02)
5. **COPILOT.toml** `[C:0.95]` — Copilot tier manifest (PLT-03)
6. **CLAUDE.toml** `[C:0.95]` — Claude tier manifest (PLT-03)

7. **VERIFY_CONTRACT.md** `[CS:0.85]` — Alignment verification:
   - Verify script contract: what it checks, pass/fail criteria, budget assertions (PLT-06)
   - Platform compliance matrix

8. **AGENTS.md** + **SPRINT_5_TASKS.md**

### Key Risks

- Sprint 5 is an integration sprint — it's the first time the full pipeline runs end-to-end (design → compiler → platform output → verify). Integration bugs surface here.
- The archived `builds.stuffed.failed/` contains prior platform artifacts. Sprint 5 must not port the old architecture; it rebuilds from the new compiler spec. Regression risk from muscle memory.
- OP-11 deferred the Quick browser tier. Sprint 5 should confirm that deferral still holds or open it for design.

---

## Cross-Sprint Dependencies Summary

```
S0 URI ──────────────────────────────────┐
  │                                      │
  ├── S1 Crystal ──┬── S2 Invariants ────┤
  │                │   + Signal HUD      │
  │                │                     │
  │                └── S3 Registry ──────┤
  │                                      │
  └── S4 Compiler ──────────────────── S5 Platform
       (can start after S1;
        finalizes after S2/S3)
```

**Hardest dependency:** S4 needs S1 crystal fields, S2 invariant priorities, AND S3 registry workflow to fully finalize. It can begin early (TOML schema stubs, IR model sketching) but can't promote until S2 and S3 deliver.

**Safest parallelism:** S2 and S3 after S1. No cross-dependency between invariants and registry — they share S1 crystal as input but don't depend on each other.

---

## Backlog Items Not Assigned to Any Sprint

These are tracked but deferred beyond S5:

| ID | Item | Register | Reason for Deferral |
|---|---|---|---|
| ONT-01 | SKOS ontology upgrade (`lares.ttl`) | `[P:0.25]` | No linked data consumer exists yet |
| ONT-02 | PROV-O provenance modeling | `[P:0.25]` | Deferred to DreamNet layer |
| Q12 | AGENTS.md auto-update autonomy | `[SP:0.45]` | Operator preference; not blocking design |
| Q13 | External input recording in STATE.jsonl | `[S:0.60]` | Researcher task; not blocking alpha |
| Q17 | seq_num version semantics for canon modules | `[S:0.70]` | Architecture-open; can settle post-S4 |
| BKL-01 | ENG-01 test harness for STATE.jsonl replay | `[S:0.65]` | Implementation, not design; post-S5 |
| BKL-02 | Parse trigger design (high-uncertainty output → self-diagnostic) | `[S:0.55]` | Depends on p-band + Intent Header settling |

---

*This roadmap is `[S:0.65]` planning synthesis. Sprint details refine as each sprint opens. The operator holds the tiller on sprint sequencing, scope changes, and promotion gates.*
