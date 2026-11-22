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
 * A KEY MAY NAME A SUB-DOOR. `"<door> <sub>"` keys the sub-verb's own entry; the dispatcher prefers the
 * longer key when the positional matches, so a sub-door's flags reach the reader instead of its parent's.
 *
 * PURE DATA, SO ANY VESSEL CAN HOLD IT. This module imports nothing — no `node:fs`, no environment read.
 * The `meme` field NAMES the wiki record behind a verb door (`lar:` names; it never fetches); the `--meme`
 * reach rides the daemon verb rail `lares meme get` already uses, which any vessel holding the cap can run.
 * Every URI here comes HARVESTED from the owning module's own `Meme:` header — never invented at this seat.
 */
import { PLANE_LABELS } from "@lararium/mesh/plane-labels";

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
  ddate: {
    usage: "usage: lares ddate [+FORMAT] [day month year]",
    synopsis:
      "Print the Discordian date, computed by the house's own calendar (no host ddate binary stands behind it). " +
      "Five seasons of 73 days (Chaos, Discord, Confusion, Bureaucracy, The Aftermath), a five-day week (Sweetmorn, Boomtime, Pungenday, " +
      "Prickle-Prickle, Setting Orange), YOLD = the Gregorian year + 1166, St. Tib's Day on February 29 (no season, no weekday), " +
      "an apostle's holyday on day 5 of a season and its season holyday on day 50. With no date it reads today's local day. " +
      "X-Day (Confusion 40, 9827 YOLD) is the Church of the SubGenius's date, set forward once the first X-Day passed without incident; %X counts the days to it.",
    details: [
      "  %A %a   weekday, long and short          %B %b   season, long and short",
      "  %d      day of the season                %e      the ordinal (1st, 11th, 21st, 22nd, 23rd)",
      "  %E      the ordinal by its last digit alone (11st, 12nd, 13rd): the first ddate's reading, an easter egg",
      "  %H      the day's holyday, if any        %N      stop here unless the day holds a holyday",
      "  %Y      the YOLD                         %X      days until X-Day (negative once it passed)",
      "  %n %t   newline, tab                     %.      an exclamation from the platform's entropy door",
      "  %{ %}   the span between them reads \"St. Tib's Day\" on February 29 and prints plain on every other day",
    ],
    examples: [
      "lares ddate                                       # today, with the default format",
      "lares ddate 5 1 2024                              # a named day: Setting Orange, Chaos 5, 3190 YOLD",
      "lares ddate '+%{%A, the %e of %B%}, %Y. %N%nCelebrate %H' 19 2 2025",
      "lares ddate +%X 20 11 2026                        # days until X-Day",
      "lares ddate '+%. %E'                              # an exclamation and the first ddate's ordinal",
    ],
    flags: [
      "--json       emit the envelope instead of the bare line: {text, entropy, gregorian, yold, tibs, season, dayOfSeason, weekday, holyday}; `entropy` names the door a `%.` drew from",
    ],
  },
  oracle: {
    usage: "usage: lares oracle cast --recipe <slug> [--coins <six values>] [--caster <name>]",
    synopsis:
      "Cast the I Ching by three coins a line and let the vessel write the cast as one tiddler under lar:///ha.ka.ba/lares/oracle/casts/. " +
      "A line sums three coins, heads three and tails two: 6 (old yin) and 9 (old yang) change, 7 and 8 hold. The six lines, bottom first, " +
      "name the primary hexagram by its King Wen number; the changing lines turned over name the relating one. With no --coins the coins draw " +
      "through the platform's entropy door (crypto.getRandomValues); --coins hands in the operator's own throw with real coins, named " +
      "operator:three-coins. A cast stands as an act: the tiddler holds the throw, and reading it again never casts again; " +
      "the oracle widens attention and never decides.",
    details: [
      "  The reading names the house's imported texts for each hexagram: the DOA (Kopyleft 2022, Steal and Share Alike) and the",
      "  e-jing ((K)opyLeft, its quoted snippets under fair use), each with its attribution and license.",
    ],
    examples: [
      "lares oracle cast --recipe default                       # a house cast through the platform's entropy door",
      "lares oracle cast --recipe default --coins 7,8,9,6,7,7   # the six lines you threw with real coins, bottom first",
      "lares oracle cast --recipe default --json                # the verb's answer: cast, readings, the tiddler's title",
    ],
    flags: [
      "--coins <v>   six line values of 6, 7, 8 or 9, bottom line first (7,8,9,6,7,7 or 789677): the operator's own throw",
      "--caster <n>  who cast (default: operator)",
      "--json        emit {decision, created, title, cast, text, readings, note}",
    ],
  },
  law: {
    usage: "usage: lares law list [--limit N] [--after <cursor>] [--all]  |  lares law pin <uri>  |  lares law unpin <uri>",
    synopsis:
      "Read the house's law, pinned law first, from the worn face's daemon wiki. The index derives from canon by filter and no list stands " +
      "in code: the law reads every root meme under a bag's api/ tree, by title, and $:/config/lares/law/pins holds the pin set (the boot " +
      "seed, then the Mu family), a TiddlyWiki filter the wiki's own engine runs. Only canon prints: a row stands where a canon layer " +
      "answers its record, so nothing a face writes reads as law. A pin edits the pin set by one run, keeping its layout, and lands it in " +
      "the face's working layer, never in house canon; a pin orders canon law and adds none.",
    details: [
      "  lares law list            the pinned titles (marked 📌), then the law they leave out, each with its description or role",
      "  lares law pin <uri>       add a law meme to the pin set (a `[[uri]]` run); a title no canon law holds refuses law-pin-absent",
      "  lares law unpin <uri>     take it out (its `[[uri]]` run leaves; a title a broader run names takes a `-[[uri]]` run)",
    ],
    examples: [
      "lares law list                                              # the first page: pins, then law by title",
      "lares law list --all --json                                 # every row: {filter, pins, rows, total, next}",
      "lares law pin lar:///ha.ka.ba/lares/api/pono/lar-uri        # read the address law right after the Mu family",
      "lares law unpin lar:///ha.ka.ba/lares/api/mu/chao           # drop one Mu member from the pins",
    ],
    flags: [
      "--limit N        rows per page (the door's ceiling holds)",
      "--after <c>      the page behind a cursor `list` named",
      "--all            follow every cursor to the end",
      "--json           emit the answer: list {filter, pinsTitle, pins, rows, total, next}; pin {title, uri, decision, pinned, text, hash}",
    ],
    next: ["lares meme get <uri> --recipe default      # read one law meme whole"],
    meme: "lar:///ha.ka.ba/lararium/tw5/daemon-law-tiddlers",
  },
  herm: {
    usage: "usage: lares herm [--port N] [--relay-port N]  |  lares herm relay-rotate",
    synopsis: "Stand a herm: the wiki-less wayfarer that stands the carriage crossroads a family's hearths dial to carry sealed bodies between each other. It boots the same node the vessel runs, under the herm recipe, and prints the crossroads' dial URL(s) and gate key once the node attests ready.",
    details: [
      "  lares herm                stand the herm detached; needs a founded place (`lares vessel found`) and a built node",
      "  lares herm relay-rotate   mint a new durable relay gate and print its pin; restart the herm, then hand each dialing hearth the new pin",
    ],
    examples: ["lares herm", "lares herm --port 8080 --relay-port 8090", "lares herm relay-rotate"],
    flags: [
      "--port <N>         the http read-face port (LAR_PORT, else 8080)",
      "--relay-port <N>   the carriage crossroads port hearths dial (LAR_HERM_RELAY_PORT, else 8090)",
    ],
    next: ["where the host holds the engine, a herm stands as the container's own service: docker compose -f docker-compose.surface.yml --profile herm up -d herm"],
  },
  promote: {
    usage: "usage: lares promote list|prepare|commit|drop|orphan [digest] [--wiki wiki] [--face N]",
    synopsis: "Every wiki wears promotion capability; its edge holds (face, wiki, digest). The AI prepares and flags; the hand commits and raises.",
    examples: ["lares promote list --wiki garden", "lares promote prepare <digest> --why reason", "lares promote commit <digest>", "lares promote orphan <digest> --keep"],
    flags: ["--wiki <wiki>   wiki name", "--face N   face index", "--why <reason>   preparation reason", "--keep   keep an orphan", "--drop   drop an orphan"],
  },
  lei: {
    usage: "usage: lares lei show|kui|unstring|restring --rite push|kukulu|keep|exec --branch <name> [--scope '<json>'] [--head <h>] [--returns <n>] [--reach wide|head] [--after <cid>] [--lei <cid>] [--yes] [--face N | --all]  |  lares lei land '<pūlama answer>' [--face N]  |  lares lei terms kui|restring|unstring --rite <r> --branch <name> [--returns <n>] [--reach wide|head] [--head <h>] [--after <cid>] [--lei <cid>] [--yes] [--face N | --all]",
    synopsis:
      "A lei grants one rite at one branch. A wide lei (the default) names no head and carries its returns; a head lei pins one head. " +
      "The hand strings (kui), unstrings and restrings; any seat reads. The signed lei carries the consent, and a `push` lei adds its ward co-sign. " +
      "Under a pūlama the hand signs at the pūlama's hand door and `land` lands the record; `terms` prints the one JSON line that door takes " +
      "(the face from --face, else a keep's own face, else the daemon mount; a restring's `after` from the line's tip), and writes nothing. `kui --all` strings one lei for every open face under ONE route, each face's own record by its own hand at its own line's tip, and names each face's cid; a show of one line naming no face reads every open face's line.",
    examples: [
      "lares lei show --rite kukulu --branch main --json                    # data.lei: standing, reach, returnsLeft",
      "lares lei show --rite push --branch feature/x --head <commit> --json   # ask after one head",
      "lares lei kui --rite push --branch feature/x --returns 3               # a wide lei of three returns",
      "lares lei kui --rite kukulu --branch main --reach head --head <commit> # a lei pinned to one head",
      "lares lei kui --rite kukulu --branch main --returns 3 --all          # one route: a kukulu lei for every open face",
      "lares lei kui --rite keep --branch house-backup --returns 6           # six keeps into the workspace house-backup",
      "lares lei unstring --rite push --branch feature/x --lei <cid>          # revoke it; a signed record, nothing deleted",
      "lares lei restring --rite push --branch feature/x --returns 2          # supersede the standing lei",
      "lares lei land '<the pūlama's answer>'                                 # land a record the hand signed at the pūlama",
      "lares lei terms restring --rite push --branch feature/x --returns 2    # one line: the terms `pulama-main.js lei restring` takes",
    ],
    flags: ["--rite <r>   push, kukulu, keep or exec", "--scope '<json>'   (exec) the wiki, the writer, and titles or one class; the branch derives from the wiki", "--branch <name>   the branch the lei binds (a keep lei: the workspace's name)", "--head <commit>   the head a show reads at, or a head lei pins",
      "--returns <n>   a wide lei's count of returns (more than twelve asks --yes)", "--reach wide|head   the lei's reach (wide where absent)", "--after <cid>   (kui) the lei this one follows; absent for the first",
      "--lei <cid>   (unstring) the lei to revoke", "--face N   face index", "--all   (kui, push or kukulu) one lei for every open face, under one route"],
  },
  rite: {
    usage: "usage: lares rite kukulu [--branch <name>] [--face N] [--rollback [<rev>]] | keep --workspace <name> [--into <path>] [--accept-omissions] [--sessions|--no-sessions] | keep --if-due [--workspace <name>] | keep-cut --workspace <name> [--into <path>] [--accept-omissions] | begin --rite <r> --branch <name> --head <commit> [--staging <path>] [--image <digest>] | offer --branch <name> --head <commit> --image <digest> | land --tessera <id> --head <commit> [--image <digest>] | receipts [--rite kukulu [--branch <name>]]",
    synopsis:
      "A rite spends a lei. kūkulu is the one verb that raises the house again around its hearth, and it picks up wherever the " +
      "house stands: it fast-forwards the checkout where it stands clean and behind its upstream (a dirty tree behind, a diverged " +
      "branch or a detached head stops with one line), makes the image (the tag, a kept image, or a build from the commit), spends " +
      "each face's kukulu lei where one stands (the guest half of a tessera; no prompt), takes the vessel down (keep, census) and " +
      "raises the new one, and the new vessel rests the host half. A pūlama whose code moved, or that stands unlit, lights on this " +
      "terminal in the same run; an image no admission and no lei carries asks the pūlama's admit there too. With no terminal, a day " +
      "that owes either route stops before anything moves and names the hand act (`lares rite kukulu` on a terminal); every other " +
      "day flows. --rollback stands the image that ran before (--rollback <rev>: an older revision's kept image, or a build from " +
      "that commit), with no checkout move. A Ctrl+C at any prompt (accept-loss, the light, the admit) leaves the house where the " +
      "next run reads it: a begin standing unlanded at this head and over this image, every half landable, is resumed (no lei " +
      "spent, no new tessera, the resting offer reused where its vouches match), and any other (another head or image, a face " +
      "shut or rehived since) refuses by name with the line that clears it: each half a lent face lands, landed by hand where the " +
      "vessel stands (`lares rite land --tessera <id> --head <the head the vessel runs>`; conferre reads it red). " +
      "keep lays the house's authored memory, cut as a cleartext house bundle a new house imports, into a workspace the operator " +
      "bound, and keeps it in the operator's repo: on the host it guards the workspace clone (only <into> changes; a committed `* -text` " +
      ".gitattributes; no secret-shaped string), runs keep-cut in the vessel (a return of the keep lei strung for that workspace; the " +
      "bundle replaces the one an earlier keep left), commits `keep <bundleId>`, rebases, pushes, and lands the tessera at the bundle " +
      "id the pushed tree holds. A push that fails names the cure: mend the remote and run keep again. " +
      "keep also carries this device's Claude Code sessions under devices/<name>-<id8>/ in the same commit and push; " +
      "--no-sessions (or LARES_KEEP_SESSIONS=0) keeps the house alone. " +
      "conferre matches the halves at each wake: a match reads par, a half with no match reads red.",
    examples: [
      "lares lei kui --rite kukulu --branch main --returns 3 --all   # the hand strings every open face's lei first, one route",
      "lares rite kukulu                                       # fast-forward, image, begin, restand, land: the whole raise",
      "lares rite kukulu --rollback                            # stand the image that ran before, no build, no checkout move",
      "lares lei kui --rite keep --branch house-backup --returns 6 --face 0   # the hand strings a keep lei for one workspace, as one face",
      "lares rite keep --workspace house-backup                # guard, cut into <workspace>/house, commit, push, land: par",
      "lares rite keep-cut --workspace house-backup            # the vessel half alone: cut, verify, spend a return, rest the bundle",
      "lares rite offer --branch main --head <commit> --image <digest>   # the standing vessel rests what the next one carries to a pūlama",
      "lares rite land --tessera <id> --head <commit>          # land a rite whose vessel came back locked",
      "lares rite receipts --json                              # data.receipts, data.conferre",
      "lares rite receipts --rite kukulu --branch main --json  # data.standing: each lent face's begun half resting unlanded",
    ],
    flags: ["--branch <name>   the line the kukulu lei binds (the checkout's branch where absent)", "--rollback [<rev>]   (kukulu) the image that ran before, or an older revision's", "--rite <r>   (begin) the rite; (receipts) kukulu reads every lent face's unlanded begin", "--head <commit>   (begin, offer, land) the head",
      "--staging <path>   (begin, a keep) the bundle the keep staged inside its workspace; the vessel derives the id from it",
      "--workspace <name>   (keep, keep-cut) the bound workspace the bundle rests in", "--into <path>   (keep, keep-cut) the place inside it (house where absent)",
      "--accept-omissions   (keep, keep-cut) name the bundle partial where the census reads unsettled",
      "--if-due             (keep) keep only where the house moved since the pushed bundle; reads LARES_KEEP_WORKSPACE with no --workspace",
      "--image <digest>   (offer, begin, land) the digest of the image the host built",
      "--tessera <id>   (land) the tessera a begin answered", "--face N   face index (a kūkulu naming none acts as the worn face; a keep naming none acts as the keep's face and says so; the floor refuses by name)"],
  },
  kapae: {
    usage: "usage: lares kapae raise|lower|flag <digest> [--wiki wiki] [--face N]",
    synopsis: "Every wiki wears promotion capability; its edge holds (face, wiki, digest). The AI prepares and flags; the hand commits and raises.",
    examples: ["lares kapae flag <digest> --why reason", "lares kapae raise <digest> --wiki garden", "lares kapae lower <digest>"],
    flags: ["--wiki <wiki>   wiki name", "--face N   face index", "--why <reason>   flag reason", "--keep   keep an orphan", "--drop   drop an orphan"],
  },
  "intent-relay": {
    usage: "usage: lares intent-relay enable|disable|status|rotate [--face N] [--json]",
    synopsis: "Control a face's sealed intent relay and inspect its public pin and admission key.",
    examples: ["lares intent-relay enable --face 1", "lares intent-relay status --face 1", "lares intent-relay rotate"],
    flags: ["--face N   face index", "--json   structured output"],
  },
  kahua: {
    usage: "usage: lares kahua mint|propose|stage|lift|withdraw|carry|list|get [title|cid...] [--face N]",
    synopsis: "Read and write one face's kahua stage, the fleet's working-memory stage. The face's founding act pins the stage, by whichever device founds the face; `mint` adopts that pin and registers it, and a face whose log names none refuses `kahua-mint-outside-founding`. Memory climbs in two crossings: `stage` writes a row into the face's local canon bags/daemon-<F> (local, unsigned; any seat may), and a lift carries one staged row to every device the face wears. A lift prints the staged row's preview (title, row digest, fields, body) and lifts only on that row digest typed back at a terminal, or `--digest <hex>` naming the row digest the preview printed; a bare --yes lifts nothing. Two digests share one word: the row digest (what `stage` answers and a lift names) covers the row's body and fields, while a proposal's `digest` names the body digest, the body bytes alone; a lift with `--proposal` compares the proposal's body digest with the staged body. A lift signs under the face's root, so a lift always asks the face's passphrase at a terminal; `--digest` spares the typed-back digest alone. The door reads the row back and refuses `kahua-lift-unstaged` (no such row) or `kahua-lift-digest-moved` (the row moved since the preview); a lift the head already carries lands nothing. An AI seat proposes and stages; the operator's hand lifts, withdraws and carries (after a root rotation, the earlier items stand again only once carried), each act signed under the face's root out of sealed custody. Every answer prints as JSON.",
    examples: [
      "lares kahua mint --face 1",
      "lares kahua propose --face 1 --proposals '[{\"title\":\"T\",\"revision\":\"r1\",\"text\":\"body\",\"taint\":[]}]'",
      "lares kahua stage T --face 1 --text body",
      "lares kahua lift T --face 1 --taint none   # previews the staged row, asks for its row digest, then the face's passphrase",
      "lares kahua lift T --face 1 --taint none --digest <hex> --proposal <intent-id>",
      "lares kahua withdraw <cid> --face 1",
      "lares kahua carry <cid> <cid> --face 1",
      "lares kahua carry --all --face 1",
      "lares kahua get T --face 1 --history",
      "lares kahua list --face 1   # the stage's LIFTED items alone; a staged row rests in bags/daemon-<F> and lists here once its lift lands",
    ],
    flags: ["--face N   face index", "--text <body> | --file <path>   (stage) the row's body", "--fields <json>   (stage) the row's fields", "--digest <hex>   (lift) the staged row's row digest, as its preview printed it; it stands in for typing the digest back, and the passphrase prompt still needs a terminal", "--taint a,b | none   inputs from outside the face", "--sources <json>   further daemon sources the item distils (the staged row always rides)", "--parent <cid> | none   the revision a lift supersedes", "--proposal <id>   the proposal a lift answers", "--proposals <json>   a proposal batch", "--history   every revision of a title", "--all   (carry) every earlier head the history reads"],
  },
  intent: {
    usage: "usage: lares intent issue|show|ask|answer|claim|takeover|release|cancel|supersede|release-root|delegate|delegate-revoke|delegations [verb-or-id] [--face N]",
    synopsis: "Read and write one face's signed intent plane. Name --face N on every invocation when this vessel holds several faces; a sole face resolves itself.",
    examples: [
      "lares intent issue face-join --face 1 --to <atom> --args '{}'",
      "lares intent show --face 1",
      "lares intent ask <intent-id> --face 1",
      "lares intent answer <ask-cid> --face 1 --executor <atom>",
      "lares intent cancel <intent-id> --face 1",
    ],
    flags: ["--face N   face index", "--to <atom> | --prefer <atoms> | --class <capability> | --every   audience", "--args <json>   issue arguments", "--nonce <text>   invocation nonce", "--void-at <act-cid> | --through <act-cid>   causal bounds", "--agent <key> --prefix <verb> --policy <json> --as-of <cite> | --until <cite>   delegation", "--executor <atom> [--deny]   answer", "--detail <digest>   ask: the act digest a co-sign names", "--json   structured show"],
  },
  nexus: {
    usage: "usage: lares nexus <seal | rite | kapae | un_kapae | contract | revoke | carry | uncarry | members | accept-carriage | admit-take | carry-for | carry-take | posture | kahuli | publish | realm-bag | realm-bags | offering | promote | cabal | release>",
    synopsis: "the Nexus relation doors: charter ceremony, admission, carriage, posture, realm bags, and exact local offering inspection.",
    details: [
      "  seal <seat | rotate | show | export | import | grow | cold | cofound | roll | anchor>  the kahu quorum's seats + pre-rotated epoch chain; grow = the crossing record ceremony; cold rehearse = read a card back; cofound = found a Nexus with a second operator (open | join | seal); roll = roll a joint Nexus across its vaults (open | join | sign | file | abandon); anchor = carry the roll's anchor across them (--out | --from)",
      "  kapae <nym> [--reason <text>] [--nexus <aid>]   raise a quorum-signed ban on a presenter nym",
      "  kapae <nym> [--nexus <aid>] --out <partial>   sign the seats held here, write a PARTIAL (two-vault Nexus)",
      "  kapae --from <partial> [--out <file>]     judge a partial, cosign it, land the ban once the quorum counts",
      "  kapae --list [--nexus <aid>]              read the currently-Kapae'd set (the fold)",
      "  un_kapae <nym> [--nexus <aid>]            mint a quorum-signed causal lift (--out / --from carry it across two vaults)",
      "  contract <operator-pubkey> [--sig <hex>] [--sync-url <url>]  seat a vessel at the CONTRACT cap-tier (quorum + contract-in);",
      "                                            --json emits the admit BUNDLE the joinee takes by hand",
      "  contract <operator-pubkey> --sync-url <url>   name the url the joinee dials this hearth at; the bundle carries it (admit only)",
      "  revoke <operator-pubkey>                  revoke a member (quorum-only)",
      "  contract|revoke <nym> --nexus <aid> --out <partial>   a Nexus whose seats rest in two vaults: sign with the",
      "                                            seats held here and write the act as a PARTIAL file; nothing lands",
      "  contract --from <partial> [--out <file>]  judge a partial against this vessel's own charter head and board;",
      "                                            ready → this vessel's seats cosign; complete → it lands here",
      "  carry <place-vessel-key> --carrier <hex>  contract a faceless PLACE (a Herm) as a CARRIER — quorum + its own",
      "                                            VESSEL-key seal. It NEVER enters the member set; its whole grant is",
      "                                            the realm's PUBLIC-declared books, by hash (heraldry#/the-herm-card)",
      "        --floor-pin <file>                  the place's signed floor pin CLAIM with its KEL rows (`carry-for --out`); REQUIRED:",
      "                                            it lands atomically beside the counted act, and the carry emits the CARRY BUNDLE",
      "                                            the place takes. With `--out <partial>` a Nexus whose seats rest in two vaults",
      "                                            carries it as a PARTIAL (`carry --from <partial>` on the other vault)",
      "  uncarry <place-vessel-key>                end a carrier contract (quorum-only)",
      "  members --list [--nexus <aid>]            read a Nexus's members board — a public RECORD of admits, never",
      "                                            authority (default: the primary charter's Nexus)",
      "  accept-carriage [--index N] [--nexus <aid>]  (joining operator) mint + keep the 'accepts carriage' contract-in",
      "                                            for one Nexus (default: the primary charter's)",
      "  admit-take <bundle-file>                  (joining operator) verify the admit bundle a founding kahu handed over",
      "                                            against the charter held for its Nexus, keep it, and re-present a",
      "                                            running vessel's dial to the hearth that wrote it",
      "  carry-for [--nexus <aid>] [--out <file>]  (joining PLACE, on itself) mint the carrier seal with its OWN vessel",
      "                                            key — reads no persona, because a crossroads holds none — and sign",
      "                                            its floor pin at this Nexus (default the primary charter's; --nexus",
      "                                            names a carried one) at the head of its own place KEL. --out writes the",
      "                                            claim with the KEL rows: the file the kahu's `carry --floor-pin` reads",
      "  carry-take <bundle-file>                  (carried PLACE, on itself) verify the carry bundle and write it onto",
      "                                            its own board replica: its floor gate stands at that Nexus, only there",
      "  posture [private | open]                  read / flip the cross-Nexus federation posture of this hearth's charter (a herm",
      "                                            answers the knock by class, operator ruling: it reads OPEN and refuses the flip)",
      "  rite <petname>                            the pet-named procedures — `cabal` seats the founding quorum, `kahuli` overturns a ratchet tier",
      "  kahuli <engine | grammar>                 the OVERTURN — advance one ratchet tier of this Nexus's genesis composition",
      "  realm-bag <bag-uri>                       register a bag this steward keeps on the realm's shared CRDT (read at CONTRACT);",
      "                                            the acting face's key for this Nexus seals it (--face N, else the one face standing open)",
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
      "  promote open <file> --purpose <p> --surface <s> [--class ordinary|high-impact] [--nexus <aid>] --out <approval>",
      "                                            sign the exact bytes of a promotion with the seats held here",
      "  promote sign <approval> --confirm-statement <digest> [--nexus <aid>] --out <file>   add this vault's seats to it",
      "  promote check <approval> <file> [--nexus <aid>]   the verdict over the file's bytes (exit 0 only on ok)",
      "  cabal <admit | remove> <group> [--nexus <aid>] [--out <partial>]",
      "                                            the seat quorum admits a PersonaGroup into the Kahu cabal, or removes it",
      "  cabal cosign <partial> --act <cid> [--nexus <aid>] [--out <file>]   add this vault's seats; lands once it counts",
      "  cabal standing <group> [--nexus <aid>]    where one group stands in the cabal, as of this vessel's last sync",
      "  release <manifest-file> --approval <file> [--nexus <aid>]   publish the Nexus's FLOOR RELEASE: a held seat seals the porch body naming the",
      "                                            manifest, the seats' approval of its exact bytes (`promote open --surface floor-release`) rides",
      "                                            attached, and it lands on the Nexus's publication board once it counts",
      "  release <manifest-file> --cut [--nexus <aid>]   cut that manifest from LIVE house canon (a promoted offer rides it),",
      "                                            stage the floor in this hearth's CAS; it lands nothing (offering#/the-canon-offer);",
      "                                            a bag whose live rows count under half its prior snapshot's refuses floor-cut-thin,",
      "                                            unless --thin <slug[,slug]> names it as shrunk on purpose",
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
    synopsis: "inspect one exact signed offering already carried by this Nexus's publication board. It reads local CAS only and never fetches, installs, mutates genesis, or changes grammar.",
    examples: ["lares nexus offering inspect sha256:<offering-cid>"],
  },

  "nexus promote": {
    usage: "usage: lares nexus promote <open | sign | check>",
    synopsis: "the seats' approval of ONE promotion's exact bytes, carried between vaults as a file. The approval holds public material alone; each signature comes from a seat key held in this vault.",
    details: [
      "  open <file> --purpose <p> --surface <s> [--class ordinary|high-impact] [--nexus <aid>] --out <approval.json>",
      "  sign <approval.json> --confirm-statement <digest> [--confirm-hash <hash>] [--nexus <aid>] --out <approval.json>",
      "  check <approval.json> <file> [--nexus <aid>]",
      "",
      "  --confirm-statement  the ni:///sha-256 digest of the approval's signed statement (bytes hash, purpose, surface, class,",
      "                       epoch) that `open` prints, read by a person before a seat signs it",
      "  --confirm-hash       optional: also name the bytes hash, the exact bytes the person approves",
    ],
    examples: ["lares nexus promote check ./approval.json ./page.md"],
    meme: "lar:///ha.ka.ba/lararium/mesh/kahu#/chartered-classes",
  },

  "nexus cabal": {
    usage: "usage: lares nexus cabal <admit | remove | cosign | standing>",
    synopsis: "the seat quorum's admission of a PersonaGroup into a Nexus's Kahu cabal, at the high-impact threshold the charter's seats set. A vouch admits nobody; where the seats rest in several vaults the act travels as a partial file, read aloud by its act CID.",
    details: [
      "  admit <group> [--nexus <aid>] [--out <partial.json>]    open the admission and sign with the seats held here",
      "  remove <group> [--nexus <aid>] [--out <partial.json>]   take the group back out, at the admission's threshold",
      "  cosign <partial.json> --act <cid> [--nexus <aid>] [--out <partial.json>]",
      "                                            add this vault's seats; the act lands once it counts",
      "  standing <group> [--nexus <aid>]          admitted, removed, unsettled or absent, as of this vessel's last sync",
      "",
      "  --act  the act CID the partial carries, read aloud before a seat signs it",
    ],
    examples: ["lares nexus cabal admit <group-id> --out ./cabal-partial.json", "lares nexus cabal standing <group-id>"],
    meme: "lar:///ha.ka.ba/lararium/mesh/kahu#/cabal-admission",
  },

  sensorium: {
    usage: "usage: lares sensorium <run|open|query|ls|keep|dissolve|name|names|propose-name|accept-name> …",
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
    usage: "usage: lares mempalace <install|setup|harvest|repave|status|quiesce|resume> [flags]  ·  lares mempalace <vendored verb> …",
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

  mcp: {
    usage: "usage: lares mcp aho [-- <child argv…>]",
    synopsis:
      "The aho: it holds an MCP client's stdio for the session's whole life and spawns the house's own surface (or the argv " +
      "after `--`) as a child that may fall and rise, so a surface restart never reaches the client. While no child " +
      "stands the seat answers `initialize` and the tool list from what the child last answered; a call answers the " +
      "tool error `hearth-sleeps` at once. A call in flight at a child's death answers `outcome-unknown: re-read " +
      "before re-trying`, and the seat never sends it again. The seat logs event names and counts alone, and holds no key.",
    examples: [
      "lares mcp aho                      # the seat a harness config records: the house's own surface, resolved at each spawn",
      "lares mcp aho -- <child argv…>     # name another child (a test, another surface)",
      "lares home tend                    # writes the seat into each harness config",
    ],
    next: ["lares home read   # the seat each harness config names"],
  },

  hooks: {
    usage: "usage: lares hooks <pause|resume|status>",
    synopsis:
      "The hook-lever on its own: `pause` / `resume` / `status` capture hooks by writing / " +
      "removing a marker file a capture hook checks and steps aside on when present. Lets a migration or a " +
      "`lares sense teardown` run WITHOUT daemon-spawn contention. `lares mempalace quiesce` pauses AND " +
      "drains in one gesture; this verb is the lever alone (suppress minting without touching live daemons).",
    examples: [
      "lares hooks status                 # is minting paused?",
      "lares hooks pause                  # suppress capture minting",
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
      "vessel stands, each door runs inside it, so a roll reaches its walkers with no restart. The walker route ships SHUT " +
      "by name (the shut-routes house ruling, stable-founding-road #/rulings): the act is written, but no gate seats a walker until a live grant reader opens the route.",
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
      "this vessel's WALKING door. A vessel walks in at another hearth on an invite, as one face (`--face N`, else the one face standing open): " +
      "`take` keeps a carried `lar-invite:` string durably, and the vessel's hearth dial walks in on it; " +
      "`invite` hands the newest invite out of the wallet, as one string to carry. Bare `lares walk` reads " +
      "where this vessel walks — the Nexus, its standing there, and its wallet. A vessel walks at one hearth: " +
      "a take for a second refuses and writes nothing. While the vessel stands, each door runs inside it. The walker route " +
      "ships SHUT by name (the shut-routes house ruling, stable-founding-road #/rulings): the invite is kept, but no hearth gate seats a walk until a live grant reader opens the route.",
    details: [
      "  (none)                  per hearth: the Nexus, whether the invite still waits, the grant held, the wallet count",
      "  take <lar-invite:…> [--face N]   keep a carried invite; the hearth dial walks in on it as that face",
      "  invite                  hand the newest invite out of the wallet",
    ],
    examples: [
      "lares walk take 'lar-invite:…' --face 0  # keep the invite a hearth handed you, walking as face 0",
      "lares walk                               # where this vessel walks, and how many invites it holds",
      "lares walk invite                        # one invite to carry to one newcomer",
    ],
    flags: [],
    meme: "lar:///ha.ka.ba/lararium/mesh/membership-doctrine#/the-invite",
  },
  vessel: {
    usage: "usage: lares vessel <unbound|found|rotate|stand|stop|lay|read|roster|census|fresher|floor|request|rite> [flags]",
    synopsis:
      "THE VESSEL DOOR — one namespace over the vessel's own causal island. Four primitives and one " +
      "read: `found` mints identity + bootstrap · `stand` brings the daemon up and reports · `stop` " +
      "halts it on the port · `lay` lays every disk mirror back into the layer it mirrors (each disk-sourced " +
      "bags/* holding into its canon through INGEST, then every mirror under the projections root into its one layer, each face root " +
      "(faces/<pet name>) laid where it stands; kahua lifts only on a typed count or --lift-kahua N; import carries a bundle onto this hearth's faces by pet-name) · `read` inspects and starts nothing. Compositions ride " +
      "`vessel rite <petname>`, so a new cap-stack arrives as a rite rather than another top-level verb. " +
      "Advancing the genesis composition is a MESH act — `nexus kahuli` — never a vessel door.",
    examples: [
      "lares vessel stand                      # idempotent boot, attach-or-start, and REPORT",
      "lares vessel read --palaces             # health, plus the palace-organ table",
      "lares vessel roster                     # who is home: the worn face, the seats here and far, the lanes, the open vota",
      "lares vessel lay --apply --yes          # lay every holding (idempotent)",
      "lares vessel lay --apply --verbose      # keep full CREATE detail",
      "lares vessel fresher --bag sdm          # each working copy's base hash beside the canon hash standing now",
      "lares vessel lay --apply --lift-kahua 3    # also lift the 3 kahua items the preview named",
      "lares vessel rite refresh               # the post-code-change cure: build · stop · stand",
      "lares vessel request <requestId>        # read a request's receipt, dispatching nothing",
      "lares vessel request <requestId> --cancel  # withdraw it before it is read: your own hand, never a timeout's",
      "lares vessel floor status               # the vessel's floor pin: pinned release, newest seen, fast-forward, fork",
      "lares vessel floor accept [<release>]   # walk prior from the pin to the release (or the sole newest)",
      "lares vessel floor seed [--genesis <dir>]  # the seed a genesis dir offers (CID, digests) beside the founding record; moves nothing",
    ],
    flags: [
      "stand --foreground   this terminal owns the node (no Vite)",
      "stand --with-web     node + Vite web surface together",
      "stand --page         the daemon also serves the built Web page (names its root and receipt; declares same origin where undeclared)",
      "stand --restart             free the port, then serve the current vessel",
      "stand --observe      REPORT ONLY — withholds the standing half; outranks every acting flag",
      "stand --init         found a vessel where the root holds none — writes LAR_ROOT alone; the operator's homes ride `lares home`, the mempalace sidecar `mempalace install`",
      "read --palaces       the palace-organ health table (mempalace · structure · form · mesh)",
      "roster --json        the roster whole: {grain, rotation, seats, asker, lanes, lanesGap, vota, unread, counts, more}, the body the MCP seat's vessel_roster answers",
      "read --json          the reading as one JSON object (every lens; `read vessel` names each document); a pipe reads the terminal's prose",
      "census --docs        every document the stores hold: its class (current · duplicate · orphan · last-version · sealed-unread), who names it, the unnamed list; removes nothing; --json the full rows",
      "request <requestId>  the receipt the vessel's ledger and durable outcome doc hold; reads, never dispatches; --cancel withdraws the request (the operator's own explicit act)",
      "rite <petname>       founding · refresh · rebuild — the pet-named cap-stacks",
      "lay --lift-kahua <N>  lift the kahua items the lay previewed when N equals their count (a bare --yes lifts none)",
      "floor seed --genesis <dir>  the genesis dir whose seed reads (else LAR_GENESIS through the one resolver; an image carries /app/genesis); --json carries `seed`, the line the pūlama takes",
      "floor seed --image <digest>  print the whole pūlama frame {\"digest\",\"seed\"} as the one stdout line (wins over --json); a shim hands it to `pulama-main image '<frame>'` unparsed",
    ],
    next: ["lares vessel read --palaces", "lares sense pour --all"],
    meme: "lar:///ha.ka.ba/lares/cli/vessel-door",
  },

  sense: {
    usage: "usage: lares sense <search|relate|structure|status> [--lens <plane>]  ·  lares sense <lifecycle verb> …",
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
      "lares sense recall keyhive convergent removal           # verbatim drawers",
      "lares sense recall fork --speaker operator --surface claude  # filters compose (AND)",
      "lares sense pour --all                                  # the sovereign re-pave (all sources)",
      "lares sense worldline 0425c035                          # walk a session's spirit tree",
      "lares sense teardown --confirm --drain                  # tear the planes for a clean re-pave",
      "lares sense trial-run --trial-root /state/sensorium-serving-one --freeze-receipt /state/freeze-receipt.json --intent one --source-host host-a --model-home /state/model-home",
      "lares sense search \"known phrase\" --trial-root /state/sensorium-serving-one --model-home /state/model-home --json",
      "lares sense status --trial-root /state/sensorium-serving-one --json  # typed and semantic frontiers, unsupported views",
    ],
    flags: [
      "--lens <plane>  content | structure | form | persistence (default content) — READ verbs",
      "--wing <w>      scope to one project wing",
      "--agent/--surface/--speaker/--channel/--function   recall filters (compose AND; need a query)",
      "--imago <id>    (recall) fetch one imago verbatim; --list lists imagines",
      "--all           (pour) sweep every transcript source",
      "--trial-root <absolute named root>  frozen Claude serving operation; trial-run/search/status only",
      "--model-home <root>  pinned MiniLM assets for trial-run/search; must match the operation receipt",
      "--source-key/--revision <value>  trial search postfilters (bounded candidate window)",
      "--confirm/--drain/--force   (teardown) remove / quiesce-first / override live holders",
    ],
    next: ["lares sense status --lens content", "lares mempalace status   # the guest comparator door"],
  },

  realm: {
    usage: "usage: lares realm rename|move|list [<current pet> | <wiki slug>] [--to <pet>]",
    synopsis:
      "THE REALM'S PET NAME — a realm holds its wikis at projections/realms/<realm pet name>/wikis/<slug>/ (each its own git tree) " +
      "and its domain bags at projections/realms/<realm pet name>/bags/<slug>/, as a face holds its planes under projections/faces/<pet name>/. " +
      "Every realm carries a pet name: one minted with none takes its wiki's slug, and the vessel mints that label on first read, so nothing " +
      "waits. The label rests local at projections/realm-labels/<pet>.json (0600), never in a share row or a replicated document. A rename or " +
      "move relabels at once; the folder follows at once while no vessel answers, else at the vessel's next lock or re-stand.",
    details: [
      "  lares realm rename <current pet> --to <new pet>   the realm takes a new pet name; its folder follows at a quiet point",
      "  lares realm move <wiki slug> --to <realm pet>     the wiki and its canon bag move there (named now where none stands)",
      "  lares realm list                                  each realm, its wikis' folders and the canon realm ids it holds",
    ],
    examples: ["lares realm list", "lares realm rename notes --to Garden", "lares realm move works --to Garden"],
    flags: ["--to <pet>   (rename) the new pet name; (move) the realm the wiki moves to"],
    next: ["lares wiki init <slug> --realm <pet>   # mint a wiki into an existing realm", "lares surface init --realm <pet>   # each wiki of the realm its own git tree"],
    meme: "lar:///ha.ka.ba/lares/api/pono/cabal-realm#/the-workbench",
  },
  "realm rename": {
    usage: "usage: lares realm rename <current pet | realm id> --to <new pet>",
    synopsis:
      "Rename the realm that wears <current pet> or holds <realm id>. The new pet name follows the face segment rule (no '/', '\\', ':', NUL or " +
      "leading dot, never empty), stays unique on the house without case, and never repeats a face's pet name (a realm's pools commit under " +
      "their own identity). The label moves at once, and each of its folders follows to projections/realms/<new pet>/ (its .git with it) at a " +
      "quiet point: at once while no vessel answers, else at the vessel's next lock or re-stand, the wiki reading where it stands until then, " +
      "never half-moved.",
    examples: ["lares realm rename notes --to Garden", "lares realm rename Garden --to Orchard"],
    flags: ["--to <new pet>   the realm's new pet name"],
    next: ["lares realm list"],
  },
  "realm move": {
    usage: "usage: lares realm move <wiki slug> --to <realm pet>",
    synopsis:
      "Move a wiki and its canon bag into the realm wearing <realm pet>, named now where none wears it: its workbench rests at " +
      "projections/realms/<pet>/wikis/<slug>/ and its bag at projections/realms/<pet>/bags/<slug>/. The wiki keeps its canon realm id (the label " +
      "only gathers it), and a realm the move empties drops its label, named. The folders follow at a quiet point (at once while no vessel " +
      "answers, else at its next lock or re-stand). One wiki rests in one realm; the daemon wiki joins none.",
    examples: ["lares realm move works --to Garden", "lares realm move notes --to notes"],
    flags: ["--to <realm pet>   the realm the wiki moves to"],
    next: ["lares realm list", "lares surface init --realm Garden"],
  },
  "realm list": {
    usage: "usage: lares realm list",
    synopsis: "Each realm the house labels: its pet name, each wiki's folder, its loose bags, and the canon realm ids it holds. Reads the local labels alone.",
    examples: ["lares realm list", "lares realm list --json"],
    next: ["lares realm move <wiki slug> --to <realm pet>"],
  },
  surface: {
    usage: "usage: lares surface init|check|open|commit|face [--face N | --realm <realm pet name>] [--launch] [-m <seam>]",
    synopsis:
      "THE FACE POOL — each face's private planes rest under projections/faces/<pet name>/ (wiki, canon, stage, personal, recovery), " +
      "and that root holds the face's one git working tree. Git runs here with an empty global config and no system config. " +
      "It runs on this machine: with no LAR_ROOT, the container house's pools rest under LARES_HOUSE/projections, its paths print " +
      "as the host spells them, and the vessel answers only a face no label under projections/face-labels/ settles. A wiki several faces " +
      "share rests once, in its REALM's folder (projections/realms/<realm pet name>/wikis/<slug>/, or the workspace its share row names), " +
      "each wiki folder its own git tree under the wiki's identity, never a face's; --realm <realm pet name> names the realm.",
    details: [
      "  lares surface init     make the worn (or named) face's root a pool: .git (0700), the house's ignore list, a local author, the pool-check hook",
      "  lares surface check    the pool check over the repo standing here; exit 1 names each breach (the pre-commit hook runs it)",
      "  lares surface open     print `<editor> -n <face root> <realm roots>`; --launch runs it; writes no workspace file",
      "  lares surface commit   commit only what the house already agrees with, under a lar: subject naming no face; never pushes",
      "  lares surface face     the face the house resolves and its pet name (the host asks the vessel this alone)",
    ],
    examples: ["lares surface init", "lares surface open --launch", "lares surface commit -m sitting-close", "lares surface check --face 1"],
    flags: ["--face N   face index (the worn face where absent)", "--realm <realm pet name>   (init, check, commit) the realm's one tree (and any workspace its wikis bind), not a face's", "--launch   (open) run the window line on this machine", "-m <seam>   (commit) the seam the subject names (by-hand where absent)"],
    next: ["lares surface open --launch", "lares surface init --realm notes   # the realm's root its one git tree", "lares shore   # a path that reads apart stands off the house"],
    meme: "lar:///ha.ka.ba/kahua/memory/project/face-pools",
  },
  "surface init": {
    usage: "usage: lares surface init [--face N | --realm <realm pet name> | --workspace <name>]",
    synopsis:
      "Make the worn (or named) face's root, projections/faces/<pet name>/, a git working tree: .git inside it at 0700; .git/info/exclude carries the " +
      "house's one ignore list (HOUSE_IGNORED: .vscode/, .shore/, temp/, *.orphans/, the atomic writer's temps, a personal layer's view state such as $__StoryList.tid; the vessel's watch keeps that block current at each arm) while .meta, .kapae, .mem and .tid stay " +
      "committable; local config sets user.name to the pet name, user.email to <slug>@face.invalid and commit.gpgsign=false, never a global config; " +
      "a pre-commit hook runs `lares surface check`. A second init changes nothing and says already; a hook of another hand stands, named. " +
      "--realm <realm pet name> makes the realm's ROOT, projections/realms/<realm pet name>/, its one pool instead (one tree per entity: every " +
      "wiki folder inside rides that tree, never a tree of its own): the same block plus each wiki folder's recovery/ and temp/, author " +
      "<pet name> <folded>@realm.invalid (the realm's identity, never a face's), the same hook; a tree nested below the root lifts into it with " +
      "its history kept (its git dir rests in .git/lifted/). A workspace a share row names for one of its wikis takes its own pool, author " +
      "<slug> <slug>@workspace.invalid. A wiki folder standing nowhere yet is named and left; a realm no label names, or whose root and " +
      "workspaces all stand nowhere, refuses by name. " +
      "--workspace <name> makes the operator's bound workspace (seen at /lar/workspaces/<name>) one pool by the same init, on the operator's ask: " +
      "the house never founds a workspace's tree by itself (the wake offers this where a bound workspace holds no tree); a workspace binding no " +
      "directory, or resting inside another git work tree, refuses by name.",
    examples: ["lares surface init", "lares surface init --face 1", "lares surface init --realm notes", "lares surface init --workspace backup"],
    flags: ["--face N   face index (the worn face where absent)", "--realm <realm pet name>   the realm's root and its wikis' workspaces (not beside --face)", "--workspace <name>   one bound workspace as a pool (not beside --face or --realm)"],
    next: ["lares surface open --launch"],
  },
  "surface check": {
    usage: "usage: lares surface check [--face N | --realm <realm pet name>]",
    synopsis:
      "The pool check over the repo standing at this directory (or the named face's pool). A pet name binds nothing here: it names no " +
      "refusal, so an index file, an author or a remote carrying pet names passes. It refuses what guards a crypto identity or the pool's " +
      "structure: another face's root or realm's root; any repo holding projections/ or config/; a tree nested below a face or realm " +
      "root (that root holds the one tree); and a signing key another face pool in the house carries. It reads local config alone and exits 1 " +
      "naming each breach. From a realm pool (or --realm <realm pet name>, over each of its pools) it also refuses a faces/ folder.",
    examples: ["lares surface check", "lares surface check --face 1 --json", "lares surface check --realm notes"],
    flags: ["--face N   check that face's pool wherever this runs", "--realm <realm pet name>   check each pool of that realm wherever this runs"],
  },
  "surface open": {
    usage: "usage: lares surface open [--face N] [--launch]",
    synopsis:
      "Print the one window line: `<editor> -n` over the worn face's root and the realm roots it belongs to (the entity roots: each realm whose workbench holds a wiki " +
      "the face keeps a personal layer or a recovery folder for, any realm a label groups a wiki whose workbench stands, and any realm root " +
      "holding its own .git: once per realm; workspace roots stay out). --launch runs it. It writes no workspace file. The editor " +
      "reads from the house config tiddler $:/config/lares/surface/Editor (<config>/surface-editor.tid: its text names the command, as " +
      "code-insiders), else what stands on this PATH: `code-insiders` where only it stands, and where both stand the one whose server " +
      "this shell belongs to (a VS Code Insiders remote shell reads Insiders), else `code`; where neither stands the line names `code` " +
      "and a note names both.",
    examples: ["lares surface open", "lares surface open --launch"],
    flags: ["--face N   face index", "--launch   run the line on this machine"],
  },
  "surface commit": {
    usage: "usage: lares surface commit [--face N | --realm <realm pet name>] [-m <seam>]",
    synopsis:
      "Keep the sitting: stage only the pool paths whose disk bytes equal the synced base (the house already agrees with them; a .meta rides " +
      "with its carrier, a removal stages where no base stands; a .kapae shadow stages where its bytes equal the house's own write of it, " +
      "its removal where the house lowered it), and commit them under `lar:///surface.keeps.the-sitting/<seam> — N carriers`, " +
      "naming no face, the carrier URIs in the body, the author from the pool's local config. A path standing off reads apart by name and stays " +
      "unstaged. It never pushes. --realm <realm pet name> keeps the realm's sitting the same way, ONE commit over its root's tree under the realm's author (and one per workspace its wikis bind).",
    examples: ["lares surface commit", "lares surface commit -m sitting-close", "lares surface commit --realm notes"],
    flags: ["--face N   face index", "--realm <realm pet name>   the realm's tree and its wikis' workspaces", "-m <seam>   the seam the subject names, one slug (by-hand where absent)"],
    next: ["lares shore   # each path that read apart"],
  },
  "surface face": {
    usage: "usage: lares surface face [--face N]",
    synopsis:
      "Name the face the house resolves (the named one, else the one standing open) and the pet name its root folder carries. " +
      "On a container house's host the other sub-verbs read the face labels first and ask the vessel this line only where no label settles it.",
    examples: ["lares surface face", "lares surface face --face 1 --json"],
    flags: ["--face N   face index"],
  },

  tiddler: {
    usage: "usage: lares tiddler <get | put | delete> <title> --recipe <slug>   (get also takes --bag <slug>: that one bag's record)",
    synopsis:
      "THE TIDDLER DOOR — one record with its fields, whatever its type: a plain note, a data tiddler, a meme's root " +
      "or one of its slots. Every verb runs in the wiki's own TiddlyWiki engine through the daemon, but `get --bag <slug>`, which reads one bag's record with no engine: `--recipe default` " +
      "names the worn face's daemon wiki, and `--recipe <slug>` any wiki this face reaches (one it hosts, or one shared " +
      "to it), composed over that wiki's canon, its shared working layer and this face's own layers; a wiki the face " +
      "reaches none of refuses `wiki-unreached`. `get` reads the " +
      "record (fields, then the text) and the `base` hash a writer hands back; `put` PATCHES: it sets and unsets " +
      "fields, adds and removes tags, and moves the text only where `--text` or `--file` names it, landing in the " +
      "wiki's working layer (this face's own personal layer of a wiki where it holds no writer's seat); `delete` removes a plain tiddler plainly: the record leaves its layer and no tombstone " +
      "rises; a meme root or slot answers the consequence the delete would land and refuses by name " +
      "(`tiddler-delete-in-a-family`) unless `--family` names the family act, which lands the root and its slots as " +
      "one change. Only a lower layer makes a delete a choice: where one holds the title too, a delete with no mode " +
      "refuses `delete-mode-needed` and names both meanings: `--mode kapae` raises a tombstone that keeps the " +
      "records beneath hidden (they stay in their bags); `--mode reveal` retracts the topmost record and the one " +
      "beneath surfaces. A delete of a title the wiki reads absent retracts a kāpae that hides nothing (its " +
      "`.kapae` shadow leaves the disk); `--mode reveal` retracts one that hides a lower record. A meme root or slot " +
      "takes a field or tag patch here; its text moves through `lares meme put`. `--base` carries the hash last " +
      "read: a record that moved past it answers `conflict` and nothing lands. The engine verbs stand beside this " +
      "door: `lares wiki filter | render | status`.",
    examples: [
      "lares tiddler get \"Room 4\" --recipe default                         # the record as a .tid on stdout, the base on stderr",
      "lares tiddler get \"Room 4\" --recipe default --skinny                 # every field, the text left home",
      "lares tiddler get \"Room 4\" --bag lares                              # that one bag's record, its base and the bag that answered",
      "lares tiddler get lar:///ha.ka.ba/kahua/memory/feedback/x --recipe default --slot '#/why'   # one slot of a meme",
      "lares tiddler put \"Room 4\" --recipe default --fields '{\"todo\":\"done\"}' --tag-add reviewed --base <hash>   # a field and tag patch; the text stays",
      "lares tiddler put \"New Note\" --recipe default --create --text \"first words\" --fields '{\"tags\":\"memory\"}'",
      "lares tiddler delete \"Old Note\" --recipe default --if-match <hash>   # a stale base moves nothing",
      "lares tiddler delete lar:///t/x --recipe default --family              # a meme root and its slots, one change",
      "lares tiddler delete \"Room 4\" --recipe default --mode reveal          # drop my copy; the layer beneath surfaces",
      "lares tiddler delete \"Room 4\" --recipe default --mode kapae           # hide the title; the layers beneath keep theirs",
      "lares wiki filter '[tag[memory]sort[title]]' --recipe default --limit 5   # one page; --after <cursor> continues, --all walks it",
      "lares wiki filter '[[Room 4]backlinks[]]' --recipe default               # the link graph rides filters",
      "lares wiki render Handover --recipe default --form html                  # transclusions resolved by the engine",
      "lares wiki status --recipe default                                       # which layer takes a write for this face",
      "lares wiki filter '[tag[road]sort[title]]' --recipe kahu                 # a shared wiki, in its own engine",
      "lares tiddler put \"Road note\" --recipe kahu --create --text \"first words\"   # lands in that wiki's working layer",
    ],
    flags: [
      "--recipe <slug>      the wiki read or written: default (the worn face's daemon wiki) or any wiki this face reaches",
      "--bag <slug>         (get) read that one bag's record, with no wiki and no engine; put and delete refuse a bag (the meme door takes it: `lares meme put --bag <slug>`), and so do `lares wiki filter | render | status`",
      "--face N             act as face N on a session of it (the worn face where absent; a shut face refuses face-not-open; a lit sibling answers from its own daemon wiki, --recipe default)",
      "--slot <#/name>      (get) one slot of the meme the title names",
      "--fields <a,b>       (get) the named fields alone   ·   (put) a JSON object of field names to string values",
      "--skinny             (get) every field, the text left home",
      "--unset <a,b>        (put) fields to remove",
      "--tag-add <list>     (put) tags to add, as TiddlyWiki writes a list: one [[two words]]",
      "--tag-remove <list>  (put) tags to remove",
      "--text <words>       (put) the new text   ·   --file <path>  the new text from a file (`-` reads stdin)",
      "--base <hash>        (put) the hash last read; stale → conflict, nothing lands",
      "--create             (put) land only where no tiddler stands; an existing one answers `exists`",
      "--if-match <hash>    (delete) the hash last read; stale → conflict, nothing moves",
      "--family             (delete) name the family act: a meme root leaves with its slots, as one change",
      "--mode <kapae|reveal> (delete) over a lower layer's record: kapae hides it   ·   reveal surfaces it (none: a plain delete)",
      "--max-bytes <N>      (get) the byte cap on the answer; the largest fields leave first and get named",
    ],
    next: ["lares wiki filter '[tag[memory]]' --recipe default", "lares meme get <uri> --recipe default   # a family's whole text"],
    meme: "lar:///ha.ka.ba/lares/docs/pono/wiki-surface-scout",
  },

  meme: {
    usage: "usage: lares meme <put | get | patch | list | delete | normalize | check | sitting | project | promote | offer> (store verbs require (--recipe <slug> | --bag <slug>))",
    synopsis:
      "THE MEME DOOR — one family for every law over meme text, and each verb DECLARES ITS SEAT: " +
      "`normalize` · `check` · `sitting` · `project --to md` (over a file) run LOCAL with no daemon in " +
      "reach; `put` · `get` · `patch` · `list` · `delete` · `project` to any other target, or from a `lar:` uri, ride " +
      "the daemon verb. Store-backed verbs require `(--recipe <slug> | --bag <slug>)`; `--recipe` edits AS " +
      "the named wiki; " +
      "`--bag` places into that bag and REFUSES when this island cannot write it; `--realm <id>` beside " +
      "`--bag` names the realm whose registration that bag resolves through, and reads that realm alone. " +
      "`--base` carries the " +
      "canonical hash last read — a record that moved past it CONFLICTS and nothing lands.",
    examples: [
      "lares meme get lar:///ha.ka.ba/lares/api/corpus --recipe lares        # the carrier on stdout (a pipe too), the base on stderr; --json for the envelope",
      "lares meme patch lar:///ha.ka.ba/... --recipe lares --slot '#/x' --append note.txt --base <hash>  # one slot's body through the put's gate, resealed",
      "lares meme get road.html --recipe lares       # a rendered record (`projection: rendered` on its source): one read; its writes refuse rendered-derives, so edit the sources",
      "lares meme put lar:///ha.ka.ba/... --recipe lares --file note.mem     # land a framed meme through the gate",
      "lares meme put lar:///ha.ka.ba/... --bag lar:///ha.ka.ba/bags/daemon-<relation> --face 1 --file note.mem   # a lit face writes its own lane, sealed by its own chain",
      "lares meme list --recipe lares --tree                                  # every root the wiki resolves, each slot tree nested",
      "lares meme list --bag lares                                            # every root that one bag holds",
      "lares meme get lar:///ha.ka.ba/lares/docs/x --recipe lares --all      # a meme past one page answers its has-stack; --all reads it whole, paged on slot boundaries",
      "lares meme delete lar:///ha.ka.ba/... --recipe lares --if-match <hash> # a stale base moves nothing",
      "lares meme normalize draft.mem                         # re-frame + re-stamp the block check",
      "lares meme check bags/**/*.mem                         # CI / pre-commit: drift exits 1",
      "lares meme project note.mem --to md --out ./out        # the submission pair, clock-free",
      "lares meme project --to md --check bags/…/submissions   # every pair on the shelf re-projects clean",
      "lares meme promote bags/…/docs/pono/x.mem --face 0     # the selected face signs the canon crossing",
      "lares meme promote x.mem --dest-bag lar:///ha.ka.ba/bags/crossroads --approval a.json  # publish for the Nexus: the seats approved these bytes",
      "lares meme offer lar:///ha.ka.ba/... --bag lares     # offer a working record toward canon; canon stays unmoved",
      "lares meme offer list --bag lares · offer show <cid> · offer promote <cid> [--over-fresher]  # the steward reviews and lands it",
    ],
    flags: [
      "--recipe <slug>    an edit AS that wiki: its designated writable bag, write-then-sync",
      "--bag <slug>       a residency placement into that bag (refused when this island cannot write it)",
      "--json             (get) the envelope {uri, text?, canonicalHash, bytes, grain, slots, next}; the carrier otherwise, on a terminal or a pipe",
      "--after <cursor>   (get) one page of the whole carrier: hand back the cursor `next` named",
      "--all              (get) the whole carrier, its pages (each cut on a slot boundary) followed to the end",
      "--base <hash>      (put, patch) the canonical hash last read; required on patch; stale → conflict, nothing lands",
      "--slot <#/name>    (patch) the slot whose body moves",
      "--append <file>    (patch) a paragraph at the end of the slot's body",
      "--replace <file>   (patch) the slot's whole body",
      "--if-match <hash>  (delete) the canonical hash last read; stale → conflict, nothing moves",
      "--file <path>      (put) the meme text (stdin when absent)",
      "--tree             (list) nest each root's slot tree; roots + canonical hash alone otherwise. " +
        "`list --recipe` names the roots the wiki's whole stack resolves (a removed carrier lists nowhere); " +
        "`list --bag` names that one bag's own",
      "--dest-bag <uri>   (promote) the canon bag crossed into; the cap is read against this name",
      `--approval <file>  (promote) the seats' approval over these exact bytes; a crossing into the ${PLANE_LABELS.crossroads} refuses without one`,
      "--nexus <aid>      (promote) the Nexus whose charter reads the approval",
      "--all              (offer list) retired offers too; open ones alone otherwise",
      "--over-fresher     (offer promote) the steward's explicit choice to land an offer canon moved under (\"canon is fresher\")",
      "--gradient         (check) name each file's kind and the marks that kind requires and lacks",
      "--edges            (check) name the addresses these carriers point at, and which of them answer",
      "--format=problems  (check) one `path:line:col: severity: code: message` line per diagnostic, for an " +
        "editor's problem matcher (lar:///ha.ka.ba/lares/cli/problems); a clean file prints nothing, the exit stays",
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

  events: {
    usage: "usage: lares events [--since <epoch:writer:seq>] [--kind <bag-projected>] [--wait] --json",
    synopsis:
      "Read the vessel journal through the daemon. Without --wait it returns the matching entries already standing. " +
      "With --wait it answers on the first matching entry after --since (or after now when --since is absent).",
    examples: [
      "lares events --json",
      "lares events --kind bag-projected --wait --json",
      "lares events --since genesis:node-daemon:12 --json",
    ],
    flags: [
      "--since <epoch:writer:seq>  read entries after this cursor",
      "--kind <k>                  one kind: bag-projected",
      "--wait                      hold until the first matching entry lands",
      "--json                      print the structured payload",
    ],
  },

  library: {
    usage: "usage: lares library <list | show | acquire | verify | index | path>",
    synopsis:
      "The ACQUIRED shelf — books and corpora a human did not author, kept READABLE and VERIFIABLE outside " +
      "every tracked tree. The tier stands at `<root>/library` (or LAR_LIBRARY), beside the hearth and never " +
      "inside it, so no re-founding reaches it. Layout: `<collection>/<cid>/<the real filename>`: " +
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
      "--persona <index>  which persona acts (default: the one face standing open)",
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
    usage: "usage: lares persona <new <index> --name <petname> [--handle <Handle>] [--seat [--chair <label>]] [--split-root] | list | sync | reissue [--nexus <aid>] [--face N] | recovery-contact show <index> | recovery-contact offer --prefix <persona-…> | recovery-contact enrol <index> --threshold <k> <offer>… | recovery-contact view --prefix <persona-…> | provisional <index> | confirm <index> <lar-log-view:…> | view <persona-…> --seat-key <key> | raise-sign <challenge-json> [--as <index>]>",
    synopsis:
      "The PLURALITY-PONO identity multitude. THREE NAMES, THREE JOBS: the private LABEL names a compartment " +
      "to you alone; the declared HANDLE names what a persona answers to OUTWARD (an intent — only " +
      "`lares handle publish` performs the announce); the SEAT stands it for a Kahu chair on this node and " +
      "needs no Handle and carries a private chair label. `--split-root` opts into recovery shares. A vessel wears no face " +
      "between commands: a command names the face it acts as (`--face N`), or resolves the one face standing open. Local-first: a write lands on this node first and rides up when a hearth answers. A joining " +
      "vessel takes a face by `lares fleet join` and never mints its root here. RECOVERY CONTACTS: three people each hold a recovery key for one face, and two of the three, together, restore " +
      "your Handle (your Handle: the public card your face publishes, recognised by its own key). A recovery contact restores your Handle; a custodian card of a `--split-root` returns your memory, and neither stands in for the other.",
    examples: [
      "lares persona new 0 --name '<label>' --seat [--chair '<chair label>']",
      "lares persona new 1 --name '<label>' --seat [--chair '<chair label>']",
      "lares persona new 2 --name '<label>' --seat [--chair '<chair label>'] [--split-root]",
      "lares nexus seal seat                  # ... the founding sequence closes here",
      "lares persona list                     # held indices · labels · declared Handles",
      "lares persona sync                     # carry labels + Handles up to the fleet (the persona plane)",
      "lares persona reissue --nexus <aid> --face 1   # face 1 hands its key at that Nexus on to a fresh key",
      "lares persona recovery-contact offer --prefix <persona-…>         # a recovery contact cuts a fresh key for one face",
      "lares persona recovery-contact enrol 0 --threshold 2 <offer> <offer> <offer>   # the face's first recovery contact set",
      "lares persona provisional 1              # a restored face: the head its restore read, and who could confirm it",
      "lares persona confirm 1 <lar-log-view:…>  # one party's own view of that head confirms the face",
      "lares persona view <persona-…> --seat-key <key>   # a chair this vessel holds signs its view of a face's head",
      "lares persona raise-sign '<challenge-json>' --as 0   # sign a vessel's raise challenge as that persona's leaf (its own entry: `lares persona raise-sign --help`)",
      "lares persona recovery-contact view --prefix <persona-…>  # a recovery contact signs its own view of a face's head with its card",
    ],
    flags: [
      "--name <petname>   (new) the PRIVATE label at that handle-index",
      "--handle <Handle>  (new) declare the public Handle it answers to (intent, not an announce)",
      "--seat             (new) stand it for a Kahu chair on THIS node (no Handle needed)",
      "--chair <label>    (new) private label for a seat claim; pass with --seat",
      "--split-root       (new) opt into arming the 2-of-3 recovery split",
      "reissue            the face's key (--face N, else the one face standing open) at one Nexus hands its standing on to a fresh random key, by a hand-over both keys sign",
      "--nexus <aid>      (reissue) the Nexus; absent, this vessel's own charter",
      "recovery-contact show      the face's prefix, which a recovery contact's offer names, and the set it holds",
      "recovery-contact offer     a recovery contact's fresh recovery key for one face: a card it keeps and an offer line it hands over",
      "recovery-contact enrol     the face's own key enrols its first set of three recovery contacts (two of the three restore your Handle); a key another face holds refuses",
      "--prefix <p>       (recovery-contact offer) the face the recovery contact guards",
      "--threshold <k>    (recovery-contact enrol) how many recovery contacts sign a later rotation; two, the only count enrolment takes",
    ],
    next: ["lares persona list", "lares handle publish '<glamour>'   # the outward announce"],
  },

  vault: {
    usage: "usage: lares vault <status | unlock | lock | bind | unbind <slot-id> | backup --face <N> --out <file> | restore <file> [--as <N>] [--memory] [--cards --face <root-key-or-prefix>] | rehive --face <N>> [--passphrase | --paper] [--rotate]",
    synopsis:
      "The VESSEL KEY custody door (status, unlock, lock, bind, unbind): the key seals the vessel's private rows, the " +
      "keyhive and veil archives among them, and every boot rests at the floor until a person unlocks it. " +
      "`backup` cuts ONE face's bundle: its root, its own lines and the content keys this vessel holds for it, sealed " +
      "under a new route of its own; it carries no veil key and no seat, and the sealed bytes must survive elsewhere. " +
      "`restore` brings a face back from its bundle as a recovery act: the vessel derives its own veil and takes a NEW seat " +
      "under the face's fixed prefix, and `--memory` lands the bundle's content keys on that seat. " +
      "`status` prints the slot tree, each face as one counted line, the carrier counts, every fault by name and every " +
      "private file no row names, the same few lines on a terminal and through a pipe; `--verbose` adds ONE reading of " +
      "every standing file the carrier table names (a row under the vessel key reads sealed or reads as a fault, a row " +
      "outside it names the law it rests bare under), and `--json` answers the whole custody object. `unbind --rotate` runs as one act: the rotation's census passes before any byte moves, " +
      "so a carrier that refuses it leaves the slot bound. A credential rides a TTY alone, typed with no echo: no " +
      "flag, no environment variable and no pipe carries one.",
    examples: [
      "lares vault status                     # the slot tree, each face, the carrier counts, every fault, and any private file outside the carrier table",
      "lares vault status --verbose           # the same, plus one reading of each standing file",
      "lares vault unlock                     # hand the standing vessel a TTY credential: it opens its key and composes with what the key opens",
      "                                       # where LARES_KEEP_WORKSPACE (or the one LARES_WORKSPACES pair) names a keep workspace and no keep lei stands, it asks once to string one under the same passphrase, as the face --face names, else the daemon mount",
      "lares vault unlock --face N            # open face N under its own route; the vessel wears it",
      "lares vault unlock --all [--face N]    # try the route on every face; --face N wears N, and refuses by name where N stays shut under it",
      "lares vault lock [--face N]            # the standing vessel drops its key and stands at the floor; --face N drops that face alone",
      "lares vault bind [--face N] [--passphrase|--paper]   # unlock, then bind a second human route (a paper pin reads back); --face N binds into that face's own tree",
      "lares vault unbind <slot-id> [--face N]   # unlock, remove a slot; the rotation offer prints; --face N leaves the node tree alone",
      "lares vault unbind <slot-id> --rotate  # one act: a new vessel key seals every carrier and each staying slot binds over it",
      "lares vault reseat                     # seat a fresh keep pair under the route custody proves; every later keep seals to it (an unbind re-seats too)",
      "lares vault backup --face <N> --out <file>   # cut ONE face's backup bundle, sealed under a route of its own",
      "lares vault restore <file>             # bring a face back from its bundle: a recovery act that takes a NEW seat",
      "lares vault restore <file> --memory    # land the bundle's content keys on the restored seat (vessel standing, unlocked on the face)",
      "lares vault restore --cards --face <key|persona-…> --as 1   # rebuild a face's root from two split cards: a root, never memory",
      "lares vault rehive --face <N>          # a SHUT face whose veil-archive row holds another identity's Archive stands from its own seed; the answer names the next acts",
    ],
    flags: [
      "--passphrase|--paper  (bind) which route the new slot carries; (unlock) skip the route question",
      "--rotate           (unbind) mint a new vessel key and re-bind each staying slot; put <slot-id> BEFORE it",
      "--face <N>         (backup) the handle-index of the face to cut; the standing vessel holds it open; (rehive) the SHUT face to rehive",
      "--out <file>       (backup) the bundle file to write; a file already standing there refuses",
      "--as <N>           (restore) the handle-index the face lands at here; absent, the index its bundle named",
      "--memory           (restore) import the bundle's memory section instead of its lineage",
      "--cards            (restore) read a root split's cards on the terminal instead of a bundle; needs --face and --as",
      "--verbose          (status) one reading of each standing file the carrier table names, beside the summary",
      "--json             (status) the whole custody object (the slot tree, every row, the files outside the table, the door); (unlock) the door's answer as one object; the form a caller parses, since a pipe reads prose",
      "--face <key|pfx>   (restore --cards) the face the cards should rebuild: its root's public key or its prefix",
      "unlock | bind | unbind | reseat | backup | restore | rehive read their credential on a TTY ALONE — no flag, env var or pipe; no TTY refuses CredentialTtyRefusal",
    ],
    next: ["lares vault status", "lares vault unlock"],
  },

  wear: {
    usage: "usage: lares wear <N>   (N names a face standing open, a whole number from 0; `--face N` reads the same)",
    synopsis:
      "UNLOCK OPENS CUSTODY; WEAR CHOOSES THE FACE. The vessel's mount moves to face hN, a face already standing open " +
      "(under a pūlama, one the pūlama lends), and the vessel composes again on it. A wear asks no route and carries none, and an AI seat wears on the operator's word as the operator's own terminal does. " +
      "A vessel holding no key refuses `custody-locked` and names `lares vault unlock`; a composition that refuses wears " +
      "the face it left, and the vessel key stays held. A wear that lands replays the share landing, as an unlock does: rows a " +
      "grant carried for the face now worn lift into its catalog (the face already worn among them), and the wear names what still waits on a shut face.",
    examples: [
      "lares wear 1                           # move the mount to face h1, a face already standing open",
      "lares wear --face 0                    # the same move, the face named by flag",
    ],
    flags: [
      "--face <N>         the face to wear, read where no positional names one",
      "--json             the door's answer as one object, the form a caller parses; a pipe reads the one prose line",
    ],
    next: ["lares vault status", "lares vault unlock   # a vessel holding no key opens here first"],
    meme: "lar:///ha.ka.ba/lares/docs/pono/the-worn-house",
  },


  cabal: {
    usage: "usage: lares cabal <face | vouch | join | feed | clock>",
    synopsis:
      "The JOIN AXIS — a mutual-hold relation with a cabal-realm, orthogonal to the CARRIAGE contract " +
      "`nexus contract` writes. ONE KEY ACTS IN A REALM: the key the acting face presents at the Nexus the realm " +
      "stands under; a verb names that face (`--face N`), else the one face standing open acts. A vouch stakes " +
      "that face's OWN standing on one joiner and needs no kahu " +
      "quorum, because it performs no steward act. IT ADMITS NOBODY: the vouch rides as signal-2 on the " +
      "lineage the admission price walks, and the cost lands at the moment of vouching, since a voucher's " +
      "score SPLITS across everyone they vouch for. Re-vouching the same joiner stays ONE edge — re-minting " +
      "never buys out-degree.",
    examples: [
      "lares cabal face --realm <realm-doc-id> [--face N]             # the face's key there: the nym a voucher names",
      "lares cabal vouch <joiner-nym> --realm <realm-doc-id>          # dilutes you, admits nobody",
      "lares cabal join --realm <realm-doc-id> [--bundle <path|json>] # PRESENT and cross with carried heads",
      "lares cabal feed --realm <realm-doc-id>                        # the OFFERING — roll your lease slot",
      "lares cabal clock --realm <realm-doc-id>                       # who feeds this realm, and how deep",
    ],
    flags: [
      "--realm <doc-id>   the cabal-realm every verb here addresses",
      "--nexus <aid>      the Nexus the realm stands under, at this vessel's first act there (default: the primary charter's)",
      "--cap <n>          (join) the price ceiling this crossing accepts",
    ],
    next: ["lares cabal clock --realm <realm-doc-id>", "lares nexus seal show"],
  },

  edge: {
    usage: "usage: lares edge <kapae | un-kapae> (<edge-id> | --member <key> | --device <key>) [--realm <realm-id> [--nexus <aid>]] [--quorum] [--as <root-index>]\n       lares edge settle [--fleet <fleet-root>]\n       lares edge <kapae | un-kapae> (--member <key> | --voucher <key> --joiner <key>) --realm <realm-id> --quorum --partial\n       lares edge cosign (<partial-json> | --from <file>) [--act <act-cid>]",
    synopsis:
      "Set one RELATIONSHIP aside, or take the marker back down — the kāpae raised over an EDGE rather than " +
      "over a party. Scoped under `edge` to mirror `nexus kapae` / `nexus un_kapae` and stay apart from " +
      "them: that pair shadows a PRESENTER at a Nexus, this pair shadows one RELATIONSHIP. TWO HANDS ACT. The " +
      "HOLDER signs with the one key the edge names: a voucher over their own vouch (`--realm`), with the key " +
      "the acting face (--face N) presents at the Nexus the realm stands under, or a fleet " +
      "root over a device of its fleet (`--device`, on the fleet's own board). The QUORUM (`--quorum`) signs " +
      "with the seats this vessel holds of the charter the realm stands under, at that charter's head epoch: it strikes a vouch, or sets a " +
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
      "--as <root-index>  (--device) which held fleet root signs as the holder (default: the first held one); a realm's holder is the acting face (--face N)",
      "--nexus <aid>      the Nexus the realm stands under, at this vessel's first act there (default: the primary charter's)",
      "--fleet <root>     (settle) one fleet root to settle (default: the root of every face this vessel holds)",
      "--partial          with --quorum: sign with the seats held here and print a partial, landing nothing",
      "--voucher <key>    (partial) with --joiner: name one vouch by its two ends",
      "--joiner <key>     (partial) with --voucher: name one vouch by its two ends",
      "--from <file>      (cosign) read the partial from a file",
      "--act <act-cid>    (cosign) sign and land that act; absent, the verb only reads the partial",
    ],
    next: ["lares cabal join --realm <realm-id>   # reads every shadow the crossing meets", "lares nexus kapae --list   # the PRESENTER board — a different kind of setting-aside"],
  },

  fleet: {
    usage: "usage: lares fleet join <offer [--face N] | request <offer-file> | answer <request-file> [--face N] | land <answer-file> | abandon>",
    synopsis:
      "THE FLEET-JOIN DOOR: one face's fleet takes a new vessel of the same human, by three files carried by hand. " +
      "The joining vessel founds a PLACE first and mints its own face-scoped keys there; the root holder's answer " +
      "carries the device edge, a certificate and a grant per scope, the gate pin and canon list inside the root's " +
      "signature, and the face's address secret sealed to the request. The joining vessel's acts run with no vessel standing.",
    details: [
      "  join offer [--face N] [--out FILE]          on the root holder: the face, its root key, a nonce, the scopes it stands at",
      "  join request <offer-file> [--out FILE]      on the joining place: its face-scoped keys mint; the join stays pending",
      "  join answer <request-file> [--face N] [--out FILE] [--sync-url URL] [--doc-url URL]   on the root holder: the signed answer",
      "  join land <answer-file>                     on the joining place: the face lands",
      "  join abandon                                on the joining place: the pending join leaves",
    ],
    examples: [
      "lares fleet join offer --out offer.json                      # on the root holder",
      "lares fleet join request offer.json --out request.json       # on the new vessel, a place already founded",
      "lares fleet join answer request.json --sync-url ws://hearth:7777/ws --out answer.json",
      "lares fleet join land answer.json                            # on the new vessel",
      "lares fleet join offer --face 1 --out offer.json             # the root holder's second face takes the vessel",
    ],
    flags: [
      "--face N          which of the root holder's faces the join serves (default 0, the founding face); offer and answer name the same one",
      "--out FILE        write the file the next vessel reads, instead of printing it", "--sync-url URL    the url the new vessel dials this hearth at",
      "--doc-url URL     the document the new vessel's dial asks this hearth for (an automerge: url); the answer carries it beside the gate pin",
    ],
    next: ["lares vessel stand --with-web"],
  },

  "persona raise-sign": {
    usage: "usage: lares persona raise-sign <challenge-json-text> [--as <persona-index>]",
    synopsis:
      "The RECOGNISER's half of the raise ceremony. A vessel standing at the WAKING FLOOR emits a challenge " +
      "as a line of JSON text (its boot log prints it); `persona raise-sign` signs THAT TEXT, taken literally as the " +
      "positional argument (never a path — it reads no file), with your persona's LEAF for the Nexus the " +
      "challenge names (never the root). It attaches that leaf's admit, read off your own replica of the " +
      "Nexus's carriage board as a presented admit — the counted head, its closed lineage, and any roll " +
      "anchors that carry an admit minted before a roll — and hands the grant back. The vessel raises only " +
      "on an admit it reads HELD on its own place-side carried set — no key of yours ever rests on the " +
      "vessel you raise, and the grant stands only until that Nexus's lease epoch rolls past it.",
    examples: [
      "lares persona raise-sign '{\"vesselId\":\"<id>\",\"nexus\":\"<aid>\",\"epoch\":0,\"nonce\":\"<hex>\"}'" +
        "   # sign the vessel's printed challenge as persona 0's leaf",
      "lares persona raise-sign \"$(cat ./challenge.json)\" --as 2   # ... as persona 2's leaf, challenge saved to a file first",
    ],
    flags: ["--as <persona-index>   which held persona's leaf signs the grant"],
    next: ["lares persona list", "lares vessel read"],
  },

  "vessel lay": {
    usage: "usage: lares vessel lay [--apply] [--yes] [--verbose] [--lift-kahua <N>]",
    synopsis:
      "Lay every disk mirror back into the layer it mirrors: each disk-sourced bags/* holding into its canon through " +
      "INGEST's three-way gate, then every mirror under the projections root into its one layer, a former face's folders " +
      "adopted by pet-name. A bare run previews per holding and writes nothing; `--apply` lands; kahua lifts only on a " +
      "typed count or `--lift-kahua N`. Idempotent: a second lay lands nothing. Seed names the genesis offer alone; the " +
      "canon act lays.",
    examples: [
      "lares vessel lay                           # preview every holding; writes nothing",
      "lares vessel lay --apply --yes             # lay every holding (idempotent)",
      "lares vessel lay --apply --lift-kahua 3    # also lift the 3 kahua items the preview named",
    ],
    flags: [
      "--apply              land what the preview names",
      "--yes                answer the canon prompt yes (kahua lifts none on --yes alone)",
      "--verbose            keep full CREATE detail",
      "--lift-kahua <N>     lift the kahua items the lay previewed when N equals their count",
    ],
    next: ["lares shore", "lares vessel read"],
    meme: "lar:///ha.ka.ba/lares/cli/vessel-door",
  },

  "vessel rite": {
    usage: "usage: lares vessel rite <founding|refresh|rebuild>",
    synopsis:
      "The pet-named compositions over the vessel primitives. A rite composes ONE door's radius: each step writes " +
      "LAR_ROOT and nothing else, so a machine's onboarding reads as three acts at three doors (`lares repo tend` · " +
      "`lares home tend` · `lares vessel rite founding`).",
    examples: [
      "lares vessel rite founding        # found · stand · lay",
      "lares vessel rite refresh         # the post-code-change cure: build · stop · stand",
      "lares vessel rite rebuild         # re-derive · stand",
    ],
    flags: ["founding   found · stand · lay", "refresh    build · stop · stand", "rebuild    re-derive · stand"],
    next: ["lares vessel read", "lares home read"],
    meme: "lar:///ha.ka.ba/lares/cli/vessel-door",
  },

  repo: {
    usage: "usage: lares repo <read|tend|verify|undo> [--staged] [--force] [--probe] [--json]",
    synopsis:
      "THE CHECKOUT'S DOOR — this checkout holds its declared reality tunnel (lar:///ha.ka.ba/lares/cli/reality-tunnel): the seed's links " +
      "and CLAUDE.md's import, the scouts that carry the seed, the files Copilot reads beside CLAUDE.md, Codex's doc cap, the " +
      "operator rule's exclude. `read` answers both diffs (live against the tunnel, live against what the house last wrote) and " +
      "writes nothing; `tend` writes only on difference and records a generation; `verify` reads what the hosts loaded; " +
      "`undo [gen]` restores one. Exit: 0 aligned · 1 drift · 2 usage · 3 foreign bytes refused · 4 a needed piece absent.",
    examples: [
      "lares repo read                  # every item, both diffs; writes nothing",
      "lares repo read --staged         # what the commit carries (the pre-commit gate reads this)",
      "lares repo tend                  # converge; the root build runs this",
      "lares repo verify --probe        # Claude's /context, Codex's final hash, Copilot's sources",
      "lares repo undo                  # restore the latest tend generation",
    ],
    flags: [
      "--staged       read the index rather than the working tree (read only)",
      "--force        take bytes the house does not own; the ledger keeps them",
      "--probe        verify by asking each host (spends model calls)",
    ],
    next: ["lares home read", "lares repo verify"],
    meme: "lar:///ha.ka.ba/lares/cli/reality-tunnel",
  },

  home: {
    usage: "usage: lares home <read|tend|verify|undo> [--brief] [--force] [--probe] [--yes] [--json]",
    synopsis:
      "THE OPERATOR'S HOMES' DOOR — every home the device carries (the native home, and the Windows profile under WSL) " +
      "holds its declared reality tunnel: each harness's memory guard at its maximum (Claude's cleanupPeriodDays, Codex's saved " +
      "history, Copilot's prompt history), the lares MCP seats and hooks aimed at the main clone, the seed rule, `lares` on " +
      "the path. `tend` names every path it will write and asks first (--yes without a terminal). No door lowers a memory " +
      "guard. Exit: 0 aligned · 1 drift · 2 usage · 3 foreign bytes refused · 4 a needed piece absent.",
    examples: [
      "lares home read                  # every home's items, both diffs; writes nothing",
      "lares home read --brief          # one line (the wake hook prints it at turn 1)",
      "lares home tend                  # converge every home; asks before writing",
      "lares home verify                # the last Claude session loaded the seed once",
      "lares home undo 3                # restore generation 3",
    ],
    flags: [
      "--brief        one line: every item holds, or which stand off the tunnel (drift alone; an aligned row another hand rewrote reads apart)",
      "--force        take bytes the house does not own; the ledger keeps them",
      "--probe        verify by asking each host (spends model calls)",
      "--yes          tend without asking (a terminal-less caller)",
    ],
    next: ["lares home verify", "lares repo read"],
    meme: "lar:///ha.ka.ba/lares/cli/reality-tunnel",
  },
};

/**
 * The door key for a `--help` call: the SUB-DOOR entry when one stands (`"<door> <sub>"`), the command
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

/** The long account each top-level verb carries in the command table, seated by the table at load so a door's help
 *  and its usage refusal (both drawn from `helpLines`) print it alike. The top-level list prints the brief. */
const ABOUT = new Map<string, string>();
export function seatAbout(door: string, about: string): void { ABOUT.set(door, about); }

/**
 * One door's help as LINES — the single home both the `--help` render and a module's usage REFUSAL draw
 * from. A module that keeps its own copy of these words splits the two; the weld test refuses that.
 */
export function helpLines(door: string, summary?: string): string[] {
  const help = COMMAND_HELP[door];
  const about = ABOUT.get(door);
  if (!help) {
    const out = [`lares ${door}`, "", "Examples:", `  lares ${door}                 # usage`, `  lares ${door} --help          # this account`];
    if (summary) out.push("", "About:", `  ${summary}`);
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
  if (about) out.push("", "About:", `  ${about}`);
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
