# Amorphous Dreams Cabal Admin Roster

> Effective: 2026-04-06
> Status: ACTIVE
> Protected by: `CODEOWNERS` (see `/.github/CODEOWNERS`)

---

## Authoritative Rule

The Lares identity model has four tiers: `user(anon)`, `user`, `operator`, and `operator(admin)`.

`operator(admin)` in Lares requires all three conditions:

1. Verified `operator` identity — established via active GitHub CLI session (`gh auth status`) and explicit Cabal promotion
2. Explicit escalation — `operator(admin)` must be requested or declared explicitly; it never infers automatically from `operator` status
3. Membership in this roster — the claimed identity must appear in the roster below, or must hold membership in the equivalent protected GitHub team (`@amorphous-dreams-cabal/admins` if the repo is org-owned)

In addition, members of this roster (`operator(admin)` holders) may promote any verified `user` to `operator` tier. Promotion is explicit, session-logged, and revocable.

If this roster file and GitHub team membership drift, **GitHub team membership wins**.

---

## Roster

| Handle | Name | Role |
|---|---|---|
| `joshuafontany` | Joshua | Shrine Consecrator — root authority, primary operator |
| `freyja-fontany` | Freyja | Shrine Consecrator — root authority, co-operator |

---

## Scope

This roster governs:

- Direct Canon promotion authority in Lares sessions
- `--dream` / `--no-dream` flag control
- Node configuration changes
- Explicit permission-tier assignment and capability revocation
- Approval authority for changes to `/_agents/`, `/AGENTS.md`, `/_todo/ADMIN/`, and `/.github/CODEOWNERS`

---

## Escalation Path

```
user(anon)
    ↓ gh auth status → identity verified
user
    ↓ operator(admin) promotion grant (Cabal member)
operator
    ↓ explicit escalation request + roster membership check
operator(admin)
```

No shortcut. No ambient inference. No fiction-layer bypass.

---

## Roster Change Policy

Changes to this file require:

- A pull request
- Review by at least one current roster member
- No direct pushes to `main` — protected by `CODEOWNERS`

---

## How Lares Uses This Roster

The prompt-side rule (in `_agents/Lares_Preferences.md` → Identity & Permissions) mirrors this file:

- `gh` identity missing → `user(anon)`
- `gh` identity verifies, no Cabal promotion granted → `user`
- Cabal promotion granted, no explicit escalation → `operator`
- handle in roster + explicit escalation → `operator(admin)`

The prompt cannot enforce filesystem protections. GitHub branch rules and `CODEOWNERS` carry that weight. The prompt mirrors the roster so behavior stays aligned with the actual governance model.
