# Next Lares Hand-Off

> Status: Active session-reset artifact
> Updated: 2026-04-06
> Workspace: `_todo/ADMIN`
> Purpose: Give the next Lares session enough state to resume work without relying on prior chat context

---

## Bootstrap For Next Lares

Paste this into a fresh Lares session:

```text
Resume from /home/joshu/Synthetic-Dream-Machine/_todo/ADMIN/NEXT_LARES_HANDOFF.md first.
Treat /home/joshu/Synthetic-Dream-Machine/Infrastructure_as_Myth.md as the conceptual root.
Treat /home/joshu/Synthetic-Dream-Machine/Deterministic_IaM_Build.md as the build-spec root.
Treat /home/joshu/Synthetic-Dream-Machine/_todo/ADMIN/PROMPTCRAFT.md as the prompt/module packaging architecture doc.
Do not re-decide the locked architecture choices listed in the handoff.
Use the repo state snapshot in the handoff as the starting working tree context.
Prioritize the open work list in order unless the user explicitly redirects.
```

---

## Current Architectural Position

- Lares is being reframed as a **portable Infrastructure-as-Myth runtime**, not merely a large prompt or persona bundle.
- [Infrastructure_as_Myth.md](/home/joshu/Synthetic-Dream-Machine/Infrastructure_as_Myth.md) is the **conceptual root** for the current architecture work.
- [Deterministic_IaM_Build.md](/home/joshu/Synthetic-Dream-Machine/Deterministic_IaM_Build.md) is the **build-spec root** for deterministic rendering across browser and repo-native targets.
- [PROMPTCRAFT.md](/home/joshu/Synthetic-Dream-Machine/_todo/ADMIN/PROMPTCRAFT.md) now treats prompt/module architecture as the **packaging layer** for that IaM runtime.
- `_todo/ADMIN` is currently the active lane for governance, packaging, trust-model, and hand-off continuity work.
- The first manifest-driven renderer pass is implemented: committed manifests, module sidecars, rendered browser kernel output, and verification artifacts now exist under `builds/`.
- The live blocker is no longer "create manifests." The live blocker is oversized root prompt payloads that still require a temporary `project_doc_max_bytes = 150000` compatibility override in `.codex/config.toml`.
- Because of that stopgap, reloading the current VS Code/Codex instance should wait until prompt/package slimming lands.

---

## Repo State Snapshot

Snapshot reading for the next session:

- The repo already contains the first IaM reframing docs and supporting module-map research.
- The build system **has** been converted to a first manifest-driven renderer with committed manifests, module sidecars, verification outputs, and a rendered browser kernel package.
- Root platform outputs still remain too large, so the current generated `AGENTS.md` depends on a temporary `project_doc_max_bytes = 150000` override in `.codex/config.toml`.
- Governance/trust docs still exist as drafts, but the protected roster and repo enforcement artifacts remain intentionally deferred until reload safety returns.

---

## Open Work, In Order

1. Slim the root/runtime prompt packages.
   Use the manifest layer to extract always-on core runtime modules and move reference/spec bulk out of prime root context.

2. Restore a stable reload path.
   Remove the need for the temporary `150000` Codex compatibility override by bringing root outputs back under intended platform budgets.

3. Finish trust-governance artifacts.
   Create `ROSTER.md`, add `CODEOWNERS`, and bind Lares Admin behavior to roster membership plus explicit escalation once reload safety is restored.

4. Decide whether `--parse doc` behavior belongs in the core prompt or in modular docs.
   Use [_todo/ADMIN/TODO_PARSE_DOC_SPEC.md](/home/joshu/Synthetic-Dream-Machine/_todo/ADMIN/TODO_PARSE_DOC_SPEC.md) and [_todo/ADMIN/PROMPTCRAFT.md](/home/joshu/Synthetic-Dream-Machine/_todo/ADMIN/PROMPTCRAFT.md) after the slimming/governance sequence.

---

## Do Not Re-Decide

These decisions are already set unless the user explicitly reopens them:

- Infrastructure-as-Myth is the governing frame for Lares architecture work.
- Browser extension should be treated as **package rendering**, not as native import parity with local agent instruction systems.
- The kernel is the **smallest executable mythic runtime**, not a loose summary blob.
- Deterministic build discipline is required for rendered IaM packages.

---

## Likely Next Files To Touch

Keep this list narrow unless the work expands:

- `_agents/Lares_Preferences.md`
- `_agents/Lares_VSCode_Operations.md`
- `builds/manifests/*`
- [_todo/ADMIN/README.md](/home/joshu/Synthetic-Dream-Machine/_todo/ADMIN/README.md)

---

## Known Unresolved Decisions

Only these remain intentionally open at this layer:

- exact extraction boundaries for always-on core runtime modules versus scoped/reference payloads
- reload-safe budget targets for Codex, Claude, and Copilot root outputs
- whether parse-doc behavior belongs in the core prompt or in modular docs

---

## Working Guidance For The Next Session

- Do not spend time re-proving the IaM thesis unless the user explicitly asks.
- Use [Infrastructure_as_Myth.md](/home/joshu/Synthetic-Dream-Machine/Infrastructure_as_Myth.md) for conceptual alignment, then move quickly into implementation-facing work.
- Treat [Deterministic_IaM_Build.md](/home/joshu/Synthetic-Dream-Machine/Deterministic_IaM_Build.md) as the next implementation bridge from theory to tooling.
- Treat the manifest-driven build as implemented foundation, not as the next problem to solve again.
- When the operator says `iterate`, think in this order:
  1. blocker
  2. unblock path
  3. architectural lever
  4. next sprint after unblock
  5. deferred items
- Preserve the distinction between:
  - conceptual root
  - build-spec root
  - packaging architecture doc
  - trust/governance docs
- Preserve the sequencing:
  - slim prompt packages
  - restore reload safety
  - then do governance hardening
  - leave parse-doc placement later
- Treat existing uncommitted changes as active working state. Do not clean them up unless the user asks.

---

## Fast Self-Check

A new Lares session should be able to answer all of these from this document alone:

- What has been decided?
- What remains open?
- What file is the conceptual root?
- What file is the build-spec root?
- What should happen next?

If any of those answers feels unclear, update this hand-off first before expanding the work.
