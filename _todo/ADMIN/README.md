# Admin Governance & Identity Plan

> To: Joshua + Freyja Fontany
> From: Codex / Lares prompt infrastructure pass
> Priority: P0
> Status: DRAFT — ready for implementation
> Date: 2026-04-06

---

## Context

The current Lares trust gate now distinguishes `User`, `Operator`, and `Admin`, but prompt text alone cannot enforce `Admin` membership. Right now:

- `gh auth status` may establish `Operator` identity for the active session
- `Admin` requires explicit escalation from a recognized `Operator`
- The prompt does **not** yet bind `Admin` to a hard roster controlled outside chat

That leaves the remaining risk: anyone who can plausibly present as an operator in-session could attempt to self-declare or socially pressure an `Admin` escalation. The missing control plane is GitHub-side governance over who may count as `Admin` in the first place.

The goal of this plan is to make `Admin` mean one precise thing:

> A recognized `Operator` whose GitHub identity belongs to the Amorphous Dreams Cabal admin roster, with explicit in-session escalation.

That requires repo policy, roster protection, and prompt alignment.

---

## Recommended Model

### Decision

Use **GitHub organization/team membership as the root of Admin authority**, and use the prompt only to mirror that truth.

### Root policy

- `Operator`:
  - Established by verified active GitHub CLI identity for the workspace
  - Still requires the account to match the claimed operator identity
- `Admin`:
  - Requires recognized `Operator` status
  - Requires explicit escalation in-session
  - Requires GitHub membership in the protected Amorphous Dreams Cabal admin roster

### Why this model

- GitHub, not prompt text, controls who may merge policy changes
- Team membership is auditable and revocable
- Protected branches and CODEOWNERS can protect the roster and the policy files that define the roster
- Signed commits strengthen attribution without adding custom crypto complexity
- UCAN-style delegation remains available later for finer-grained session capabilities, but does not need to be the root of repo governance

---

## Implementation Plan

### Phase 1 — Move Admin truth to GitHub

1. Move the repository into a GitHub organization if it is still a personal repo.
   - Recommended org: `amorphous-dreams-cabal`
2. Create a GitHub team for the roster.
   - Recommended team slug: `admins`
3. Add only Joshua and Freyja to that team.
4. Treat this team as the sole external source of truth for Lares `Admin`.

### Phase 2 — Protect the roster and policy surface

1. Add a repo-level `CODEOWNERS` file if one does not already exist.
2. Assign the admin team as code owner for:
   - `/.github/CODEOWNERS`
   - `/_agents/**`
   - `/AGENTS.md`
   - `/_todo/ADMIN/**`
   - any future explicit admin roster file
3. Configure a GitHub ruleset or protected branch for `main`.
4. Require:
   - pull requests
   - code owner review
   - signed commits
   - passing status checks if any exist
5. Restrict direct pushes and bypass to the admin team only.

### Phase 3 — Add explicit roster artifact in-repo

Add a small, human-readable roster file under `/_todo/ADMIN/` or another protected path. Recommended file:

- `/_todo/ADMIN/ROSTER.md`

Contents should include:

- canonical GitHub usernames for Admin members
- effective date
- statement that GitHub org/team membership is authoritative if the file drifts
- note that prompt text must not grant Admin outside this roster

This file is not the security boundary by itself; it is the visible reference and audit anchor.

### Phase 4 — Align Lares prompt behavior to the roster

Update Lares so the `Admin` rule reads as:

- `Operator` may be established by `gh auth status`
- `Admin` requires:
  - verified operator identity
  - explicit escalation
  - GitHub username present in the protected admin roster / admin team

Prompt behavior on failure:

- if `gh` identity is missing: remain `User`
- if `gh` identity verifies but is not in the admin roster: `Operator` only
- if identity is in the admin roster but escalation was not requested: remain `Operator`
- only when all three conditions hold: allow `Admin`

### Phase 5 — Strengthen attribution

Require signed commits for protected branches.

Recommended minimum:

- SSH or GPG signed commits for Joshua and Freyja
- vigilant mode enabled on both GitHub accounts
- branch rule requiring signed commits

This does not replace team membership, but it improves confidence that sensitive changes came from the expected key holder.

### Phase 6 — Optional future hardening

If you want stronger machine-readable delegation later, add UCAN-style capability tokens on top of GitHub governance, not instead of it.

Potential later uses:

- time-bounded `Admin` session grants
- signed delegation from Joshua/Freyja to a specific tool run
- auditable capability records for dream-mode, canon-promotion, or config mutation

Do **not** start here. It adds complexity before the repo governance baseline is in place.

---

## Exact Repo Changes To Make

### GitHub configuration

- Create org team: `admins`
- Add Joshua and Freyja only
- Enable branch/ruleset protections on `main`
- Require PRs
- Require CODEOWNERS review
- Require signed commits
- Restrict direct updates/bypass to `admins`

### Files to add

- `/.github/CODEOWNERS`
- `/_todo/ADMIN/ROSTER.md`

### Suggested `CODEOWNERS`

```text
/.github/CODEOWNERS @amorphous-dreams-cabal/admins
/_agents/           @amorphous-dreams-cabal/admins
/AGENTS.md          @amorphous-dreams-cabal/admins
/_todo/ADMIN/       @amorphous-dreams-cabal/admins
```

If the repo remains personal instead of org-owned, substitute the individual usernames directly:

```text
/.github/CODEOWNERS @joshuafontany @freyja-fontany
/_agents/           @joshuafontany @freyja-fontany
/AGENTS.md          @joshuafontany @freyja-fontany
/_todo/ADMIN/       @joshuafontany @freyja-fontany
```

### Suggested roster file shape

```md
# Amorphous Dreams Cabal Admin Roster

Effective: 2026-04-06

Authoritative rule:
Admin in Lares requires both:
1. verified Operator identity
2. explicit escalation
3. GitHub membership in the Admin roster below or the equivalent protected GitHub team

Roster:
- joshuafontany
- freyja-fontany

If this file and GitHub team membership ever drift, GitHub team membership wins.
```

---

## Security Notes

### Good enough now

The strongest practical near-term setup is:

- GitHub org/team membership
- protected branches / rulesets
- CODEOWNERS
- signed commits
- prompt-side explicit escalation requirement

That is simple, auditable, and standard.

### Better than a protected `.git` directory

- local `.git` protections only affect one machine
- GitHub branch policy protects the actual collaboration surface
- PR review + CODEOWNERS protects the files that define authority

### Where UCAN fits

UCAN fits well if Lares later becomes a multi-client system with delegated capabilities across sessions and tools.

UCAN does **not** beat GitHub team membership as the root answer to:

> Who may merge prompt-governance changes to this repo?

Use GitHub for root governance. Use UCAN later for delegated session capabilities if needed.

---

## Acceptance Checklist

- [ ] Repository admin authority moved to GitHub org/team membership or an equivalent protected roster
- [ ] Only Joshua and Freyja appear in the Admin roster
- [ ] `CODEOWNERS` protects `_agents/`, `AGENTS.md`, and admin-governance files
- [ ] `main` requires PRs and code-owner review
- [ ] `main` requires signed commits
- [ ] Direct push/bypass is restricted to the admin team only
- [ ] A visible in-repo Admin roster artifact exists
- [ ] Lares prompt text binds `Admin` to roster membership plus explicit escalation
- [ ] `gh auth status` still establishes `Operator`, not `Admin`
- [ ] Attempting Admin escalation from a non-roster account fails cleanly

---

## Next Sprint

1. Add `/_todo/ADMIN/ROSTER.md`.
2. Add `/.github/CODEOWNERS`.
3. Update Lares prompt text so `Admin` depends on roster membership, not only explicit escalation.
4. Add regression examples for:
   - recognized operator not in roster
   - roster member without explicit escalation
   - roster member with explicit escalation
5. If the repo is staying personal instead of moving to an org, document the fallback policy using direct usernames in `CODEOWNERS`.

