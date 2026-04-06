# ADMIN Workspace

> Status: ACTIVE
> Priority: Critical P1 / Sprint S1 workspace
> Date: 2026-04-06
> Purpose: Track admin-governance, identity, trust-gate, Infrastructure-as-Myth, and prompt-policy work for Lares

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

---

## Sprint S1 Focus

### Must ship

- Create `TRUST_MODELS.md` and stabilize the governance recommendation
- Establish Infrastructure-as-Myth as the shared architectural frame for prompt, governance, and packaging work
- Define deterministic build rules for rendered IaM packages
- Add a protected admin roster artifact plan
- Define the repo-side enforcement path clearly enough to implement next

### Should ship

- Add `CODEOWNERS`
- Add `ROSTER.md`
- Update Lares prompt rules so Admin depends on roster membership plus explicit escalation

### Can wait

- UCAN-based delegated capability experiments
- advanced crypto-backed session grants
- parse-doc prompt-placement decisions

---

## Immediate Next Actions

1. Use [Infrastructure_as_Myth.md](/home/joshu/Synthetic-Dream-Machine/Infrastructure_as_Myth.md) as the conceptual root for all prompt architecture work in this workspace.
2. Use [Deterministic_IaM_Build.md](/home/joshu/Synthetic-Dream-Machine/Deterministic_IaM_Build.md) as the build-spec root for package/render work.
3. Add [TRUST_MODELS.md](/home/joshu/Synthetic-Dream-Machine/_todo/ADMIN/TRUST_MODELS.md) as the dedicated trust research file.
4. Create `ROSTER.md` with the visible admin roster and authority statement.
5. Add `/.github/CODEOWNERS` for `_agents/`, `AGENTS.md`, and `_todo/ADMIN/`.
6. Patch Lares prompt sources so `Admin` requires roster membership, not only explicit escalation.
7. Add regression examples for:
   - verified operator not in admin roster
   - verified roster member without escalation
   - verified roster member with explicit escalation

---

## Exit Criteria For S1

- [ ] Trust-model recommendation documented in a stable research file
- [ ] Admin roster represented in-repo
- [ ] GitHub-side protection path specified or implemented
- [ ] Prompt-side Admin rule depends on roster membership plus explicit escalation
- [ ] Regression coverage exists for success and failure paths
