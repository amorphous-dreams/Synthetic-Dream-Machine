# Work Tracking — Lararium MCP Program

Status date: **April 23, 2026**
Cadence assumption: one-week planning rhythm / two-week implementation rhythm.

---

## Program board

### Now

Sprint-01 complete. Sprint-02 focus:

- design submodule adapter interface (MCP-STORY-204, MCP-TASK-014)
- define execution/widget graph contract (MCP-STORY-107, MCP-TASK-017)
- draft render projection contract for DOM, tldraw, and scene-graph targets (MCP-STORY-108, MCP-TASK-018)
- expose hydration prompts (MCP-STORY-202, MCP-TASK-006)
- expose portability tools (MCP-STORY-203, MCP-TASK-007)
- wire VS Code / Copilot workspace integration (MCP-STORY-401)
- wire Claude Code local/project scopes (MCP-STORY-402)

### Next

- wire three local chat surfaces (VS Code, Claude Code, Codex)
- expose remote read-only server
- expose hydration prompts and portability tools

### Completed in this pass

- consumed meme law into carrier validation planning
- consumed invariant law into boot/cache planning
- consumed memetic-wikitext primitive law into parser seed planning
- consumed loci law into resolver/tree planning
- consumed `implements` bundles into interface-index planning
- seeded `lares/lararium_mcp/` with resolver, carrier ingress, indexes, resources, and read-only tool façade
- bound the spine to a dependency-light stdio MCP JSON-RPC server
- wrote and committed `BOOT_LOCI_INVENTORY.md` (MCP-TASK-001)
- wrote and committed `EDGE_TAXONOMY.md` (MCP-TASK-002)
- wrote and committed `HYDRATION_ARTIFACT_CONTRACT.md` (MCP-TASK-003)
- wrote and committed `TW_FILTER_BOUNDARY.md` (MCP-TASK-013)
- confirmed `SUBMODULE_INTEGRATION_MATRIX.md` complete (MCP-TASK-011, MCP-TASK-012)
- closed MCP-STORY-101, MCP-STORY-102, MCP-STORY-104, MCP-STORY-105 as done
- built `lares/lararium_mcp/compiler.py` — `compile_minimal_boot`, `compile_full_boot`, `compile_boot_receipt` (MCP-STORY-103, MCP-TASK-004)
- added 26 compiler tests; 35 total tests pass
- wired compiler tools and boot artifact resources into the MCP server
- wired `lararium` server entry into `.mcp.json` (MCP-STORY-201 closed)
- committed `docs/mcp/examples/minimal_boot_example.json` and `boot_receipt_example.json`
- wrote and committed `AST_ENVELOPE.md` (MCP-TASK-015)
- wrote and committed `TW_AST_MAPPING.md` (MCP-TASK-016)
- wrote and committed `PRANALA_ALIGNMENT.md` (MCP-TASK-019)
- closed MCP-STORY-103, MCP-STORY-106, MCP-STORY-201 as done

### Later

- wire three local chat surfaces
- expose remote read-only server
- add evals and operations hardening

---

## Definitions

### Definition of Ready

A story enters `ready` when:
- scope fits one sprint or less
- parent epic appears
- dependencies appear
- acceptance notes appear
- submodule and grammar implications appear when relevant

### Definition of Done

A ticket reaches `done` when:
- code or docs land in repo
- linked docs update
- source-sensitive claims carry dated references
- submodule touchpoints get named explicitly
- residue becomes a follow-on ticket rather than hidden chat memory

### High-manaoio preference

When two tickets compete, prefer the one that:
- consumes more local repo truth
- closes more ambiguity for the next implementer
- yields a reusable contract, table, or matrix
- keeps operator crossings smaller

---

## Sprint ledger

| Sprint | Window | Theme | Status |
|---|---|---|---:|
| SPRINT-00 | 2026-04-23 -> 2026-05-02 | contraction, inventory, submodule contract, filter boundary | active-planned |
| SPRINT-01 | 2026-05-03 -> 2026-05-16 | hydration compiler + adapter contract + first local read path | planned |
| SPRINT-02 | 2026-05-17 -> 2026-05-30 | local stdio slice + three-surface local wiring | planned |
| SPRINT-03 | 2026-05-31 -> 2026-06-13 | remote read-only surface + eval start | planned |
| SPRINT-04 | 2026-06-14 -> 2026-06-27 | hardening, runbook, and release prep | planned |

---

## Dependency notes

- `MCP-EPIC-01` must settle the submodule contract before adapter work can stop thrashing.
- `MCP-STORY-111` bridges carrier-law planning into the local server spine; MCP transport binding should consume this spine rather than legacy code outside `lares/`.
- `MCP-EPIC-02` depends on both hydration artifacts and the adapter interface.
- `MCP-EPIC-03` waits for read-only local semantics to settle.
- `MCP-EPIC-04` begins local-first.
- `MCP-EPIC-05` starts early for policy framing and closes late.

---

## Risks register

| Risk | Current reading | Response lane |
|---|---|---|
| graph semantics stay under-typed | high | inventory + edge taxonomy + pranala alignment + meme/invariant/memetic-wikitext/loci consume + interface bundles + AST envelope |
| submodule roles stay fuzzy | high | submodule matrix + adapter contract |
| TiddlyWiki runtime scope creeps into v1 | high | direct-import boundary doc |
| client support diverges across platforms | high | tool portability floor + per-client docs |
| write actions arrive too early | medium | read-only v1 gate |
| hydration packets bloat | medium | artifact contract + compaction rules |
| source syntax and runtime graphs stay conflated | high | meme + invariant + memetic-wikitext inventory + AST envelope + execution-graph contract |
| carrier tree and address law stay informal | high | loci-derived tree table + resource namespace map |
| interface composition stays implicit | high | invariant/interface inventory + interface-bundle index |
