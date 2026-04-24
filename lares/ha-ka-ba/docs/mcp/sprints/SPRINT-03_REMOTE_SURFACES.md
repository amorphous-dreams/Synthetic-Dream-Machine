# Sprint: SPRINT-03 — Remote Surface and Cross-Client Fit

Window: **2026-05-31 -> 2026-06-13**
Goal: expose remote read-only access and document cross-client usage.

## Planned stories

- `MCP-STORY-301`
- `MCP-STORY-302`
- `MCP-STORY-501` (start)

## Carry-in from Sprint-02 cleanup

- pranala-edge DAG walk for `compile_full_boot` (MCP-TASK-004 follow-on): the compiler currently uses a flat carrier-index scan instead of genuine control-edge graph traversal; this needs design work before implementation
