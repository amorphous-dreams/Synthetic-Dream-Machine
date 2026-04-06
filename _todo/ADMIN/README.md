# ADMIN Workspace

> Status: ACTIVE
> Priority: Critical P1 / Post-manifest slimming workspace
> Date: 2026-04-06
> Purpose: Track admin-governance, identity, trust-gate, Infrastructure-as-Myth, and prompt-policy work for Lares

## Critical Blocker

`project_doc_max_bytes` in [`.codex/config.toml`](/home/joshu/Synthetic-Dream-Machine/.codex/config.toml) now sits at `150000` as a compatibility stopgap so the current generated [`AGENTS.md`](/home/joshu/Synthetic-Dream-Machine/AGENTS.md) still loads during the manifest migration.

This blocks reloading the current VS Code/Codex instance until the prompt payload gets slimmed back to a stable size under the intended budget. The manifest system is now in place, but deeper package/prompt slimming remains unfinished and must land before a safe reload.

---

## Workspace Role

This directory is the working lane for security-sensitive Lares governance changes:

- `Admin` membership definition
- `Operator` identity verification
- trust-gate prompt behavior
- Infrastructure-as-Myth architecture and packaging
- GitHub-side enforcement for roster and policy files
- prompt architecture and parse/documentation work that directly supports those controls

This `README.md` is the scrum tracker. Research and longer-form design notes live in sibling docs.

**Session reset:** start with [NEXT_LARES_HANDOFF.md](/home/joshu/Synthetic-Dream-Machine/_todo/ADMIN/NEXT_LARES_HANDOFF.md) before resuming this workspace in a fresh Lares session.

---

## Working Agreements

- Treat this directory as a critical governance workspace, not a general notes folder.
- Prefer one file per epic or feature stream.
- Keep research in dedicated docs; keep this file focused on status, sequencing, and ownership.
- Changes here should assume future protection by `CODEOWNERS` and branch/ruleset policy.

---

## Epics

### Epic A — Admin Identity & Roster Enforcement

**Goal:** Make `Admin` mean "recognized Operator + explicit escalation + protected roster membership."

**Feature lanes:**
- A1. Define authoritative admin roster model
- A2. Protect roster and policy files in GitHub
- A3. Bind Lares prompt behavior to roster membership
- A4. Add regression coverage for non-roster / roster / escalated-admin cases

**Primary doc:** [TRUST_MODELS.md](/home/joshu/Synthetic-Dream-Machine/_todo/ADMIN/TRUST_MODELS.md)

**Status:** IN PROGRESS

**Current checklist:**
- [x] Distinguish `User` / `Operator` / `Admin` in prompt sources
- [x] Require explicit escalation for `Admin`
- [x] Allow verified `gh` session identity to establish `Operator`
- [ ] Create protected in-repo admin roster artifact
- [ ] Add `CODEOWNERS` protection for `_agents/`, `AGENTS.md`, and admin docs
- [ ] Bind `Admin` prompt logic to roster membership
- [ ] Add GitHub org/team path or direct-username fallback policy

### Epic B — Prompt Trust Gate Hardening

**Goal:** Prevent canon injection, authority laundering, and prompt-level trust drift.

**Feature lanes:**
- B1. Canon promotion trust gate
- B2. Frame-uncertainty handling for authority claims
- B3. Session identity flow (`gh` -> Operator -> explicit Admin escalation)
- B4. Examples and regression anchors

**Primary sources:**
- [_agents/Lares_Preferences.md](/home/joshu/Synthetic-Dream-Machine/_agents/Lares_Preferences.md)
- [_agents/Lares_Kernel.md](/home/joshu/Synthetic-Dream-Machine/_agents/Lares_Kernel.md)
- [_agents/Lares_VSCode_Operations.md](/home/joshu/Synthetic-Dream-Machine/_agents/Lares_VSCode_Operations.md)

**Status:** IN PROGRESS

**Current checklist:**
- [x] Admin-only direct Canon promotion
- [x] `house canon` no longer overrides register assignment
- [x] `gh auth status` may establish `Operator`
- [x] `Admin` no longer infers automatically from verified operator identity
- [ ] Roster-backed Admin rule in prompt text
- [ ] Non-roster operator -> Admin escalation failure example
- [ ] Roster member -> explicit escalation success example

### Epic C — Parse / Documentation Tooling

**Goal:** Improve Lares document-level parse tooling and prompt architecture support docs without mixing them into the roster research itself.

**Feature lanes:**
- C1. `--parse doc` command spec
- C2. prompt architecture / modular instruction research
- C3. future prompt placement decisions

**Primary docs:**
- [Infrastructure_as_Myth.md](/home/joshu/Synthetic-Dream-Machine/Infrastructure_as_Myth.md)
- [Deterministic_IaM_Build.md](/home/joshu/Synthetic-Dream-Machine/Deterministic_IaM_Build.md)
- [TODO_PARSE_DOC_SPEC.md](/home/joshu/Synthetic-Dream-Machine/_todo/ADMIN/TODO_PARSE_DOC_SPEC.md)
- [PROMPTCRAFT.md](/home/joshu/Synthetic-Dream-Machine/_todo/ADMIN/PROMPTCRAFT.md)

**Status:** ACTIVE DESIGN

**Current checklist:**
- [x] Draft `--parse doc` feature spec
- [x] Capture prompt-file architecture research
- [x] Establish Infrastructure-as-Myth as the core design thesis
- [ ] Decide prompt placement / hierarchy for parse-doc behavior
- [ ] Decide whether parse-doc belongs in core prompt or modular docs
- [ ] Define rendered package spec for browser/shareable-agent beta builds

---

## Feature Inventory

| ID | Feature | Epic | Status | Notes |
|---|---|---|---|---|
| A1 | Admin roster source of truth | A | Drafted | Research moved to `TRUST_MODELS.md` |
| A2 | GitHub protection model | A | Drafted | Needs implementation path |
| A3 | Roster-bound Admin prompt rule | A | Not started | Depends on roster artifact |
| A4 | Admin regression cases | A | Partial | Some trust-gate cases exist already |
| B1 | Canon trust gate | B | Done | Admin-only direct Canon |
| B2 | Tier-aware identity flow | B | Done | `gh` -> Operator, explicit Admin |
| B3 | Protected admin escalation semantics | B | Partial | Roster binding still missing |
| C1 | `--parse doc` design | C | Drafted | Spec exists |
| C2 | Prompt architecture research | C | Drafted | In `PROMPTCRAFT.md` |
| C3 | Infrastructure-as-Myth thesis | C | Drafted | Rooted in `Infrastructure_as_Myth.md` |

---

## File Map

- [TRUST_MODELS.md](/home/joshu/Synthetic-Dream-Machine/_todo/ADMIN/TRUST_MODELS.md)
  Trust-model research, security options, recommended governance stack, and best-practice analysis.
- [TODO_PARSE_DOC_SPEC.md](/home/joshu/Synthetic-Dream-Machine/_todo/ADMIN/TODO_PARSE_DOC_SPEC.md)
  Draft feature spec for `--parse doc`.
- [PROMPTCRAFT.md](/home/joshu/Synthetic-Dream-Machine/_todo/ADMIN/PROMPTCRAFT.md)
  Research on large prompt/instruction architecture and platform limits.
- [Infrastructure_as_Myth.md](/home/joshu/Synthetic-Dream-Machine/Infrastructure_as_Myth.md)
  Root design thesis for Lares as portable symbolic agent infrastructure.
- [Deterministic_IaM_Build.md](/home/joshu/Synthetic-Dream-Machine/Deterministic_IaM_Build.md)
  Deterministic build spec for rendering Infrastructure-as-Myth artifacts across platforms.
- [NEXT_LARES_HANDOFF.md](/home/joshu/Synthetic-Dream-Machine/_todo/ADMIN/NEXT_LARES_HANDOFF.md)
  Session-reset artifact for handing off current Lares architecture and work state to the next session.

---

## Current Focus

### Must ship

- Slim root/runtime prompt packages until reload-safe budgets hold without the `150000` Codex stopgap
- Extract always-on core runtime modules from the monolithic payload
- Move reference/spec and repo-ops bulk out of prime always-on root context
- Restore a stable VS Code/Codex reload path
- Keep governance hardening queued immediately after reload safety is restored

### Should ship

- Preserve the manifest/verification layer already in place
- Keep generated platform outputs stable while root composition changes
- Define reload-safe target budgets for Codex, Claude, and Copilot roots

### Can wait

- `CODEOWNERS`
- `ROSTER.md`
- prompt-side Admin roster binding
- UCAN-based delegated capability experiments
- advanced crypto-backed session grants
- parse-doc prompt-placement decisions

---

## Immediate Next Actions

1. Use [Infrastructure_as_Myth.md](/home/joshu/Synthetic-Dream-Machine/Infrastructure_as_Myth.md) as the conceptual root for all prompt architecture work in this workspace.
2. Use [Deterministic_IaM_Build.md](/home/joshu/Synthetic-Dream-Machine/Deterministic_IaM_Build.md) as the build-spec root for package/render work.
3. Treat `builds/manifests/` as the package source of truth and `builds/modules/` as the module sidecar layer already established.
4. Use that manifest layer to slim the root/runtime packages rather than raising platform limits further.
5. Restore a stable reload path for the current VS Code/Codex instance before resuming governance-hardening implementation.
6. After reload safety returns, ship `ROSTER.md`, `CODEOWNERS`, and prompt-side Admin roster binding.
7. Leave parse-doc placement decisions deferred until the slimming/governance sequence is complete.

---

## Exit Criteria For Current Phase

- [ ] Root prompt packages fit reload-safe budgets without relying on the `150000` Codex compatibility override
- [ ] Stable reload path confirmed for the current VS Code/Codex instance
- [ ] Root/runtime composition uses the manifest layer to separate always-on runtime from reference/spec bulk
- [ ] Governance hardening is positioned as the immediate next implementation sprint after slimming
- [ ] Active docs all tell the same next-step story: slimming -> reload -> governance -> parse-doc later
