/**
 * command-help — the per-command HELP REGISTRY behind `lares <command> --help`.
 *
 * Each entry carries `{ synopsis, examples[], flags[] }` and renders EXAMPLES FIRST (clig.dev:
 * "show them first") — operators copy a working line faster than they read a flag table — then the
 * flags, then a `next:` nudge (the git-status idiom: suggest what to run after). A destructive verb
 * names its preview/confirm path in the synopsis so the safe gesture is the discoverable one.
 *
 * The registry is sparse: a command WITHOUT an entry renders its dispatch summary (passed in by the
 * caller). The `corpus` entry is the live source the design meme (lar:///ha.ka.ba/lares/api/corpus) mirrors.
 *
 * ONE HOME FOR A DOOR'S WORDS. A command module that refuses on a bad sub-verb draws its menu from HERE
 * through `helpLines`, so the refusal and `--help` render identical bytes. A module holding its own copy
 * splits the two, and `tests/help-door-meme.test.ts` welds that split shut.
 *
 * A KEY MAY NAME A SUB-DOOR. `"vessel wire"` keys the sub-verb's own entry; the dispatcher prefers the
 * longer key when the positional matches, so a sub-door's flags reach the reader instead of its parent's.
 *
 * PURE DATA, SO ANY VESSEL CAN HOLD IT. This module imports nothing — no `node:fs`, no environment read.
 * The `meme` field NAMES the wiki record behind a verb door (`lar:` names; it never fetches); the `--meme`
 * reach rides the daemon verb rail `lares meme get` already uses, which any vessel holding the cap can run.
 * Every URI here comes HARVESTED from the owning module's own `Meme:` header — never invented at this seat.
 */

export interface CommandHelp {
  /** the spine an operator greps for: `usage: lares <door> <a | b | c>`. */
  readonly usage?: string;
  /** one paragraph: what the command does + (for destructive verbs) its preview/confirm path. */
  readonly synopsis: string;
  /** copy-pasteable invocations, the common cases FIRST. */
  readonly examples: readonly string[];
  /** `--flag  meaning` lines (the value form spelled where it takes one). */
  readonly flags?: readonly string[];
  /** suggested next commands (the git-status idiom). */
  readonly next?: readonly string[];
  /** the `lar:` URI of the meme standing behind this verb door, harvested from the module's `Meme:` header. */
  readonly meme?: string;
}

export const COMMAND_HELP: Readonly<Record<string, CommandHelp>> = {
  sensorium: {
    synopsis:
      "The source-neutral sensorium surface. `run` / `open` ingest a path into a scratch sensorium. " +
      "`run` is ephemeral-DEFAULT: open → ingest → analyze → DISSOLVE on exit (success OR error). `open` " +
      "leaves it live to `query` / `keep` / `dissolve`. Every scratch is leak-proofed: " +
      "`dissolve --orphans` reaps anything an interrupted run left behind. Four planes stand over the " +
      "scratch: content · multi-scale-FFZ bands · content-free structure vectors · the corpus's OWN " +
      "grammar (FORM induction, mined blind and MDL-stopped).",
    examples: [
      "lares sensorium run ./notes -- what decisions were made # open, analyze, dissolve",
      "lares sensorium run ./notes --keep                     # ... but retain it",
      "lares sensorium open ./src --name myproj               # spin up + ingest, leave live",
      "lares sensorium query c-abc123 capability model        # search a live sensorium",
      "lares sensorium ls                                     # live sensoria",
      "lares sensorium keep c-abc123                          # retain ephemeral → durable",
      "lares sensorium dissolve c-abc123                      # remove one (idempotent)",
      "lares sensorium dissolve --orphans                     # reap leaked scratch",
      "lares sensorium name memory root \"working memory\"",
      "lares sensorium propose-name memory cid:abc \"a turning\" --projection entity-graph --evidence cid:abc,cid:def",
      "lares sensorium names memory",
      "lares sensorium accept-name memory pn-1234",
    ],
    flags: [
      "--keep             (run) retain the sensorium instead of dissolving on exit",
      "--name <n>         (run|open) working label (default: the source basename)",
      "--all              (dissolve) remove every live sensorium",
      "--orphans          (dissolve) reap leaked scratch (interrupted runs, dead owners)",
      "--projection <h>   (propose-name) the proposing derived projection",
      "--evidence a,b     (propose-name) local evidence references",
    ],
    next: ["lares sensorium ls", "lares sensorium names memory", "lares sense teardown   # the full nuke, incl. .corpus/*"],
    meme: "lar:///ha.ka.ba/lares/api/sensorium",
  },

  mempalace: {
    synopsis:
      "THE GUEST COMPARATOR'S DOOR (the sovereign sensorium lives at `lares sense`). The guest ~/.mempalace " +
      "is the vendored vanilla nakama store — a clean comparator, a SEPARATE causal island the vessel never " +
      "boots into. `setup` raises it (+ pins hooks.auto_save=false); `harvest` mines transcripts into it " +
      "through the vendored miner's OWN vanilla path — no lar_* stamps, no sensorium planes; `repave` " +
      "previews or rebuilds it (quiesce → verify → tear → stand → harvest, idempotent). `status` surfaces " +
      "the live daemon/hook/capture topology (PID · serves · SPAWNER · uptime); `quiesce` pauses hooks then " +
      "drains the daemons to zero; `resume` un-pauses.",
    examples: [
      "lares mempalace setup               # raise the guest ~/.mempalace",
      "lares mempalace harvest --all       # mine transcripts into the guest (vanilla, no lar_*)",
      "lares mempalace repave --confirm    # tear + stand the guest clean",
      "lares mempalace status              # the live daemon/hook/capture topology + spawners",
      "lares mempalace quiesce             # pause hooks → drain daemons → confirm zero, then un-pause",
      "lares mempalace resume              # un-pause the hooks (daemon re-spawns lazily)",
    ],
    flags: [
      "--all       (harvest) sweep every transcript source",
      "--confirm   (repave) rebuild (default previews)",
      "--hold      (quiesce) leave the hooks paused after draining (run `resume` when done)",
    ],
    next: ["lares sense teardown --confirm --drain   # tear the SOVEREIGN planes", "lares hooks status"],
  },

  hooks: {
    synopsis:
      "The hook-lever on its own: `pause` / `resume` / `status` the capture + ingest hooks by writing / " +
      "removing a marker file the hook scripts check and NO-OP on when present. Lets a migration or a " +
      "`lares sense teardown` run WITHOUT daemon-spawn contention. `lares mempalace quiesce` pauses AND " +
      "drains in one gesture; this verb is the lever alone (suppress minting without touching live daemons).",
    examples: [
      "lares hooks status                 # is minting paused?",
      "lares hooks pause                  # suppress capture/ingest minting",
      "lares hooks pause --reason migrate # ... with a recorded reason",
      "lares hooks resume                 # un-pause",
    ],
    flags: ["--reason <t>   (pause) record why the hooks were paused (default: manual)"],
    next: ["lares mempalace status", "lares mempalace quiesce   # pause AND drain"],
  },

  vessel: {
    synopsis:
      "THE VESSEL DOOR — one namespace over the vessel's own causal island. Five primitives and one " +
      "read: `found` mints identity + bootstrap · `stand` brings the daemon up and reports · `stop` " +
      "halts it on the port · `clear` wipes the store and re-founds (identity survives) · `seed` plants " +
      "every bags/* holding back into its doc · `read` inspects and starts nothing. Compositions ride " +
      "`vessel rite <petname>`, so a new cap-stack arrives as a rite rather than another top-level verb. " +
      "Advancing the genesis composition is a MESH act — `nexus kahuli` — never a vessel door.",
    examples: [
      "lares vessel stand                      # idempotent boot, attach-or-start, and REPORT",
      "lares vessel wire                       # point every AI surface here (re-aims drift)",
      "lares vessel wire --claude              # ~/.claude alone",
      "lares vessel read --palaces             # health, plus the palace-organ table",
      "lares vessel seed --apply --yes         # plant every holding (idempotent)",
      "lares vessel rite refresh               # the post-code-change cure: build · stop · clear · stand",
    ],
    flags: [
      "stand --foreground   this terminal owns the node (no Vite)",
      "stand --with-app     node + Vite app together",
      "stand --restart [--clear]   free the port first, optionally wiping the store",
      "stand --observe      REPORT ONLY — withholds the standing half; outranks every acting flag",
      "stand --install      found the vessel before standing it — stays inside LAR_ROOT",
      "stand --init         ... and wires every AI surface too (reaches ~/.claude etc; `vessel wire` is the door for that alone)",
      "stand --admit <file>        join an existing operator PersonaGroup",
      "wire [--claude|--codex|--copilot|--vscode]   aim that surface here; no flag aims them all",
      "wire --observe       REPORT what a wiring would touch; write nothing",
      "read --palaces       the palace-organ health table (mempalace · structure · form · mesh)",
      "rite <petname>       founding · refresh · rebuild · rebirth — the pet-named cap-stacks",
    ],
    next: ["lares vessel read --palaces", "lares sense pour --all"],
    meme: "lar:///ha.ka.ba/lares/cli/vessel-door",
  },

  sense: {
    synopsis:
      "THE SOVEREIGN SENSORIUM'S ONE DOOR (the guest comparator lives at `lares mempalace`). READ four " +
      "verbs with the plane as a `--lens` parameter (search · relate · structure · status), so a new plane " +
      "needs no new verb. TEND the planes with the lifecycle verbs (recall · capture · pour · teardown · " +
      "worldline · telemetry · subagents · flow). `pour --all` walks the whole tending movement — " +
      "quiesce · baseline · drawers · bearing · projection · verify · resume — never the guest miner. " +
      "Every verb rides the daemon's composed caps (the " +
      "single-owner law: nothing opens a store beside the vessel's holder).",
    examples: [
      "lares sense search \"entrance block\" --lens structure   # hybrid recall over a plane",
      "lares sense status --lens content                       # wings · rooms · entities · total",
      "lares sense recall keyhive convergent removal           # stamp-filtered verbatim drawers",
      "lares sense recall fork --voice Council --band canon     # filters compose (AND)",
      "lares sense pour --all                                  # the sovereign re-pave (all sources)",
      "lares sense worldline 0425c035                          # walk a session's spirit tree",
      "lares sense teardown --confirm --drain                  # tear the planes for a clean re-pave",
    ],
    flags: [
      "--lens <plane>  content | structure | form | persistence (default content) — READ verbs",
      "--wing <w>      scope to one project wing",
      "--voice/--band/--agent/--surface/--drift   recall stamp filters (compose AND, honest counts)",
      "--imago <id>    (recall) fetch one imago verbatim; --list lists imagines",
      "--all           (pour) sweep every transcript source",
      "--confirm/--drain/--force   (teardown) remove / quiesce-first / override live holders",
    ],
    next: ["lares sense status --lens content", "lares mempalace status   # the guest comparator door"],
  },

  meme: {
    usage: "usage: lares meme <put | get | list | delete | normalize | check | sitting | project>",
    synopsis:
      "THE MEME DOOR — one family for every law over meme text, and each verb DECLARES ITS SEAT: " +
      "`normalize` · `check` · `sitting` · `project --to md` (over a file) run LOCAL with no daemon in " +
      "reach; `put` · `get` · `list` · `delete` · `project` to any other target, or from a `lar:` uri, ride " +
      "the daemon verb. No target names the ANCHOR (the daemon's own wiki); `--recipe` edits AS that wiki; " +
      "`--bag` places into that bag and REFUSES when this island cannot write it. `--base` carries the " +
      "canonical hash last read — a record that moved past it CONFLICTS and nothing lands.",
    examples: [
      "lares meme get lar:///ha.ka.ba/lares/api/corpus        # text on stdout, the base on stderr",
      "lares meme put lar:///ha.ka.ba/... --file note.mem     # land a framed meme through the gate",
      "lares meme list --tree                                 # nest each root's slot tree",
      "lares meme delete lar:///ha.ka.ba/... --if-match <hash>   # a stale base moves nothing",
      "lares meme normalize draft.mem                         # re-frame + re-stamp the block check",
      "lares meme check bags/**/*.mem                         # CI / pre-commit: drift exits 1",
      "lares meme project note.mem --to md --out ./out        # the submission pair, clock-free",
    ],
    flags: [
      "--recipe <slug>    an edit AS that wiki: its designated writable bag, write-then-sync",
      "--bag <slug>       a residency placement into that bag (refused when this island cannot write it)",
      "--base <hash>      (put) the canonical hash last read; stale → conflict, nothing lands",
      "--if-match <hash>  (delete) the canonical hash last read; stale → conflict, nothing moves",
      "--file <path>      (put) the meme text (stdin when absent)",
      "--tree             (list) nest each root's slot tree; roots + canonical hash alone otherwise",
      "--gradient         (check) name each file's kind and the marks that kind requires and lacks",
      "--edges            (check) name the addresses these carriers point at, and which of them answer",
      "--to <mem|md|html|tid|json>   (project) the render target",
      "--out <path>       (project) the pair's directory (--to md) or the rendered file; stdout otherwise",
      "--title-base <uri> (project --to md) mount the pair under a shelf address",
    ],
    next: ["lares meme check <file.mem>", "lares meme sitting bags/   # what the fire could take; it BURNS NOTHING"],
    meme: "lar:///ha.ka.ba/lares/docs/handoff",
  },

  library: {
    usage: "usage: lares library <list | show | acquire | verify | index | path>",
    synopsis:
      "The ACQUIRED shelf — books and corpora a human did not author, kept READABLE and VERIFIABLE outside " +
      "every tracked tree. The tier stands in the SHRINE at `<lararium>/library` (`~/.local/share/lararium/" +
      "library`, or LAR_LIBRARY) — a house no wipe names. Layout: `<collection>/<cid>/<the real filename>` " +
      "+ `meta.json`: the directory name IS the digest (audit with sha256sum, no tooling), the filename " +
      "reads to a human, the sidecar carries origin · licence · the RFC-6920 anchor. A reference NAMES — " +
      "`library:mark-twain` travels, a directory does not.",
    examples: [
      "lares library list                              # the collections, and what each holds",
      "lares library show mark-twain                   # one collection's bodies, with their anchors",
      "lares library acquire ./huck.epub --to mark-twain   # MOVES by default (--keep copies)",
      "lares library verify                            # re-digest the BYTES against each directory name",
      "lares library index mark-twain --out ./index.json   # the tracked part that travels",
      "lares library path mark-twain                   # resolve library:<collection> to a directory",
    ],
    flags: [
      "--to <coll>        (acquire) the collection the body lands in",
      "--keep             (acquire) COPY instead of moving — moving carries the point",
      "--origin <url>     (acquire) where the body came from",
      "--licence <terms>  (acquire) the terms it travels under",
      "--note <text>      (acquire) a free note onto the sidecar",
      "--out <path>       (index) write the tracked index here",
    ],
    next: ["lares library verify", "lares library path <collection>"],
    meme: "lar:///ha.ka.ba/lararium/mesh/content-resolution",
  },

  circle: {
    usage: "usage: lares circle <add <nym> --to <circle> | card <carriage> | remove <nym> --to <circle> | list [--to <circle>]>",
    synopsis:
      "The FOLLOW VERB — the inversion-of-control social graph. Adding a nym to a circle IS the follow. The " +
      "graph stays PRIVATE and LOCAL and NEVER federates: nothing reaches the crossroads plane, no central " +
      "trace, and publishing a public glamour stays a separate deliberate act. Fail-closed: an unmet nym " +
      "needs its self-certifying HandleCard admitted first — either `circle card <paste>` ahead of time, or " +
      "`add … --card <file.json>` inline. The default circle reads \"following\".",
    examples: [
      "lares circle add <nym> --to following --petname 'the cartographer'",
      "lares circle card @card.json                    # TOFU-admit a carried HandleCard (paste / QR / stdin)",
      "lares circle add <nym> --to following --card ./card.json   # ... or admit it inline",
      "lares circle remove <nym> --to following        # unfollow",
      "lares circle list                               # the private follow-view (petname + last-seen glamour)",
    ],
    flags: [
      "--to <circle>      the circle to add to / remove from / read (default: following)",
      "--petname <label>  (add) the PRIVATE local label for that nym",
      "--card <file>      (add) the self-certifying HandleCard for a nym this vessel has never met",
    ],
    next: ["lares circle list", "lares handle publish '<glamour>'   # the outward act, never a follow"],
    meme: "lar:///ha.ka.ba/lararium/mesh/membership-doctrine#the-two-stacks",
  },

  handle: {
    usage:
      "usage: lares handle <publish \"<glamour>\" | rotate | graft | burn [--from-persona] | attest \"<claim>\" | " +
      "verify-attestation <statement | @file | -> [--card <file>]> [--persona <index>]",
    synopsis:
      "The Handle's verb family — a persona's public \"here I am\" note and its lifecycle on the handle-KEL. " +
      "`publish` mints a self-certifying card and announces it onto the Nexus WHO board; `rotate` seats a fresh " +
      "presentation key under the same name (the OWNING PERSONA authorizes, so a lost key recovers through the " +
      "persona); `burn` ends the name terminally (the seated key, or the persona from above with " +
      "--from-persona); `attest` signs a claim under the current head. `graft` (owner-set succession) declares " +
      "its shape and awaits its vessel-side pass. " +
      "TWO HALVES OF AN ATTESTATION, NEVER ONE: `verify-attestation` runs the CHAIN-VERIFY half reader-locally " +
      "— the chain verifies, stands unburned, matches the statement's prefix and seats the head that signed it " +
      "— touching NO network and NO board. A pass proves THE HANDLE SAID IT, never that the claim is TRUE. The " +
      "SURFACE-VERIFY half (asking DNS whether the Handle really controls example.net) is a separate act this " +
      "door does not perform and does not imply.",
    examples: [
      "lares handle publish 'Guru-Josh'                      # announce a face onto the WHO board",
      "lares handle rotate --persona 1                       # seat a fresh presentation key, same name",
      "lares handle attest 'controls example.net'            # mint a signed claim under the head",
      "lares handle verify-attestation @stmt.json --card ./card.json   # CHAIN-verify a claim someone handed you",
      "lares handle verify-attestation - < stmt.json         # ... reading the statement from stdin",
      "lares handle burn --from-persona                      # the persona buries the face from above",
    ],
    flags: [
      "--persona <index>  which persona acts (default: the worn persona, then 0)",
      "--from-persona     (burn) the owning persona buries the face from above, not the seated key",
      "--card <file>      (verify-attestation) the carried HandleCard whose chain to verify against; " +
        "without it the reader's own handle-book supplies the chain, and an unmet Handle refuses not-found",
    ],
    next: [
      "lares circle card @card.json   # admit a carried card so verify-attestation finds its chain locally",
      "# the SURFACE half stays yours: check the claimed domain/service yourself — a chain-verify never did",
    ],
    meme: "lar:///ha.ka.ba/lararium/mesh/handle-card",
  },

  persona: {
    usage: "usage: lares persona <new <index> --name <petname> [--handle <Handle>] [--seat] | wear <index> | list | sync | admit>",
    synopsis:
      "The PLURALITY-PONO identity multitude. THREE NAMES, THREE JOBS: the private LABEL names a compartment " +
      "to you alone; the declared HANDLE names what a persona answers to OUTWARD (an intent — only " +
      "`lares handle publish` performs the announce); the SEAT stands it for a Kahu chair on this node and " +
      "needs a Handle. Neither flag implies the other, so a compartment called 'the-burner' can still stand " +
      "under any declared Handle. `wear` switches the active persona (reboot-to-switch — one face to the " +
      "mesh). Local-first: a write lands on this node first and rides up when a hearth answers. A joinee " +
      "receives a root by admit and never mints here.",
    examples: [
      "lares persona new 0 --name '<label>' --handle '<declared Handle>' --seat",
      "lares persona new 1 --name '<label>' --handle '<declared Handle>' --seat",
      "lares persona new 2 --name '<label>' --handle '<declared Handle>' --seat",
      "lares nexus seal seat                  # ... the founding sequence closes here",
      "lares persona wear 1                   # switch the active persona",
      "lares persona list                     # held indices · active marker · labels · declared Handles",
      "lares persona sync                     # carry labels + Handles up to the fleet (the persona plane)",
    ],
    flags: [
      "--name <petname>   (new) the PRIVATE label at that handle-index",
      "--handle <Handle>  (new) declare the public Handle it answers to (intent, not an announce)",
      "--seat             (new) stand it for a Kahu chair on THIS node (needs a Handle)",
      "admit <sub>        offer | grant | open | accept | list — airgapped device-to-device hand-off (QR 3-hop)",
    ],
    next: ["lares persona list", "lares handle publish '<glamour>'   # the outward announce"],
  },

  vault: {
    usage: "usage: lares vault <status | seal | rotate | export <path> | repair | passphrase> [--force] [--yes]",
    synopsis:
      "At-rest seal LIFECYCLE for the sovereign secret carriers (keyhive archive + recovery share). " +
      "DAEMON-FIRST: a mutating verb routes through the daemon while it stands, so its in-memory policy " +
      "moves with the carriers and nothing un-rotates; it falls to a direct file op only when the daemon " +
      "sits down. The passphrase never touches argv or shell history — a no-echo TTY prompt takes it " +
      "(double-entry for a new pass), or LARES_ARCHIVE_PASSPHRASE (+ _NEW) with --yes. Every seal STAMPS " +
      "its Erisian day beside the vault as a record, never as part of the passphrase.",
    examples: [
      "lares vault status                     # the seal state of both carriers",
      "lares vault status --check             # ... probing a passphrase → split-KEK detection",
      "lares vault seal                       # seal cleartext carriers under a NEW passphrase",
      "lares vault rotate                     # re-seal both carriers old → new",
      "lares vault export ./backup.seal       # a passphrase-SEALED backup (--force overwrites)",
      "lares vault repair                     # re-seal a lagging carrier — the split-KEK cure",
      "lares vault passphrase                 # WHICH DAY this vault was sealed on, and what to type",
    ],
    flags: [
      "--check            (status) probe a passphrase against both carriers → split detection",
      "--force            (export) overwrite an existing backup at that path",
      "--yes              take the passphrase from the environment instead of a TTY prompt",
      "LARES_ARCHIVE_PASSPHRASE       the current passphrase (non-interactive, with --yes)",
      "LARES_ARCHIVE_PASSPHRASE_NEW   the new passphrase for seal / rotate",
    ],
    next: ["lares vault status --check", "lares vault export ./backup.seal"],
  },

  cabal: {
    usage: "usage: lares cabal <vouch | join | feed | clock>",
    synopsis:
      "The JOIN AXIS — a mutual-hold relation with a cabal-realm, orthogonal to the CARRIAGE contract " +
      "`nexus contract` writes. A vouch stakes ONE held face's OWN standing on one joiner and needs no kahu " +
      "quorum, because it performs no steward act. IT ADMITS NOBODY: the vouch rides as signal-2 on the " +
      "lineage the admission price walks, and the cost lands at the moment of vouching, since a voucher's " +
      "score SPLITS across everyone they vouch for. Re-vouching the same joiner stays ONE edge — re-minting " +
      "never buys out-degree.",
    examples: [
      "lares cabal vouch <joiner-nym> --realm <realm-doc-id>          # dilutes you, admits nobody",
      "lares cabal vouch <joiner-nym> --realm <id> --expires 2027-01-01T00:00:00Z",
      "lares cabal join --realm <realm-doc-id>                        # PRESENT and cross",
      "lares cabal feed --realm <realm-doc-id>                        # the OFFERING — roll your lease slot",
      "lares cabal clock --realm <realm-doc-id>                       # who feeds this realm, and how deep",
    ],
    flags: [
      "--realm <doc-id>   the cabal-realm every verb here addresses",
      "--expires <iso>    (vouch) an ISO-8601 horizon on the stake",
      "--as <root-index>  which held persona root signs",
      "--cap <n>          (join) the price ceiling this crossing accepts",
    ],
    next: ["lares cabal clock --realm <realm-doc-id>", "lares nexus seal show"],
  },

  edge: {
    usage: "usage: lares edge <kapae | un-kapae> <edge-id> --epoch-cid <cid> [--as <root-index>] [--version <n>]",
    synopsis:
      "Set one RELATIONSHIP aside, or take the marker back down — the kāpae raised over an EDGE rather than " +
      "over a party. Scoped under `edge` to mirror `nexus kapae` / `nexus un_kapae` and stay apart from " +
      "them: that pair shadows a PRESENTER under a kahu quorum, this pair shadows one RELATIONSHIP under " +
      "whichever key holds it. Setting a relation aside says NOTHING about either end — the vessel keeps " +
      "standing, the face keeps standing, only that relation stops counting. RAISING WINS A TIE and " +
      "lowering takes a deliberate hand, so an eviction never quietly reverses when a partition heals. The " +
      "write asserts no authority: whether the signing root holds the edge gets decided by whichever reader " +
      "consults the shadow.",
    examples: [
      "lares edge kapae <edge-id> --epoch-cid <cid>              # shadow that relation",
      "lares edge un-kapae <edge-id> --epoch-cid <cid>           # re-admit it — a deliberate signed act",
      "lares edge kapae <edge-id> --epoch-cid <cid> --as 1       # sign with a named persona root",
    ],
    flags: [
      "--epoch-cid <cid>  the charter epoch the marker rides",
      "--as <root-index>  which held persona root signs (default: the active one)",
      "--version <n>      pin the marker version; a raise wins a same-version tie",
    ],
    next: ["lares nexus kapae --list   # the PRESENTER board — a different kind of setting-aside"],
  },

  raise: {
    usage: "usage: lares raise sign <challenge-json> [--as <persona-index>]",
    synopsis:
      "The RECOGNISER's half of the raise ceremony. A vessel standing at the WAKING FLOOR emits a challenge; " +
      "`raise sign` signs it with one of YOUR persona roots and hands a grant back to it. The challenge " +
      "comes from the vessel being raised and the grant goes back to it — no key of yours ever rests on the " +
      "vessel you raise, and the grant stands only until that Nexus's lease epoch rolls past it.",
    examples: [
      "lares raise sign ./challenge.json           # sign with the active persona root",
      "lares raise sign ./challenge.json --as 2    # ... with the root at handle-index 2",
    ],
    flags: ["--as <persona-index>   which held persona root signs the grant"],
    next: ["lares persona list", "lares vessel read"],
  },

  "vessel wire": {
    usage: "usage: lares vessel wire [--claude] [--codex] [--copilot] [--vscode] [--observe]",
    synopsis:
      "Point every AI surface on this machine at this vessel. Idempotent: an aligned wire passes untouched, " +
      "a DRIFTED one re-aims, an absent one gets written. THIS IS THE ONE VESSEL VERB THAT REACHES OUTSIDE " +
      "THE VESSEL ROOT — `stand` never does.",
    examples: [
      "lares vessel wire                # tend every surface, plus this repo's own adapters",
      "lares vessel wire --claude       # ~/.claude alone",
      "lares vessel wire --observe      # REPORT what a wiring would do; touch nothing",
    ],
    flags: [
      "no flag        tend every surface, plus this repo's own adapters",
      "--claude       ~/.claude — mempalace MCP + the wake/ingest hooks",
      "--codex        ~/.codex",
      "--copilot      ~/.copilot",
      "--vscode       every VS Code root present (stable + Insiders, remote + local)",
      "--observe      REPORT what a wiring would do; touch nothing",
    ],
    next: ["lares vessel read --palaces", "lares vessel stand"],
    meme: "lar:///ha.ka.ba/lares/cli/vessel-door",
  },
};

/**
 * The door key for a `--help` call: the SUB-DOOR entry when one stands (`vessel wire`), the command
 * otherwise. Longest match wins, so a sub-verb's own flags reach the reader instead of its parent's.
 */
export function helpDoor(command: string, positional: readonly string[]): string {
  const sub = positional[0];
  if (sub && `${command} ${sub}` in COMMAND_HELP) return `${command} ${sub}`;
  return command;
}

/** The `lar:` URI standing behind a verb door, or `undefined` where the door names none. */
export function memeForDoor(door: string): string | undefined {
  const uri = COMMAND_HELP[door]?.meme?.trim();
  return uri ? uri : undefined;
}

/**
 * One door's help as LINES — the single home both the `--help` render and a module's usage REFUSAL draw
 * from. A module that keeps its own copy of these words splits the two; the weld test refuses that.
 */
export function helpLines(door: string, summary?: string): string[] {
  const help = COMMAND_HELP[door];
  if (!help) {
    const out = [`lares ${door}`];
    if (summary) out.push("", `  ${summary}`);
    out.push("", `  (no detailed help yet — run \`lares ${door}\` for usage.)`);
    return out;
  }
  const out: string[] = [];
  if (help.usage) out.push(help.usage, "");
  out.push(`lares ${door} — ${help.synopsis}`, "");
  out.push("Examples:");
  for (const ex of help.examples) out.push(`  ${ex}`);
  if (help.flags && help.flags.length) {
    out.push("", "Flags:");
    for (const f of help.flags) out.push(`  ${f}`);
  }
  if (help.next && help.next.length) {
    out.push("", "Next:");
    for (const n of help.next) out.push(`  ${n}`);
  }
  if (help.meme) {
    out.push("", "Meme:", `  ${help.meme}`, `  read it: lares ${door} --help --meme`);
  }
  return out;
}

/**
 * Render a command's help to stdout (examples first, then flags, then `next:`, then the door's meme).
 * When no registry entry exists, fall back to the dispatch `summary` so every command still answers.
 */
export function renderCommandHelp(door: string, summary?: string): void {
  for (const line of helpLines(door, summary)) console.log(line);
}
