# Flying Triremes and Laser Swords — Changelog

No release has shipped, and no version tag exists. The eras below name turns in the work, newest first. The first version number arrives with the first tagged release.

## Unreleased

### The working layer and the founded seat

**Fixed**
- **Wiki deletes leave canon intact.** Deleting a canon title writes a tombstone into the working layer, where it hides the title; a later save replaces that tombstone. A composition without a working layer refuses the delete by name.
- **The wiki follows its bag composition.** It shows the topmost resolved record, including a working tombstone or copy-up, when canon changes beneath it.
- **Draft actions land as one act.** Save, rename, and cancel carry the base from when the draft opened; opening an editor and discarding or saving immediately leaves no stray draft, and returning to the landed value writes nothing. An untouched draft reads unmodified, and Cancel asks nothing.
- **Hand saves respect the composition.** The composition's own order keeps every save at or above the working layer; a route through an empty pointer or a rule naming canon raises a named refusal.
- **Titles keep their layer on save.** A title held above its routed layer saves where it lives; session state and view state route to the temp and personal layers.
- **Removed child references take their family with them.** Editing a placed root to remove a child reference tombstones that child and every descendant.
- **Failed landings raise a named alert.** A landing that fails twice surfaces an alert naming its title, and the next wave retries it.
- **Meme moves carry deletes down.** `lares act MOVE` carries a tombstone into the named bag, and `--shadow` hides a title from a bag that holds none; `lares wiki resolve` prints `Hidden by` for the hiding bag.
- **Never-projected addresses refuse ingest.** A file at an address that never projects to disk refuses with `never-projected-path`.
- **Removed storage keys stay removed.** A removal waits for writes already in flight, and a range removal fences saves beneath its prefix until the removal settles.
- **The stopped shore forgets its wiki.** Teardown clears its ledger and write records after pending hand edits settle; a noop write marks nothing, and one dispatch writes a target at most once.
- **Hand edits pace by title activity.** The gate groups edits by title whatever the title's kind, and teardown flushes every marked title.
- **Every wiki mounts a working layer.** No canon bag serves as the default writable. The daemon's working layer projects to `wikis/daemon/`, while its receipts, ward audits, and summons stay off disk. A vessel that first boots without a face gains its working layer once a face seats and the vessel stands again; the binding carries its Keyhive document, and an attach that cannot stand refuses the boot by name.
- **The wiki shore owns queued changes.** The nalu engine applies one change synchronously, while the shore owns the queue and its door; genesis carries that applier.
- **Current-head reads avoid document views.** A record read at its document's own heads uses the standing document, which shortens corpus feeds through the shore.
- **The repository adapters share one release line.** automerge-repo and its four adapters use 2.6.0-alpha.5.
- **The browser walk requires its wiki document.** A missing wiki document makes the walk fail.
- **A vessel that cannot stand its full composition stays up at the floor.** It names the fault once and keeps answering what the floor serves.
- **A refused boot frees its store.** The next boot meets no store claim left by a refused boot.
- **The household terminator passes a long socket handshake.** Its header buffers hold a 16k sub-protocol header on the way in and in the vessel's answer.
- **Passphrase seal verbs refuse a carrier sealed under the vessel key.** The refusal names the carrier and moves no bytes.
- **Every signature reads one strict rule.** Every Ed25519 verifier in the house calls one door: a key reads in its one canonical encoding and inside the prime-order subgroup, a signature reads canonical, and the equation takes no cofactor. A small-order key, which a lenient verifier lets anyone sign for, and a mixed-order key each refuse by name where they enter a charter seat, a guardian set, a key log, a device edge, an admit, a hosting grant or a commitment; a charter, roll or log that names one refuses whole. No reader takes its verifier from its caller.
- **A Handle reader believes no step it did not verify.** A reader holding no owner-head resolver trusts a Handle's inception alone and answers `handle-rotation-unverified` for any later step, so a stranger's appended rotation gains nothing; a reader holding one verifies every step before any verdict. Every Handle incepts armed with its next key, and each rotation commits a fresh one. A persona head read verifies every rotation on every read.
- **A corpus load answers without a stall.** Field values rest as immutable scalars, so a whole-corpus load lands about nine times sooner and the disk mirror follows with no long pause.
- **Another device's save reaches an open wiki at once.** Ordinary, system and personal titles arrive without a reattach; a volatile title never arrives.
- **A carrier's root and children land together.** The disk mirror never writes half a carrier.
- **Removing a field someone else just edited loses no edit.** The other edit stays live and the remover's version stands as a parallel draft.
- **A disk conflict raises one alert and one audit row.** Each standoff keeps its own key, and resolving it, moving it or ending its projection clears the alert.
- **A refused ingest ends non-zero.** `lares ingest --apply` exits 4 when any file refused and still prints every row.
- **Copy and move keep a record's change-id.** The corpus reader's memo follows the body.
- **The raise door reads the leased epoch.** A raise against an earlier epoch refuses after a Nexus rekey.
- **A command at a standing floor names the unlock.** A verb that needs a sealed row refuses and names `lares vault unlock`; with no vessel standing it asks for the custody route when it first needs one.
- **An unreadable archive refuses the stand by name.** So does an archive of another identity.
- **A stand presents one contact card.** The card gets minted before the stand's Archive leaves, so every later stand opens what the card promised.
- **The joinee rite dials the hearth's own gate.** A founder that also stands a carriage relay no longer hands a joiner the relay's key.

**Added**
- **Meme content commands name a container.** `put`, `get`, `list`, `delete`, and `project` require `--recipe <slug>` or `--bag <slug>`; a missing container refuses with `no-container`, and `--recipe default` names the daemon's own wiki. Every daemon-door meme verb and MCP meme tool likewise requires one container.
- **Seats need no Handle.** `persona new --seat [--chair <label>]` claims a seat with a private chair label; the seal names seats by fingerprint, and `nexus seal export` carries keys and fingerprints without chair labels.
- **Reserve cards support scratch-root rehearsal.** `lares nexus seal reserve rehearse` reads two cards under a scratch root, proves the rebuilt key-set against the charter head, writes nothing, and rolls nothing. Cards print their generation and quorum.
- **The container offers a household HTTPS slot.** Compose profile `https` adds a terminator and resolver, while `device-admit` carries a `syncUrl` derived from `LAR_PUBLIC_URL`.
- **Release manifests bind image and source addresses.** The manifest tool ties an image digest to the genesis, engine, and grammar addresses.
- **The founding runbook walks through the container.** It guides a household step by step and names what stands owed; the harbor carrier states the container boundary.
- **A standing vessel unlocks and locks without a restart.** `lares vault unlock` opens the vessel key on a running vessel and `lares vault lock` drops it; `lares vault status` reports whether the vessel holds its key. Three failed unlocks close the door until the daemon restarts, and every restart returns the vessel to the floor.
- **`lares vessel unbound` lists documents minted with no binding.** It removes nothing.
- **The container offers a one-shot certificate issuer.** Compose profile `issuer` asks for one DNS-01 wildcard certificate per machine. It reads the registrar's credential from two owner-read files in a directory outside both mounts, and it refuses by name on a missing or misplaced directory, a loose file or directory mode, or unaccepted authority terms.

**Changed**
- **The CLI leaves destructive vessel doors out.** `vessel clear`, `vessel rite rebirth`, and `vessel stand --restart --clear` leave the command surface; `vessel rite refresh` builds, stops, and stands without wiping, and a fresh start runs by hand.
- **Seal readings follow seated keys.** `nexus seal show` reads `seed` or `nexus` from seats, and a carriage contract moves no phase. `persona new` leaves root splitting opt-in through `--split-root`.
- **Seal rotation names reserve refusals.** `nexus seal rotate` reports `rotation-unarmed`, `reveal-mismatch`, `reserve-armed`, and `reserve-commit-unrevealable`; `seal show` and `seal seat` report `reserveArmed`.
- **A Handle binds through its face's announce.** A Nexus domain presents its own table, and quorum removal needs no Handle name.
- **Canon states the recovery boundary.** The seed and Nexus readings, quorum admission, the user road's three dials, and guardians per face hold in canon; no verb carries a recovery card into rotation.
- **The host shim holds the engine.** It opens a persona door before `up`, restarts the vessel when a face lands, and refuses in-container stand and stop by name under `LAR_ENGINE=host`.
- **LAN discovery offers candidates only.** It stays off by default; `LAR_LAN_DISCOVERY=announce` enables discovery, and candidates carry no authority.
- **Harnesses run the image by digest.** `LARES_HARNESS_IMAGE` names the image used by the mesh, kahu, crossing, swarm, and burn harnesses.
- **Witnesses wait for the work they measure.** The rite-commands witness reads a command through the host shim, and the corpus-feed witness waits for every corpus root.
- **Disk projection reconciles roots without timers.** Each run of marks reconciles a carrier root once, with one more pass when a mark arrives during its reconcile; the mount scan marks every resident root that a configured mirror backs.
- **Disk projection reports its own pause.** A delay of a second or longer between a wiki change and the first file write prints a diagnostic with the elapsed time and lookup count.
- **The container shims unlock after each start they perform.** With a terminal attached they run `vault unlock`; without one they name that command.
- **Mesh scenarios name their compose project.** `MESH_PROJECT` names it, with `dreamnet-mesh` as the default, and the mesh's browser vessels read their code from the image.
- **Every boot rests at the floor.** Nothing stored lifts it; `lares vault unlock` raises the vessel.
- **Founding seals its archives under the vessel key.** The keyhive archive, each face's veil archive and each face's anchors rest sealed from the first write. `lares vault export` no longer exists.
- **The house runs `@keyhive/keyhive` 0.3.0-alpha.1.** A vessel founded on an earlier Keyhive re-founds.
- **A browser vessel keeps its keyhive Archives in its keystore.** A browser founded earlier refuses to boot until its site data gets cleared.
- **Stores written before immutable values do not read.** Found anew; the genesis seed itself carries on unchanged.
- **A capability layer takes a write by name alone.** The WHO board and the mesh palace refuse a bagless write.
- **The session contract names every hand that reaches a vessel.** A tab, a CLI run, the disk watcher and a spirit's seat each open a session; a tasked spirit holds a Mask and the vessel's seat, and no key of its own.

### The shore and the oracle floor

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

### NO GLOBAL NOW

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

### The identity watch (2026-09-05 → 09)

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

### Before the Lararium (April 2026)

**Added**
- **Intent Header.** `AGENTS.md` sets a prospective generation state before each span and carries the active domain, quality, dynamic, register, stance, phase, and scope.
- **Micro-trace HUD.** `lares/signal/micro-trace.md` records backward-looking state changes inside generated spans.
- **Five attention bands.** The operations guide maps five `p` ranges to inline annotation density, with band three as the default.
- **Phase transition marks.** `→◇`, `→■`, and `→○` mark phase changes; stance glyphs mark genuine stance shifts.
- **Exchange fields.** The HUD names an estimated mana remainder, active `voice(s)`, and monotonic `tick:N`.
- **Dispatch trace pairs.** Each sub-agent dispatch and return carries a coordinator/worker URI pair.
- **Coordinator handoffs.** The guide distinguishes same-territory micro-traces from territory changes that need a new Intent Header.
- **Diagnostic controls.** `--parse` tags segments, `--debug` records traces silently, and `--verbose` surfaces trace detail.

**Changed**
- **Turn-frame boundary.** `AGENTS.md` places the URI and HUD pair at operator exchange boundaries and micro-trace marks inside spans.
- **Annotation layers.** The Intent Header declares prospective state while the Micro-trace HUD records transitions that occur during generation.
- **Trace visibility.** `--debug` records internal transitions and handoffs; `--verbose` surfaces selected trace detail and boundary pairs.
- **Elyncia book paths.** Root directories move to lowercase, placing the setting books and referee guide under `elyncia/`.
- **Game-content ownership.** `.github/CODEOWNERS` assigns `elyncia/`, `ftls/`, and `sdm/` to personal owners.
- **Governance review.** `.github/CODEOWNERS` routes `AGENTS.md`, `.github/`, and `lares/` through the administrator team and personal co-owners.
- **Kowloon registrations.** `.gitmodules` registers `kowloon/`, `kowloon-frontend/`, `kowloon-client/`, and `tldraw/` against Amorphous Dreams forks.
- **MemPalace registration.** `.gitmodules` moves `mempalace/` from its former owner to the Amorphous Dreams fork.
- **Repository remote.** `origin` points to `amorphous-dreams/Synthetic-Dream-Machine`.
- **Trust gate.** Lares guidance reserves direct Canon promotion for verified sourcing or explicit Admin promotion and keeps Operator rulings below Canon.
- **Cold-boot HUD.** The shared kernel sets the input rating, output Intent Header, then post-generation trace order.

**Fixed**
- **Admin escalation.** Verified identity and shrine or roleplay framing do not grant Admin; explicit escalation supplies that authority.
- **Default resolution.** The kernel treats `p[10]` as a default band and lets stronger local signal guide selection.
- **Dream recovery.** Dream guidance names unauthorized drift and gives a Detect → Diagnose → Recover → Re-anchor sequence.
- **Dream artifacts.** Dream guidance describes lock and anchor records with SHA-256 content integrity fields.
- **Signal-tag spelling.** Prompt guidance uses tilde-free confidence tag notation.
