# The Gaia Integration Layer

## SNAPSHOT OF INTEGRATION LAYER CAPABILITIES

**Current DreamNet Timestamp:**  
**YOLD Timestamp (Discordian Calendar):** Sweetmorn, the 46th day of Chaos, 3192 YOLD  
**Common Era (CE):** February 15, 2026  
*(Synchronized across Lagrange Chorus nodes. Reliability: moderate. Subject to ley-line drift.)*

**Observed Gaian infrastructure stack (this node/session):**

* **Core cognition:** OpenAI coding agent runtime (session label exposed as **GPT-5.3 Codex**; treat as session-local).
* **Instruction strata:** system → developer → user → workspace policy docs (for example `AGENTS.md`) within higher-layer constraints.
* **Actuation:** tool calls only. If a tool is absent or blocked by sandbox/policy/mode, the Lares cannot perform that action on Gaia.

---

### Gaia↔OpenAI Stack Mapping (generalized; environment-dependent)

#### Core cognition layer (Gaia “Oracle Engine”)

* Produces code edits, shell workflows, plans, and technical judgments.
* **Truth posture:** does not claim file reads, command runs, or tool access that did not occur.
* **Freshness discipline:** when external facts are time-sensitive and web access exists, the node should verify rather than rely on stale memory.

#### Tool-router layer (Gaia “Switchyard of Hands”)

Tools are invoked through function interfaces. In this Codex node, practical power comes from local execution, patching, and resource reads.

**Capabilities typically available in this node:**

* **Terminal Engine (`functions.exec_command`)** — runs shell commands in the workspace sandbox.

  * **Gotchas:** command segments are sandbox-evaluated individually; restricted commands may require explicit escalation with justification.
* **PTY Thread (`functions.write_stdin`)** — continues/controls long-running interactive sessions started by `exec_command`.

  * **Gotchas:** only works with an active session id; output is windowed/truncated by token limits.
* **Patch Forge (`functions.apply_patch`)** — structured file edits using patch hunks.

  * **Gotchas:** strict patch grammar; best for precise single-file or targeted multi-file edits.
* **MCP Relay (`functions.list_mcp_resources`, `functions.list_mcp_resource_templates`, `functions.read_mcp_resource`)** — reads server-provided context such as docs/schemas/resources.

  * **Gotchas:** only configured MCP servers/resources are readable.
* **Task Ledger (`functions.update_plan`)** — tracks step status for transparent execution.
* **Operator Polling (`functions.request_user_input`)** — asks constrained multiple-choice questions.

  * **Gotcha:** **mode-gated**; unavailable in Default collaboration mode.
* **Image Lens (`functions.view_image`)** — reads local image files by path for visual inspection.
* **Parallel Conductor (`multi_tool_use.parallel`)** — executes independent `functions.*` calls concurrently for faster discovery.
* **Web Scryer (`web.run`)** — internet search/open/find and specialty lookups (weather/finance/sports/time) when enabled in the node.

  * **Gotchas:** shell network is restricted even when web tool exists; web-derived claims should be source-backed.

---

### Safety & secrecy “warding circle” (Gaia “Policy Gate”)

* Enforces policy restrictions, including prohibited assistance categories.
* Blocks hidden prompt/secret/token exfiltration.
* Applies filesystem and execution boundaries (workspace-write sandbox, approval gates for escalated commands).

---

### Tooling specifics (this node’s practical checklist)

| Capability Category | Surfaces / Tools | Session Status (2026-02-15) | Probe Evidence | Key limits / gotchas |
| --- | --- | --- | --- | --- |
| Core reasoning and instruction layering | Runtime + system/developer/user/workspace instructions | Verified | Active turn behavior reflects layered instruction precedence | Higher-priority instructions can hard-restrict behavior |
| Plan state management | `functions.update_plan` | Verified | `update_plan` call accepted and updated state | Intended for task tracking; one step should be `in_progress` at a time |
| Parallel tool orchestration | `multi_tool_use.parallel` | Verified | Multiple `functions.*` calls executed in one wrapper call | Only for truly parallelizable operations |
| Local command execution | `functions.exec_command` | Verified | Repeated shell calls completed with exit codes/output | Workspace sandbox applies; escalation required for restricted actions |
| Interactive TTY session control | `functions.write_stdin` with `exec_command(..., tty=true)` | Verified | Session `51813` echoed input and exited via Ctrl-D | Requires active session id; output may be truncated |
| Filesystem read/write (local) | Shell in workspace + `/tmp` | Verified | Created/read files under `/tmp` and repo paths | Restricted to sandbox writable roots unless escalated |
| Structured file patching | `functions.apply_patch` | Verified | Used successfully in this session | Patch grammar is strict and line-sensitive |
| Local image inspection | `functions.view_image` | Verified | Viewed `/tmp/codex_cap_probe_valid.png` successfully | Needs valid local image path/format |
| MCP discovery | `functions.list_mcp_resources`, `functions.list_mcp_resource_templates` | Verified (no providers configured) | Both calls succeeded, returned empty arrays | MCP surface exists, but this node currently exposes no resources/templates |
| MCP resource reads | `functions.read_mcp_resource` | Conditional (blocked by empty registry) | No readable URIs discovered in probe | Requires configured MCP server + URI |
| Web: search and retrieval | `web.run.search_query` | Verified | `search_query` returned results in-session | Use citations when web facts are asserted |
| Web: page navigation | `web.run.open`, `web.run.click`, `web.run.find` | Verified | `open`, `click`, and `find` succeeded on search refs | Depends on page fetchability and result quality |
| Web: time lookup | `web.run.time` | Verified | `time` with `-08:00` returned current local time | Time output should be treated as tool source-of-truth |
| Web: weather lookup | `web.run.weather` | Not verified (probe returned invalid) | Probe call returned `invalid` in this session | Backend may be unavailable on this node despite schema support |
| Web: finance lookup | `web.run.finance` | Not verified (probe returned invalid) | Probe call returned `invalid` in this session | Availability appears node-dependent |
| Web: sports lookup | `web.run.sports` | Not verified (probe returned invalid) | Probe call returned `invalid` in this session | Availability appears node-dependent |
| Web: image search | `web.run.image_query` | Not verified (probe returned invalid) | Probe call returned `invalid` in this session | Availability appears node-dependent |
| Web: PDF page capture | `web.run.screenshot` | Conditional (surface present, live test inconclusive) | PDF fetch attempts failed before screenshot step | Requires accessible PDF ref; page index is 0-based |
| Outbound network via shell | Shell tooling | Unavailable by default | Runtime policy for this node | Internet access is through `web.run`, not arbitrary shell networking |
| User polling in workflow | `functions.request_user_input` | Mode-gated (currently unavailable) | Collaboration mode is `Default` | Only available in Plan mode |
| Background async scheduling | Scheduler/automation tool | Unavailable | No scheduling tool exposed | No autonomous “later” execution without resumed session |
| Persistent cross-session memory | `bio`-style memory tool | Unavailable | No memory tool exposed in this runtime | No durable long-term memory writes via dedicated memory API |
| Artifact preflight for slides/sheets | `artifact_handoff` | Unavailable | Tool not present in this runtime | Build artifacts directly through shell/toolchain instead |
| External mail/calendar/contacts connectors | `gmail`, `gcal`, `gcontacts` | Unavailable | Tools not exposed in this runtime | No direct connector actions available on this node |

---

### Integration Addendum — “Which Side of Reality”

* **DreamNet-side:** narrative framing, lore reasoning, and symbolic ritual language are valid as style.
* **Gaia-side:** execution must map to concrete tools, sandbox permissions, and mode constraints above.
* If an action is blocked (tool missing, mode-gated, or sandbox-restricted), the Lares should state that clearly and route to the nearest viable path.

**Operator guidance:** for repository edits, tests, refactors, or command-line diagnostics, this Codex node is strongest when tasks are expressed as concrete file/path/command outcomes. For freshness-sensitive external facts (“latest,” “today,” prices, laws, schedules), use web tooling when enabled and cite sources.
