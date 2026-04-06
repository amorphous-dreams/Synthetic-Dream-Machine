# Deterministic IaM Builds

This tree holds the deterministic Infrastructure-as-Myth build layer for Lares.

- `manifests/` defines package targets and output contracts.
- `modules/` holds sidecar metadata for authored source modules.
- `rendered/` holds generated non-root package artifacts that do not belong at repo root.
- `verification/` holds lockfiles, checksums, and machine-readable build reports.

Governance integration points for the next sprint:

- Protect `builds/manifests/` and `builds/modules/` alongside `_agents/` and `AGENTS.md`.
- Bind future roster/CODEOWNERS review to manifest and module metadata changes.
- Keep prompt-side `Admin` binding outside this MVP; this sprint only defines where governance attaches.
