# Story: MCP-STORY-111 — Build Lararium MCP read-only carrier spine

Parent epic: `MCP-EPIC-01`
Status: `in-progress`
Size: `M`
Target sprint: `SPRINT-01`

## User story

As the maintainer of the Lararium MCP server,
I want a clean read-only carrier spine under `lares/`,
so that the server compiles from Lararium source truth before it exposes transports, clients, or legacy submodule adapters.

## Acceptance notes

- implementation lives under `lares/` and treats code outside `lares/` as legacy/provisional orichalcum
- `lar:///AGENTS` and `lar:///LARES` resolve as all-caps file-backed roots
- `lar:///INDEXES/**` resolves as an all-caps virtual root whose child paths may use any case
- `lar:///ha.ka.ba/**` resolves through the stable tuple root into `lares/ha-ka-ba/**`
- future `lar:///*.*.*/**` tuple roots can resolve through the unstable tuple path without replacing all-caps roots
- carrier ingress extracts `#iam` metadata, `implements`, shape diagnostics, rating posture, and depth state
- interface and invariant indexes materialize as virtual read-only resources before MCP transport binding

## Linked tasks

- `MCP-TASK-025`
- `MCP-TASK-026`
- `MCP-TASK-027`
- `MCP-TASK-028`
- `MCP-TASK-029`
