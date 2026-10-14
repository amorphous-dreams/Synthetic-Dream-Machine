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
  /** A command family's own sub-door menu, where a single synopsis would hide meaningful distinctions. */
  readonly details?: readonly string[];
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
  nexus: {
    usage: "usage: lares nexus <seal | rite | kapae | un_kapae | contract | revoke | carry | uncarry | members | accept-carriage | admit-take | carry-for | posture | kahuli | publish | realm-bag | realm-bags | offering>",
    synopsis: "the Nexus relation doors: charter ceremony, admission, carriage, posture, realm bags, and exact local offering inspection.",
    details: [
      "  seal <seat | reserve | rotate | commit | show | export | import | grow>  the kahu quorum's seats + pre-rotated epoch chain; grow = the crossing record ceremony",
      "  kapae <nym> [--reason <text>]             raise a quorum-signed ban on a presenter nym",
      "  kapae --list                              read the currently-Kapae'd set (the fold)",
      "  un_kapae <nym>                            mint a quorum-signed causal lift",
      "  contract <operator-pubkey> [--sig <hex>]  seat a vessel at the CONTRACT cap-tier (quorum + contract-in);",
      "                                            --json emits the admit BUNDLE the joinee takes by hand",
      "  revoke <operator-pubkey>                  revoke a member (quorum-only)",
      "  carry <place-vessel-key> --carrier <hex>  contract a faceless PLACE (a Herm) as a CARRIER — quorum + its own",
      "                                            VESSEL-key seal. It NEVER enters the member set; its whole grant is",
      "                                            the realm's PUBLIC-declared books, by hash (heraldry#/the-herm-card)",
      "  uncarry <place-vessel-key>                end a carrier contract (quorum-only)",
      "  members --list [--nexus <aid>]            read a Nexus's members board — a public RECORD of admits, never",
      "                                            authority (default: the primary charter's Nexus)",
      "  accept-carriage [--index N] [--nexus <aid>]  (joining operator) mint + keep the 'accepts carriage' contract-in",
      "                                            for one Nexus (default: the primary charter's)",
      "  admit-take <bundle-file>                  (joining operator) verify the admit bundle a founding kahu handed over",
      "                                            against the charter held for its Nexus, keep it, and re-present a",
      "                                            running vessel's dial to the hearth that wrote it",
      "  carry-for                                 (joining PLACE, on itself) mint the carrier seal with its OWN vessel",
      "                                            key — reads no persona, because a crossroads holds none",
      "  posture [private | open]                  read / flip the cross-Nexus federation posture",
      "  rite <petname>                            the pet-named procedures — `cabal` seats the founding quorum, `kahuli` overturns a ratchet tier",
      "  kahuli <engine | grammar>                 the OVERTURN — advance one ratchet tier of this Nexus's genesis composition",
      "  realm-bag <bag-uri>                       register a bag this steward keeps on the realm's shared CRDT (read at CONTRACT);",
      "                                            the WORN face's key for this Nexus seals it (`lares persona wear N` first)",
      "            [--realm <id>]                  the realm the act lands in: a cabal realm (64 hex) or the charter-derived realm (the default)",
      "            [--join]                        ASK to keep a bag another hand keeps — the record waits on each standing steward",
      "            [--cosign [--with <key>]]       consent as a named steward to a record that waits on this hand;",
      "                                            `--with` names the asker where several records wait",
      "            [--steward <key>[,<key>]]       also NAME those stewards, each a key that already sealed a record of this realm",
      "            [--tier contract|public]        the DECLARED read — public names a book the Herm carries by hash",
      "            [--expiry <rolls>]              lease the registration against the realm's own pace",
      "            [--charter <nym>=<realm-id>]    the charter a named hand holds (a book spanning two charters)",
      "  publish <plugins>                         THE OFFERING DOOR — what THIS operator publishes for others to take;",
      "                                            held apart from `kahuli`, which overturns what the MESH shares",
      "  offering inspect <offering-cid>           inspect one exact local gift; read-only, no fetch or install",
      "  realm-bags [--realm <id>]                 the bags a realm carries, and who keeps each; a listing never enters a realm",
    ],
    examples: [
      "lares nexus rite quorum",
      "lares nexus contract <operator-pubkey> --json",
      "lares nexus admit-take ./admit-bundle.json",
      "lares nexus offering inspect sha256:<offering-cid>",
    ],
  },

  "nexus offering": {
    usage: "usage: lares nexus offering inspect <offering-cid>",
    synopsis: "inspect one exact signed offering already carried by this Nexus Crossroads board. It reads local CAS only and never fetches, installs, mutates genesis, or changes grammar.",
    examples: ["lares nexus offering inspect sha256:<offering-cid>"],
  },

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

  host: {
    usage: "usage: lares host <roll | invite>",
    synopsis:
      "the hearth's HOSTING door. A hearth that carries a Nexus hosts walkers in it: `roll` publishes a signed " +
      "hosting act on this hearth's hosting doc in the Nexus (its CID names the epoch; rolling twice is the hard roll that " +
      "ends every grant and token before it), and `invite` mints one invite at the current epoch, printed as " +
      "the one `lar-invite:` string to carry. Bare `lares host` reads the live epochs, the cap and how many " +
      "invites were redeemed — counts, never rows. Nothing about who was invited is kept anywhere. While the " +
      "vessel stands, each door runs inside it, so a roll reaches its walkers with no restart.",
    details: [
      "  (none)                                   per Nexus: the current and previous epoch, the cap, the redemption counts",
      "  roll   [--nexus <aid>] [--cap <n>]       roll the hosting epoch; the act lands on this hearth's hosting doc",
      "  invite [--nexus <aid>] [--relay <url>]   mint this hearth's own invite at the current epoch",
    ],
    examples: [
      "lares host                               # what this hearth hosts, and the redemption counts",
      "lares host roll                          # open (or roll) the hosting epoch in the primary charter's Nexus",
      "lares host roll --cap 2                  # each walker lineage mints at most 2 invites per epoch",
      "lares host invite --relay ws://hearth:7700  # one invite to carry to one newcomer",
    ],
    flags: [
      "--nexus <aid>   the Nexus to act in (default: this hearth's own charter)",
      "--cap <n>       roll: invites per walker lineage per epoch (whole number ≥ 1)",
      "--relay <url>   invite: the relay the newcomer dials, carried in the invite string",
    ],
    meme: "lar:///ha.ka.ba/lararium/mesh/membership-doctrine#/the-invite",
  },

  walk: {
    usage: "usage: lares walk <take | invite>",
    synopsis:
      "this vessel's WALKING door. A vessel walks in at another hearth on an invite, as the face it wears: " +
      "`take` keeps a carried `lar-invite:` string durably, and the vessel's hearth dial walks in on it; " +
      "`invite` hands the newest invite out of the wallet, as one string to carry. Bare `lares walk` reads " +
      "where this vessel walks — the Nexus, its standing there, and its wallet. A vessel walks at one hearth: " +
      "a take for a second refuses and writes nothing. While the vessel stands, each door runs inside it.",
    details: [
      "  (none)                  per hearth: the Nexus, whether the invite still waits, the grant held, the wallet count",
      "  take <lar-invite:…>     keep a carried invite; the hearth dial walks in on it as the worn face",
      "  invite                  hand the newest invite out of the wallet",
    ],
    examples: [
      "lares persona wear 0                     # a walker walks as the face it wears",
      "lares walk take 'lar-invite:…'           # keep the invite a hearth handed you",
      "lares walk                               # where this vessel walks, and how many invites it holds",
      "lares walk invite                        # one invite to carry to one newcomer",
    ],
    flags: [],
    meme: "lar:///ha.ka.ba/lararium/mesh/membership-doctrine#/the-invite",
  },
  vessel: {
    synopsis:
      "THE VESSEL DOOR — one namespace over the vessel's own causal island. Four primitives and one " +
      "read: `found` mints identity + bootstrap · `stand` brings the daemon up and reports · `stop` " +
      "halts it on the port · `seed` plants " +
      "every bags/* holding back into its doc · `read` inspects and starts nothing. Compositions ride " +
      "`vessel rite <petname>`, so a new cap-stack arrives as a rite rather than another top-level verb. " +
      "Advancing the genesis composition is a MESH act — `nexus kahuli` — never a vessel door.",
    examples: [
      "lares vessel stand                      # idempotent boot, attach-or-start, and REPORT",
      "lares vessel wire                       # point every AI surface here (re-aims drift)",
      "lares vessel wire --claude              # ~/.claude alone",
      "lares vessel read --palaces             # health, plus the palace-organ table",
      "lares vessel seed --apply --yes         # plant every holding (idempotent)",
      "lares vessel rite refresh               # the post-code-change cure: build · stop · stand",
    ],
    flags: [
      "stand --foreground   this terminal owns the node (no Vite)",
      "stand --with-web     node + Vite web surface together",
      "stand --restart             free the port, then serve the current vessel",
      "stand --observe      REPORT ONLY — withholds the standing half; outranks every acting flag",
      "stand --install      found a vessel that holds none, then link `lares` globally — the founding runs first and stays inside LAR_ROOT; the mempalace sidecar has its own door, `mempalace install`",
      "stand --init         founds the same, AND wires every AI surface (reaches ~/.claude etc; `vessel wire` is the door for that alone)",
      "stand --admit <file>        join an existing operator PersonaGroup",
      "wire [--claude|--codex|--copilot|--vscode]   aim that surface here; no flag aims them all",
      "wire --observe       REPORT what a wiring would touch; write nothing",
      "read --palaces       the palace-organ health table (mempalace · structure · form · mesh)",
      "rite <petname>       founding · refresh · rebuild — the pet-named cap-stacks",
    ],
    next: ["lares vessel read --palaces", "lares sense pour --all"],
    meme: "lar:///ha.ka.ba/lares/cli/vessel-door",
  },

  sense: {
    synopsis:
      "THE SOVEREIGN SENSORIUM'S ONE DOOR (the guest comparator lives at `lares mempalace`). READ four " +
      "verbs with the plane as a `--lens` parameter (search · relate · structure · status), so a new plane " +
      "needs no new verb. TEND the planes with the lifecycle verbs (recall · capture (incl. sub-agent " +
      "transcripts) · pour · teardown · worldline · telemetry · flow). `pour --all` walks the whole tending movement — " +
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
    usage: "usage: lares meme <put | get | list | delete | normalize | check | sitting | project | promote> (store verbs require (--recipe <slug> | --bag <slug>))",
    synopsis:
      "THE MEME DOOR — one family for every law over meme text, and each verb DECLARES ITS SEAT: " +
      "`normalize` · `check` · `sitting` · `project --to md` (over a file) run LOCAL with no daemon in " +
      "reach; `put` · `get` · `list` · `delete` · `project` to any other target, or from a `lar:` uri, ride " +
      "the daemon verb. Store-backed verbs require `(--recipe <slug> | --bag <slug>)`; `--recipe` edits AS " +
      "the named wiki; " +
      "`--bag` places into that bag and REFUSES when this island cannot write it; `--realm <id>` beside " +
      "`--bag` names the realm whose registration that bag resolves through, and reads that realm alone. " +
      "`--base` carries the " +
      "canonical hash last read — a record that moved past it CONFLICTS and nothing lands.",
    examples: [
      "lares meme get lar:///ha.ka.ba/lares/api/corpus --recipe lares        # text on stdout, the base on stderr",
      "lares meme put lar:///ha.ka.ba/... --recipe lares --file note.mem     # land a framed meme through the gate",
      "lares meme list --recipe lares --tree                                  # every root the wiki resolves, each slot tree nested",
      "lares meme list --bag lares                                            # every root that one bag holds",
      "lares meme delete lar:///ha.ka.ba/... --recipe lares --if-match <hash> # a stale base moves nothing",
      "lares meme normalize draft.mem                         # re-frame + re-stamp the block check",
      "lares meme check bags/**/*.mem                         # CI / pre-commit: drift exits 1",
      "lares meme project note.mem --to md --out ./out        # the submission pair, clock-free",
      "lares meme project --to md --check bags/…/submissions   # every pair on the shelf re-projects clean",
      "lares meme promote bags/…/docs/pono/x.mem              # the canon crossing, receipt beside the carrier",
    ],
    flags: [
      "--recipe <slug>    an edit AS that wiki: its designated writable bag, write-then-sync",
      "--bag <slug>       a residency placement into that bag (refused when this island cannot write it)",
      "--base <hash>      (put) the canonical hash last read; stale → conflict, nothing lands",
      "--if-match <hash>  (delete) the canonical hash last read; stale → conflict, nothing moves",
      "--file <path>      (put) the meme text (stdin when absent)",
      "--tree             (list) nest each root's slot tree; roots + canonical hash alone otherwise. " +
        "`list --recipe` names the roots the wiki's whole stack resolves (a removed carrier lists nowhere); " +
        "`list --bag` names that one bag's own",
      "--dest-bag <uri>   (promote) the canon bag crossed into; the cap is read against this name",
      "--gradient         (check) name each file's kind and the marks that kind requires and lacks",
      "--edges            (check) name the addresses these carriers point at, and which of them answer",
      "--grammar          (normalize/check) also apply GRAMMAR-authority clauses (authored spelling, " +
        "e.g. a call site's `:` vs `=`) — default reports them as a preference and moves no byte",
      "--to <mem|md|html|tid|json>   (project) the render target",
      "--out <path>       (project) the pair's directory (--to md) or the rendered file; stdout otherwise",
      "--check            (project --to md, over a <file.md|dir>) prove currency by re-projection alone; " +
        "writes nothing, exits 1 naming each pair whose source moved or vanished, or whose bytes drifted",
    ],
    next: ["lares meme check <file.mem>", "lares meme sitting bags/   # what the fire could take; it BURNS NOTHING"],
    meme: "lar:///ha.ka.ba/lares/api/pono/meme",
  },

  library: {
    usage: "usage: lares library <list | show | acquire | verify | index | path>",
    synopsis:
      "The ACQUIRED shelf — books and corpora a human did not author, kept READABLE and VERIFIABLE outside " +
      "every tracked tree. The tier stands in the SHRINE at `<lararium>/library` (`~/.local/share/lararium/" +
      "library`, or LAR_LIBRARY) — a house no wipe names. Layout: `<collection>/<cid>/<the real filename>`: " +
      "the directory name IS the digest (audit with sha256sum, no tooling), the filename reads to a human. " +
      "No per-entry sidecar: each entry's record rides as its own `#/<cid>` ahu slot inside the collection's " +
      "`index.mem` carrier — origin · licence · the RFC-6920 anchor. A reference NAMES — " +
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
    meme: "lar:///ha.ka.ba/lararium/mesh/membership-doctrine#/the-two-stacks",
  },

  handle: {
    usage:
      "usage: lares handle <publish \"<glamour>\" | rotate | graft | burn [--from-persona] | " +
      "attest --surface <kind> --subject <name> [--return-locator <where>] | " +
      "verify-attestation <statement | @file | -> [--card <file>]> [--persona <index>]",
    synopsis:
      "The Handle's verb family — a persona's public \"here I am\" note and its lifecycle on the handle-KEL. " +
      "`publish` mints a self-certifying card and announces it onto the Nexus WHO board; `rotate` seats a fresh " +
      "presentation key under the same name (the OWNING PERSONA authorizes, so a lost key recovers through the " +
      "persona); `burn` ends the name terminally (the seated key, or the persona from above with " +
      "--from-persona); `attest` signs a STRUCTURED claim under the current head — a named SURFACE (which " +
      "adapter, and whose authority, answers the check: dns-control · atproto-account · kowloon-actor · " +
      "loopback-address) plus the foreign SUBJECT it names, never prose, because a peer sharing none of our " +
      "context must read the edge mechanically. `graft` (owner-set succession) declares " +
      "its shape and awaits its vessel-side pass. " +
      "TWO HALVES OF AN ATTESTATION, NEVER ONE: `verify-attestation` runs the CHAIN-VERIFY half reader-locally " +
      "— the chain verifies, stands unburned, matches the statement's prefix and seats the head that signed it " +
      "— touching NO network and NO board. A pass proves THE HANDLE SAID IT, never that the claim is TRUE. The " +
      "SURFACE-VERIFY half (asking DNS whether the Handle really controls example.net) is a separate act this " +
      "door does not perform and does not imply.",
    examples: [
      "lares handle publish 'Guru-Josh'                      # announce a face onto the WHO board",
      "lares handle rotate --persona 1                       # seat a fresh presentation key, same name",
      "lares handle attest --surface dns-control --subject example.net       # a signed DNS-control edge",
      "lares handle attest --surface kowloon-actor --subject '@alice@kowloon.example' --return-locator 'profile.urls[]'",
      "lares handle verify-attestation @stmt.json --card ./card.json   # CHAIN-verify a claim someone handed you",
      "lares handle verify-attestation - < stmt.json         # ... reading the statement from stdin",
      "lares handle burn --from-persona                      # the persona buries the face from above",
    ],
    flags: [
      "--persona <index>  which persona acts (default: the worn persona, then 0)",
      "--from-persona     (burn) the owning persona buries the face from above, not the seated key",
      "--surface <kind>   (attest) WHICH adapter answers: dns-control · atproto-account · kowloon-actor · loopback-address",
      "--subject <name>   (attest) the foreign name the edge reaches, in that surface's own grammar",
      "--return-locator <where>  (attest) where the surface half looks for the prefix named BACK " +
        "(bidirectional or nothing); absent, the adapter reads its own conventional location",
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
    usage: "usage: lares persona <new <index> --name <petname> [--handle <Handle>] [--seat [--chair <label>]] [--split-root] | wear <index> | list | sync | admit>",
    synopsis:
      "The PLURALITY-PONO identity multitude. THREE NAMES, THREE JOBS: the private LABEL names a compartment " +
      "to you alone; the declared HANDLE names what a persona answers to OUTWARD (an intent — only " +
      "`lares handle publish` performs the announce); the SEAT stands it for a Kahu chair on this node and " +
      "needs no Handle and carries a private chair label. `--split-root` opts into recovery shares. `wear` switches the active persona (reboot-to-switch — one face to the " +
      "mesh). Local-first: a write lands on this node first and rides up when a hearth answers. A joinee " +
      "receives a root by admit and never mints here.",
    examples: [
      "lares persona new 0 --name '<label>' --seat [--chair '<chair label>']",
      "lares persona new 1 --name '<label>' --seat [--chair '<chair label>']",
      "lares persona new 2 --name '<label>' --seat [--chair '<chair label>'] [--split-root]",
      "lares nexus seal seat                  # ... the founding sequence closes here",
      "lares persona wear 1                   # switch the active persona",
      "lares persona list                     # held indices · active marker · labels · declared Handles",
      "lares persona sync                     # carry labels + Handles up to the fleet (the persona plane)",
    ],
    flags: [
      "--name <petname>   (new) the PRIVATE label at that handle-index",
      "--handle <Handle>  (new) declare the public Handle it answers to (intent, not an announce)",
      "--seat             (new) stand it for a Kahu chair on THIS node (no Handle needed)",
      "--chair <label>    (new) private label for a seat claim; pass with --seat",
      "--split-root       (new) opt into arming the 2-of-3 recovery split",
      "admit <sub>        offer | grant | open | accept | list — airgapped device-to-device hand-off (QR 3-hop)",
    ],
    next: ["lares persona list", "lares handle publish '<glamour>'   # the outward announce"],
  },

  vault: {
    usage: "usage: lares vault <status | unlock | lock | bind | unbind <slot-id> | backup --face <N> --out <file> | restore <file> [--as <N>] [--memory]> [--passphrase | --paper] [--rotate]",
    synopsis:
      "The VESSEL KEY custody door (status, unlock, lock, bind, unbind): the key seals the vessel's private rows, the " +
      "keyhive and veil archives among them, and every boot rests at the floor until a person unlocks it. " +
      "`backup` cuts ONE face's bundle: its root, its own lines and the content keys this vessel holds for it, sealed " +
      "under a new route of its own; it carries no veil key and no seat, and the sealed bytes must survive elsewhere. " +
      "`restore` brings a face back from its bundle as a recovery act: the vessel derives its own veil and takes a NEW seat " +
      "under the face's fixed prefix, and `--memory` lands the bundle's content keys on that seat. " +
      "`status` gives ONE reading of every standing file the carrier table names: a row under the vessel key reads " +
      "sealed or reads as a fault, a row outside it names the law it rests bare under, and a private file no row " +
      "names prints by name. `unbind --rotate` runs as one act: the rotation's census passes before any byte moves, " +
      "so a carrier that refuses it leaves the slot bound. A credential rides a TTY alone, typed with no echo: no " +
      "flag, no environment variable and no pipe carries one.",
    examples: [
      "lares vault status                     # the slot tree, one reading of each standing file, and any private file outside the carrier table",
      "lares vault unlock                     # hand the standing vessel a TTY credential: it opens its key and composes with what the key opens",
      "lares vault lock                       # the standing vessel drops its key and stands at the floor",
      "lares vault bind [--passphrase|--paper]   # unlock, then bind a second human route (a paper pin reads back)",
      "lares vault unbind <slot-id>           # unlock, remove a slot; the rotation offer prints",
      "lares vault unbind <slot-id> --rotate  # one act: a new vessel key seals every carrier and each staying slot binds over it",
      "lares vault backup --face <N> --out <file>   # cut ONE face's backup bundle, sealed under a route of its own",
      "lares vault restore <file>             # bring a face back from its bundle: a recovery act that takes a NEW seat",
      "lares vault restore <file> --memory    # land the bundle's content keys on the restored seat (vessel standing, unlocked, wearing the face)",
    ],
    flags: [
      "--passphrase|--paper  (bind) which route the new slot carries; (unlock) skip the route question",
      "--rotate           (unbind) mint a new vessel key and re-bind each staying slot; put <slot-id> BEFORE it",
      "--face <N>         (backup) the handle-index of the face to cut; the standing vessel wears it",
      "--out <file>       (backup) the bundle file to write; a file already standing there refuses",
      "--as <N>           (restore) the handle-index the face lands at here; absent, the index its bundle named",
      "--memory           (restore) import the bundle's memory section instead of its lineage",
      "unlock | bind | unbind | backup | restore read their credential on a TTY ALONE — no flag, env var or pipe; no TTY refuses CredentialTtyRefusal",
    ],
    next: ["lares vault status", "lares vault unlock"],
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
      "lares cabal join --realm <realm-doc-id>                        # PRESENT and cross",
      "lares cabal feed --realm <realm-doc-id>                        # the OFFERING — roll your lease slot",
      "lares cabal clock --realm <realm-doc-id>                       # who feeds this realm, and how deep",
    ],
    flags: [
      "--realm <doc-id>   the cabal-realm every verb here addresses",
      "--as <root-index>  which held persona root signs",
      "--cap <n>          (join) the price ceiling this crossing accepts",
    ],
    next: ["lares cabal clock --realm <realm-doc-id>", "lares nexus seal show"],
  },

  edge: {
    usage: "usage: lares edge <kapae | un-kapae> (<edge-id> | --member <key> | --device <key>) [--realm <realm-id>] [--quorum] [--as <root-index>]\n       lares edge settle [--fleet <fleet-root>]\n       lares edge <kapae | un-kapae> (--member <key> | --voucher <key> --joiner <key>) --realm <realm-id> --quorum --partial\n       lares edge cosign (<partial-json> | --from <file>) [--act <act-cid>]",
    synopsis:
      "Set one RELATIONSHIP aside, or take the marker back down — the kāpae raised over an EDGE rather than " +
      "over a party. Scoped under `edge` to mirror `nexus kapae` / `nexus un_kapae` and stay apart from " +
      "them: that pair shadows a PRESENTER at a Nexus, this pair shadows one RELATIONSHIP. TWO HANDS ACT. The " +
      "HOLDER signs with the one key the edge names: a voucher over their own vouch (`--realm`), or a fleet " +
      "root over a device of its fleet (`--device`, on the fleet's own board). The QUORUM (`--quorum`) signs " +
      "with the seats of this vessel's charter, at the charter's head epoch: it strikes a vouch, or sets a " +
      "MEMBER's whole relation to a realm aside (`--member`), which holds against a fresh vouch. A lower " +
      "lifts only its own hand's raises. RAISING WINS A TIE: a lower lifts the shadow only when it causally " +
      "follows every raise, so a lower racing a raise leaves the shadow up and shows a fork for people to " +
      "settle. Each act cites the heads this vessel counts, at whatever epoch they root on, so a lift after " +
      "a seal roll cites the raise it lifts, and running the verb again settles a fork. The write asserts no " +
      "authority: whether a hand holds the edge gets decided by whichever reader consults the shadow. A lift " +
      "restores standing alone; a fresh crossing seats fresh keys. `settle` answers, on the KEY side, every " +
      "raise this vessel counts on its fleet's board: a device set aside leaves the face's key group, each " +
      "counted raise owes one roll of the seat it names, and the vessel remembers what it answered. A seat " +
      "leaves under the hand that seated it or a hand upstream of that seat; where this vessel holds neither, " +
      "`settle` says so. A vessel that reads a shadow over its own edge performs no key act. SEATS ON SEPARATE " +
      "VESSELS sign one quorum act in turn: `--quorum --partial` signs with the seats this vessel holds and " +
      "prints a partial that carries the whole act and names its subject in plain keys; `cosign` judges it " +
      "against this vessel's own charter and board and prints what it reads, signing nothing; with " +
      "`--act <act-cid>`, the id that read printed, it adds this vessel's seats and lands the act once the threshold meets. The input holds " +
      "ONE partial and nothing else, so no text beside it describes the act. A partial cut before the line moved or the roster rolled refuses as stale, and one whose act " +
      "already counts here refuses as a replay. No clock decides either.",
    examples: [
      "lares edge kapae <vouch-edge-id> --realm <realm-id>               # a voucher withdraws their own vouch",
      "lares edge kapae --member <key> --realm <realm-id> --quorum       # the seat quorum sets a member aside",
      "lares edge un-kapae --member <key> --realm <realm-id> --quorum    # the quorum lifts its own shadow",
      "lares edge kapae --device <device-key> --as 1                     # a fleet root sets a lost device aside",
      "lares edge settle                                                 # the device's seat leaves the face's key group",
      "lares edge kapae --member <key> --realm <realm-id> --quorum --partial   # one seat signs its part",
      "lares edge cosign '<partial-json>'                                # another seat's vessel reads the partial",
      "lares edge cosign '<partial-json>' --act <act-cid>                # and then adds its part, for that act alone",
    ],
    flags: [
      "--realm <realm-id> the realm whose own edge board carries the act (absent: the fleet's board)",
      "--member <key>     name a member's whole relation to the realm (the quorum's edge)",
      "--device <key>     name a device's relation to the signing root's fleet",
      "--quorum           sign with this vessel's held seats of the charter's quorum",
      "--as <root-index>  which held persona root signs as the holder (default: the active one)",
      "--fleet <root>     (settle) one fleet root to settle (default: the root of every face this vessel holds)",
      "--partial          with --quorum: sign with the seats held here and print a partial, landing nothing",
      "--voucher <key>    (partial) with --joiner: name one vouch by its two ends",
      "--joiner <key>     (partial) with --voucher: name one vouch by its two ends",
      "--from <file>      (cosign) read the partial from a file",
      "--act <act-cid>    (cosign) sign and land that act; absent, the verb only reads the partial",
    ],
    next: ["lares cabal join --realm <realm-id>   # reads every shadow the crossing meets", "lares nexus kapae --list   # the PRESENTER board — a different kind of setting-aside"],
  },

  raise: {
    usage: "usage: lares raise sign <challenge-json-text> [--as <persona-index>]",
    synopsis:
      "The RECOGNISER's half of the raise ceremony. A vessel standing at the WAKING FLOOR emits a challenge " +
      "as a line of JSON text (its boot log prints it); `raise sign` signs THAT TEXT, taken literally as the " +
      "positional argument (never a path — it reads no file), with your persona's LEAF for the Nexus the " +
      "challenge names (never the root). It attaches that leaf's admit, read off your own replica of the " +
      "Nexus's carriage board as a presented admit — the counted head, its closed lineage, and any roll " +
      "anchors that carry an admit minted before a roll — and hands the grant back. The vessel raises only " +
      "on an admit it reads HELD on its own place-side carried set — no key of yours ever rests on the " +
      "vessel you raise, and the grant stands only until that Nexus's lease epoch rolls past it.",
    examples: [
      "lares raise sign '{\"vesselId\":\"<id>\",\"nexus\":\"<aid>\",\"epoch\":0,\"nonce\":\"<hex>\"}'" +
        "   # sign the vessel's printed challenge as persona 0's leaf",
      "lares raise sign \"$(cat ./challenge.json)\" --as 2   # ... as persona 2's leaf, challenge saved to a file first",
    ],
    flags: ["--as <persona-index>   which held persona's leaf signs the grant"],
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
  if (help.details && help.details.length) {
    out.push(...help.details, "");
  }
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
