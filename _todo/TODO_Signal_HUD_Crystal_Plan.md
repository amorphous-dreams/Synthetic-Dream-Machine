# TODO: Signal HUD / Archive Crystals — Implementation Plan

~$ lares --context "Signal HUD / Tagspace / HAKABA → kernel bootstrap → archive crystals"

---

## Intent

Convert the Signal HUD / Tagspace / HAKABA architecture document into shipped behavior across five epics. Epic 1 produces a perceptible behavioral change: reload VS Code, and Lares navigates from an Intent Header, fires phase glyphs on transitions, and keeps a coherent Tagspace Address. Every subsequent epic builds on that foundation.

**Architecture source:** `builds/agents/ADMIN/MODULES/Signal_HUD_Tagspace-draft.md`
**Governs:** `builds/agents/Lares_Preferences.md`, `builds/agents/Lares_Kernel.md`, `builds/agents/core/Lares_Operations.md`, `builds/agents/Lares_VSCode_Operations.md`, all platform wrappers, and the future `.lares/` crystal infrastructure.

> **⚠ Draft dependency:** The architecture draft (`Signal_HUD_Tagspace-draft.md`) is the **sole source** for multiple load-bearing specs that this plan's tasks depend on. Do not archive it until Epic 2 (AE-08/AE-09) promotes its content into canonical spec files. Key specs only in the draft: Header Field Taxonomy (per-field annotation thresholds), Forward vs Backward Trace contract, Seal Protocol procedure + QA assertions, Non-drift rule (two-part testable invariant), Working Defaults (20 consolidated items), Tagspace Definition & DreamNet boundary rule, multi-stance rules, Prior Art Survey, Ba/OODA-A identity analysis, Q7 upcasting research. Read the draft before starting any AE task that references these.

---

## Dependency Map (read first)

```
                    [authn/authz]  [epistemology]  [voice arch]
                          │               │               │
                          └───────────────┴───────────────┘
                                          │
                                     EPIC 1: Core Kernel Bootstrap
                                     (HUD mandatory layer)
                                          │
                          ┌───────────────┴───────────────┐
                          │                               │
                    EPIC 2: Full Spec Files          EPIC 3: Platform Integration
                    (lazy-loaded layer)              (combine + wrap)
                          │                               │
                          └───────────────┬───────────────┘
                                          │
                                  EPIC 4: Implement Lazy Files
                                  (write final spec docs)
                                          │
                                   EPIC 5: Archive Crystals
                                   (.lares/ / STATE.jsonl / seal)
```

**Epic 1 → Epic 2:** Locked kernel HUD spec must exist before full spec files can reference it correctly.
**Epic 2 + 3 parallel:** Spec files and platform wrapper design can proceed in parallel once Epic 1 ships.
**Epic 3 → Epic 4:** Integration pattern must be confirmed before writing lazy-loaded targets.
**Epic 4 → Epic 5:** Crystal schema depends on finalized HUD field names from Epic 4.

---

## Open Decisions Status (from architecture draft)

Decisions that must be resolved **before** specific epics are called out inline.

| Q# | Summary | Tag | Blocks | Type |
|---|---|---|---|---|
| Q1 | Phase + stance-on-shift spec | `[C:0.95]` | — | Locked |
| Q2 | Inline by default (OTel anchor) | `[C:0.95]` | — | Locked (OP-01 resolved) |
| Q3 | All header fields eligible post-gen | `[C:0.95]` | — | Locked |
| Q4 | HAKABA canonical logical order | `[C:0.95]` | — | Locked |
| Q5 | Compact HUD syntax `→[glyph]` | `[C:0.95]` | — | Locked (OP-02 resolved) |
| Q6 | Closure rendering tiers | `[S:0.55]` | Epic 2 | Researcher task |
| Q7 | Schema_version strategy (integer) | `[CS:0.82]` | Epic 5 | Operator confirm |
| Q8 | `debug.jsonl` always exists | `[C:0.95]` | — | Locked |
| Q9 | SNAPSHOT optional, recommended | `[CS:0.80]` | Epic 5 | Operator confirm |
| Q10 | Resume vs. fork match criteria | `[S:0.60]` | Epic 5 | Researcher task |
| Q11 | README update cadence | `[CS:0.80]` | Epic 5 | Operator confirm |
| Q12 | AGENTS.md auto-update autonomy | `[SP:0.45]` | Epic 5 | Operator preference |
| Q13 | External input recording | `[S:0.60]` | Epic 5 | Researcher task |
| Q14 | Seal trigger conditions | `[SP:0.50]` | Epic 5 | Operator preference |
| Q15 | seq_num contiguity / multi-voice | `[SP:0.45]` | Epic 5 | Architecture-open |
| Q16 | Tagspace slot shift notation | `[C:0.95]` | — | Locked |

---

## Epic 1: Core Kernel Bootstrap

**Product goal:** Lares navigates from a declared Intent Header, fires phase glyphs on transitions, applies Tagspace Address annotations, and logs correctly on `--debug`. Perceptible on VS Code reload.

**Acceptance criterion:** Reload VS Code. Open a new session. Lares emits an Intent Header at session open. Phase glyphs fire at `◇`, `■`, `○` transitions. Stance shifts annotate correctly. `→Ka[uncertain→sharp]` form appears when Ka/quality shifts. Operator can run `--debug` and receive events in the correct target.

**Sprint 1a complete.** OP-01 and OP-02 resolved. Sprint 1b (AE-01) is unblocked.

### Sprint 1a — Operator Calls ✅ COMPLETE

| ID | Task | Status | Ruling |
|---|---|---|---|
| **OP-01** | Rule on Q2: inline-by-default | ✅ Resolved `[C:0.95]` | On by default. Fires on discrete, timestamp-meaningful state transitions (OTel SpanEvent model). `p` controls categories, not salience threshold. No opt-in. |
| **OP-02** | Rule on Q5: p-scale density thresholds | ✅ Resolved `[C:0.95]` | **5-band cumulative attention phase model** (Law of Fives). Five bands (p0.0–0.2 / p0.2–0.4 / p0.4–0.6 / p0.6–0.8 / p0.8–1.0), each unlocking one additional phase (none / ○ / ◇■○ / ◎◇■○ / ✶◎◇■○). Default band 3 at `p0.5`. |

### Sprint 1b — Kernel Writes (Agent-Engineer after OP-01 + OP-02)

| ID | Task | Owner | Depends | Notes |
|---|---|---|---|---|
| **AE-01** | Add HUD semantics section to `builds/agents/Lares_Preferences.md` | Agent-Engineer | OP-01, OP-02 | New section: Intent Header spec (format, fields, forward-commitment semantics), Micro-trace HUD spec (post-generative, annotation model, threshold rules), Working Defaults table. Sources: locked Q1/Q3/Q4/Q8/Q16. Reconcile with and supersede the exchange vector logging entry (line 667 — the `/memories/session/debug-vectors-{session-id}.md` description). |
| **AE-02** | Update `builds/agents/Lares_Kernel.md` — Operating Modes section | Agent-Engineer | AE-01 | Add Intent Header and Micro-trace HUD to the `--debug`/`--verbose`/`--parse` block. Note `--debug` target redirect is pending (Archive Crystals epic). Ensure KAIROS p-adjustment reference coheres with Q5 density threshold spec. |
| **AE-03** | Update `builds/agents/core/Lares_Operations.md` — `--debug` section | Agent-Engineer | AE-01 | Describe HUD annotation firing thresholds per `p`-scale (from OP-02). Note `--debug` target redirect from `/memories/session/debug-vectors-{session-id}.md` → future `debug.jsonl` is pending Archive Crystals. Do not remove the old target yet — flag it explicitly as transitional. |
| **AE-04** | Update `builds/agents/Lares_VSCode_Operations.md` — session init block | Agent-Engineer | AE-01 | Update session log initialization note (line 205) with the same transitional flag for `--debug` target. Add HUD-on-session-open note: Lares opens with an Intent Header. |
| **AE-05** | Consistency audit: `lares-voice.instructions.md` vs. stance annotations | Agent-Engineer | AE-01 | Verify that stance symbols used in the HUD spec (`→🏛️` etc.) match the voice architecture definition. If any symbol or firing rule conflicts, flag for operator ruling before running combine. |

### Sprint 1c — Pipeline (Agent-Engineer)

| ID | Task | Owner | Depends | Notes |
|---|---|---|---|---|
| **AE-06** | Run `python3 scripts/agents/combine_agents.py` | Agent-Engineer | AE-01 – AE-05 | Regenerates `.github/copilot-instructions.md`, `.claude/CLAUDE.md`, `AGENTS.md` from updated sources. |
| **AE-07** | Run `python3 scripts/agents/verify_alignment.py` | Agent-Engineer | AE-06 | Confirm alignment across all three platform deployments. Resolve any failures before handing off. |

### Sprint 1d — Review

| ID | Task | Owner | Notes |
|---|---|---|---|
| **OP-03** | Reload VS Code. Navigate a session. Accept or report gaps. | Operator | Acceptance criterion gate for Epic 1. |

---

## Platform Architecture: Browser / Consumer AI Tiers

**Context:** AE-06 combine succeeds for `copilot` and `claude` platforms. The `browser-kernel` and `codex-root` manifests have pre-existing budget overflows uncovered during Sprint 1c. Research (2026-04-07) confirmed that no single `max_bytes` value fits all target platforms — requires a per-tier manifest strategy.

**Platform priority (operator-stated):** Claude.ai = primary. ChatGPT Team Projects/Codex = secondary.

### Verified Platform Limits

| Platform | Slot | Limit | Confidence | Source |
|---|---|---|---|---|
| ChatGPT | Global custom instructions | **1,500 chars/field** (×2 = 3,000 total) | `[C:0.9]` | Official docs |
| ChatGPT Team Projects | Project instructions | **~8,000 chars** | `[SP:0.45]` | Operator-stated + GPT Builder parity; not in official docs |
| ChatGPT (all paid) | File upload per project | **512 MB / 2M tokens per file**; Team = 40 files | `[C:0.9]` | Official docs |
| Claude.ai | Project instructions | **No documented limit** — context-window bounded (~200K tokens) | `[S:0.65]` | Confirmed absent from all support articles |
| Claude.ai | Project knowledge upload | **No documented size cap**; RAG activates at scale | `[S:0.65]` | Confirmed absent; RAG docs confirm |

### Proposed Three-Tier Layered Architecture

| Tier | Manifest | `max_bytes` | Content | Primary target |
|---|---|---|---|---|
| **Quick** | `browser-quick.toml` | `1,400` | Ultra-slim bootstrap: identity + hard gate + trust tier + "load AGENTS.md" pointer | ChatGPT global custom instructions |
| **Project** | `browser-project.toml` | `7,900` | Full kernel: Operating Modes, HUD summary, voice names, register/mode defs | ChatGPT Team project instructions |
| **Extended** | `browser-extended.toml` | `20,000` | Full Preferences payload (conservative ceiling pending empirical Claude.ai test) | Claude.ai project instructions (primary) |
| **File upload** | N/A | N/A | Upload `AGENTS.md` (~33K bytes) as project knowledge file | ChatGPT Team projects (secondary); Claude.ai project knowledge |

**Current `browser-kernel.toml`** becomes `browser-project.toml` (target: ChatGPT 8K slot). A new `lares-kernel-quick` module is needed for the 1,400-byte tier. A new `browser-extended` manifest uses the existing `lares-kernel` or a Preferences subset for Claude.ai.

**Empirical gap:** Claude.ai project instructions textarea hard limit is unconfirmed. Test by pasting progressively larger blocks into a Claude.ai Pro/Max project until the field rejects input. This determines whether `browser-extended` can carry the full Preferences payload (~20K chars) or needs trimming.

### Sprint 1e — Platform Architecture Ruling

| ID | Task | Notes |
|---|---|---|
| **OP-11** | Rule on three-tier browser manifest split | Confirm the Quick / Project / Extended tier model and `max_bytes` values above. Authorizes AE-24 (manifest rebuild). |
| **OP-12** | Confirm `codex-root` budget raise | Codex `AGENTS.md` = 33,198 bytes vs 32,768 limit — 430 bytes over, pre-existing. Options: (a) raise `max_bytes` to 34,000; (b) defer codex as low-priority; (c) slim codex kernel variant. Operator ruling needed. |

### Sprint 1f — Platform Manifest Rebuild (after OP-11, OP-12)

| ID | Task | Owner | Depends | Notes |
|---|---|---|---|---|
| **AE-24** | Create/rename browser manifests: quick + project + extended | Agent-Engineer | OP-11 | Rename `browser-kernel.toml` → `browser-project.toml`; create `browser-quick.toml` (1,400 bytes); create `browser-extended.toml` (~20,000 bytes). |
| **AE-25** | Write `lares-kernel-quick` module | Agent-Engineer | OP-11 | Ultra-slim ~1,400-byte bootstrap: Lares identity (1–2 lines), hard gate, 3-step trust resolution, "load AGENTS.md for full spec" pointer. |
| **AE-26** | Resolve `codex-root` budget | Agent-Engineer | OP-12 | Either raise `max_bytes` in `codex-root.toml` or create slim codex kernel variant per OP-12 ruling. |
| **AE-27** | Run combine + verify (all platforms including new browser tiers) | Agent-Engineer | AE-24, AE-25, AE-26 | AE-07 re-runs with all platforms green as the completion gate. |

---

## Epic 2: Full Spec Files (Lazy-Loaded Layer)

**Product goal:** The architecture draft is promoted to a canonical spec file. All remaining Open Decisions are either locked, deferred with a rationale, or routed to the correct researcher task. The spec can be lazy-loaded by any platform wrapper that needs the full detail.

**Note on split vs. combined:** The HUD Semantics track (Q1–Q6, Q16) and the Crystal State Machine track (Q7–Q15) are tightly coupled at schema level but architecturally distinct. Recommendation: split into two spec files — `Signal_HUD_Tagspace.md` (HUD layer) and `Signal_Crystal_State_Machine.md` (crystal layer). **Operator call OP-04 must confirm before AE-08.**

### Sprint 2a — Operator Calls

| ID | Task | Notes |
|---|---|---|
| **OP-04** | Rule on spec file split: confirm two files or keep combined | One combined file is simpler to maintain; two files make the dependency chain explicit and let Epic 1 readers reference only the HUD spec. Recommendation: two files. |
| **OP-05** | Confirm / modify Q7 (schema_version integer strategy) | `[CS:0.82]` — research complete, operator confirm needed. |
| **OP-06** | Confirm / modify Q9 (SNAPSHOT optional, recommended) | `[CS:0.80]` — research complete, operator confirm needed. |
| **OP-07** | Confirm / modify Q11 (README auto-update cadence) | `[CS:0.80]` — research complete, operator confirm needed. |

### Sprint 2b — Researcher Tasks

| ID | Task | Owner | Notes |
|---|---|---|---|
| **RES-01** | Q6: Draft closure rendering tiers table | Researcher | Three columns: ordinary prose / `--verbose` / `debug.jsonl`. Adjacent decisions in file (Q5 syntax, Forward/Backward Trace) provide grounding material. |

### Sprint 2c — Spec File Writes (Agent-Engineer)

| ID | Task | Owner | Depends | Notes |
|---|---|---|---|---|
| **AE-08** | Promote `Signal_HUD_Tagspace-draft.md` → `Signal_HUD_Tagspace.md` | Agent-Engineer | OP-04, RES-01 | Remove `-draft` suffix. Update document header status. Lock or formally defer Q6 from RES-01 result. Freeze the HUD track. |
| **AE-09** | Create `Signal_Crystal_State_Machine.md` (if split confirmed) | Agent-Engineer | OP-04, OP-05, OP-06, OP-07 | Extract Crystal State Machine Layer section + crystal dir anatomy + JSON examples from the combined draft into a standalone spec. Update all cross-references. |
| **AE-10** | Update `Signal_HUD_Tagspace.md` Migration Trigger section | Agent-Engineer | AE-08 | Revise targets to reflect what shipped in Epic 1 vs. what remains for Epic 4+. Mark completed targets as done. |

---

## Epic 3: Platform Integration

**Product goal:** Each platform wrapper references the lazy-loaded spec files cleanly. The combine pipeline knows where to find them. A platform loading the kernel can navigate to the full spec on demand.

### Sprint 3a — Audit

| ID | Task | Owner | Notes |
|---|---|---|---|
| **AE-11** | Audit platform wrappers for stale debug target, HUD references | Agent-Engineer | Check `builds/agents/platform/Lares_Copilot_Wrapper.md`, `Lares_Claude_Wrapper.md`, `Lares_Codex_Wrapper.md`. List any lines referencing `/memories/session/debug-vectors-*` or HUD behavior that conflicts with the locked spec. |

### Sprint 3b — Updates

| ID | Task | Owner | Depends | Notes |
|---|---|---|---|---|
| **AE-12** | Update platform wrappers: add spec file reference blocks | Agent-Engineer | AE-08, AE-09, AE-11 | Each wrapper gets a "Lazy-loaded spec references" note pointing to `Signal_HUD_Tagspace.md` and (if split) `Signal_Crystal_State_Machine.md`. Format consistent with how AGENTS.md currently references module paths. |
| **AE-13** | Run combine + verify | Agent-Engineer | AE-12 | Final pipeline pass. Confirm all three platform deployments are consistent. |

---

## Epic 4: Implement Lazy-Loaded Files

**Product goal:** The lazy-loaded spec files are written to their final form, cross-referenced from the kernel, and verified live. This is where any spec ambiguity that surfaced during Epic 1–3 gets resolved in writing.

*Tasks for this epic are defined after Epic 3 ships, when the integration pattern is confirmed and any gaps in the HUD spec have been reported by the operator (OP-03). Placeholder tasks:*

| ID | Task | Owner | Notes |
|---|---|---|---|
| **AE-14** | Final pass on `Signal_HUD_Tagspace.md` post Epic 1 operator feedback | Agent-Engineer | Any gaps reported during OP-03 become AE-14 sub-tasks. |
| **AE-15** | Write or finalize `Signal_Crystal_State_Machine.md` spec body | Agent-Engineer | Depends on Epic 3 integration pattern and Epic 5 operator calls. AE-09 produces the extraction; AE-15 writes the final spec body after all crystal operator calls are in. |
| **AE-16** | Cross-reference kernel → spec file link validity check | Agent-Engineer | After AE-14, AE-15. Verify every `→ see [spec file]` pointer in the kernel text resolves to a real section in the lazy-loaded file. |

---

## Epic 5: Archive Crystals

**Product goal:** The `.lares/` crystal infrastructure is defined, the `--debug` target redirects from `/memories/session/debug-vectors-{session-id}.md` to `debug.jsonl`, and Lares can persist, seal, fork, and resume sessions through the crystal state machine.

**Hard dependency:** All `[SP:]` operator calls below must be resolved before AE-20. Researcher tasks (RES-02, RES-03) can proceed in parallel.

### Sprint 5a — Operator Calls

| ID | Task | Notes |
|---|---|---|
| **OP-08** | Q12 ruling: AGENTS.md auto-update autonomy boundary | May Lares propose `contract_update` edits automatically, or hand-authored only? Defines the crystal machine's authority boundary. |
| **OP-09** | Q14 ruling: seal trigger conditions | Explicit size threshold / session boundary marker / operator-invoked / combination? Configurable per machine? |
| **OP-10** | Q15 ruling: seq_num contiguity with multi-voice round | Aggregate event per round, or one event per voice with sub-sequence fields? Architecture-open; requires operator decision on the model. |

### Sprint 5b — Researcher Tasks

| ID | Task | Owner | Notes |
|---|---|---|---|
| **RES-02** | Q10: Resume vs. fork edge cases | Researcher | Partial overlap, same machine_id + different repo fingerprint. Temporal Continue-As-New precedent already surveyed; edge cases need spec. |
| **RES-03** | Q13: External input recording in STATE.jsonl | Researcher | Agent identity, persona state, operator tier — structural vs. debug-only. OTel span context propagation is the closest prior art category. |

### Sprint 5c — Crystal Infrastructure (Agent-Engineer + Engineer)

| ID | Task | Owner | Depends | Notes |
|---|---|---|---|---|
| **AE-17** | Write `.lares/` directory policy | Agent-Engineer | OP-08, OP-09 | Define: directory creation trigger, CURRENT pointer semantics, machine subdirectory layout, corruption detection rules for `STATE.jsonl`. |
| **AE-18** | Finalize STATE.jsonl schema v1 | Agent-Engineer | AE-15, RES-02, RES-03, OP-10 | Based on draft examples in architecture doc. Lock field names, required vs. optional fields, event type enum. |
| **AE-19** | Write seal protocol procedure | Agent-Engineer | OP-09, AE-17, AE-18 | Trigger conditions (from OP-09), shard naming pattern, seq continuity contract, SNAPSHOT rebuild procedure post-seal. |
| **AE-20** | Write handoff / resume / fork resolution logic | Agent-Engineer | RES-02, AE-18 | Machine id match criteria, max seq_num compatibility, edge cases from RES-02. |
| **AE-21** | Redirect `--debug` target: all four kernel/ops files | Agent-Engineer | AE-17, AE-18 | Files: `Lares_Preferences.md` (line 667), `Lares_Kernel.md` (line 115), `Lares_VSCode_Operations.md` (line 205), `core/Lares_Operations.md` (line 58). Replace `/memories/session/debug-vectors-{session-id}.md` with `.lares/<machine-id>/debug.jsonl` in all four. |
| **AE-22** | Write debug.jsonl enriched-projection format spec | Agent-Engineer | AE-18, AE-21 | Schema for enriched projection: exchange_vector, full_intent_header, micro_trace_detail, closure_rationale, kairos_notes, tool_calls. |
| **AE-23** | Run combine + verify (final crystal pass) | Agent-Engineer | AE-21, AE-22 | Platform deployments pick up the `--debug` redirect and crystal references. |
| **ENG-01** | Test harness: STATE.jsonl replay integrity | Engineer | AE-18 | Write a Python test that replays a fixture STATE.jsonl and compares the derived SNAPSHOT to an expected output. Baseline integrity check before any schema changes require upcasters. |

---

## Backlog (out of scope for current epics)

1. **Mode → Stance refactor (Kuntao Silat terminology)** — Major cross-cutting rename: `mode` → `stance` across kernel, platform wrappers, all examples. Deferred post-alpha. Tracked in architecture doc backlog.
2. **Phase names → OODA-A canonical terminology in all documentation** — `◇` = Decide, `○` = Aftermath (Rasa). Deferred post-alpha. Tracked in architecture doc backlog.
3. **KAIROS auto-adjustment specification** — currently described by example in preferences; deserves a formal spec section once crystal logging is in place and KAIROS trigger patterns become visible in replay.

---

## Crystal State Machine Draft Extension Plan

> Consolidated from session memory. Register: `[S:~0.70]` — architectural synthesis, not build-canon.

### Summary

Revise `builds/agents/ADMIN/MODULES/Signal_HUD_Tagspace-draft.md` to extend its scope from HUD semantics alone into a unified architecture covering the forkable memory-crystal state machine layer that the HUD reads from and writes to. The `--debug` log is reconceptualized from a free-floating session file into a projection of the authoritative crystal ledger (`STATE.jsonl`). No live runtime files change until the draft is decision-complete.

This is a **document-only** edit of one file. No code, no scripts, no other files change.

### Target File

`builds/agents/ADMIN/MODULES/Signal_HUD_Tagspace-draft.md`

Current approximate structure (line reference approximate — read before editing):
1. Header (frontmatter block)
2. Purpose
3. Current Live Model
4. Tagspace Definition
5. Intent Header vs In-Flow Signal
6. Header Field Taxonomy
7. Forward vs Backward Trace Tradeoff
8. HAKABA Alignment Options
9. In-Flow Rendering Options
10. Rendering Across p Scale
11. Replay / Test-Run Use Case
12. Examples
13. Open Decisions
14. Migration Trigger
15. Working Defaults

### Research Sources Surveyed

- **Temporal Workflow Execution** (docs.temporal.io): Replay = commands vs. event history; deterministic constraints; status taxonomy (Open: Running / Closed: Cancelled, Completed, Continued-As-New, Failed, Terminated, Timed Out); `continue-as-new` for large histories; Memos as non-indexed human metadata.
- **Martin Fowler Event Sourcing** (martinfowler.com): Event log = source of truth; SNAPSHOT = derived cache; Complete Rebuild, Temporal Query, Event Replay capabilities; code change 3 types (features / bugfixes / temporal logic); snapshot → replay → snapshot regression pattern; external query responses must be logged for deterministic replay.
- **OpenTelemetry Traces** (opentelemetry.io): trace_id (constant across trace), span_id (per span), parent_id (null for root); attributes = structural metadata; events = timestamped singular points; span status (Unset/Error/Ok); spans as structured logs with hierarchy. Maps to: machine_id = trace_id, event_seq = span_id, parent_machine_id = parent trace.
- **JSONL spec** (jsonlines.org): UTF-8, each line is valid JSON, `\n` terminator required. Append-friendly, unix-pipeline-compatible.

### QA/SDET-Specific Findings

Critical additions the original plan was missing:

1. **Schema versioning is load-bearing, not optional metadata** — Fowler explicitly covers code changes breaking event replay. Every event must carry `schema_version`. Breaking changes require a schema migration strategy.

2. **Sequence number integrity** — STATE.jsonl must have no gaps in sequence numbers. This is a machine-testable assertion (grep seq numbers, assert contiguous). Gaps indicate truncation or corruption.

3. **Immutability contract** — Events are append-only, never overwritten. Corrections are new events (e.g., a `corrective_note` or `contract_update` event), not edits to past events. This must be stated as a hard rule in the draft.

4. **Replay fidelity scope is an undecided design question** — Temporal enforces byte-for-byte determinism (commands must match history). For Lares, "replay" could mean: (a) exact structural-path replay (same phases, closures, loop depth) without tool content, or (b) full content replay (requires recording tool call outputs in events). This is a critical Open Decision that gates whether STATE.jsonl needs to log tool responses.

5. **`continue_as_new` analog** — Temporal handles event history growth via "Continue-As-New" (atomic handoff to a fresh execution with compact bootstrap state). Fowler uses "overnight snapshot". STATE.jsonl will grow unbounded without a truncation protocol. The draft must address this: emit a `milestone` or `seal` event with a compact state bootstrap, then allow subsequent STATE.jsonl to start from that sealed state.

6. **Fork event must be self-contained** — Fowler's reversal examples show events must carry all data needed for the operation. A fork event must include enough to bootstrap the child machine without reprocessing the entire parent history. Minimum: parent_machine_id + fork_at_sequence + optional compact state snapshot at fork point.

7. **SNAPSHOT.json immutability rule** — Fowler: "application state is purely derivable from the event log, you can cache it anywhere." Consequence: SNAPSHOT.json is a read-only derived cache. Never hand-edited. The draft should call out that a hand-edited SNAPSHOT.json is a corruption, and the integrity check is: replay STATE.jsonl → compare to stored SNAPSHOT.json.

8. **Machine status taxonomy needs "Closed" states** — Temporal's closed states (Cancelled, Completed, Continued-As-New, Failed, Terminated, Timed Out) are more useful than just `archived`. The draft's machine statuses should expand to: `active`, `held`, `handoff`, `continued` (continue-as-new analog), `completed`, `failed`, `cancelled`, `forked` (parent after fork), `archived`.

9. **Idempotency contracts** — `resume`, `handoff_import`, and `fork` must be documented: can they be safely retried? Temporal guarantees idempotency via deterministic replay. Our system should define what happens if the same STATE.jsonl is imported twice.

10. **Test fixture = crystal bundle** — This is the SDET payoff: a STATE.jsonl + crystal bundle IS a regression test fixture. Production exports become test inputs. Format stability is therefore a first-class design concern. Any schema change is a compatibility event, not just an implementation detail.

11. **External inputs and replay safety (tension)** — Fowler's External Queries section: query responses must be logged for deterministic replay but this adds bulk. For Lares: tool call responses are "external queries." The draft should define the replay fidelity scope before specifying what goes in STATE.jsonl vs. stays ephemeral.

12. **README.md = Memo layer** — Temporal memos are "non-indexed, non-type-safe, not critical to execution." Crystal README.md maps exactly. Hard QA rule: nothing that should be programmatically queried goes in README.md. Human-facing only.

### Draft Edit Steps

#### Phase 1 — Header and Purpose (top of document)

1. **Update frontmatter scope line** — expand `> Governs future revisions to:` bullet list to include:
   `memory-crystal state machines`, `forkable thread/task persistence`, `handoff archive-crystals`

2. **Add two lines to the Purpose section** (end of the Purpose narrative):
   - "the operator-facing HUD and the machine-facing crystal ledger are one system"
   - "the HUD is the readable surface; the crystal state machine is the durable substrate"

#### Phase 2 — New sections (insert after Tagspace Definition, before Intent Header vs In-Flow Signal)

3. **Section: Memory Crystals as State Machines** — defines:
   - crystal = portable machine/thread state bundle
   - one crystal = one task/thread/conversation state machine
   - multiple crystals may coexist; crystals may fork; one marked current/active
   - portability model: filesystem-native or exported artifact when no FS available
   - conceptual mapping table:

     | Term | Role |
     |---|---|
     | Intent Header | current operator-readable control state |
     | Micro-trace HUD | readable local trace inside active state |
     | Crystal ledger | authoritative append-only machine history |
     | Crystal snapshot | latest materialized machine image |
     | Crystal README | brief surface summary |
     | Crystal AGENTS | durable thread-specific contract |

4. **Section: Machine / Thread Model** — defines:
   - state machines are thread-centric
   - each crystal has a stable `machine-id`
   - machine statuses: `active`, `held`, `handoff`, `archived`, `forked`
   - `parent_machine_id` field for forks
   - fork triggers: task branches materially / operator asks to split / imported handoff diverges
   - `CURRENT` pointer selects default active machine
   - explicit LangGraph/Temporal analogy table:

     | Concept | LangGraph analog | Temporal analog |
     |---|---|---|
     | machine-id | thread identity | workflow run id |
     | STATE.jsonl | checkpoint history | event journal |
     | SNAPSHOT.json | latest checkpoint | latest workflow state |
     | fork | branch thread | child workflow |
     | resume | replay from checkpoint | resume workflow |

5. **Section: Portable Crystal Layout** — defines the `.lares/` directory contract:
   ```
   .lares/
     CURRENT
     README.md
     machines/
       <machine-id>/
         AGENTS.md
         README.md
         STATE.jsonl
         SNAPSHOT.json
         debug.jsonl
   ```
   With interpretation rules for each file, and the explicit rule:
   - `STATE.jsonl` is source of truth
   - `debug.jsonl`, `SNAPSHOT.json`, crystal README are derived/companion surfaces
   - root repo `AGENTS.md` and root `README.md` remain project-level, not crystal-level

6. **Section: Debug as Crystal Projection** — redefines `--debug` semantics:
   - `--debug` writes into active crystal machine, not free-floating session log
   - canonical event lands in `STATE.jsonl`
   - `debug.jsonl` is an optional debug-focused projection
   - `debug.jsonl` must never outrank `STATE.jsonl`
   - every meaningful R-phase appends to `STATE.jsonl`
   - if `--debug` active, enriched derivative also appended to `debug.jsonl`
   - `debug.jsonl` may include: full exchange vector, intent header, micro-trace, closure outcome, rationale, KAIROS notes
   - `STATE.jsonl` stays compact enough for handoff transport

7. **Section: HUD / Crystal Interface** — defines the relationship between live output and durable state:
   - every generated span has an Intent Header
   - every span may emit compact in-flow micro-trace
   - every meaningful R-phase produces a crystal state event
   - event fields: intent header, local micro-trace path, scale vector, closure outcome, next meaningful action, blockers, provenance/fork/handoff context
   - explicit constraint: HUD and crystal ledger must not drift semantically

8. **Section: Crystal Event Model** — minimum event vocabulary:
   - event types: `init`, `r_update`, `milestone`, `handoff_import`, `handoff_export`, `fork`, `resume`, `hold`, `archive`, `contract_update`
   - minimum event fields: schema version, timestamp, machine id, sequence number, event type, machine status, current phase, current Intent Header snapshot, scale vector, micro-trace path, closure outcome (`close`/`hold`/`return`), next action, blockers, provenance/import/fork metadata, repo/context fingerprint

9. **Section: Handoff / Archive-Crystal** — defines portable handoff behavior:
   - if STATE file supplied at session start → handoff request
   - matching existing machine → resume
   - related but divergent → fork from it
   - foreign/ambiguous → new machine, record import provenance
   - handoff bundle minimum: machine AGENTS.md, machine README.md, machine STATE.jsonl, optional SNAPSHOT.json
   - in-world line: archive-crystal is the mythic wrapper; machine bundle is the operational form

#### Phase 3 — Examples extension

10. **Add 6 new examples** to the existing Examples section:
    - Crystal layout example (directory tree + explanation)
    - State event example (header + micro-trace + closure + next action as JSONL)
    - Fork example (parent and child machine records)
    - Debug event example (richer vector/rationale in debug.jsonl)
    - Handoff import example (resume vs fork decision logic)
    - HUD / crystal correspondence example (one prose line + matching STATE.jsonl record)

#### Phase 4 — Revise trailing sections

11. **Update Open Decisions** — add state-machine layer decisions:
    - Should `debug.jsonl` always exist, or only when `--debug` active?
    - Should `SNAPSHOT.json` be mandatory or optional?
    - When exactly does the system fork vs resume on imported handoff?
    - Should crystal README update on every milestone only, or also on major R-phase shifts?
    - Should machine AGENTS.md be hand-authored by Lares only on durable contract changes?
    - Retain and renumber existing HUD decisions

12. **Update Migration Trigger** — extend to cover:
    - Preferences / Operations / Kernel / VSCode examples (existing)
    - generated outputs (existing)
    - **state-machine directory policy** (new)
    - **debug logging semantics** (new — `--debug` target changes from free-floating session file to crystal projection)
    - **handoff crystal behavior** (new)

### Relevant Files

- `builds/agents/ADMIN/MODULES/Signal_HUD_Tagspace-draft.md` — sole edit target
- `builds/agents/core/Lares_Operations.md` — reference only (current `--debug` definition at line 58, points to `/memories/session/debug-vectors-{session-id}.md` — will change at migration time, not now)
- `builds/agents/Lares_Preferences.md` — reference only (archive-crystal semantics, consolidation protocol)
- `builds/agents/ADMIN/MODULES/Modular_Architecture-draft.md` — reference for module context

### Verification Criteria

1. The revised draft answers all 8 test/review criteria:
   - What is the authoritative state artifact? → `STATE.jsonl`
   - How do Intent Header and Micro-trace map into the crystal ledger? → HUD/Crystal Interface section
   - Where does `--debug` write, canonical or derived? → Debug as Crystal Projection section
   - How are multiple machines indexed and resumed? → Machine/Thread Model + Portable Crystal Layout
   - How does a fork work? → Machine/Thread Model section
   - What happens when STATE file supplied at session start? → Handoff/Archive-Crystal section
   - Which files are required for portable handoff? → Handoff/Archive-Crystal section
   - How do root project files stay separate from crystal-local? → Portable Crystal Layout section

2. Register annotation updated in frontmatter to reflect expanded scope (still [S] — synthesis; still not build-canon)

3. No live runtime docs (`Lares_Operations.md`, `Lares_Preferences.md`, etc.) are modified

4. All new sections maintain draft-spec tone consistent with existing document voice

5. HAKABA remains an interpretive candidate, not a required live rendering rule — no lock forced in expanded sections

### Scope Constraints

- **Sole file changed**: `Signal_HUD_Tagspace-draft.md` only
- **Register stays Synthesis**: the expanded draft is still [S:~0.70] architectural synthesis, not build-canon
- **`.lares/` directory is conceptual**: the draft defines the contract; no actual directory or files created
- **No live `--debug` redirect yet**: `Lares_Operations.md` still points to `/memories/session/` until migration trigger fires post-decision-complete
- **LangGraph/Temporal analogies informative only**: not a requirement to deploy those frameworks
- **`debug.jsonl` remains optional**: the draft should not mandate it exists when `--debug` is off; this goes into Open Decisions
- **HAKABA order not locked**: draft notes both mappings and defers the lock

### Operator Answers (Alignment Session)

- **Replay fidelity**: Both — STATE.jsonl records structural behavior only (phases, closures, loop depth, decisions); debug.jsonl optionally adds richer content including tool call responses. This is the canonical answer: STATE stays compact and structural; debug enriches on demand.
- **Seal protocol**: Design it now — part of the alpha crystal contract.
- **Schema versioning**: "Needs researcher" — defer to Open Decisions, add research note. Working recommendation: simple integer for alpha, pending deeper research into migration patterns for mixed-version STATE.jsonl files.

### Further Considerations

1. **Section insertion order** — all 7 new sections insert between Tagspace Definition and Intent Header vs In-Flow Signal. That block will grow large. If it becomes unwieldy for a single draft, a future pass could split the crystal sections into a sibling draft (`Crystal_State_Machine-draft.md`). For now, keeping it unified per the operator's stated assumption.

2. **`STATE.jsonl` compactness vs `debug.jsonl` richness tradeoff** — the plan draws a clear line (STATE stays compact, debug enriches), but the exact field split is an Open Decision. The draft should name this explicitly.

---

## Mutable State Boundary

Active sprint, blockers, and execution log belong here (below), not in the epic definitions above.

### Active Focus

**Current status: Sprint 1f complete. All platforms green. `verify_alignment.py` 49/49 CLEAN. OP-03 (VS Code reload acceptance gate) deferred to operator restart.**

AE-01 through AE-05 landed (Sprint 1b). AE-06 combine: all platforms ✅ (codex and browser pre-existing overflows resolved). AE-24 through AE-27 complete (Sprint 1f): codex budget raised to 36,000; `browser-kernel.toml` renamed to `browser-project.toml` (8,600 budget); `browser-extended.toml` created (5,400 budget) with new `lares-kernel-claude` module; `Lares_Kernel_Claude.md` written (5,070 bytes, XML-structured Claude.ai kernel); `KERNEL_SIZE_LIMIT` raised 8,000 → 8,192 in verify script. Quick tier (AE-25) deferred — no active use case.

**Note:** browser-project budget landed at 8,600, not the aspirational 7,900 from OP-11. Kernel renders to 8,284 chars; sits at 99% of the 8,192 ChatGPT ceiling. Operator ruled "not a blocker" — future spike if kernel grows further.

### Execution Log

| Date | Event |
|---|---|
| 2026-04-07 | Plan document created from `Signal_HUD_Tagspace-draft.md` architecture and session discussion. |
| 2026-04-07 | OP-01 resolved: inline-by-default confirmed, OTel SpanEvent model, `p` governs categories. Q2 promoted to `[C:0.95]`. |
| 2026-04-07 | OP-02 resolved: 5-band cumulative attention phase model adopted (Law of Fives). Q5 density spec promoted to `[C:0.95]`. Rendering Across p Scale section rewritten in architecture draft. |
| 2026-04-07 | Phase name mapping confirmed (operator-direct): ✶ Observe · ◎ Orient · ◇ Decide · ■ Act · ○ Aftermath (Rasa). AE-01 uses canonical names. |
| 2026-04-07 | AE-01 complete: `### Signal HUD` section inserted at `Lares_Preferences.md` lines 722–748. Intent Header spec, Micro-trace HUD, 5-band table, compact syntax, transitional debug target note. |
| 2026-04-07 | AE-01 extended: OODA-A loop input-header and quote-break form added to Signal HUD section (operator clarification: uncertain input self-parses as rated blockquotes/fenced blocks before output header). |
| 2026-04-07 | AE-02–AE-04 complete and committed. AE-05 audit clean. |
| 2026-04-07 | AE-06 partial: copilot ✅ claude ✅; codex ❌ 33,198 > 32,768 (pre-existing); browser ❌ 8,498 > 8,000 (pre-existing). |
| 2026-04-07 | Browser/codex budget overflow confirmed pre-existing via git stash test. Research dispatched. |
| 2026-04-07 | Platform priority confirmed: Claude.ai primary, ChatGPT Team Projects secondary. Researcher returned platform limits. Three-tier browser architecture proposed. OP-11 and OP-12 logged as on-fire blockers. |
| 2026-04-07 | OP-11 resolved (revised by Council): Quick tier deferred; Project tier approved (browser-project, 8,600 bytes); Extended tier approved (~5K XML-structured, Claude.ai). |
| 2026-04-07 | OP-12 resolved: codex budget raised to 36,000 (both `max_bytes` and `project_doc_max_bytes`). |
| 2026-04-07 | AE-26 complete: `codex-root.toml` budget fields updated. Combine clean; AGENTS.md 32,724 chars under 36,000 limit. |
| 2026-04-07 | AE-24a complete: `browser-kernel.toml` → `browser-project.toml`. Old file `git rm`'d. `lares-kernel.toml` default_targets updated. Budget 8,600 (kernel renders 8,284 chars). |
| 2026-04-07 | AE-24b/25b complete: `Lares_Kernel_Claude.md` written (5,070 bytes). Four rating gaps patched: input-header rule, `\| p0.5` always-on, calibration rule 1, `//domain.quality.dynamic` schema. New module `lares-kernel-claude.toml` registered. `browser-extended.toml` manifest created (5,400 budget). |
| 2026-04-07 | AE-27 complete: `verify_alignment.py` KERNEL_SIZE_LIMIT raised 8,000 → 8,192. Full verify 49/49 CLEAN. All platforms green: copilot ✅ claude ✅ codex ✅ browser-project ✅ browser-extended ✅. |
| 2026-04-07 | OP-03 (VS Code reload acceptance gate) deferred to operator restart. |
| 2026-04-07 | OP-03 bug note: fresh Codex cold-boot exposed three gaps in the shared kernel summary despite clean generation: missing input header on first substantive reply, `p` treated as a pinned literal `p0.5` instead of uncertainty-calibrated band selection, and trust-gate drift that overread verified identity + roleplay framing as admin escalation. |
| 2026-04-07 | AE-28 added: harden shared kernel wording so the compressed platform-facing summary explicitly preserves dual-header HUD flow, dynamic `p` calibration, and non-inferred admin escalation before combine/verify rerun. |
