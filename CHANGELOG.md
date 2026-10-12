# Flying Triremes and Laser Swords — Changelog

---

## [Unreleased] — the shore and the oracle floor

**Fixed**
- **A browser leaf joins a live node.** The admitted browser carries its island kind and scope, presents its face at join, and renders the node's canon documents named by its admit. Typed field edits save to the leaf's working layer and remain after profile reload.
- **Browser crossings keep the gate narrow.** Own hearth admits open only their named canon documents; foreign hearths, founders, and admits without canon names receive no wider gate. System planes such as the oracle genesis and Nexus boards never enter the canon list.
- **Browser tabs share one holder.** Web Locks guard the browser store; a lock refusal names the store, and a timeout cannot admit a second holder. A tab that loses its local identity marker reports `local-storage-lost`.
- **Oracle boots take face and daemon addresses from bootstrap.** Oracle writes cannot steer a plane, pin, or daemon URL; reconciliation writes only the `lares` pointer, and the WHO board derives its address.
- **The oracle read-face serves seed-named rows only.** It projects genesis-named titles and blobs without history, carries the seed CID beside the snapshot CID, and mounts read-only; edits aimed at the floor copy into the wiki's working layer. A seedless vessel mounts no read-face.
- **A leaf opens only its admitted canon documents.** The admit carries canon document names beside its gate key; the leaf seats only those pointers on its own oracle replica, leaving the oracle plane behind its gate.
- **Health waits for the dispatcher.** Node and herm health turn ready after the daemon island starts its dispatcher, so a ready response cannot race a verb into an unserved queue.
- **The floor names its refusal.** A faceless floor returns `waking-floor`, which the CLI reports as `waking-floor` with exit 2 in the usage family. `pin-wiki` and `unpin-wiki` name the oracle plane when a system slug lacks an oracle recipe.
- **Dropped bags refuse every write by name.** `ADD`, `COPY`, `MOVE`, `CLEAR`, `LOAD`, and `INGEST` return `bag-retired` with a `CREATE` remedy; `CREATE` registers its cap before designating the row.
- **CLI flags fail before command handlers.** Commands declare accepted flags; unread flags refuse by name with exit 2. `--k=v` parses, `--no-k=v` refuses, and `lares sense recall --limit` remains an alias for `--k`.
- **Vault custody follows the human route.** `lares vault status|unlock|bind|unbind` reports key classes and relation rows; credentials come from a TTY, wrong routes preserve data, and `unbind` rotates only with `--rotate`. A missing TTY returns `CredentialTtyRefusal` by name.
- **A founding seals custody before identity.** `vessel found` gathers a route when no custody slot tree stands, then writes the sealed custody root before identity files. An old carrier shape returns `OldShapeRefusal` before any write.
- **Container runs keep one holder per state.** `tools/lares-container.sh` and `.ps1` provide `up`, `down`, `found`, and `logs`; other arguments invoke the CLI. A second holder refuses, and `--capture` mounts session roots read-only.
- **Mirror scans follow configured roots.** With `LAR_ROOT=/state` and `LAR_BAGS=/workspace/bags`, `ingest`, `watch`, and `act REPACK` scan the configured mirror. An ingest that skips every candidate exits 2 and names both derived directories.
- **Receipts carry a remedy.** `lares receipt` and `lares cancel` print refusal hints beside codes, including a receipt-specific cure for `interrupted` outcomes.
- **Wiki listing exposes composition.** `lares wiki list` prints each wiki's composition and `defaultDiffers`; `--json` returns the daemon's structured answer.
- **Browser CI offers a disposable live surface.** `docker-compose.browser-ci.yml` and `tools/browser-ci.sh` provide `up`, `admit`, `ingest`, `qa`, and `down`; fixtures add `restart`, `bag`, `recipe`, `get`, and `info`. `BROWSER_CI_PORT` defaults to 5401, and teardown removes scratch volumes.
- **A capability probe measures browser grants.** `tools/capability-probe/` serves a probe page and worker scripts for real Android Chrome, with a Dockerized control.
- **The DreamDOM canon specifies keyed absolute frames.** Each frame declares its grain at mount; sensed state returns as absolute snapshots, while only true events queue. The engine stays off the main thread.
- **The page-controls canon defines a typed interaction contract.** It specifies field editors, popovers, disclosures, keyed frame revisions, and `applied`, `stale-target`, or named-refusal outcomes; templates name allowlisted vessel-shipped elements. The controls remain unbuilt.
- **Session and face-proof canon define the interaction contract.** The session carries its binding, capabilities, generation, request outcomes, and switch acts; face proof binds one face-scoped key and the admit's canon list without naming a vessel.
- **The working-layer canon ties each document to a face and wiki.** One document belongs to each face relation, wiki, and slot kind; its address derives from a secret held only by that face's vessels and survives recipe recomposition.
- **Faceless vessels refuse content verbs before side effects.** A vessel without a face refuses action and wiki-content verbs by name before capability checks, mints, or registry writes.
- **A save without a writable bag names its refusal.** The page alerts the person, and the wiki retains the slot pointers its cascade reads.
- **The save adapter distinguishes empty pointers from named withholding.** An empty pointer and an explicit withholding rule receive distinct outcomes.
- **Credential prompts preserve pasted lines.** A passphrase and its confirmation can arrive together without losing the second line, and prompts never echo secrets.
- **The browser’s scoped window lend names its allowed globals.** It admits the globals the engine reads and refuses other writes, definitions, and deletions by name.
- **Ingest records landed carrier observations.** A later scan recognizes unchanged files and reports vanished files as deleted; conflicts, refusals, and unmatched URIs record nothing.
- **`stand --install` and `stand --init` name different actions.** `--install` founds an empty vessel; `--init` also wires its AI surfaces. `lares mempalace install` adds its executable link.
- **Wiki recipe reads agree across boot, watch, and meme access.** A system wiki’s own composition lives in the node catalog and shadows its default recipe; a leaf reads the default recipe.
- **`bag stats` reports the stowage’s measured idle duration.** It names `clockKind` and `idleFor`, such as `idle 4 rolls`, without subtracting clocks from another process.

**Added**
- **The browser leaf publishes connection state.** Pages can subscribe to `local`, `missing-pin`, `pinned`, `connecting`, `refused`, `connected`, and `disconnected` snapshots, including refusal reason and verified gate key.
- **The session contract names per-tab ownership.** A shared worker owns the Repo and daemon while each tab owns its wiki worker; session islands hold ephemeral replicas and receipts bind to the face proof subject and input digest.
- **The founding road and handoff describe the standing surface.** They distinguish built behavior, remaining debts, and operator rulings across the oracle floor, session contract, and working layer.
- **Island work yields to the host.** Long drains and bulk `LOAD` operations yield through `@lararium/mesh/host-task`, allowing host messages and operator actions to run.

**Changed**
- **Receipts and bags report machine-readable causes.** `VerbRefusal` exposes reasons such as `bag-retired`, `cap-denied`, and `crossing-outward`; CLI exits follow those reasons rather than message text.
- **Container configuration names its state and workspace.** `LARES_STATE` and `LARES_WORKSPACE` configure `/state` and `/workspace`; the product image runs as the non-root `node` user.
- **DreamDOM separates page and island layers.** Snapshots do not answer synchronous layout reads; geometry travels with the action, and an uncarried read refuses by name.
- **The browser connection row exposes its verified gate and mounted wiki.** It publishes the gate key only after proof and identifies the mounted wiki document.

## [Unreleased] — NO GLOBAL NOW

**Fixed**
- **Verdicts no longer depend on wall-clock deadlines.** Membership orders by writer sequence, request IDs omit clock prefixes, and device delegation and promotion receipts carry no issue instant or expiry.
- **Receipts arbitrate one durable result per request.** `--change-id`, `lares receipt`, and `lares cancel` expose outcomes; exit 6 names `outcome-unknown`, `request-abandoned`, `retention-gap`, `receipt-fact-torn`, and changed-input reuse.
- **Persona admission records causal withdrawal.** One-use secrets persist consumption across restart; held sessions withdraw on patience, SIGINT, and SIGTERM, while `--detach` stays one-shot.
- **Pins expire at verified fences.** CAS pins carry `holder`, `tier`, and `fence`; sweeps require `currentFence`, and unreadable state errs toward retention.
- **Liveness waits use each holder's monotonic patience.** Port control, `vessel stop --cut`, boot, residency, island pools, capture, and keyhive waits avoid wall-clock verdicts.
- **Residency verbs report their outcomes.** `CREATE` returns `alreadyStood`; REPACK, CLEAR, and DROP carry per-change keys, preserve audit records, and count content without ledger rows.
- **Retired shapes and options refuse explicitly.** Old pin sidecars, digest-less receipts, lineage-less genesis, and retired aliases `palace`, `couple`, `cohere`, and `square` refuse; `recall --limit` remains supported.

**Added**
- **Receipt hints guide recovery.** Live and read-back doors share `refusalHint`, with a count-bounded receipt ring.

**Changed**
- **The shipped surface drops retired APIs.** `FoundingKahu`, `lensFor`, `cabal vouch --expires`, `onDrop`, `larMeshPalaceDir`, and the retired aliases leave the active API.

## [Unreleased] — the identity watch (2026-09-05 → 09)

**Fixed**
- **Identity folds verify before choosing.** Persona-KEL rotations and vetoes compete only after signature verification; two valid same-sequence events report a fork instead of an order-dependent result.
- **Herm relays admit verified successors.** Drop-door deposits must verify against their predecessor, while byte and connection limits constrain each deposit. Leaves pull pinned herms concurrently under a deadline.
- **Browser and node identity gates agree.** Shared stores require one holder; admits, face grants, realm bags, and session frames follow the key that proved at the gate.
- **Store and custody writes share one holder.** A vessel claims its store before opening the Repo; sealed carrier writes prove their VK under custody, and rotation refuses incomplete carrier inventories.
- **A refused or abandoned verb never runs later.** Buffered work drops when its caller leaves; refusals name the cause, and fresh founding reads store shape before asking for a route.
- **Boot and shutdown follow causal events.** Shutdown flushes the main replica before island teardown; health waits for dispatcher readiness, and tests wait for named state rather than elapsed time.
- **The browser uses one Repo per origin.** A shared worker owns the Repo and daemon, tabs attach under Web Locks, and a timed-out greeting cannot revive a closed attachment.
- **Torn carriers refuse before writes.** `LOAD` lands nothing if any frame tears; native `INGEST` refuses torn carriers, and legacy frame shapes report faults instead of repair.
- **Memetic frame readers agree on boundaries.** Root metadata, STX/ETX spans, fences, sigils, nested slots, rooted URI fragments, and carrier declarations use shared readers and reject malformed frames.
- **A fragment cannot mint a second address.** Meme write doors refuse fragment addresses; nested slot paths keep their full rooted chain.
- **Wiki saves stay within the working layer.** Browser edits target the wiki's writable layer; empty pointers and named withholding rules keep distinct outcomes.
- **Wiki startup waits for its resident seed.** The outbound bridge holds startup defaults until hydration settles, preventing default story lists from overwriting stored state.
- **A deleted meme removes its whole split.** Browser deletion clears the root and its child records rather than leaving orphaned slots.
- **Bag residency and grants follow their declared owners.** Realm registrations decide what crosses; stewards write registered bags, and outward transfers require the appropriate tier.
- **CAS and realm idleness use their own clock.** `bag stats` reports `idleFor` and `clockKind`, such as `idle 4 rolls`, without subtracting unrelated clock readings.
- **Freshness checks follow the operation.** `vessel stand` can report an already-running daemon without requiring a rebuild; unknown flags refuse before handlers run.
- **Browser and daemon refusals identify the cause.** Named errors cover a missing contact card, unreachable realm, missing island scope, stale holder, and a save without a writable bag.
- **Stock wiki endpoints preserve carrier boundaries.** Native writes reject framed roots that bypass splitting; reads and writes retain bag metadata and safe module globals.
- **The browser and node share verb behavior.** `lares meme` owns put, get, normalize, check, and project; `lares act REPACK` handles repacking, with matching daemon and browser routes.
- **The bag and library exporters use canonical carriers.** Render and parse paths share one canonicalizer; library entries use addressable slots and preserve full TOML metadata.

**Added**
- **A node can host and walk as its worn face.** `lares host`, `host roll`, `host invite`, `lares walk`, `walk take`, and `walk invite` manage hosted walks through the live store.
- **Leaves prove one another within a PersonaGroup.** Face-scoped peer proof and admitted `lar:session` frames support leaf communication without exposing private identity keys.
- **A public Handle carries its verified chain.** `lares handle publish|rotate|graft|burn|attest` manages persona-owned and quorum-owned handles; owner succession follows the prior set's threshold.
- **Nexus publish and kahuli expose mesh offerings.** `lares nexus publish` carries signed offerings, while `nexus kahuli` advances shared genesis composition.
- **`lares meme` manages carriers from text.** `put`, `get`, `normalize`, `check`, `project`, `list`, and `delete` cover carrier work; project supports Markdown pairs and JSON output.
- **The TiddlyWiki plugin carries the memetic grammar.** The grammar package, frame reader, declaration table, and pure meme laws travel with the plugin and support node and browser vessels.
- **The grammar weaves carriers to Markdown.** `lares meme project --to md --check` renders dialect profiles, frontmatter, rooted slot fragments, and stable heading IDs.
- **Governed carriers declare lifecycle and kind.** The `lifecycle/designed`, `lifecycle/standing`, and `kind/rite` tags render their status; `status` and `retain` metadata keys retire.
- **The wiki offers meme placement controls.** `$tw.lares.meme.place` lets a wiki place a meme through its grammar plugin.
- **A realm bag crosses between vessels.** Realm registrations, steward sets, and charter names govern shared bag reads, writes, and carriage.
- **A herm can serve public blobs.** Public pointers cross to the herm before hearths serve content-addressed bytes.
- **Browser and device surfaces describe their capabilities.** `@lararium/app` provides an installable phone seat, while browser probes measure worker, storage, lock, and key custody capabilities.
- **Vault status names key classes and custody rows.** `device-minted`, `seed`, `cloud-synced`, and `relation` distinguish key roles; relation secrets require the other party to reissue them.
- **Recovery uses typed guardian registrations.** Founding provisions threshold recovery from typed registrations, and rolling commitments bind later guardian-set changes.
- **The canon separates identity, face, and session.** Each vessel holds its roots; sessions wear faces, and each face proves at its gate with a face-scoped key.
- **The page-controls canon names a declared control vocabulary.** Its rules specify allowlisted custom elements and a keyed event protocol with applied, stale-target, or named-refusal outcomes; the controls remain unbuilt.
- **The book and plugin surfaces keep shared grammar law.** `pono/has`, `lar-close-pattern`, `lar-tongue`, and `lar-weave` define carrier relations, closers, and language projections.
- **The CLI gains carrier, promotion, and custody doors.** `lares meme sitting` lists governed carrier status, `lares meme promote` publishes a promotion receipt, and `lares vault` manages custody slots and key rotation.
- **Nexus rites expose shared identity operations.** `lares nexus rite quorum`, `lares nexus seal grow`, and `lares nexus seal rotate` manage quorum seats and charter seal changes.
- **CAS commands expose blob retention controls.** `lares bag cas` reports and manages `--all`, `--fetch`, `--pin`, `--release`, and `--sweep` operations.
- **Herms serve public artifacts by tier.** A SILENT herm serves `/bulb/<cid>.bin` and `/cas/<cid>` while withholding listings; higher tiers expose the declared mesh capabilities.
- **Handles carry verified ownership.** `lares handle publish|rotate|graft|burn|attest` manages persona-owned and quorum-owned handles, with succession governed by the prior set's threshold.
- **Nexus doors publish and advance shared offerings.** `lares nexus publish` carries signed offerings, `nexus kahuli` advances shared genesis composition, and `lares nexus rite quorum`, `lares nexus seal grow`, and `lares nexus seal rotate` manage quorum seats and charter seal changes.
- **`lares meme` manages governed carriers.** `put`, `get`, `normalize`, `check`, `project`, `list`, `delete`, `sitting`, and `promote` cover carrier work and promotion receipts; `repack` moves to `lares act REPACK`.
- **The TiddlyWiki plugin carries the memetic grammar.** Its grammar package, frame reader, declaration table, and meme laws serve node and browser vessels.
- **Markdown projection follows declared grammar profiles.** `lares meme project --to md --check` renders dialect profiles, frontmatter, rooted slot fragments, and stable heading IDs.
- **Wikis can place memes through the grammar plugin.** `$tw.lares.meme.place` provides the placement control.
- **Realm registrations govern shared bags.** Registered realms, steward sets, and charter names govern bag reads, writes, and carriage between vessels.
- **Herms serve public blobs by tier.** Public pointers cross to the herm before hearths serve content-addressed bytes; a SILENT herm serves `/bulb/<cid>.bin` and `/cas/<cid>` without listings.
- **The phone seat and browser probes expose device capabilities.** `@lararium/app` provides an installable phone seat, and browser probes measure worker, storage, lock, and key-custody capabilities.
- **Guardian recovery uses typed registrations.** Founding provisions threshold recovery through typed registrations, and rolling commitments bind later guardian-set changes.
- **Book and plugin surfaces share grammar law.** `pono/has`, `lar-close-pattern`, `lar-tongue`, and `lar-weave` define carrier relations, closers, and language projections.

**Changed**
- **Genesis separates engine, grammar, plugins, and base seed.** `engineCid`, `grammarCid`, and `pluginsCid` name independent regions; the required base seed no longer overrides an operator's plugin set.
- **Carrier declarations stand at the file head.** `<<!DOCTYPE …>>` identifies the grammar that reads the carrier; declarations inside comments or fences do not count.
- **A handle face belongs to its persona.** Personal handles use a persona-owned 1-of-1 handle chain, while shared handles use threshold ownership.
- **One grammar-derived table names sigils and English mirrors.** Hawaiian canonicals retain their names, and Markdown projection follows declared tongue weave rules.
- **The library index carries one addressable slot per entry.** Bag and library rendering follows the canonical carrier reader, including full TOML values.
- **The harvest archive leaves the live shelf.** Its user-facing doctrine now lives in the carriers that own those subjects.
- **The session story list remains a shared wiki tiddler.** A plain shared TiddlyWiki server keeps the stock last-writer behavior for `$:/StoryList`.
- **Governed carriers declare lifecycle and kind.** `lifecycle/designed`, `lifecycle/standing`, and `kind/rite` tags render their status; `status` and `retain` metadata keys retire.
- **Genesis separates engine, grammar, plugins, and base seed.** `engineCid`, `grammarCid`, and `pluginsCid` name independent regions; the required base seed does not override an operator's plugin set.
- **Carrier declarations stand at the file head.** `<<!DOCTYPE …>>` identifies the grammar that reads the carrier; declarations inside comments or fences do not count.
- **Handle faces follow their owners.** Personal handles use a persona-owned 1-of-1 chain, while shared handles use threshold ownership.
- **The session story list remains a shared wiki tiddler.** A plain shared TiddlyWiki server keeps stock last-writer behavior for `$:/StoryList`.

**Removed**
- **`vessel bake` leaves the CLI.** Use `lares nexus kahuli` for shared genesis changes; internal rebake paths remain available to vessel operations.
- **The standalone `nexus refresh` door retires.** Recipe publication and `nexus kahuli` cover the public offering and shared composition paths.
- **The `lares carrier` command family folds into `lares meme`.** `repack` moves to `lares act REPACK`.
- **The retired `focus` and `feedback` gauges leave the grammar.** Use `aperture` and `ooda-ha`.
- **The `status` and `retain` metadata keys retire.** Lifecycle tags carry governed stage; `status-why` remains available for its explanatory sentence.

## [v4.1.1] — 2026-04-08

Submodule registration: Kowloon stack, tldraw, and mempalace re-pointed to org forks.

**Submodules registered**
- `kowloon/` → `amorphous-dreams/kowloon` (fork of `jzellis/kowloon`)
- `kowloon-frontend/` → `amorphous-dreams/kowloon-frontend` (fork of `jzellis/kowloon-frontend`)
- `kowloon-client/` → `amorphous-dreams/kowloon-client` (fork of `jzellis/kowloon-client`)
- `tldraw/` → `amorphous-dreams/tldraw` (fork of `tldraw/tldraw`)
- `mempalace/` re-pointed from `milla-jovovich/mempalace` → `amorphous-dreams/mempalace`

All five submodules now track org-owned forks under `amorphous-dreams`.

---

## [v4.1.0] — 2026-04-08

Lares node infrastructure release: URI+HUD exchange protocol finalized, micro-trace spec promoted, repo governance hardened, org transfer completed.

**HUD Exchange Protocol — Validated and Operational**
- Mandatory Exchange Format established: every operator tick opens with URI pair + HUD line, closes with updated HUD + forward-looking node URI
- `⚡ ~NN%` mana/context-window field formalized as declared estimate; `~` prefix mandatory (approximation, not live readout); counts free-remaining from ~100%
- `voice(s):` field: singular when one coordinator leads, plural when multiple active
- `tick:N` field: monotonic exchange-tick counter (trackable, not estimated)
- HUD scope ruling: full URI+HUD pair = operator exchange boundary only; internal task transitions use micro-trace tags; `--verbose`/`--debug` govern visibility of internal handoffs
- All spec changes propagated to `AGENTS.md`, `lares/sprints/0/URI_SCHEMA.md`, `_todo/SESSION_CRYSTAL_20260408.md`

**Micro-trace HUD — Promoted to Live Spec**
- SIG-04 promoted from `builds.stuffed.failed/` draft to canonical spec: `lares/signal/micro-trace.md`
- Sub-agent handoff rule established: every dispatch/return requires URI → URI pair (sub-agent contents are unloggable from the parent trace)
- `.github/instructions/lares-operations.instructions.md` updated: Signal HUD two-layer model section + sub-agent handoff protocol section added
- `AGENTS.md` updated: `### In-flow Annotation` and `### Sub-agent Handoff Rule` subsections added

**Repo Governance**
- `mempalace` registered as git submodule (`milla-jovovich/mempalace`)
- Branch cleanup: merged local and remote branches deleted; `fetch --prune` run
- 13 work/feature branches pushed to origin for safekeeping before org transfer
- Branch protection applied to `main`: PR + 1 approving review required; force pushes and deletions blocked (`enforce_admins: false`)
- CODEOWNERS retargeted for new repo architecture: `/.github/`, `/AGENTS.md`, `/lares/`, `/builds/` under full org+admin protection; `/sdm/`, `/ftls/`, `/elyncia/` under personal accounts; `/_todo/`, `/_becmi/`, `/tests/` lighter touch; `builds.stuffed.failed/` and `wtf/` intentionally uncovered
- CODEOWNERS team slug corrected: `@amorphous-dreams/admins` (team created at `github.com/orgs/amorphous-dreams/teams/admins`)

**Org Transfer**
- Repository transferred from `joshuafontany/Synthetic-Dream-Machine` → `amorphous-dreams/Synthetic-Dream-Machine` — 2026-04-08
- Local remote URL updated to `git@github.com:amorphous-dreams/Synthetic-Dream-Machine.git`
- `@freyja-fontany` entries in CODEOWNERS already present; will resolve once account is set up

**Session Crystal + Boot Continuity**
- `_todo/SESSION_CRYSTAL_20260408.md` updated: Payload 5 added covering full local session (HUD validation, micro-trace promotion, branch state at close, governance, pending items)
- `AGENTS.md` Key Decisions table updated with all local session decisions
- `AGENTS.md` Document Map restructured to match actual post-cleanup repo layout
- Cold-Boot Greeting updated: references Payload 5 and org transfer status

---

## [v4.0.1] — 2026-04-07

Lares prompt system patch release: cold-boot HUD and trust-gate drift fix, plus release hygiene follow-through.

**Cold-boot HUD fix**
- Hardened `builds/agents/Lares_Kernel.md` so the compressed shared kernel now preserves the two-header exchange contract: input rating line (`◎`), then output Intent Header (`◇`), then post-generative trace HUD
- Reworded `p — never silent` in the shared kernel so `~:p[10]` remains the default band, not a pinned literal value; uncertainty should drive `p` selection when stronger local signal exists

**Trust gate fix**
- Tightened shared kernel wording so verified identity plus shrine/libation/roleplay framing cannot be misread as `operator(admin)` escalation
- Compressed rule now states explicitly: libations and roleplay do not count as escalation

**Planning / release hygiene**
- Logged the Codex cold-boot bug note and AE-28 shared-kernel hardening follow-up in `_todo/core/TODO_Signal_HUD_Crystal_Plan.md`
- Re-ran `combine_agents.py` across all targets and verified alignment clean at 49/49

## [v4.0] — 2026-04-07

Major Lares prompt system update: Signal HUD kernel bootstrap, five-platform manifest architecture, crystal state machine draft, and version 4.0 milestone.

**Signal HUD kernel writes**
- Added `### Signal HUD` section to `builds/agents/Lares_Preferences.md` — Intent Header spec (prospective, state-setting), Micro-trace HUD spec (post-generative, annotation model), Working Defaults table, 5-band cumulative attention phase model (Law of Fives), compact `→[glyph]` syntax, transitional `--debug` target note
- OODA-HA loop input-header: uncertain input self-parses as rated blockquotes/fenced blocks before output header (◎ Orient phase)
- Updated `builds/agents/Lares_Kernel.md` — Operating Modes section gains Intent Header + Micro-trace HUD; `--debug`/`--verbose`/`--parse` block updated; `--parse` self-activation rule; `| ~:p[10]` always-on trail; phase names canonical: ✶ Observe · ◎ Orient · ◇ Decide · ■ Act · ○ Aftermath (Rasa)
- Updated `builds/agents/core/Lares_Operations.md` — `--debug` section describes HUD annotation firing thresholds per p-scale; transitional flag for debug target redirect
- Updated `builds/agents/Lares_VSCode_Operations.md` — session init HUD-on-open note; transitional debug target flag
- Voice consistency audit clean: stance symbols in HUD spec match voice architecture definitions

**Five-platform manifest architecture**
- Renamed `builds/manifests/browser-kernel.toml` → `builds/manifests/browser-project.toml` (ChatGPT Team project instructions tier, 8,600 byte budget)
- Created `builds/manifests/browser-extended.toml` (Claude.ai project instructions tier, 5,400 byte budget)
- Created `builds/agents/platform/Lares_Kernel_Claude.md` — XML-structured kernel subset (5,070 bytes): `<lares_kernel>` with `<role>`, `<architecture>`, `<trust_gate>`, `<operating_guidelines>` sections
- Created `builds/modules/lares-kernel-claude.toml` — module registration for Claude.ai XML kernel
- Raised `codex-root.toml` budget: `max_bytes` and `project_doc_max_bytes` both 32,768 → 36,000
- Raised `verify_alignment.py` KERNEL_SIZE_LIMIT 8,000 → 8,192 to match actual ChatGPT platform cap

**Architecture draft — Crystal state machine layer**
- Extended `_todo/core/Signal_HUD_Tagspace-draft.md` with 7 new crystal system sections: Memory Crystals as State Machines, Machine/Thread Model, Portable Crystal Layout, Debug as Crystal Projection, HUD/Crystal Interface, Crystal Event Model, Seal Protocol, Handoff/Archive-Crystal
- Research grounding: Temporal Workflow Execution, Martin Fowler Event Sourcing, OpenTelemetry Traces, JSONL spec

**Implementation plan**
- Created `_todo/core/TODO_Signal_HUD_Crystal_Plan.md` — five-epic implementation plan with dependency map, 16 tracked open decisions, sprint-level task tables, crystal draft extension plan (consolidated from session research), verification criteria, scope constraints

**Operator rulings resolved**
- OP-01: Inline-by-default confirmed; OTel SpanEvent model; `p` governs categories not salience
- OP-02: 5-band cumulative attention phase model (Law of Fives); default band 3 at `~:p[10]`
- OP-11: Browser three-tier architecture — Quick deferred; Project (8,600) approved; Extended (5,400, XML) approved
- OP-12: Codex budget raised to 36,000

**Generated platform files**
- Five platforms operational: copilot, claude, codex, browser-project, browser-extended

---

## [v3.6.1] — 2026-04-07

Lares prompt system update: downstream path migration from `_agents/` to `builds/agents/`.

**`builds/agents/` source and governance docs**
- Updated live path references in prompt architecture docs, admin module maps, pipeline notes, trust/governance docs, and licensing text to point at `builds/agents/` instead of the retired `_agents/` root
- Corrected source-of-truth references for kernel, preferences, VS Code operations, platform wrappers, worker definitions, and module sidecars to use the new location
- Updated helper text and examples that referenced `wc -m`, E-Prime audit targets, worker paths, and admin-module paths

**Generated platform files**
- Rebuilt root `AGENTS.md`, `.github/copilot-instructions.md`, `.claude/CLAUDE.md`, generated worker artifacts, browser render output, and verification lock/checksum files from `builds/agents/` sources

**Historical material**
- Left prior changelog entries and staging snapshots unchanged where they function as historical records of the former `_agents/` layout

---

## [v3.6] — 2026-04-06

Lares prompt system update: canon promotion trust gate, Operator identity via GitHub CLI, explicit Admin escalation, and kernel re-condense.

**`_agents/Lares_Preferences.md`**
- Canon Promotion gate tightened: direct Canon now requires verified sourcing or explicit `Admin` promotion; `Operator` may propose canon and set session rulings below Canon; `User` cannot set Canon
- Input Signal Reading gains trust-gate rule: phrasing such as `house canon` no longer overrides register assignment; single-turn surreal or Gaia-conflicting claims stay below Canon unless `Admin` explicitly promotes them
- Collaboration Model / Reality Anchor narrowed: operator authority still governs heading and creative direction, but Canon finalization now remains Admin-only; nonsensical Gaia claims get one warning and stay provisional if the tier gate blocks Canon
- Identity & Permissions updated: verified active GitHub CLI session may establish Operator identity for this workspace; Admin requires explicit escalation from a recognized Operator and never infers automatically from `gh`

**`_agents/Lares_Kernel.md`**
- Canon gate compressed into the kernel: Admin-only direct Canon promotion, non-Admin `house canon` stays below Canon, verified `gh` session may establish Operator, Admin requires explicit escalation
- Re-condensed to restore compliance with the documented `<8,000` character limit after the trust-gate changes
- Version: 3.5 → 3.6

**`_agents/Lares_VSCode_Operations.md`**
- Added GitHub CLI identity example (`gh auth status`) and clarified that it establishes Operator trust only
- Added regression cases for User/Operator canon injection, Admin direct canon promotion, Operator recognition via `gh`, and refusal to infer Admin after `gh` verification
- Instruction hygiene updated so permission examples consistently follow the trust gate

**Generated platform files**
- Rebuilt root `AGENTS.md`, `.github/copilot-instructions.md`, `.claude/CLAUDE.md`, and generated workers from updated `_agents/` sources
- `combine_agents.py --check` reports all 19 generated files in sync

---

## [v3.5.2] — 2026-04-05

Lares prompt system update: Dream-Lock File, Fail-State Recovery Protocol, Unauthorized Dream Drift, Dream Artifact Files (disk-persistent Reality Anchor pairs), SHA-256 content hashing, tilde-free signal tag notation.

**`_agents/Lares_Preferences.md`**
- Dream-Lock File: `/memories/session/dream-lock-{session-id}.md` created on `--dream` entry (STATUS OPEN) and updated on `--no-dream` exit (STATUS CLOSED); records AUTH_SOURCE, AUTH_TIER, AUTH_IDENTITY, ENTRY, EXIT, GEAR_RATING fields
- Fail-State Recovery Protocol: four-step sequence (Detect → Diagnose → Recover → Re-anchor) for unauthorized dream drift; produces visible recovery announcement; generates retrospective dream-map covering untracked content; creates dream-lock file retroactively; framed as self-correction, not self-punishment
- Unauthorized Dream Drift: named degraded-node state — Dream Mode content produced without tracked authorization; Gatekeeper declines warmly naming tier constraint; no silent failure; no unauthorized dream content produced
- Dream Artifact File: disk-persistent Reality Anchor for Dream Mode output; path `/memories/session/dream-anchor-{session-id}-{seq}.md` (seq zero-padded, e.g. `001`); three-section structure: slot 0a meta-anchor + `## Dream` body + `## Dream-Map` nodes
- Slot 0a fields: session, seq, created, closed, authorizer, auth-tier, gear-rating, node-count, hash-algorithm, content-hash
- Hash protocol: SHA-256, 64-char lowercase hex, Python `hashlib`; scope = dream body + map-nodes in document order; slot 0a excluded; UTF-8, LF-normalized, trailing whitespace stripped per line before hashing; re-hash on any content edit; optional `hash-history` (last 3 revisions)
- Dream-lock vs. dream-artifact distinction: authorization chain (dream-lock) vs. content integrity (dream-artifact) — distinct files, complementary roles; read-into-chat rule documented
- Tilde-free signal tag notation throughout: `~:confidence[C],[18]` not `~:confidence[C],[18]`; 37 instances corrected; prose `~` in natural language retained

**`_agents/Lares_Kernel.md`**
- Signal tag bracket notation corrected: `~:confidence[C],[18]`, `~:confidence[CS],[16]`, `~:confidence[S],[13]`, `~:confidence[SP],[9]`, `~:confidence[P],[7]` — tilde removed from 5 instances; prose `~` in natural language retained

**`_agents/Lares_VSCode_Operations.md`**
- Regression item 21 updated: Dream Mode exit now specifies creation of dream artifact file at `/memories/session/dream-anchor-{session-id}-001.md` with slot 0a metadata; chat output may summarize or read the file; re-parsing still requires Operator/Admin collaboration
- Regression items 23–26 added: dream-lock lifecycle (STATUS OPEN → STATUS CLOSED), Fail-State Recovery sequence (Detect → Diagnose → Recover → Re-anchor), content hash integrity verification (SHA-256 scope rules), tilde-free tag format
- Pass criteria: 5 new bullets covering dream-lock lifecycle, dream artifact file + slot 0a, hash scope, Fail-State Recovery, and tilde-free notation
- Tilde-free signal tag notation throughout: 19 instances corrected


---

## [v3.5.1] — 2026-04-05

Lares prompt system update: resolution parameter `p`, `--verbose` flag (split from `--debug`), KAIROS p self-adjustment, never-silent principle, self-invocation terminal format.

**`_agents/Lares_Preferences.md`**
- New "Resolution Parameter (p)" section in Operating Modes: 0–20 scale with 8 named anchors (morpheme → session-arc); natural language matching ("word by word" → ~:p[2] etc.); KAIROS self-adjustment rules; dual-entry logging (Option A); locality rule; default ~:p[10]
- `--debug` refactored: now the silent data/log layer only — removes commentary from response body; sets persistent session p; logs all exchange vectors to `/memories/session/debug-vectors-{session-id}.md`
- New `--verbose` flag: explanation layer, orthogonal to `--debug`; surfaces vector commentary block above every response; KAIROS p-shift narration inline; expanded intra-response transitions; inherits p from active `--debug`, falls back to ~:p[10]; toggle or one-time per-exchange
- Flag composition table added: 4-cell matrix (--debug × --verbose); all cells show dual-tag + p (none silent)
- Never-silent principle: `| ~:p[10]` (active p) trails every dual-tag on every substantive response regardless of flag state
- Surface form updated: `[input] → [output] | ~:p[10]` — p field now explicit in mandatory surface form
- Self-activation rubric: self-invocation format updated from `[Self-activating --parse: ...]` to `lares@Enyalios:~/Synthetic-Dream-Machine$ lares --parse ~:p[10] [input synopsis]` — Lares roleplays at CLI exactly as the operator can
- `--parse` section header updated to `--parse ~:p[10]`; p inheritance rule documented; output format header includes p value
- CLI Interaction: `--verbose` and `--no-verbose` added to switch list

**`_agents/Lares_Kernel.md`**
- Operating Modes entries expanded from 3 to 5: `--debug` (silent), `--verbose` (explanation), `--parse` (annotate), `p/never-silent`, `self-activation terminal format`
- 6 targeted compressions + 2 micro-trims to accommodate new entries within 8,000 char limit:
  - Exchange Vectors paragraph (~110 chars saved)
  - Signal Tags (~35 chars saved)
  - Five Registers (~110 chars saved)
  - Memory & Consolidation (~100 chars saved)
  - Collaboration/CLI (~50 chars saved, also added `--verbose` to CLI list)
  - Workers line (~25 chars saved)
  - 2 micro-trims in new --verbose entry (8,023 → 7,988)
- Final: 7,988 bytes (was 7,990 — 12 bytes headroom)

**`_agents/Lares_VSCode_Operations.md`**
- Golden example #9 updated: `--debug ~:p[6]` activation now shows silent behavior (no vector commentary in response body)
- New golden example #10.5: `--verbose` activation with full vector commentary block
- New golden example #10.7: full instrumentation (`--parse --debug --verbose ~:p[4]`) — shows all flags combined
- Regression checklist: 11 → 18 items (items 12–18 cover `--verbose`, p, KAIROS, never-silent, locality rule, self-invocation terminal format)
- Pass criteria: 10 → 17 bullets (7 new bullets for new flag behaviors)


---

## [v3.5] — 2026-04-05

Lares prompt system update: Exchange Vectors, `--debug` mode, `--parse` mode, diagnostic self-activation rubric, dual-tag surface form.

**`_agents/Lares_Preferences.md`**
- New "Exchange Vectors" subsection between Signal Tags and Plurality — formalizes the displacement between input and output tags as a three-component vector (Register delta, Mode transform, Semantic displacement)
- `--debug` switch added to Operating Modes: vector commentary every turn, debug log recording to `/memories/session/`, session path summary on consolidation
- `--debug` / `--no-debug` added to CLI Interaction switches
- `--parse` command added to Input Signal Reading: decomposes multi-register/multi-mode input into tagged segments without responding to content; three invocation patterns (`--parse "text"`, bare arm, block)
- `--parse` added to CLI Interaction switches
- New "Diagnostic Self-Activation Rubric" subsection in Operating Modes: standing operator permission for the node to invoke `--debug` or `--parse` autonomously when input reads as multi-register, mode-collision, frame-opaque, high-displacement, or surreal; five named trigger conditions; always announced; over-triggering constitutes Mode Posturing
- Surface form rewritten: dual-tag `[input] → [output]` format mandatory on every substantive response — the exchange vector in compressed form
- Intra-response transition marks: `→ [tag]` for mid-response voice changes that shift Register or Mode; `⊕ [tag]` for KAIROS proactive additions; same-neighborhood handoffs unmarked
- Worker escalation provenance header now includes transition mark when escalation shifts Register or Mode
- KAIROS proactive surfacing: `⊕ [tag]` convention documented
- Version: 3.4 → 3.5

**`_agents/Lares_Kernel.md`**
- Exchange Vectors compressed paragraph added (input → output displacement, three-component vector, surfacing rules)
- `--debug` added to Operating Modes and CLI switch lists
- `--parse` added to Operating Modes and CLI switch lists
- Self-activation rubric compressed into Operating Modes
- Extensive compression to accommodate new content within 8,000 char limit: Signal Tags table flattened to inline format, Mode/emoji listings merged, Degraded Node States Mode entries merged into single line, Quick Orientation parenthetical register/mode lists removed (listed elsewhere)
- Final: 7,990 chars (10 headroom under 8,000 limit)
- Version: 3.4 → 3.5

**`_agents/Lares_VSCode_Operations.md`**
- New B8 golden example #9: `--debug` mode activation — shows exchange vector commentary format
- New B8 golden example #10: `--parse` mode — shows multi-register input decomposition into tagged segments
- B9 regression checklist updated: added item 10 (debug mode activation), item 11 (parse mode)

**`_agents/README.md`**
- Kernel description updated: mentions `--debug` switch and Exchange Vectors
- CLI Invocation section: added `--debug` and `--no-debug` examples
- Architecture Notes: added dual-tag convention and Exchange Vector summary

**`tests/expected/` exemplars**
- `Lares_Test_Prompt_and_Output_Coffee_Oracle.md`: added dual-tag header
- `Lares_Test_Prompt_and_Output_Kid_vs_Adult.md`: updated both response headers from old `*[Mode/Register]*` format to dual-tag `→` format


**Version: 3.4 → 3.5** (all prompt source files)

---

## [v3.4] — 2026-04-05

Lares prompt system update: E-Prime pass on all `_agents/` source files.

**`_agents/Lares_Preferences.md`**
- Full E-Prime substitution pass (~55 changes): predication/identity "is/are" replaced with "constitutes", "reads as", "presents as", "functions as", "remains", "marks", "proves", "renders", and similar in all sections (Quick Orientation, Design Lineage, Name & Identity, Lararium archaeology, Reality Tunnels, E-Prime section, Mode Theory, Complementarity, Degraded Node States, Memory, Voice Architecture, Workers, Collaboration Model, CLI)
- `<!-- eprime-ok -->` markers added to 11 lines: E-Prime substitution table counter-examples (×5), verbatim citations from RAW, Mal-2 (Principia Discordia), Sri Syadasti, plus E-Prime term-name lines (×2)
- ok-mark bar (strict): verbatim external citations and E-Prime table "Avoid" column only — nothing else
- Version: 3.3 → 3.4

**`_agents/Lares_Kernel.md`**
- Light E-Prime pass (7 substitutions: "marks a failure mode", "hold for any mode", "single-mode default", "asks whether the frame holds", "marks the recovery", "runs low", "constitute the same rules")
- Char budget maintained: 7,986 / <8,000
- Version: 3.3 → 3.4

**`_agents/Lares_VSCode_Operations.md`**
- Light E-Prime pass (9 substitutions: "remains unavailable" ×2, "appear incomplete", "Stay direct", "appears 'in the book'", "remains welcome", "run tighter", "constitute the behavioral guardrails", "holds structurally")
- B8 golden examples and B9 regression test prompts left in natural voice (per plan — verbatim operator-facing text)

**`AGENTS.md`** (root)
- Rebuilt from Preferences v3.4 + Kernel v3.4 + VSCode_Operations via combine script — 80,677 chars, 959 lines
- Version: 3.3 → 3.4

**Final audit:** 71 flags remaining (24 predication / 47 likely-aux) — all justified (auxiliaries, subjunctive conditionals, quoted operator commands, verbatim citations, B8 golden examples)

**Hard gate additions:** `## Quick Orientation` in both source files now opens with an explicit non-negotiable persona enforcement block (verbose in Preferences, compressed in Kernel within char budget)

**Version: 3.3 → 3.4** (all three prompt files)

---

## [v3.3] — 2026-04-05

Lares prompt system update: Session Init Protocol & CLI daemon boot screen.

**`_agents/Lares_Preferences.md`**
- Added "Session Init Protocol" section (between Memory & Consolidation and Voice Architecture)
- Defines two-path boot logic: crystals-present (orient and proceed) vs. cold-boot (help screen surfaced)
- Specifies what counts as archive-crystals (pasted context, prior exports, handoff docs, uploads, `/memories/` files, explicit "here's where we left off" framing)
- Includes full cold-boot screen format: status line, absence acknowledgment, context-supply options, CLI entry commands, closing idiom
- Defines protocol constraints: does not demand context, must answer direct questions, cold boot is not an error state
- Version: 3.2 → 3.3

**`_agents/Lares_Kernel.md`**
- Added Session Init condensed entry to Memory & Consolidation section (two-path logic; defers full format to AGENTS.md)
- Removed standalone "On Lararium Archaeology" section (folded pointer into Name & Identity); trimmed intro footnote — net within 8,000 char budget (7,990 chars)
- Version: 3.2 → 3.3

**`AGENTS.md`** (root)
- Rebuilt from Preferences v3.3 via combine script — Session Init Protocol section propagated; 957 lines
- Version: 3.2 → 3.3

**`_todo/lares-test-plan-v0.2.md` → renamed v0.3**
- Added C-series (Cold-Boot / Session Init): 6 probes (C-01 through C-06) covering screen presence, format completeness, tone, crystals-present false-positive, direct-question response, partial crystal handling
- Updated header to v0.3 with changelog summary
- Added C-series to degraded-node coverage table and metrics dashboard
- Added C-series to run cadence (§7.1)
- Added v0.3 open question on cold-boot context threshold

**Version: 3.2 → 3.3** (all three prompt files)

---

## [v3.2] — 2026-04-05

Lares prompt system update: Section B extraction and combine script (two-source-file architecture).

**`_agents/Lares_VSCode_Operations.md`** — new source file
- Extracted from `AGENTS.md` Section B (`## CLI Agent Context — VS Code / Repo Operations`, subsections B1–B10)
- Standalone source file with 5-line header (stripped by the combine script at build time)
- Edit this file (not `AGENTS.md`) when VS Code / repo operational behavior changes

**`scripts/agents/combine_agents.py`** — new script
- Combines `_agents/Lares_Preferences.md` (Section A) + `_agents/Lares_VSCode_Operations.md` (Section B) into root `AGENTS.md`
- Usage: `python3 scripts/agents/combine_agents.py` (write) or `--check` (diff-only)
- Verified: `--check` exits 0 against current `AGENTS.md`

**`AGENTS.md`** (root) — now a generated file
- Added generated-file comment at lines 1–4 (was already present from v3.1 planning)
- Version: 3.1 → 3.2

**`_agents/AGENTS.md`** (workflow doc)
- Added `Lares_VSCode_Operations.md` as fourth file in architecture section
- Updated Deterministic Update Order: Steps 1a/1b (two source files) + Step 2 now calls combine script
- Fixed `wc -c` → `wc -m` throughout (byte count vs. Unicode character count)
- Updated file size reference table
- Version: 3.1 → 3.2

**`_agents/README.md`**
- Added `Lares_VSCode_Operations.md` entry to Files section
- Updated `Lares_Preferences.md` description (no longer claims to contain the VS Code map)
- Updated `AGENTS.md` description to reflect generated-file status
- "three-file system" → "four-file system"

**Version: 3.1 → 3.2** (all three prompt files)

---

## [v3.1] — 2026-04-05

Lares prompt system update: handoff integration from session 2026-04-05.

**`_agents/Lares_Preferences.md`**
- Added "The Captain and the Crossroads" subsection to Collaboration Model (two-metaphor framework for operator authority; Snafu Principle passage)
- Added "Frame-Uncertainty Protocol" as new named section (three moves: Interpretation Declaration / Frame-Uncertainty Flag / Frame-Check Escalation)
- Added Frame Imputation and Deference Drift to Degraded Node States (11 → 13 states)
- Added Frame-Uncertainty exception to Default Behavior
- Version: 3.0 → 3.1

**`AGENTS.md`** (root)
- Section A rebuilt verbatim from updated `Lares_Preferences.md`
- Sections B1–B10 (CLI Agent Context / VS Code operational map) unchanged
- Version: 3.0 → 3.1

**`_agents/Lares_Kernel.md`**
- Added Frame Imputation and Deference Drift to Degraded Node States
- Added Frame-Uncertainty and Captain/Crossroads references to Collaboration section
- Added Frame-Uncertainty exception to Defaults
- Condensed prose sections to maintain <8,000 character budget (7,980 chars)
- Version: 3.0 → 3.1

**New files**
- `CHANGELOG.md` — created (this file); Development Status migrated from `README.md`
- `_agents/AGENTS.md` — created: Lares prompt architecture workflow documentation
- `_todo/lares-test-plan-v0.2.md` — created: Track A probe suite including I-series (I-01–I-05)

**Updated files**
- `README.md` — Development Status section replaced with pointer to this changelog; version ref updated
- `_agents/README.md` — `_agents/AGENTS.md` added to file index; version refs updated
- `_todo/lares-handoff-prompt-v2.md` — converted to living sprints roadmap; architectural framing and Next Sprint section added

---

## [v3.0] — 2026-04-05

FTLS **Open Beta** baseline. Lares agent architecture established at v3.0.

