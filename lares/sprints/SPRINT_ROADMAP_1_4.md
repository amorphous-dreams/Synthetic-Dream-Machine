# Sprint Roadmap — Sprints 1–4 (Revised)

> Scope: Downstream sprint goals, consolidated backlog, and per-sprint outlines following Sprint 0 (URI Schema Settlement)
> Status: `[S:0.70]` 🏛️ — planning synthesis, revised post-refinement; sprint details refine as each opens
> Updated: 2026-04-08 (Rev 2 — incorporates REFINEMENT_LOG.md findings)
> Depends on: Sprint 0 `[C:0.95]` URI schema promotion (assumed complete)
> Governs: `lares/signal/`, `lares/crystal/`, `lares/invariants/`, `lares/registry/`, `lares/schemas/`
> Supersedes: SPRINT_ROADMAP_1_5.md (Rev 1 — 5-sprint model with compiler/platform split)

---

## What Changed and Why

The pre-Sprint 0 refinement session (REFINEMENT_LOG.md) surfaced three findings that restructure the roadmap:

### 1. The compiler pipeline does not exist and should not be rebuilt

`[C:0.95]` — Filesystem audit confirmed: `builds/agents/`, `builds/manifests/`, `builds/modules/`, and `scripts/agents/combine_agents.py` are all absent. The entire `builds.stuffed.failed/` architecture attempted to automate a compiler pipeline before the source modules were stable. The correct sequence: **lock content, then automate** — and only if automation earns its complexity.

**Consequence:** Sprint 4 (Compiler & Schemas) as previously scoped is invalidated. No typed IR, no host emitters, no combine pipeline. Module metadata (what a promotable artifact looks like) folds into Sprint 3 alongside the registry.

### 2. SKILL.md supersedes per-platform worker generation

`[CS:0.85]` — The `agentskills.io` open standard provides one `SKILL.md` per worker, loaded on-demand by relevance, portable across VS Code + Copilot CLI + coding agent. This eliminates the three-platform worker variant model (`.github/agents/*.agent.md` + `.claude/agents/*.md` + `.codex/agents/*.toml`) that the old compiler was built to produce.

**Consequence:** Sprint 5 (Platform Packaging) loses most of its scope. Platform-specific manifests collapse to: write the content for each deployment path. No generation pipeline needed.

### 3. The deployment target map is seven paths, not a manifest tree

`[CS:0.80]` — The actual deployment surface:

| Target | Path | Status |
|---|---|---|
| Copilot always-on | `.github/copilot-instructions.md` | **Missing** |
| AGENTS.md root | `AGENTS.md` | Exists (orphaned header) |
| AGENTS.md subfolder | `<dir>/AGENTS.md` | Exists (lares/) |
| Path-scoped instructions | `.github/instructions/*.instructions.md` | Exists (2 files) |
| Worker skills | `.github/skills/*/SKILL.md` | **Missing** |
| Claude Code always-on | `.claude/CLAUDE.md` | **Missing** |
| Custom agents | `.github/agents/*.agent.md` | **Missing** |

**Consequence:** "Platform packaging" becomes "deployment authoring" — writing content for the missing paths, not building a pipeline to generate them.

### Revised Sprint Structure

```
Old (5 sprints):  S0 → S1 Crystal → S2 Invariants → S3 Registry → S4 Compiler → S5 Platform
New (4 sprints):  S0 → S1 Crystal → S2 Invariants+HUD → S3 Registry+Schemas → S4 Deployment
```

Sprint 4 (Compiler) absorbed: module metadata → S3. Prompt engineering patterns → S4 deployment guidance.
Sprint 5 (Platform) → Sprint 4 (Deployment): write the files, not build a generator.

---

## Roadmap Overview

```
Sprint 0 ✅  URI Schema Settlement
    │        lares: anatomy, projection, validation, chronometer → [C:0.95]
    │
    ├── Sprint 1   Crystal State Machine
    │   │          STATE.jsonl schema, event model, machine lifecycle,
    │   │          portable crystal layout, HUD/crystal interface → [C:0.95]
    │   │
    │   ├── Sprint 2   Invariants & Trust + Signal HUD
    │   │              lares.core.* behavioral invariants, trust model,
    │   │              register guard, priority layers, p-band model,
    │   │              Intent Header grammar, micro-trace HUD → [C:0.95]
    │   │
    │   └── Sprint 3   Registry, Promotion Pipeline & Module Schemas
    │                  Full registry, resolver, promotion ledger, URI
    │                  assignment workflow, module/tool/permission schemas,
    │                  simplified deployment model → [C:0.95]
    │
    └── Sprint 4   Deployment Authoring
                   Write content for 7 deployment paths, root AGENTS.md
                   cleanup, first SKILL.md worker, copilot-instructions,
                   CLAUDE.md, verify/alignment contract → [C:0.95]
```

**Critical path:** S0 → S1 → S2 → S3 → S4 (linear for full confidence). S2 and S3 can parallel after S1 if needed, but S3 benefits from S2's invariant priorities for schema design.

**Integration point:** S4 is the first sprint where designed content reaches actual deployment paths. It functions as the integration test for the entire design tree.

---

## Consolidated Backlog

### signal/ — Signal HUD Layer

| ID | Item | Sprint | Target | Source | Blocks On |
|---|---|---|---|---|---|
| SIG-01 | URI schema core | S0 ✅ | `[C:0.95]` | URI_SCHEMA.md | — |
| SIG-02 | p-band model (5-band, OP-02 ruling) | S2 | `[CS:0.85]` | TODO_Resolution_Scale_Design.md | URI settled |
| SIG-03 | Intent Header grammar spec | S2 | `[CS:0.85]` | Draft §§ Intent Header | URI + crystal |
| SIG-04 | Micro-trace HUD annotation model | S2 | `[CS:0.85]` | Draft §§ Micro-trace | Intent Header |
| SIG-05 | HAKABA canonical slot reference | S1 | `[C:0.95]` | Draft § Tagspace Definition | URI path spec |
| SIG-06 | Projection table | S0 ✅ | `[C:0.95]` | URI_SCHEMA.md §5 | — |
| SIG-07 | Forward vs backward trace contract | S2 | `[S:0.70]` | Draft § Forward vs Backward Trace | Crystal events |
| SIG-08 | Header Field Taxonomy | S2 | `[CS:0.85]` | Draft § Header Field Taxonomy | p-band |

### crystal/ — Crystal State Machine

| ID | Item | Sprint | Target | Source | Blocks On |
|---|---|---|---|---|---|
| CRY-01 | STATE.jsonl event schema (all types, fields) | S1 | `[C:0.95]` | Draft §§ Crystal Event Model | URI fields |
| CRY-02 | Machine/Thread model | S1 | `[C:0.95]` | Draft § Machine / Thread Model | — |
| CRY-03 | Portable Crystal Layout | S1 | `[C:0.95]` | Draft § Portable Crystal Layout | Machine model |
| CRY-04 | Seal / continue-as-new protocol | S1 | `[CS:0.85]` | Draft §§ seal event | Machine lifecycle |
| CRY-05 | Fork protocol | S1 | `[CS:0.85]` | Draft §§ Fork Triggers | Machine model |
| CRY-06 | Debug as Crystal Projection | S1 | `[CS:0.85]` | Draft § Debug as Crystal Projection | STATE.jsonl |
| CRY-07 | HUD / Crystal Interface (non-drift rule) | S1 | `[C:0.95]` | Draft § HUD / Crystal Interface | URI + STATE |
| CRY-08 | SNAPSHOT.json contract | S1 | `[S:0.70]` | Draft § Portable Crystal Layout | STATE.jsonl |
| CRY-09 | Handoff import/export protocol | S1 | `[CS:0.85]` | Draft §§ handoff events | Seal protocol |
| CRY-10 | Ephemeral Machine Patterns | S1 | `[CS:0.85]` | Draft § Ephemeral Machine Patterns | Machine lifecycle |
| CRY-11 | REGISTRY.jsonl machine index (crystal-side) | S1 | `[S:0.70]` | Draft Pattern B | Machine model |
| CRY-12 | Schema versioning strategy | S1 | `[CS:0.82]` | Q7 in plan | STATE.jsonl |

### invariants/ — Behavioral Invariants & Trust

| ID | Item | Sprint | Target | Source | Blocks On |
|---|---|---|---|---|---|
| INV-01 | `lares.core.*` behavioral invariant registry | S2 | `[C:0.95]` | A_deep-research-report.md, D-deep-research-report.md, Kernel [C:1.0] | Crystal events |
| INV-02 | Priority layer model | S2 | `[C:0.95]` | A_deep-research-report.md, EP-RA-001.md | Invariant registry |
| INV-03 | Register guard (Canon Promotion gate) | S2 | `[C:0.95]` | Kernel § Canon Promotion gate | Invariant registry |
| INV-04 | Trust model (4-tier) | S2 | `[C:0.95]` | TRUST_MODELS.md, Kernel § Identity & Permissions | Priority layers |
| INV-05 | Bidirectional register/stance protocol | S2 | `[CS:0.85]` | EP-RA-001.md | Trust model |
| INV-06 | Degraded-node detection invariants | S2 | `[CS:0.85]` | Kernel § Degraded Node States | Invariant registry |
| INV-07 | Reality Anchor invariant | S2 | `[C:0.95]` | Kernel § Reality Anchor | Priority layers |
| INV-08 | Frame-Uncertainty Protocol invariants | S2 | `[CS:0.85]` | Kernel § Frame-Uncertainty | Invariant registry |

### registry/ — URI Registry & Promotion (now includes module schemas)

| ID | Item | Sprint | Target | Source | Blocks On |
|---|---|---|---|---|---|
| REG-01 | Promotion ledger schema (finalized) | S3 | `[C:0.95]` | REGISTRY_CONTRACT.md, C-deep-research-report.md (TOML registry examples) | Crystal lifecycle |
| REG-02 | Resolver rules (full algorithm) | S3 | `[C:0.95]` | REGISTRY_CONTRACT.md | Ledger schema |
| REG-03 | URI assignment workflow | S3 | `[C:0.95]` | lares/README.md Promotion Protocol | Resolver + ledger |
| REG-04 | Registry index format | S3 | `[CS:0.85]` | REGISTRY_CONTRACT.md §4 | Crystal REGISTRY.jsonl |
| REG-05 | Version/hash scheme for build artifacts | S3 | `[CS:0.85]` | REGISTRY_CONTRACT.md R2 | Ledger |
| REG-06 | Alias/pointer mechanism | S3 | `[CS:0.85]` | lares/README.md three-truth model | Resolver |
| REG-07 | Promotion event recording (append-only) | S3 | `[C:0.95]` | REGISTRY_CONTRACT.md §3.3 | Ledger schema |
| REG-08 | End-to-end promotion walkthrough | S3 | `[C:0.95]` | lares/README.md | All registry items |
| SCH-01 | Module descriptor schema | S3 | `[C:0.95]` | URI_SCHEMA.md §8, B-deep-research-report.md, C-deep-research-report.md (TOML manifest + cache-safety examples) | URI schema + invariants |
| SCH-02 | Tool descriptor schema | S3 | `[CS:0.85]` | B_deep-research-report.md Pattern 2 | Module schema |
| SCH-03 | Permission descriptor schema | S3 | `[CS:0.85]` | Trust model (INV-04) | Module + tool schemas |
| SCH-04 | `--parse` document spec schema | S3 | `[S:0.70]` | TODO_PARSE_DOC_SPEC.md | Module schema |
| SCH-05 | Bootloader schema (session init) | S3 | `[S:0.65]` | Kernel § Session Init Protocol | Module + permission |
| SCH-06 | Simplified deployment model spec | S3 | `[CS:0.85]` | REFINEMENT_LOG.md Session 3 | Module schema |
| SCH-07 | Invariant-core loading sequence (register-sorted) | S3 | `[C:0.95]` | URI_SCHEMA.md §8 | Invariant priorities |
| SCH-08 | Cache tier → deployment path mapping | S3 | `[CS:0.85]` | URI_SCHEMA.md §9 | Deployment model |

### deployment/ — Deployment Authoring (replaces compiler/ + platform/)

| ID | Item | Sprint | Target | Source | Blocks On |
|---|---|---|---|---|---|
| DEP-01 | Root AGENTS.md cleanup (strip orphaned header) | S4 | `[C:0.95]` | REFINEMENT_LOG.md PA-01 | Operator go-ahead |
| DEP-02 | `.github/copilot-instructions.md` | S4 | `[C:0.95]` | REFINEMENT_LOG.md PA-03 | Invariants + HUD settled |
| DEP-03 | `.claude/CLAUDE.md` | S4 | `[C:0.95]` | REFINEMENT_LOG.md PA-05 | Invariants + HUD settled |
| DEP-04 | First `.github/skills/*/SKILL.md` worker | S4 | `[CS:0.85]` | REFINEMENT_LOG.md PA-04 | Deployment model |
| DEP-05 | Platform README update (deployment target map) | S4 | `[C:0.95]` | REFINEMENT_LOG.md PA-02 | All schemas settled |
| DEP-06 | Path-scoped instructions audit + update | S4 | `[CS:0.85]` | Existing .instructions.md files | Invariants |
| DEP-07 | Verify/alignment contract | S4 | `[CS:0.85]` | verify_alignment.py (archived) | All deployment paths |
| DEP-08 | Prompt engineering guidance for deployed content | S4 | `[S:0.70]` | PROMPTCRAFT.md | Deployment model |
| DEP-09 | Custom agent template (`.github/agents/*.agent.md`) | S4 | `[S:0.65]` | Deployment target map | SKILL.md pattern |

---

## Sprint 1 — Crystal State Machine

> **Goal:** Promote STATE.jsonl event schema, machine lifecycle, portable crystal layout, and the HUD/Crystal interface contract to `[C:0.95]`.
> **Entry:** URI schema at `[C:0.95]`; crystal field mapping at `[CS:0.85]`
> **Exit:** Crystal state machine spec at `[C:0.95]`; protocols (seal, fork, handoff) at `[CS:0.85]`+
> **Subdomain:** `lares/crystal/`
> **Items:** CRY-01 through CRY-12, SIG-05

### Deliverables

1. **CRYSTAL_STATE_MACHINE.md** `[C:0.95]` — Core spec:
   - STATE.jsonl: all 11 event types, field definitions, structural constraints, immutability rule, seq_num integrity (CRY-01)
   - Machine/Thread model: `machine_id`, 9-status taxonomy, CURRENT pointer, `run_id` (CRY-02)
   - Portable Crystal Layout: filesystem contract, file roles, separation rule, shard naming (CRY-03)
   - HUD/Crystal Interface: two-part non-drift rule, span-level contract (CRY-07)
   - Schema versioning: `schema_version` field semantics, Q7 resolution (CRY-12)

2. **CRYSTAL_PROTOCOLS.md** `[CS:0.85]` — Lifecycle protocols:
   - Seal / continue-as-new: shard naming, bootstrap state, trigger conditions (CRY-04)
   - Fork: spawn rules, provenance chain, idempotency contracts (CRY-05)
   - Handoff: import/export, portable bundle contract (CRY-09)
   - Resume: idempotency, state matching, run_id semantics

3. **CRYSTAL_PROJECTIONS.md** `[CS:0.85]` — Derived surfaces:
   - debug.jsonl: enrichment fields, priority rule, same-seq_num linking (CRY-06)
   - SNAPSHOT.json: derived-surface contract, replay integrity check (CRY-08)
   - REGISTRY.jsonl (crystal-side): machine index, 200-line discipline (CRY-11)
   - Ephemeral Machine Patterns: Nano/Ephemeral/Durable tiers (CRY-10)

4. **HAKABA_REFERENCE.md** `[C:0.95]` — Tagspace slot reference (SIG-05):
   - Ha/Ka/Ba field semantics, vocabulary guidance, anti-collision rules
   - Coordinate consistency principles (same neighborhood → same address)

5. **AGENTS.md** + **SPRINT_1_TASKS.md**

### Open Questions to Resolve

| Q# | Description | Current | Action |
|---|---|---|---|
| Q7 | Schema version strategy | `[CS:0.82]` | Operator confirm |
| Q9 | SNAPSHOT optional, recommended | `[CS:0.80]` | Operator confirm |
| Q10 | Resume vs fork match criteria | `[S:0.60]` | Researcher task |
| Q14 | Seal trigger conditions | `[SP:0.50]` | Define protocol at C:0.95; leave trigger policy at CS:0.85 |
| Q15 | seq_num contiguity / multi-voice | `[SP:0.45]` | Council ruling |

---

## Sprint 2 — Invariants & Trust + Signal HUD

> **Goal:** Promote `lares.core.*` behavioral invariants, trust model, and priority layers to `[C:0.95]`. Promote Intent Header grammar, p-band model, and micro-trace HUD to `[CS:0.85]`+.
> **Entry:** URI + crystal at `[C:0.95]`
> **Exit:** Invariants at `[C:0.95]`; signal HUD at `[CS:0.85]`+
> **Subdomains:** `lares/invariants/` (primary), `lares/signal/` (secondary)
> **Items:** INV-01 through INV-08, SIG-02 through SIG-04, SIG-07, SIG-08

### Why Combined

The HUD's annotation thresholds (SIG-08) depend on the priority layer model (INV-02), and the register guard (INV-03) constrains HUD confidence reporting. Same sprint prevents cross-sprint stall.

### Deliverables

1. **INVARIANTS.md** `[C:0.95]` — Behavioral invariant registry:
   - `lares.core.*` invariant table: ID, description, priority layer, testable assertion, source
   - Priority layer model: Layer 0 (hard gates) → Layer 1 (Canon) → Layer 2 (Session) → Layer 3 (Exchange)
   - Register guard: Canon Promotion gate as formal invariant
   - Reality Anchor: factual claim independence from fiction layer

2. **TRUST_MODEL.md** `[C:0.95]` — Trust and permissions:
   - Four-tier: `user(anon)` → `user` → `operator` → `operator(admin)`
   - UCAN capability model: additive authority, attenuation, time-bounded
   - Trust gate as permission pipeline
   - `contract_update` carries authorization tier

3. **BIDIRECTIONAL_PROTOCOL.md** `[CS:0.85]`:
   - EP-RA-001: Input Signal Reading + output calibration as paired contract
   - Degraded-node detection: testable assertions per failure mode
   - Frame-Uncertainty Protocol: three-move invariant chain

4. **INTENT_HEADER.md** `[CS:0.85]`:
   - Format and forward-commitment semantics
   - Header Field Taxonomy: per-field thresholds keyed to p-band
   - Forward vs backward trace contract

5. **P_BAND_MODEL.md** `[CS:0.85]`:
   - Five-band cumulative attention model
   - p ↔ chronometer depth interaction (U4 resolution attempt)
   - Micro-trace HUD annotation rules per band

6. **AGENTS.md** + **SPRINT_2_TASKS.md**

### Key Sources (read before sprint opens)

- `A_deep-research-report.md` — `[S:]` external synthesis; grounds invariants but is not canon itself
- `EP-RA-001.md` — bidirectional register/stance protocol; foundational
- `TRUST_MODELS.md` — admin governance trust model
- `TODO_Resolution_Scale_Design.md` — p-band model source
- Kernel `[C:1.0]` tags — the invariant registry must align with these; Kernel wins on conflict

---

## Sprint 3 — Registry, Promotion Pipeline & Module Schemas

> **Goal:** Promote the full registry, resolver, promotion ledger, and URI assignment workflow to `[C:0.95]`. Settle module/tool/permission schemas. Define the simplified deployment model.
> **Entry:** URI + crystal + invariants at `[C:0.95]`
> **Exit:** Registry at `[C:0.95]`; schemas at `[CS:0.85]`+; deployment model defined
> **Subdomains:** `lares/registry/` (primary), `lares/schemas/` (co-primary)
> **Items:** REG-01 through REG-08, SCH-01 through SCH-08

### Why Schemas Move Here

The old Sprint 4 (Compiler) was designed around a build pipeline that doesn't exist. The schemas that pipeline would have consumed — module descriptors, tool contracts, permission descriptors — remain useful as **design metadata**. They describe what a promotable artifact looks like, what it depends on, and what deployment paths it targets. That metadata belongs alongside the registry, which needs to know these things to track promotions correctly.

### Deliverables

1. **REGISTRY.md** `[C:0.95]` — Full registry spec:
   - Promotion ledger: finalized JSONL schema, immutability contract
   - Resolver: full algorithm with edge cases
   - URI assignment workflow: six-step promotion flow with gate criteria
   - Alias/pointer mechanism

2. **PROMOTION_WALKTHROUGH.md** `[C:0.95]` — End-to-end example:
   - Walk through promoting URI_SCHEMA.md as the concrete case
   - Design URI → candidate → published artifact → pointer → ledger

3. **MODULE_SCHEMA.md** `[C:0.95]` — Module descriptor spec:
   - Fields: `lares_uri`, `register`, `module_id`, `seq_num`, content type, dependencies, target paths
   - Version semantics keyed to register (from URI_SCHEMA.md §8)
   - Simplified deployment model: source → copy to target path; no compiler stage

4. **TOOL_SCHEMA.md** `[CS:0.85]` — Tool descriptor spec:
   - Behavioral properties: `isConcurrencySafe`, `isReadOnly`
   - Permission requirements, uniform interface contract

5. **PERMISSION_SCHEMA.md** `[CS:0.85]` — Permission descriptor spec:
   - Trust tier requirements per capability
   - Attenuation rules for delegation

6. **DEPLOYMENT_MODEL.md** `[CS:0.85]` — Simplified pipeline:
   - Source → deploy → version (git SHA) model from REFINEMENT_LOG.md
   - Invariant-core loading sequence (register-sorted) applied to deployment
   - Cache tier → deployment path mapping
   - Replaces the old combine pipeline entirely

7. **AGENTS.md** + **SPRINT_3_TASKS.md**

### Open Questions to Resolve

| Q# | Description | Current | Action |
|---|---|---|---|
| R1 | Ledger format: JSONL vs markdown | `[S:0.65]` | Lock JSONL |
| R2 | Version scheme: hash vs semver | `[SP:0.45]` | Hash primary, semver label |
| R3 | Ledger location: design tree vs crystal tree | `[S:0.55]` | Operator call |
| R4 | Resolver: runtime tool vs design reference | `[S:0.60]` | Lock design reference for alpha |

---

## Sprint 4 — Deployment Authoring

> **Goal:** Write the actual deployment content for all seven target paths. Clean up root AGENTS.md. Create the first SKILL.md worker. Establish the verify/alignment contract.
> **Entry:** All design subdomains at `[C:0.95]`/`[CS:0.85]`+; deployment model defined
> **Exit:** All deployment paths populated; verify contract operational; design tree fully deployable
> **Subdomain:** `lares/platform/` (renamed conceptually to deployment)
> **Items:** DEP-01 through DEP-09, plus REFINEMENT_LOG.md pending actions PA-01 through PA-05

### Why This Sprint Exists

Every prior sprint produces design artifacts in `lares/`. This sprint takes those artifacts and writes the actual files that agents consume at runtime. It's the integration test for the entire architecture: if the design tree is correct, the deployment content should flow naturally from it. If it doesn't, the gaps surface here.

### Deliverables

1. **Root AGENTS.md** `[C:0.95]` — cleaned up:
   - Strip orphaned `<!-- Generated file -->` header (PA-01)
   - Replace with accurate provenance note
   - Ensure content reflects current design-canon, not stale pipeline references

2. **`.github/copilot-instructions.md`** `[C:0.95]` — Copilot always-on instructions:
   - Derived from Kernel invariants + trust model + HUD behavior
   - Budget-constrained (estimated ~4KB for always-on load)

3. **`.claude/CLAUDE.md`** `[C:0.95]` — Claude Code always-on instructions:
   - Derived from same sources, tailored to Claude Code context
   - Different budget constraints than Copilot

4. **First `.github/skills/*/SKILL.md`** `[CS:0.85]` — Worker skill:
   - Pick the highest-value worker for first SKILL.md (likely Lorekeeper or Artificer)
   - Follows `agentskills.io` spec
   - Portable across all AGENTS.md-compatible agents

5. **Path-scoped instructions audit** `[CS:0.85]`:
   - Review existing `lares-operations.instructions.md` and `lares-voice.instructions.md`
   - Update to align with design-canon invariants and HUD grammar
   - Ensure `applyTo:` globs are correct

6. **Platform README** `[C:0.95]`:
   - Deployment target map (7 paths)
   - Simplified pipeline model
   - What goes where and why

7. **VERIFY_CONTRACT.md** `[CS:0.85]`:
   - What the verify/alignment check asserts
   - Budget assertions per deployment path
   - Pass/fail criteria
   - Replaces `verify_alignment.py` contract (script itself is implementation, not design)

8. **PROMPTCRAFT_GUIDE.md** `[S:0.70]`:
   - Prompt engineering patterns for deployed instruction content
   - Hard-invariants-first ordering rationale
   - Budget discipline guidance

9. **AGENTS.md** + **SPRINT_4_TASKS.md**

### Key Risks

- **Integration risk:** This is the first time design content meets real deployment paths. Gaps between design specs and actual agent behavior surface here, not in design sprints.
- **Budget risk:** Always-on files (copilot-instructions, CLAUDE.md) have hard size limits. Content may need compression that wasn't anticipated during design.
- **Orphan risk:** Root AGENTS.md cleanup touches a deployed system artifact. Git history preserves rollback, but the edit still needs care.
- **SKILL.md learning curve:** First use of the `agentskills.io` pattern. The spec may have constraints not captured in the refinement log's research.

---

## Cross-Sprint Dependencies Summary

```
S0 URI ──────────────────────────────────┐
  │                                      │
  └── S1 Crystal ──┬── S2 Invariants ────┤
                   │   + Signal HUD      │
                   │                     │
                   └── S3 Registry ──────┤
                       + Schemas         │
                       + Deploy Model    │
                                         │
                                    S4 Deployment
                                    (integration sprint)
```

**Hardest dependency:** S4 needs everything upstream. It's intentionally last — the integration sprint that exercises the full design tree against reality.

**Safest parallelism:** S2 and S3 can parallel after S1 completes. S3 benefits from S2's invariant priorities for schema design, but can start on registry (REG-01–REG-08) independently.

---

## Backlog Items Not Assigned to Any Sprint

| ID | Item | Register | Reason for Deferral |
|---|---|---|---|
| ONT-01 | SKOS ontology upgrade (`lares.ttl`) | `[P:0.25]` | No linked data consumer exists |
| ONT-02 | PROV-O provenance modeling | `[P:0.25]` | Deferred to DreamNet layer |
| Q12 | AGENTS.md auto-update autonomy | `[SP:0.45]` | Operator preference; not blocking |
| Q13 | External input recording in STATE.jsonl | `[S:0.60]` | Researcher task; not blocking alpha |
| Q17 | seq_num version semantics for canon modules | `[S:0.70]` | Architecture-open; can settle post-S3 |
| BKL-01 | ENG-01 test harness for STATE.jsonl replay | `[S:0.65]` | Implementation, not design; post-S4 |
| BKL-02 | Parse trigger design | `[S:0.55]` | Depends on p-band + Intent Header |
| BKL-03 | Custom agent template (`.github/agents/*.agent.md`) | `[S:0.65]` | Lower priority than SKILL.md; assess post-S4 |
| BKL-04 | Quick browser tier (OP-11 deferred) | `[S:0.50]` | Confirm deferral still holds at S4 |
| CMP-08 | Prompt engineering patterns → PROMPTCRAFT_GUIDE.md | `[S:0.65]` | Moved to S4 as deployment guidance |

---

*This roadmap is `[S:0.70]` planning synthesis, revised from Rev 1 based on refinement findings. The compiler pipeline elimination simplifies the path from 5 sprints to 4 without losing any load-bearing design work. Sprint details refine as each sprint opens. The operator holds the tiller on sequencing, scope, and promotion gates.*
