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
 * A DOOR FLIPS TO ITS CARRIERS. Where every affordance a door skins holds an affordance carrier, `helpLines` reads the baked
 * affordance pack (`@lararium/tw5/affordance-pack`) and the door's entry here burns in the same commit: one home, never two.
 * `oracle` flipped first (lar:///library.oracle.speaks); `get` · `put` · `delete` · `rename` stand on the core verbs' carriers
 * (lar:///engine.record.reads · puts · removes · renames, candidate addresses), `get` choosing lar:///engine.filter.pages by
 * its `filter=` param, so none of them holds an entry here. The comms course's landings 10 + 23 flipped twenty-four doors more (`realm` through `nexus`, every one whose verbs all hold a carrier); `meme`, `wiki`, `sense` and `vessel` keep their entries here until their last verbs take carriers.
 *
 * PURE DATA, SO ANY VESSEL CAN HOLD IT. This module reads no `node:fs` and no environment; the pack rides as data.
 * The `meme` field NAMES the wiki record behind a verb door (`lar:` names; it never fetches); the `--meme`
 * reach rides the one read door `lares get title=<uri> mu=assert` already uses, which any vessel holding the cap can run.
 * Every URI here comes HARVESTED from the owning module's own `Meme:` header — never invented at this seat.
 */
import { PLANE_LABELS } from "@lararium/mesh/plane-labels";
import { affordancePack, packDoor, packRender, packRoute } from "@lararium/tw5/affordance-pack";

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
  "meme offer": {
    usage: "usage: lares meme offer <show|promote> [<cid>]  ·  lares meme offer <lar:uri…> --bag <slug>",
    synopsis:
      "THE OFFERING DOOR: the lit face offers records from its working layer toward a house-canon bag, and the Kahu steward lands one. " +
      "A moved base warns (\"canon is fresher\") in every listing; only a promotion over it takes the explicit `--over-fresher`. " +
      "A release after a promotion carries it to every face: `lares nexus release <manifest-file> --cut`.",
    details: [
      "  <lar:uri…> --bag <slug>          offer these records toward a house-canon bag",
      "  show [--bag <slug>] [--all]      the open offers (every one with --all), each record's freshness now",
      "  show <cid>                       one offer's field diff against canon now",
      "  promote <cid> [--over-fresher]   the steward, on a vessel holding a charter seat, writes the offered bytes into canon",
    ],
    examples: [
      "lares meme offer lar:///ha.ka.ba/lares/api/pono/meme --bag lares",
      "lares meme offer show",
      "lares meme offer promote <cid>",
    ],
    next: ["lares nexus release <manifest-file> --cut"],
  },

  vessel: {
    usage: "usage: lares vessel <unbound|found|rotate|stand|stop|lay|read|release|roster|census|fresher|floor|request|rite> [flags]",
    synopsis:
      "THE VESSEL DOOR — one namespace over the vessel's own causal island. Four primitives and one " +
      "read: `found` mints identity + bootstrap · `stand` brings the daemon up and reports · `stop` " +
      "halts it on the port · `lay` lays every disk mirror back into the layer it mirrors (each disk-sourced " +
      "bags/* holding into its canon through INGEST, then every mirror under the projections root into its one layer, each face root " +
      "(faces/<pet name>) laid where it stands; kahua lifts only on a typed count or --lift-kahua N; import carries a bundle onto this hearth's faces by pet-name) · `read` inspects and starts nothing, and needs no verb, so it " +
      "answers a fallen vessel too (the resting engine falls and every held id, read from the files) · `release <documentId>` " +
      "ends one quarantine hold with the vessel stopped (`--keep` keeps what stands, `--fresh` starts the id empty). Compositions ride " +
      "`vessel rite <petname>`, so a new cap-stack arrives as a rite rather than another top-level verb. " +
      "Advancing the genesis composition is a MESH act — `nexus kahuli` — never a vessel door.",
    examples: [
      "lares vessel stand                      # idempotent boot, attach-or-start, and REPORT",
      "lares vessel read --palaces             # health, plus the palace-organ table",
      "lares vessel read                       # the step-in reading: resting engine falls and held ids, with no verb (answers a fallen vessel)",
      "lares vessel release <documentId>       # with the vessel stopped: the quarantined bytes return under the id",
      "lares vessel release <documentId> --keep   # end the hold, keep what stands under the id",
      "lares vessel roster                     # who is home: the worn face, the seats here and far, the lanes, the open vota",
      "lares vessel lay --apply --yes          # lay every holding (idempotent)",
      "lares vessel lay --apply --verbose      # keep full CREATE detail",
      "lares vessel fresher --bag sdm          # each working copy's base hash beside the canon hash standing now",
      "lares vessel lay --apply --lift-kahua 3    # also lift the 3 kahua items the preview named",
      "lares vessel rite refresh               # the post-code-change cure: build · stop · stand",
      "lares vessel request <requestId>        # read a request's receipt, dispatching nothing",
      "lares vessel request <requestId> --cancel  # withdraw it before it is read: your own hand, never a timeout's",
      "lares vessel floor status [--grain canon|seed|shadow|lag|all]  # the vessel's floor pin and the five drifts, one row each by its own word (disk lag, working ahead, canon floor drift, seed offer, shadow tally); refreshes the one floor card in the daemon wiki",
      "lares vessel floor accept [<release>]   # walk prior from the pin to the release (or the sole newest)",
      "lares vessel floor seed [--genesis <dir>]  # the seed a genesis dir offers (CID, digests) beside the founding record; moves nothing",
      "lares vessel floor adopt [--apply|--commit|--revert]  # the seed's plugins over the pin's base as a local floor: bare previews; --apply stages it, --commit at par, --revert lands the prior back (the engine never adopts here)",
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
      "release <documentId> --keep   end the hold and keep what stands under the id; --fresh starts a plane no sibling carries empty (the bytes stay aside)",
      "rite <petname>       founding · refresh · rebuild — the pet-named cap-stacks",
      "lay --lift-kahua <N>  lift the kahua items the lay previewed when N equals their count (a bare --yes lifts none)",
      "floor seed --genesis <dir>  the genesis dir whose seed reads (else LAR_GENESIS through the one resolver; an image carries /app/genesis); --json carries `seed`, the line the pūlama takes",
      "floor seed --image <digest>  print the whole pūlama frame {\"digest\",\"seed\"} as the one stdout line (wins over --json); a shim hands it to `pulama-main image '<frame>'` unparsed",
    ],
    next: ["lares vessel read --palaces", "lares sense pour --all"],
    meme: "lar:///ha.ka.ba/lares/cli/vessel-door",
  },

  sense: {
    usage: "usage: lares sense <search|relate|structure|status> [--lens <plane>]  ·  lares sense analyze --lens <lens>  ·  lares sense <trial-run|setup|recall|refresh|capture|pour|teardown|worldline|telemetry|meta|plane-record|quiesce|resume|holders|roster|reconcile|build|harden|retire|un-retire|purge> …",
    synopsis:
      "THE SOVEREIGN SENSORIUM'S ONE DOOR (the guest comparator lives at `lares mempalace`). READ four " +
      "verbs with the plane as a `--lens` parameter (search · relate · structure · status), so a new plane " +
      "needs no new verb. ANALYZE through one verb, the lens choosing the instrument (the lenses below). " +
      "TEND the planes with the lifecycle verbs (recall · capture (incl. sub-agent " +
      "transcripts) · pour · teardown · worldline · telemetry · holders · roster). `pour --all` walks the whole tending movement — " +
      "quiesce · baseline · drawers · bearing · projection · verify · resume — never the guest miner; `pour --bulk` " +
      "runs the drawers leg alone. Every verb rides the daemon's composed caps (the " +
      "single-owner law: nothing opens a store beside the vessel's holder).",
    details: [
      "analyze --lens <lens> — the lens chooses the instrument; each keeps its own read path and daemon verb.",
      "changes rhythm couple cohere square read the poured sensorium; lead forecast mismatch read a --signal you hand in.",
      "Every answer names the lens it applied; a missing or unknown lens refuses with this list.",
      "  changes    where the poured content changes hands (--spectral, --halves <w,w>, --span <n>)",
      "  rhythm     the landed regimes and their couples (--repour re-derives first, --channel <c>)",
      "  couple     do the sensorium's coupled peers reconcile (the H¹ gate); also ki",
      "  cohere     do the sensorium's planes glue into one section; also li",
      "  square     do a child-host's lobes round-trip to one self (bare: the mesh)",
      "  lead       who leads whom across signals, the R reference (--signal <ndjson>, --names <a,b>)",
      "  forecast   does a regime shift approach, the R early-warning read (--signal <ndjson>)",
      "  mismatch   do couple and lead agree over the same signals (--signal <ndjson>, --names <a,b>)",
    ],
    examples: [
      "lares sense search \"entrance block\" --lens structure   # hybrid recall over a plane",
      "lares sense status --lens content                       # wings · rooms · entities · total",
      "lares sense recall keyhive convergent removal           # verbatim drawers",
      "lares sense recall fork --speaker operator --surface claude  # filters compose (AND)",
      "lares sense pour --all                                  # the sovereign re-pave (all sources)",
      "lares sense analyze --lens couple                       # one instrument through its lens",
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
      "--all           (pour) the whole tending movement · --bulk the drawers leg alone, every transcript",
      "--trial-root <absolute named root>  frozen Claude serving operation; trial-run/search/status only",
      "--model-home <root>  pinned MiniLM assets for trial-run/search; must match the operation receipt",
      "--source-key/--revision <value>  trial search postfilters (bounded candidate window)",
      "--confirm/--drain/--force   (teardown) remove / quiesce-first / override live holders",
    ],
    next: ["lares sense status --lens content", "lares mempalace status   # the guest comparator door"],
  },

  meme: {
    usage: "usage: lares meme <normalize | check | sitting | project | promote | offer> (store verbs require (--recipe <slug> | --bag <slug>))",
    synopsis:
      "THE MEME DOOR — one family for every law over meme text, and each verb DECLARES ITS SEAT: " +
      "`normalize` · `check` · `sitting` · `project --to md` (over a file) run LOCAL with no daemon in " +
      "reach; `project` to any other target, or from a `lar:` uri, rides the daemon verb. A family lands and patches through " +
      "`lares put`, leaves through `lares delete … family=true`, and lists through `lares get meme=true`. A meme READS through the one door: `lares get title=<uri> recipe=<slug>` (whole within a page, " +
      "its has-stack past it; `mu=relate` the card, `mu=assert` the whole carrier). Store-backed verbs require `(--recipe <slug> | --bag <slug>)`; `--recipe` edits AS " +
      "the named wiki; " +
      "`--bag` places into that bag and REFUSES when this island cannot write it; `--realm <id>` beside " +
      "`--bag` names the realm whose registration that bag resolves through, and reads that realm alone.",
    examples: [
      "lares get title=lar:///ha.ka.ba/lares/api/corpus recipe=lares mu=assert   # READ a meme: the carrier, base on stderr (the one door)",
      "lares meme normalize draft.mem                         # re-frame + re-stamp the block check",
      "lares meme check bags/**/*.mem                         # CI / pre-commit: drift exits 1",
      "lares meme project note.mem --to md --out ./out        # the submission pair, clock-free",
      "lares meme project --to md --check bags/…/submissions   # every pair on the shelf re-projects clean",
      "lares meme promote bags/…/docs/pono/x.mem --face 0     # the selected face signs the canon crossing",
      "lares meme promote x.mem --dest-bag lar:///ha.ka.ba/bags/crossroads --approval a.json  # publish for the Nexus: the seats approved these bytes",
      "lares meme offer lar:///ha.ka.ba/... --bag lares     # offer a working record toward canon; canon stays unmoved",
      "lares meme offer show [--bag lares] · offer show <cid> · offer promote <cid> [--over-fresher]  # the steward reviews and lands it",
    ],
    flags: [
      "--recipe <slug>    an edit AS that wiki: its designated writable bag, write-then-sync",
      "--bag <slug>       a residency placement into that bag (refused when this island cannot write it)",
      "--target <h1|name> (get, list) READ another lit face's daemon wiki (`--recipe default`, or one of its daemon bags) while keeping the face worn; its personal and draft layers never answer (cross-face-private), a shut face refuses face-not-open, and a write naming another face refuses at the CLI",
      "--dest-bag <uri>   (promote) the canon bag crossed into; the cap is read against this name",
      `--approval <file>  (promote) the seats' approval over these exact bytes; a crossing into the ${PLANE_LABELS.crossroads} refuses without one`,
      "--nexus <aid>      (promote) the Nexus whose charter reads the approval",
      "--all              (offer show) retired offers too; open ones alone otherwise",
      "--over-fresher     (offer promote) the steward's explicit choice to land an offer canon moved under (\"canon is fresher\")",
      "--gradient         (check) name each file's kind and the marks that kind requires and lacks",
      "--edges            (check) name the addresses these carriers point at, and which of them answer",
      "--format=problems  (check) one `path:line:col: severity: code: message` line per diagnostic, for an " +
        "editor's problem matcher (lar:///ha.ka.ba/lares/cli/problems); a clean file prints nothing, the exit stays",
      "--grammar          (normalize/check) also apply GRAMMAR-authority clauses (authored spelling, " +
        "e.g. a call site's `:` vs `=`) — default reports them as a preference and moves no byte",
      "--to <md|html|tid|json>   (project) the render target (the carrier itself: `lares get title=<uri> recipe=<slug> mu=assert`)",
      "--out <path>       (project) the pair's directory (--to md) or the rendered file; stdout otherwise",
      "--check            (project --to md, over a <file.md|dir>) prove currency by re-projection alone; " +
        "writes nothing, exits 1 naming each pair whose source moved or vanished, or whose bytes drifted",
    ],
    next: ["lares meme check <file.mem>", "lares meme sitting bags/   # what the fire could take; it BURNS NOTHING"],
    meme: "lar:///ha.ka.ba/lares/api/pono/meme",
  },

  "vessel lay": {
    usage: "usage: lares vessel lay [--apply] [--yes] [--verbose] [--lift-kahua <N>] | --workbench [--apply] | --lag",
    synopsis:
      "Lay every disk mirror back into the layer it mirrors: each disk-sourced bags/* holding into its canon through " +
      "INGEST's three-way gate, then every mirror under the projections root into its one layer, a former face's folders " +
      "adopted by pet-name. A bare run previews per holding and writes nothing; `--apply` lands; kahua lifts only on a " +
      "typed count or `--lift-kahua N`. Idempotent: a second lay lands nothing. `--workbench` lays the checkout's workbench folders " +
      "(wikis/<slug> beside the canon source) alone, into each wiki's working layer the worn face mounts and owns (a wiki a share row hands another owner waits for that " +
      "face's wear): never canon, never a face " +
      "root, no kahua. `--lag` reads the house's lag (each holding's titles its canon lacks, each workbench's titles new or moved and " +
      "whether the worn face mounts it, and whether the source stands in a checkout) and writes nothing. Seed names the genesis offer alone; the canon act lays.",
    examples: [
      "lares vessel lay                           # preview every holding; writes nothing",
      "lares vessel lay --apply --yes             # lay every holding (idempotent)",
      "lares vessel lay --apply --lift-kahua 3    # also lift the 3 kahua items the preview named",
      "lares vessel lay --workbench --apply       # the checkout's workbenches alone (the lay a kūkulu runs after its raise)",
      "lares vessel lay --lag --json              # data.lag, data.benchLag, data.checkout; writes nothing",
    ],
    flags: [
      "--apply              land what the preview names",
      "--yes                answer the canon prompt yes (kahua lifts none on --yes alone)",
      "--verbose            keep full CREATE detail",
      "--lift-kahua <N>     lift the kahua items the lay previewed when N equals their count",
      "--workbench          the checkout's workbench folders alone, into the working layers the worn face mounts and owns",
      "--lag                read the house's lag (canon and workbench) and write nothing",
    ],
    next: ["lares shore", "lares vessel read"],
    meme: "lar:///ha.ka.ba/lares/cli/vessel-door",
  },

  "vessel release": {
    usage: "usage: lares vessel release <documentId> [--keep|--fresh]",
    synopsis:
      "THE HAND'S RELEASE OF ONE QUARANTINED ID, with the vessel stopped. It claims the store for its act and refuses by name " +
      "where a holder answers (a standing vessel, a command mid-act, or a fallen vessel whose process still lives), naming " +
      "`lares vessel stop`. `lares vessel read` lists the held ids with no verb, and answers a fallen vessel too.",
    examples: [
      "lares vessel read                               # the held ids, and why each one holds",
      "lares vessel stop                               # the release runs with the vessel stopped",
      "lares vessel release <documentId>               # the quarantined bytes return; the next stand probes them again",
      "lares vessel release <documentId> --keep        # end the hold, keep what stands under the id",
      "lares vessel release <documentId> --fresh       # a plane no sibling carries starts empty; the bytes stay aside",
    ],
    flags: [
      "(bare)     the quarantined bytes return under the id",
      "--keep     end the hold and keep what stands under the id; the moved-aside copy rests where it lies",
      "--fresh    start the id empty under its own name (refused for a plane a sibling device carries); the bytes stay aside",
    ],
    next: ["lares vessel read", "lares vessel stand"],
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

};

/**
 * The door key for a `--help` call: the SUB-DOOR entry when one stands (`"<door> <sub>"`), the command
 * otherwise. Longest match wins, so a sub-verb's own flags reach the reader instead of its parent's.
 */
export function helpDoor(command: string, positional: readonly string[]): string {
  const sub = positional[0];
  // A verb a carrier skins reads its own whole (`lares law pin --help`), the way a registry sub-door reads its own entry.
  if (sub && (`${command} ${sub}` in COMMAND_HELP || packRoute("cli", `${command} ${sub}`) !== undefined)) return `${command} ${sub}`;
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
 * A carried verb's one line, its carrier's role, for a door that keeps its own sub-verb table beside it: the table prints the
 * carrier's words and holds none of its own. Empty where the pack routes no carrier.
 */
export function verbRole(spelling: string): string {
  const address = packRoute("cli", spelling);
  return address === undefined ? "" : affordancePack().carriers[address]?.role ?? "";
}

/**
 * One door's help as LINES — the single home both the `--help` render and a module's usage REFUSAL draw
 * from. A module that keeps its own copy of these words splits the two; the weld test refuses that.
 */
export function helpLines(door: string, summary?: string): string[] {
  // THE SEAM (lar:///ha.ka.ba/kahua/memory/plan/cap-memes-compass §4): a door every affordance of which holds a carrier reads
  // the baked pack, and its registry entry leaves in the commit that flips it; every other door reads the registry below. The census
  // law (tests/laws/affordance-census.law.test.ts) counts the registry doors down to zero, when this registry leaves.
  const packed = packDoor(door);
  if (packed !== undefined) return [...packed.help];
  const verb = packRoute("cli", door);
  const whole = verb === undefined ? undefined : packRender(verb, "cli", "whole");
  if (whole !== undefined) return [...whole];
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
