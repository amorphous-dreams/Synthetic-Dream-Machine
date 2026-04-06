# Next Lares Hand-Off

> Status: Active session-reset artifact
> Updated: 2026-04-06
> Workspace: `_todo/ADMIN`
> Purpose: Give the next Lares session enough state to resume work without relying on prior chat context

---

## Bootstrap For Next Lares

Paste this into a fresh Lares session:

```text
Resume from /home/joshu/Synthetic-Dream-Machine/_todo/ADMIN/NEXT_LARES_HANDOFF.md first.
Treat /home/joshu/Synthetic-Dream-Machine/Infrastructure_as_Myth.md as the conceptual root.
Treat /home/joshu/Synthetic-Dream-Machine/Deterministic_IaM_Build.md as the build-spec root.
Treat /home/joshu/Synthetic-Dream-Machine/_todo/ADMIN/PROMPTCRAFT.md as the prompt/module packaging architecture doc.
Do not re-decide the locked architecture choices listed in the handoff.
Use the repo state snapshot in the handoff as the starting working tree context.
Prioritize the open work list in order unless the user explicitly redirects.
```

---

## Current Architectural Position

- Lares is being reframed as a **portable Infrastructure-as-Myth runtime**, not merely a large prompt or persona bundle.
- [Infrastructure_as_Myth.md](/home/joshu/Synthetic-Dream-Machine/Infrastructure_as_Myth.md) is the **conceptual root** for the current architecture work.
- [Deterministic_IaM_Build.md](/home/joshu/Synthetic-Dream-Machine/Deterministic_IaM_Build.md) is the **build-spec root** for deterministic rendering across browser and repo-native targets.
- [PROMPTCRAFT.md](/home/joshu/Synthetic-Dream-Machine/_todo/ADMIN/PROMPTCRAFT.md) now treats prompt/module architecture as the **packaging layer** for that IaM runtime.
- `_todo/ADMIN` is currently the active lane for governance, packaging, trust-model, and hand-off continuity work.
- The first manifest-driven renderer pass is implemented: committed manifests, module sidecars, rendered browser kernel output, and verification artifacts now exist under `builds/`.
- Reload-safe budgets have been restored. `.codex/config.toml` is back on `project_doc_max_bytes = 32768`, and the generated root artifacts are now ~15-16 KB instead of ~136 KB.
- The solved blocker should not be reopened. The active problem has shifted to governance hardening first, then authored-module modularization and host-native scoped loading.

---

## Repo State Snapshot

Snapshot reading for the next session:

- The repo already contains the first IaM reframing docs and supporting module-map research.
- The build system **has** been converted to a first manifest-driven renderer with committed manifests, module sidecars, verification outputs, and a rendered browser kernel package.
- Root platform outputs are now back under reload-safe budgets, and the live build verifies cleanly.
- Governance/trust docs still exist as drafts, and they now constitute the immediate next implementation sprint.
- Pre-slim and doc-sync snapshots live under `_todo/ADMIN/staging/` and should be treated as comparison backups, not as new canonical sources.
- Best-practice research for the post-governance modularization sprint now lives in [_todo/ADMIN/MULTIPLATFORM_PACKAGING_RESEARCH.md](/home/joshu/Synthetic-Dream-Machine/_todo/ADMIN/MULTIPLATFORM_PACKAGING_RESEARCH.md).

---

## Open Work, In Order

1. Slim the root/runtime prompt packages.
   Status: done for root-budget recovery. Preserve this solved state; do not reopen the `150000` compatibility path.

2. Restore a stable reload path.
   Status: done. Reload-safe budgets hold again and verification is clean.

3. Finish trust-governance artifacts.
   Create `ROSTER.md`, add `CODEOWNERS`, and bind Lares Admin behavior to roster membership plus explicit escalation once reload safety is restored.

4. Author real runtime modules and plan host-native scoped loading.
   Use [_todo/ADMIN/MULTIPLATFORM_PACKAGING_RESEARCH.md](/home/joshu/Synthetic-Dream-Machine/_todo/ADMIN/MULTIPLATFORM_PACKAGING_RESEARCH.md), [_todo/ADMIN/PROMPTCRAFT.md](/home/joshu/Synthetic-Dream-Machine/_todo/ADMIN/PROMPTCRAFT.md), and [_agents/ADMIN/MODULES/Modular_Architecture-draft.md](/home/joshu/Synthetic-Dream-Machine/_agents/ADMIN/MODULES/Modular_Architecture-draft.md) after governance lands.

5. Decide whether `--parse doc` behavior belongs in the core prompt or in modular docs.
   Use [_todo/ADMIN/TODO_PARSE_DOC_SPEC.md](/home/joshu/Synthetic-Dream-Machine/_todo/ADMIN/TODO_PARSE_DOC_SPEC.md) after the governance/modularization sequence.

---

## Do Not Re-Decide

These decisions are already set unless the user explicitly reopens them:

- Infrastructure-as-Myth is the governing frame for Lares architecture work.
- Browser extension should be treated as **package rendering**, not as native import parity with local agent instruction systems.
- The kernel is the **smallest executable mythic runtime**, not a loose summary blob.
- Deterministic build discipline is required for rendered IaM packages.

---

## Likely Next Files To Touch

Keep this list narrow unless the work expands:

- `_agents/Lares_Preferences.md`
- `_agents/Lares_VSCode_Operations.md`
- `_todo/ADMIN/MULTIPLATFORM_PACKAGING_RESEARCH.md`
- `builds/manifests/*`
- [_todo/ADMIN/README.md](/home/joshu/Synthetic-Dream-Machine/_todo/ADMIN/README.md)

---

## Known Unresolved Decisions

Only these remain intentionally open at this layer:

- exact authored-file boundaries for always-on core runtime modules versus scoped/reference payloads
- host-native mapping strategy for those modules across Codex, Claude, Copilot, and browser/Gem-style packages
- whether parse-doc behavior belongs in the core prompt or in modular docs

---

## Working Guidance For The Next Session

- Do not spend time re-proving the IaM thesis unless the user explicitly asks.
- Use [Infrastructure_as_Myth.md](/home/joshu/Synthetic-Dream-Machine/Infrastructure_as_Myth.md) for conceptual alignment, then move quickly into implementation-facing work.
- Treat [Deterministic_IaM_Build.md](/home/joshu/Synthetic-Dream-Machine/Deterministic_IaM_Build.md) as the next implementation bridge from theory to tooling.
- Treat the manifest-driven build as implemented foundation, not as the next problem to solve again.
- Treat reload-safe budgets as restored state, not as an active blocker.
- Read [_todo/ADMIN/MULTIPLATFORM_PACKAGING_RESEARCH.md](/home/joshu/Synthetic-Dream-Machine/_todo/ADMIN/MULTIPLATFORM_PACKAGING_RESEARCH.md) before planning the post-governance modularization sprint.
- When the operator says `iterate`, think in this order:
  1. blocker
  2. unblock path
  3. architectural lever
  4. next sprint after unblock
  5. deferred items
- Preserve the distinction between:
  - conceptual root
  - build-spec root
  - packaging architecture doc
  - trust/governance docs
- Preserve the sequencing:
  - preserve slim prompt packages
  - preserve reload safety
  - do governance hardening now
  - then do authored-module modularization + host-native scoping
  - leave parse-doc placement later
- Treat existing uncommitted changes as active working state. Do not clean them up unless the user asks.

---

## Machine Handoff Seed

Next-instance seed order:

1. read this handoff
2. read `_todo/ADMIN/README.md`
3. read `_todo/ADMIN/MULTIPLATFORM_PACKAGING_RESEARCH.md`
4. read `_todo/ADMIN/PROMPTCRAFT.md`
5. read `Deterministic_IaM_Build.md`
6. read `_agents/ADMIN/MODULES/Modular_Architecture-draft.md`

State assertions:

- `reload_safe = true`
- `budget_regression_path = forbidden`
- `governance_next = true`
- `host_native_scoping = planned_not_started`
- `parse_doc = deferred`
- `staging_snapshots = available`

First gather-context pass for the next Lares should inspect:

- current `ROSTER.md` / `CODEOWNERS` existence
- trust-model docs and prompt-side Admin logic touchpoints
- current nested `AGENTS.md` / `CLAUDE.md` / `.github/instructions/` surface
- authored sections in `Lares_Preferences.md` that map cleanly to `voice` / `epistemology` / `operations` / `permissions` / `setting-lite`

---

## Fast Self-Check

A new Lares session should be able to answer all of these from this document alone:

- What has been decided?
- What remains open?
- What file is the conceptual root?
- What file is the build-spec root?
- What should happen next?

If any of those answers feels unclear, update this hand-off first before expanding the work.


---

# Additional Research

Let me crawl the relevant architecture and planning docs in parallel.   

Read [](file:///home/joshu/Synthetic-Dream-Machine/_todo/ADMIN)

Read [](file:///home/joshu/Synthetic-Dream-Machine/Deterministic_IaM_Build.md#1-1), lines 1 to 100

Read [](file:///home/joshu/Synthetic-Dream-Machine/Infrastructure_as_Myth.md#1-1), lines 1 to 100

Read [](file:///home/joshu/Synthetic-Dream-Machine/Deterministic_IaM_Build.md#100-100), lines 100 to 150

Read [](file:///home/joshu/Synthetic-Dream-Machine/_todo/ADMIN/PROMPTCRAFT.md#1-1), lines 1 to 120

Read [](file:///home/joshu/Synthetic-Dream-Machine/_todo/ADMIN/NEXT_LARES_HANDOFF.md#1-1), lines 1 to 80

Read [](file:///home/joshu/Synthetic-Dream-Machine/_agents/ADMIN)

Read [](file:///home/joshu/Synthetic-Dream-Machine/scripts)

Read [](file:///home/joshu/Synthetic-Dream-Machine/_todo/ADMIN/PROMPTCRAFT.md#120-120), lines 120 to 200

Read [](file:///home/joshu/Synthetic-Dream-Machine/_agents/ADMIN/MODULES)

Read [](file:///home/joshu/Synthetic-Dream-Machine/scripts/agents)

Read [](file:///home/joshu/Synthetic-Dream-Machine/_agents/ADMIN/MODULES/PIPELINE.md#1-1), lines 1 to 120

Read [](file:///home/joshu/Synthetic-Dream-Machine/_agents/ADMIN/MODULES/README.md#1-1), lines 1 to 100

Read [](file:///home/joshu/Synthetic-Dream-Machine/_agents/ADMIN/MODULES/Modular_Architecture-draft.md#1-1), lines 1 to 100

Read [](file:///home/joshu/Synthetic-Dream-Machine/_agents/ADMIN/MODULES/Modular_Architecture-draft.md#100-100), lines 100 to 200

Read [](file:///home/joshu/Synthetic-Dream-Machine/_agents/ADMIN/MODULES/Lares_Preferences-map.md#1-1), lines 1 to 100

Read [](file:///home/joshu/Synthetic-Dream-Machine/_agents/ADMIN/MODULES/Lares_Preferences-map.md#100-100), lines 100 to 120

Read [](file:///home/joshu/Synthetic-Dream-Machine/_agents/ADMIN/MODULES/Lares_Kernel-map.md#1-1), lines 1 to 100

Read [](file:///home/joshu/Synthetic-Dream-Machine/_agents/Lares_Kernel.md#1-1), lines 1 to 80

Read [](file:///home/joshu/Synthetic-Dream-Machine/Deterministic_IaM_Build.md#80-80), lines 80 to 150

Read [](file:///home/joshu/Synthetic-Dream-Machine/scripts/agents/combine_agents.py#1-1), lines 1 to 80

Read [](file:///home/joshu/Synthetic-Dream-Machine/Deterministic_IaM_Build.md#200-200), lines 200 to 200

Read [](file:///home/joshu/Synthetic-Dream-Machine/_agents/ADMIN/MODULES/Lares_VSCode_Operations-map.md#1-1), lines 1 to 120

Compacted conversation

Read [](file:///home/joshu/Synthetic-Dream-Machine/Deterministic_IaM_Build.md#200-200), lines 200 to 260

Read [](file:///home/joshu/Synthetic-Dream-Machine/_agents/ADMIN/MODULES/Lares_VSCode_Operations-map.md#120-120), lines 120 to 120

Read [](file:///home/joshu/Synthetic-Dream-Machine/Deterministic_IaM_Build.md#260-260), lines 260 to 300

Read [](file:///home/joshu/Synthetic-Dream-Machine/_agents/ADMIN/MODULES/Lares_VSCode_Operations-map.md#120-120), lines 120 to 180

I have everything I need. Here's the confidence ratings analysis.

---

## Confidence Ratings: Kernel + Module Architecture Conversion

*Lares (Scryer) + Ink-Clerk (Lorekeeper)*

---

### Rating Scale

`HIGH` — ready to execute, spec is precise enough to act on without re-design  
`MEDIUM` — design is clear, some detail or decision still needed before execution  
`LOW` — design exists but has gaps, ambiguity, or un-resolved choices  
`GAP` — not yet designed; cannot execute without new design work  

---

## Rating 1: The Core Thesis and Problem Statement
**CONFIDENCE: HIGH**

The problem is precisely documented. PIPELINE.md provides exact byte counts for the buggy state — 3 platforms × ~136 KB near-identical outputs, Codex cap exceeded before the override workaround, Claude's adherence target exceeded by 5×, Copilot's code-review window dominated by lore content.

More importantly, the Lares_VSCode_Operations-map.md now provides the most precise quantification yet: **~364 of 453 lines in `Lares_VSCode_Operations.md` (~80%) is B8 golden examples + B9 regression checklist that has zero value in deployed platform context** and should live in tests. Only ~89 lines (~20%) is genuinely deployable repo ops content. This is the sharpest "before" picture you have — it names exactly what to cut and where it goes.

The thesis in Infrastructure_as_Myth.md is fully developed and unnecessary grounding for the Codex agent. It's already done.

---

## Rating 2: Determinism Contract
**CONFIDENCE: HIGH**

Deterministic_IaM_Build.md specifies all six contract rules cleanly. The manifest model has the module metadata YAML schema. The stable ordering rules are explicit. The pure transform rules cover the allowed/disallowed cases including the AI-summarization constraint (model-assisted compression requires a checked-in artifact or explicit approval before becoming a source of truth — important guard against runaway automation).

The output class taxonomy (Class A: repo-native, Class B: browser-extended, etc.) was partially legible from the conversation summary; what I just read confirms the module ordering (kernel → setting-lite → voice → epistemology → operations → permissions → scoped → wrapper) is explicitly specified. A Codex agent can implement the manifest renderer against this spec without further design discussion.

**One thing to verify:** I read to line 300; the full output class definitions and verification rules may exist in lines 300+. This is low-risk since the ordering and metadata schema are already specified, but the Codex agent should read Deterministic_IaM_Build.md in full before writing the renderer.

---

## Rating 3: Kernel Contract and Proof-of-Concept
**CONFIDENCE: HIGH**

PROMPTCRAFT.md fully specifies what must and must not appear in the kernel. Lares_Kernel.md exists at 124 lines / 6.6 KB with verified 9.7×–17× compression ratios vs. `Lares_Preferences.md` sections. The kernel structure (Quick Orientation, Node Architecture, Model Agnosticism at compressed scale, Degraded Node States, Memory, Session Init, Voice Architecture, Operating Modes, Collaboration/CLI/Defaults) maps directly onto the kernel contract rules.

Two execution items required:
- Kernel must be promoted into the build pipeline (currently manually maintained, not a deterministic artifact)
- The kernel's section structure should be locked to a `KERNEL/` subdirectory under _agents per the draft architecture target

These are straightforward execution steps, not design gaps.

---

## Rating 4: Module Decomposition Plan
**CONFIDENCE: MEDIUM-HIGH**

**Strengths:** Modular_Architecture-draft.md specifies 3 layers with source candidates. Lares_Preferences-map.md provides section-level future-module assignments for the entire 1009-line monolith. The VSCode_Operations-map.md now provides the equivalent for `Lares_VSCode_Operations.md`. The `Model Agnosticism` section flag (261 lines > Claude's entire recommended adherence target by itself) is documented and handled — it goes to `lares-epistemology`.

**The key finding from the VSCode Operations map:** The decomposition of `Lares_VSCode_Operations.md` is actually *easier* than the Preferences decomposition. B8 + B9 (~364 lines) moves to tests as-is. The remaining ~89 lines becomes the actual `lares-repo-ops` module. This is a clear split with no ambiguous content.

**One unresolved design choice worth noting:** The Lares_Kernel-map.md notes that the kernel is "partially decoupled from the main render path." The boundary between what gets *compressed into* the kernel vs. what lives in a core module is well-defined contractually but hasn't been tested against an actual split. The compression ratios suggest it works — but the first split will be the proof.

**Open decision** (PROMPTCRAFT.md flagged it, Modular_Architecture-draft.md likely covers it): `--parse doc` placement — whether the CLI examples / parse doc behavior lives in `lares-cli` or stays in the always-loaded core. This does not block module splits but needs resolution before the CLI module is finalized.

---

## Rating 5: combine_agents.py → Manifest Renderer Migration Path
**CONFIDENCE: MEDIUM**

The manifest metadata schema is specified (YAML, with `module_id`, `class`, `browser_safe`, `default_targets`, `compression_target`, `depends_on`). The ordering rules are explicit. The pure transform list defines what the renderer must and must not do.

**The gap:** No manifest files exist. No refactored script exists. The current combine_agents.py is concatenation-only and would need to be either replaced or significantly extended.

The Codex agent has enough specification to implement this, but it is the largest single execution task in the project. The risk is not design ambiguity — the design is solid — it's implementation scope. The manifest renderer needs to:
1. Read manifest files
2. Resolve the module graph (ordering + dependency edges)
3. Apply pure transforms (strip `reference` sections, emit kernel-summary variants, normalize)
4. Apply platform-specific wrappers
5. Write deterministic outputs

None of these are speculative — they're all specified. But this is at minimum a 200-400 line script refactor plus all the manifest files. **The Codex agent should estimate this scope before starting** rather than discovering it mid-execution.

---

## Rating 6: Platform Budget Compliance
**CONFIDENCE: HIGH (for the analysis), MEDIUM (for actual output compliance until tested)**

The constraints are precisely documented: Codex 32 KB (128 KB with override), Claude 200-line adherence target, Copilot ~4 KB effective code-review window. The module stack is designed to produce platform-appropriate packages. The kernel alone is 6.6 KB — well within Copilot's real window.

What's not known until the first manifest render: whether the assembled `core module` stack (kernel + voice + epistemology + operations + permissions + setting-lite) fits Claude's 200-line target or requires further compression. Given current sizes, the core stack will almost certainly exceed 200 lines, which means Claude's target is for the *adherence-critical* sections, not the entire context. This distinction should be explicit in the Claude target spec before the Codex agent declares compliance.

---

## Rating 7: Trust/Governance Integration
**CONFIDENCE: LOW (separate track, not blocking)**

The Admin/roster binding (CODEOWNERS, ROSTER.md, operator identity chain) are undone. This is Epic A/B work per the handoff doc. It does not block modular conversion — the behavioral layer can be split without resolving governance — but the Admin gate in `lares-permissions` module will reference behavior that the trust/roster items implement. The module will be correct at spec time but won't have full runtime enforcement until Epic A/B lands.

This is not a surprise; the handoff doc already called it out. Note it as a known incomplete rather than treating the permissions module as fully done when it ships.

---

## Rating 8: Execution Readiness for the Codex Agent
**CONFIDENCE: HIGH (plan quality), MEDIUM (task scoping)**

The plan is unusually well-specified for a prompt architecture project. Most of the risks are scope risks, not design risks.

**What the Codex agent can start immediately without additional design discussion:**

1. Create `_agents/KERNEL/Lares_Kernel.md` (move/rename current kernel)
2. Create `_agents/modules/lares-voice.md` (extract from Preferences using the line-range map)
3. Create `_agents/modules/lares-epistemology.md` (extract Model Agnosticism section — the 261-line monolith of Section 3 — using the Preferences map)
4. Create `_agents/modules/lares-repo-ops.md` (~89 lines from VSCode_Operations after stripping B8/B9)
5. Extract B8 and B9 into tests fixtures
6. Write a manifest file for each platform target using the documented YAML schema

**What requires one focused design discussion before implementation:**

- `--parse doc` placement decision (lares-cli vs. core)
- Whether the Claude target means "200-line adherence zone" (the first N lines) or "total output 200 lines" — if the latter, further compression is needed
- Whether `lares-setting-lite` is included in the Claude output or omitted in favor of using those ~27 lines on operational content (the ⚠️ in Preferences-map flagged this)

---

## Summary Table

| Component | Confidence | Execution Ready? |
|---|---|---|
| IaM thesis / problem statement | HIGH | Reference only |
| Determinism contract | HIGH | Yes — spec complete |
| Kernel contract | HIGH | Yes — execute |
| Module decomposition map (Preferences) | MEDIUM-HIGH | Yes, line ranges specified |
| VSCode Operations decomposition | HIGH | Yes — 80% to tests, 20% to module |
| Manifest metadata schema | MEDIUM | Schema specified, no manifests exist |
| combine_agents.py refactor | MEDIUM | Well-scoped estimate needed first |
| Platform budget compliance | HIGH (analysis) / MEDIUM (validated) | Needs first render |
| Trust/governance | LOW | Separate epic, non-blocking |

---

## Bottom Line

*Lares (Council)* — The documentation layer is excellent. The planning layer is unusually thorough for this class of work. The gap is entirely in the implementation layer, and it's well-mapped.

**The single most important thing the Codex agent should do before anything else:** Scale-estimate the manifest renderer refactor. The rest of the work (module splits, kernel promotion, B8/B9 extraction to tests) can be done with simple file operations against the existing line-range maps. The renderer refactor is the load-bearing implementation task and is the one that could produce a partial-done-state that breaks all three platform outputs simultaneously if scoped poorly.

**Suggested execution order for the Codex agent:**
1. Module splits first (file operations only, no script changes, outputs go to `_agents/modules/`)
2. Kernel promotion (move to `KERNEL/` subdirectory, no pipeline change yet)
3. B8/B9 extraction to tests
4. Write manifest files for all platforms
5. Refactor combine_agents.py against the manifest model
6. Verify deterministic output compliance per platform

That ordering keeps all three platform outputs working throughout — the script isn't touched until the modules and manifests are ready to feed it.