# Story: MCP-STORY-201 — Expose read-only resources for `lar:///...`

Parent epic: `MCP-EPIC-02`
Status: `in-progress`
Size: `L`
Target sprint: `SPRINT-01`

## User story

As an IDE client,
I want to browse and read Lararium resources through MCP,
so that hydration and graph inspection work without custom repo-specific prompt text.

## Acceptance notes

- `resources/list` and `resources/read` now run through `python3 -m lares.lararium_mcp`
- virtual `lar:///INDEXES/**` resources materialize as JSON
- file-backed `lar:///AGENTS`, `lar:///LARES`, and `lar:///ha.ka.ba/**` resources read as text
- remaining story work should focus on client launch configs and integration polish

## Linked tasks

- `MCP-TASK-005`
