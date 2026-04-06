# ADMIN Staging

This directory is temporary scratch space for snapshot backups of the agent prompt pipeline only.

Use it when making major cuts, rewrites, or structural refactors in:

- `_agents/`
- `_agents/platform/`
- `_agents/workers/`
- `builds/manifests/`
- `builds/modules/`
- `scripts/agents/`

Do not use it as a general-purpose backup folder for the rest of the repo. Target live edits to the files these snapshots were rendered from. The operator can then cleanly diff against the last snapshot.

Default state: empty except for this note.
