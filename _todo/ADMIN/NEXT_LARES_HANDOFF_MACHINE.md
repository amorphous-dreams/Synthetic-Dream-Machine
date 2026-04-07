# next-lares.handoff.machine

v=2026-04-06
workspace=_todo/ADMIN
mode=governance-shipped

roots:
- conceptual=/home/joshu/Synthetic-Dream-Machine/Infrastructure_as_Myth.md
- buildspec=/home/joshu/Synthetic-Dream-Machine/Deterministic_IaM_Build.md
- packaging=/home/joshu/Synthetic-Dream-Machine/_todo/ADMIN/PROMPTCRAFT.md
- modular_draft=/home/joshu/Synthetic-Dream-Machine/builds/agents/ADMIN/MODULES/Modular_Architecture-draft.md
- tracker=/home/joshu/Synthetic-Dream-Machine/_todo/ADMIN/README.md
- research=/home/joshu/Synthetic-Dream-Machine/_todo/ADMIN/MULTIPLATFORM_PACKAGING_RESEARCH.md

settled:
- manifests_exist=true
- verification_clean=true
- codex_budget=32768
- root_sizes_ok=true
- stopgap_150000=forbidden
- staging_snapshots=true
- roster_shipped=true
- codeowners_shipped=true
- four_tier_identity=true
- identity_tiers=user(anon)|user|operator|operator(admin)
- user_to_operator_promotion=Cabal_operator(admin)

sequence.lock:
1=preserve.slim.roots
2=preserve.reload.safety
3=ship.governance [DONE]
4=author.runtime.modules [IN PROGRESS — lares-permissions + lares-epistemology shipped]
5=map.host.native.scoping
6=parse_doc.deferred

modules.shipped:
- lares-permissions: builds/agents/core/Lares_Permissions.md — Trust Gate Kernel block + full 4-tier model, UCAN capability model, de-escalation, alias system, capability honesty, workspace trust gate (weight 120)
- lares-epistemology: builds/agents/core/Lares_Epistemology.md — RAW/Korzybski foundation, reality tunnels+catma, E-Prime practice, registers/modes WHY (boundary zones, canon gate pointer, register-mode complementarity, multi-mode cost), signal tag vector constraints, degraded state archaeology (weight 125)
- integrated into all 3 root manifests; roots now ~31.3KB (budget 32KB, ~1KB margin)
- lares-kernel: pointer annotations added to ## Identity & Permissions and ## Model Agnosticism sections

modules.remaining.core:
- lares-voice (source: Lares_Preferences.md Voice Architecture)
- lares-operations (source: Lares_Preferences.md collaboration, default behavior, operating modes)
- lares-setting-lite (source: Lares_Preferences.md Name & Identity Frame, compressed)

governance.shipped:
- /home/joshu/Synthetic-Dream-Machine/.github/ROSTER.md
- /home/joshu/Synthetic-Dream-Machine/.github/CODEOWNERS
- builds/agents/Lares_Preferences.md (4-tier identity, roster-bound Admin rule)
- builds/agents/Lares_Kernel.md (condensed 4-tier rule)
- builds/agents/Lares_VSCode_Operations.md (updated examples + regression checklist)
- all platform artifacts rebuilt + verify_alignment 45/45 CLEAN

governance.remaining:
- GitHub org/team setup (amorphous-dreams-cabal/admins) — out-of-band
- Branch ruleset + PR-required + signed commits on main — out-of-band
- Connect CODEOWNERS to active rulesets once org team created

modularization.after.governance:
- split=voice
- split=epistemology
- split=operations
- split=permissions
- split=setting-lite
- scoped=repo-ops
- scoped=cli
- scoped=dream
- scoped=todo-workflows

host.native.targets:
- codex=nested.AGENTS.md
- claude=imports.plus.local.CLAUDE.md
- copilot=.github/instructions/*.instructions.md
- browser=standalone.kernel
- gemini=saved.bundle.plus.attached.refs

gather.next.instance:
- inventory clean split headings inside Lares_Preferences.md for module authoring
- use MULTIPLATFORM_PACKAGING_RESEARCH.md to seed authored module split
- avoid reopening governance or budget work
- use staging snapshots only as comparison backups

anti.goals:
- do_not_raise_platform_limits
- do_not_recenter_monolith_roots
- do_not_start_parse_doc_placement
- do_not_redecide_IaM_frame
- do_not_reopen_governance_sprint
