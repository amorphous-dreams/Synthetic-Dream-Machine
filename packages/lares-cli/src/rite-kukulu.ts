/**
 * rite-kukulu — the kūkulu rite's order: the ONE human verb that raises the house again around its hearth, with a tessera
 * kept across the gap wherever a kukulu lei stands.
 *
 * It reads where the house stands on every run and walks only what remains, so a run that stopped picks up wherever the
 * house stands; no file remembers a half-done run. The rite runs on the host, behind its ports, in one order:
 *
 *   0. lei          the kukulu lei on the line reads FIRST; where none stands a real terminal is offered one on the spot
 *                   (`KUKULU_LEI_RETURNS` per lent face, under one passphrase), and a no names the plain line before anything slow
 *   1. sync         (forward only) fetch, then fast-forward the checkout's own branch where the tree stands clean and behind
 *                   its upstream; a dirty tree behind it, a branch diverged from it, or a detached head stops with one line.
 *                   It never switches a branch, never stashes, and never merges anything but a fast-forward. After a
 *                   fast-forward (and where the checkout stands current yet a submodule's commit differs from its recorded
 *                   pin) each submodule is set to the pin the superproject records, never a newer one; a submodule holding
 *                   local or untracked changes stops the rite with one line naming it, and its work stays
 *   2. checkout     the checkout's head and branch
 *   3. stage        the host shim makes the image of the revision (the tag holds it, a kept rev tag takes the tag, or a
 *                   build from the commit; `--rollback` names the image that ran before, or an older revision, and never
 *                   touches the checkout) and READS the house: the vessel, the pūlama's code, lit, admitted, an offer
 *   4. gate         a seat with no terminal stops here, before anything is spent or moved, only where the day owes a
 *                   route: the pūlama's light (its code moved, none runs, or it stands unlit), or its admit (a new vessel
 *                   on an image no admission and no kukulu lei carries). The line names the hand act
 *   5. rite-begin   IN THE VESSEL, where a vessel stands: every lent face's kukulu lei returns once and rests its guest
 *                   half (`rite-begun`). No lei standing on the line runs the restand with no rite. FIRST the vessel reads
 *                   the begin that stands (`standing`: guest halves resting unlanded on the line): one at this head is
 *                   RESUMED (no return, no tessera, the offer that rests reused); one at another head refuses
 *                   `kukulu-begun-stale` with the one line that clears it. A vessel down at the start (a Ctrl+C at the
 *                   light) shows its halves to the vessel the raise stands, and the rite lands them there
 *   6. rite-offer   IN THE STANDING VESSEL, over the image the host made: one vouch per face, rested for the next vessel to
 *                   carry to the pūlama (`kukulu-offer.json`), so the pūlama lends on it with no admit
 *   7. raise        the shim's restand: down (keep, census), the pūlama re-stood and lit ATTACHED on this terminal where its
 *                   code moved, up, its admit attached where owed, the vessel's unlock and the face last worn. The down stops a
 *                   standing vessel gracefully (SIGTERM under Docker's stop grace), and the node's teardown flushes every shore
 *                   (every resident island with a mirror) before any island goes down; the rite names that before the raise
 *                   ({@link STOP_FLUSHES_LINE})
 *   8. rite-land    IN THE NEW VESSEL: each face's host half (`rite-landed`); the rite reads par only where every pair reads par
 *   9. lag          after a raise that stood, the lag reads aloud on every raise: the canon bag behind the canon source (the
 *                   carriers in `bags/` the canon layers lack; canon fills through promote and the floor's sealed cut, never
 *                   from a raise, so the line only names it), each wiki's workbench behind the checkout's `wikis/<slug>`, and a
 *                   newer seed offer (the seed's floor) the release carries than the vessel serves, named by its card. Where the canon source stands in a checkout
 *                   and the owner holds this terminal, the workbench lay's preview (each title a workbench the worn face mounts
 *                   would take) asks once, and the lay (`lares vessel lay --workbench --apply`) runs only on an explicit yes; a
 *                   workbench that does not mount is named and left. A seat (no terminal, or an AI launcher), a source in no
 *                   checkout, or a vessel waiting on its unlock names the lag and lays nothing
 *
 * A QUIET DAY spends nothing: a vessel that already runs the image under a lit pūlama begins no rite; the raise only tops
 * up the unlock and the face worn.
 *
 * A CTRL+C AT ANY PROMPT leaves the house where the next run reads it: the begun halves and the offer rest in the vessel and the
 * house's config, the restand reads where it stopped, and the next run resumes; no prompt stands between a return and its rest.
 *
 * THE IMAGE COMES BEFORE THE RETURN. A build that fails spends no lei and leaves the vessel standing as it stood.
 *
 * THE SEED THE IMAGE OFFERS (D1). The host says the seed (offered) at the head beside the founding record (the stored
 * genesis island), ratchet by ratchet (`seedOffer`, `kukuluSeedLine`). The kūkulu moves no ratchet: the new vessel serves the
 * founding record it reloads, and the line only names what waits.
 */
import { compareGenesisDigests, ratchetWords, ratchetsDiffer, type GenesisDigests, seedRatchetStances, seedStanceWords } from "@lararium/mesh/genesis-compare";

export type RiteVerbAnswer =
  | { readonly ok: true; readonly output: Record<string, unknown> }
  | { readonly ok: false; readonly code: string; readonly message: string };

/** The refusal a rite stops on where its lei spent every return. */
export const RETURNS_SPENT = "swarm-lei-returns-spent";
/** The refusal a begin answers where no kukulu lei stands on the line: the restand goes on with no rite. */
/** The refusal `lei show` reads of a lei whose returns all lie spent (the begin's refill prompt owns it). */
const RETURNS_SPENT_REFUSAL = "returns-spent";
export const LEI_ABSENT = "swarm-lei-absent";

/** The returns per lent face a kūkulu lei strung on the spot carries, where the rite finds none standing. */
export const KUKULU_LEI_RETURNS = 6;

/**
 * A spent line's refill: the rite, the branch, the face (or every open face), and the returns the spent lei carried where known.
 * `absent`: no lei stands on the line at all, so the offer strings a first one rather than refills a spent one.
 */
export interface RefillReq { readonly rite: "keep" | "kukulu"; readonly branch: string; readonly face?: number; readonly all?: boolean; readonly returns?: number; readonly absent?: true }
/** `strung`: the hand strung the refill on a terminal; `remedy`: the plain line that does it by hand (it names no cid, a kui follows the tip itself). */
export interface RefillAnswer { readonly strung: boolean; readonly remedy: string }
/** The offer a real terminal gets: ask, then string the refill through the hand door; a pipe or an AI seat only reads the remedy. */
export type RefillPort = (req: RefillReq) => Promise<RefillAnswer>;

/** The checkout's fast-forward: `ok` goes on (the line names what moved, or that nothing did); otherwise the line names what stopped it. */
export interface SyncAnswer { readonly ok: boolean; readonly line: string }

/** Which image the stage makes: one revision (the checkout's head, or a `--rollback <rev>`), or the image that ran before. */
export type StageTarget = { readonly at: string } | { readonly prior: true };

/** Where the house stands once the image does: the shim's `rebuild --image` reading. */
export interface StandReading {
  readonly revision: string;
  readonly image: string;
  readonly how: "stood" | "kept" | "built";
  readonly vessel: "standing" | "down";
  /** A vessel already runs the image. */
  readonly current: boolean;
  readonly pulama: "off" | "absent" | "level" | "closure-level" | "moved" | "unread";
  /**
   * A HOʻĀLA LEI STANDS WITH A RETURN LEFT at the pūlama (the shim reads its status). The hand's stringing already authorized the
   * waking's acts (operator rulings, 2026-11-26: standing lei caps carry the authorization until the lei expires by spends, and a
   * moved keeper code changes nothing, since the leis and the rollback cover it): the raise lights the keeper and admits the image
   * under the lei, one return each, with no route; the prior keeper image stays tagged as the rollback. Absent or false: as before.
   */
  readonly hoala?: boolean;
  /**
   * THE KEEPER TALLY, where the pūlama's code moved and it stands lit: `vests` where a successor the hand made names the
   * closure the new image carries (the raise hands the living fire to a successor, unattended, and asks no route); `struck-due`
   * where the handed run reached its count (the hand lights the successor); `lei` where no commit names the closure yet and the
   * keeper could rest one the kukulu lei licenses (`keeperLeiSpend`, no route). Absent, or null, the light rides as it did.
   */
  readonly keeper?: "vests" | "struck-due" | "lei" | null;
  readonly lit: boolean | null;
  readonly admitted: boolean | null;
  /** A kukulu offer resting from an earlier run names the image. */
  readonly offer: boolean;
  /** When that offer rested (the file's time, as the host reads it, UTC); absent where none rests or none reads. */
  readonly offerAt?: string;
}

/**
 * A kūkulu begun and never landed, as the standing vessel reads it: the face (its ordinal where the vessel names one), the
 * tessera, and the head it began at.
 */
export interface StandingBegin { readonly face: string; readonly ordinal?: number; readonly tessera: string; readonly head: string; readonly image?: string }
/** One half of the raw debt: every kūkulu half resting unlanded on the line, whatever face still verifies it (a shut or rehived face's too). */
export interface PendingBegin { readonly tessera: string; readonly group: string; readonly head: string; readonly image?: string; readonly face?: string }
/** One vouch the resting offer carries, named by the lent face whose group it names. */
export interface OfferVouch { readonly face?: string; readonly group: string; readonly branch: string; readonly head: string; readonly image: string }
/**
 * The standing read: the halves a lent face lands (`begins`), the raw debt (`pending`), and the resting offer's vouches (`offer`,
 * null where none rests), or the vessel's refusal. A vessel of an older image names no `pending`; the rite then reads its
 * `begins` alone.
 */
export type StandingAnswer =
  | { readonly ok: true; readonly begins: readonly StandingBegin[]; readonly pending?: readonly PendingBegin[]; readonly offer?: readonly OfferVouch[] | null;
      /** The resting offer's base (`sha256:<hex>`), null where none rests: an overwrite names it, or refuses `conflict`. */
      readonly offerBase?: string | null }
  | { readonly ok: false; readonly code: string; readonly message: string };

/** The refusal a run answers where a begin stands unlanded at another head than the one it raises. */
export const BEGUN_STALE = "kukulu-begun-stale";
/** The refusal a run answers where a begin stands unlanded at this head that it cannot resume: another image, or a face no lent face lands. */
export const BEGUN_UNMATCHED = "kukulu-begun-unmatched";
/** The exit a shim answers when a Ctrl+C ended it (128 + SIGINT). */
export const INTERRUPTED = 130;

export interface RitePorts {
  /** The checkout's head and the branch it rides. */
  checkout(): Promise<{ readonly head: string; readonly branch: string }>;
  /** Fetch and fast-forward the checkout (forward only); absent, the checkout stands as it stands. */
  sync?(): Promise<SyncAnswer>;
  /** The shim's image step and its reading of the house (`rebuild --image`); the answer carries its exit code. */
  stage(target: StageTarget): Promise<{ readonly code: number; readonly reading: StandReading | null }>;
  /** The shim's restand onto the image of the revision (`rebuild --at <rev>`, `--keeper-to <key>` where this rite carries a keeper
   *  move); the answer carries its exit code. */
  raise(revision: string, keeper?: { readonly to: string }): Promise<number>;
  /**
   * THE KEEPER MOVE (the keeper tally): stand the successor keeper beside the lit one and read the one-handoff key it offers and the
   * closure its host reads (`keeper-stand`), before the offer, so the vouches name the move; null where none stood. Absent, no rite
   * carries a keeper move and a moved closure relights struck.
   */
  keeperStand?(): Promise<{ readonly to: string; readonly closure: string } | null>;
  /**
   * THE COMMIT THE KUKULU LEI LICENSES (no route; operator ruling 2026-11-24: the keeper lei keeps no count of its own): the shim's
   * internal step (`pulama name-successor --lei <rev> <branch>`, no hand verb) checks the revision reachable from origin, the image's closure label equal to its D′
   * and a green LOCAL bench verdict over that very tree (the host runs `node tools/bench-gate.mjs --verdict`; CI rides beside it as
   * annotation and never blocks, ruling 2026-11-25-web2-annotates), and the keeper rests a commit naming D′, the verdict's hash and the license. The rite's own begin spends the lei's
   * return (the same return it spends for the lent face), and the vest names it. True where the commit rests (the stand then reads
   * `vests`); false where any guard refused (its lines name why). Absent, nothing licenses a commit.
   */
  keeperLeiSpend?(revision: string, branch: string): Promise<boolean>;
  /** A terminal on both ends, where a route can be typed; absent, the rite reads one. */
  tty?(): boolean;
  /** One store row, answered by the vessel that stands. */
  row(verb: "rite-begin" | "rite-land" | "rite-offer", args: Record<string, unknown>): Promise<RiteVerbAnswer>;
  /**
   * The debt on the branch's line, read by the vessel that stands (`rite receipts --rite kukulu`), as the face `face` names
   * where the operator names one (the worn face otherwise). Absent, the rite reads none and begins as it did.
   */
  standing?(branch: string, face?: number): Promise<StandingAnswer>;
  /** The keep a down left owed, run after the landing (`keep-owed`); absent, the raise runs it itself. */
  keepOwed?(): Promise<number>;
  /** The image the raised vessel runs, by digest, as the vessel's container reports it (null where none reads); absent, the rite lands over the digest it staged. */
  ranImage?(): Promise<string | null>;
  /** Where a spent kūkulu lei is offered its refill inline (and an absent one its first stringing); absent, the rite refuses as it did. */
  refill?: RefillPort;
  /**
   * Whether a kukulu lei stands on the line with a return left (for `face`, else any lent face): true where one stands, false or
   * "absent" where none was ever strung, any other string the refusal code the line reads instead (`returns-spent`, `forked`,
   * `unstrung`, a ward refusal); null where the line reads no answer. Read FIRST, before the fetch, the image step and the seed,
   * so a missing lei never costs the slow reads. Only an absent lei earns the offer to string one.
   */
  leiStands?(branch: string, face?: number): Promise<boolean | string | null>;
  /**
   * The image the vessel stands from when the rite begins (its revision label and the tag the shim keeps it under as the
   * outgoing image); null where the host reads none. Absent, the answer names no prior.
   */
  prior?(): Promise<PriorImage | null>;
  say(line: string): void;
  /**
   * The founding record's digests beside the seed the image at `head` offers (its CID and digests); null where the host reads
   * no founding record. Absent, the rite says nothing of the seed.
   */
  seedOffer?(head: string): Promise<SeedOffer | null>;
  /**
   * THE LAG after the raise (`lares vessel lay --lag` in the vessel that stands): canon behind the canon source, each workbench behind
   * the checkout's `wikis/<slug>` and whether the worn face mounts it; null where the vessel reads none. Absent, the rite reads no lag.
   */
  houseLag?(): Promise<HouseLag | null>;
  /** The floor card the vessel's status refreshed (title only), or null where no vessel answers one. */
  floorCard?(): Promise<{ readonly title: string } | null>;
  /** One yes-or-no on this terminal (a Ctrl+C reads as no); absent, the rite asks nothing and lays nothing. */
  ask?(question: string): Promise<boolean>;
  /** The workbench lay on this terminal (`lares vessel lay --workbench --apply`), run only after the owner's yes; its exit code. */
  layWorkbench?(): Promise<number>;
  /** Whether an AI seat launched this rite (the harness's mark, or a host chain that reads no person's hand); absent, false. */
  seat?(): boolean;
}

/** One holding's lag: the titles its canon source holds that its canon bag lacks (`new`) or holds in other bytes (`changed`). */
export interface LagHolding { readonly holding: string; readonly toBag: string; readonly new: readonly string[]; readonly changed: readonly string[] }
/**
 * One workbench's lag: the titles the checkout's `wikis/<slug>` holds new or moved against that wiki's working layer, and whether the
 * worn face mounts the workbench (a writer's seat there); `why` names what keeps it from mounting, `mounts` null where the seat read nowhere.
 */
export interface BenchLag { readonly slug: string; readonly toBag: string; readonly planned: readonly string[]; readonly mounts: boolean | null; readonly why?: string }
/**
 * The house's lag as the vessel reads it: the canon source dir and whether it stands in a checkout (an SDM repo, read by the
 * `pnpm-workspace.yaml` beside its `bags/`), each disk-sourced holding's canon lag and its total, the `wikis/` dir beside the source
 * (null where none stands), and each workbench's lag and its total.
 */
export interface HouseLag {
  readonly source: string; readonly checkout: boolean; readonly holdings: readonly LagHolding[]; readonly lag: number;
  readonly wikis: string | null; readonly benches: readonly BenchLag[]; readonly benchLag: number;
}

/** The line that lays the checkout's workbench projection by hand. */
export const WORKBENCH_LAY_LINE = "lares vessel lay --workbench --apply";

/** The image a kūkulu replaced: its revision label and the tag the shim keeps it under. */
export interface PriorImage {
  readonly revision: string;
  readonly tag: string;
}

/**
 * The tag the shim gives the outgoing image (`<repo>:rev-<12 hex of the revision label>`, `rev-unlabeled-<12 hex of the id>`
 * where the image names no revision), from the image ref the vessel stands from.
 */
export function priorImageRef(imageRef: string, revision: string, id: string): PriorImage {
  const repo = /:[^/]*$/.test(imageRef) ? imageRef.slice(0, imageRef.lastIndexOf(":")) : imageRef;
  return revision.trim() !== ""
    ? { revision, tag: `${repo}:rev-${revision.slice(0, 12)}` }
    : { revision: "unlabeled", tag: `${repo}:rev-unlabeled-${id.replace(/^sha256:/, "").slice(0, 12)}` };
}

/**
 * Whether the restand stops the standing vessel: the shim's down runs where a vessel stands on another image, or where the
 * pūlama re-stands (absent, or its code moved); a vessel already on the image under a pūlama that only owes its light stays.
 */
export const restandStops = (r: StandReading): boolean => r.vessel === "standing" && (!r.current || r.pulama === "absent" || r.pulama === "moved");

/** What the rite says before a raise that stops the standing vessel: the graceful stop's shore flush, and the cure past its grace. */
export const STOP_FLUSHES_LINE = "kūkulu: the restand stops the standing vessel gracefully (compose stop, SIGTERM): its teardown flushes every shore (every resident island with a mirror) before any island goes down. A stop that runs past Docker's stop grace (20s) ends by SIGKILL, and an island that had not answered leaves its mirrors behind its records (they rest in the store): once the house stands, `lares shore flush` writes what the daemon and the active wiki owe (it reaches those two alone), and `lares shore` lists what stands";

/** The one command that raises a replaced image again with no rebuild: the rite itself, rolled back to its revision. */
export const wayBackCommand = (prior: PriorImage): string =>
  prior.revision === "unlabeled" ? `LARES_IMAGE=${prior.tag} tools/lares-container.sh up` : `lares rite kukulu --rollback ${prior.revision.slice(0, 12)}`;

/** The founding record beside the seed an image offers. */
export interface SeedOffer {
  readonly record: GenesisDigests;
  readonly seed: { readonly cid: string; readonly digests: GenesisDigests };
}

/** The kūkulu's seed line: the seed the image at `head` offers beside the founding record, ratchet by ratchet. */
export function kukuluSeedLine(head: string, offer: SeedOffer): string {
  const ratchets = compareGenesisDigests(offer.record, offer.seed.digests);
  return ratchetsDiffer(ratchets)
    ? `kūkulu: the image at ${head} offers seed ${offer.seed.cid} beside the founding record: a newer seed waits: ${ratchetWords(ratchets)}; the founding record keeps serving, and the kūkulu moves no ratchet; ${seedStanceWords(seedRatchetStances(ratchets))}`
    : `kūkulu: the image at ${head} offers seed ${offer.seed.cid}: same on every ratchet as the founding record`;
}

export const RITE_KUKULU = "kukulu";

/** The hand act a seat with no terminal names where the day owes a route. */
export const HAND_ACT = "lares rite kukulu";

/**
 * Where the fast-forward stands, from what git reads: the branch (`HEAD` when detached), its upstream (null where none),
 * how far HEAD stands ahead of and behind it, and whether a tracked file changed. `fast-forward` moves the branch;
 * `stand` builds what the checkout holds; `stop` names what it found.
 */
export type SyncPlan = { readonly act: "fast-forward" } | { readonly act: "stand"; readonly line: string } | { readonly act: "stop"; readonly line: string };
export function syncPlan(s: { readonly branch: string; readonly upstream: string | null; readonly ahead: number; readonly behind: number; readonly dirty: boolean }): SyncPlan {
  if (s.branch === "HEAD") return { act: "stop", line: "the checkout stands on a detached head, so no branch fast-forwards; check out a branch (or name an image: --rollback <rev>), then run it again; nothing moved" };
  if (s.upstream === null) return { act: "stand", line: `${s.branch} follows no upstream, so nothing fast-forwards; the image builds from the checkout's head` };
  if (s.behind === 0) return { act: "stand", line: s.ahead > 0 ? `${s.branch} stands ${s.ahead} ahead of ${s.upstream} and none behind; the image builds from the checkout's head` : `${s.branch} stands level with ${s.upstream}` };
  if (s.ahead > 0) return { act: "stop", line: `${s.branch} and ${s.upstream} diverged (${s.ahead} ahead, ${s.behind} behind), and a fast-forward cannot join them; merge or rebase by hand, then run it again; nothing moved` };
  if (s.dirty) return { act: "stop", line: `${s.branch} stands ${s.behind} behind ${s.upstream} beside uncommitted changes, so nothing fast-forwards; commit or set them aside by hand, then run it again; nothing moved` };
  return { act: "fast-forward" };
}

/** The line that clears a lei the line reads as standing not, by the refusal it read. */
export function leiClearing(refusal: string, branch: string, face?: number): string {
  const fresh = `lares lei kui --rite kukulu --branch ${branch} --returns ${KUKULU_LEI_RETURNS} ${face === undefined ? "--all" : `--face ${face}`}`;
  const show = `lares lei show --rite kukulu --branch ${branch}${face === undefined ? "" : ` --face ${face}`}`;
  if (refusal === "forked") return `two lei tips stand on the line and neither holds; string one fresh lei that names the tip you keep: ${fresh}`;
  if (refusal === "unstrung" || refusal === "returned" || refusal === "narrowed" || refusal === "head-mismatch") return `a fresh lei restrings the line: ${fresh}`;
  return `read the refusal with \`${show}\` and clear what it names before the rite runs`;
}

/** Whether the day owes the pūlama a light: none runs, its code moved (unless a successor vests it; a lei unspent vests nothing), or it stands unlit. */
export const owesLight = (r: StandReading): boolean => r.pulama === "absent" || (r.pulama === "moved" && !(r.keeper === "vests" && r.lit === true)) || r.lit === false;

/**
 * THE FACTS A PRE-RITE READING READS (course pulama-unblur): the stand as the rite would read it for the checkout's head, before
 * any image builds. `pulama` compares the checkout's closure with the running pūlama's; `keeper` adds `lei` where the pūlama names
 * `leiReady` (the kukulu lei could license the keeper's commit); `lei` reads as `leiStands` answers (true: a kukulu lei stands
 * on the line with a return left, null where no read answered); `current` names a vessel already running the image of the head, and
 * `admitted` and `offer` name that image wherever one stands already (the tag's, or the vessel's); an image yet to build carries none.
 * `sync` names what the rite's fast-forward reads first (`syncPlan`): a stop stops the rite, a fast-forward reads the upstream's head.
 */
export interface HandFacts {
  readonly pulama: StandReading["pulama"];
  readonly lit: boolean | null;
  readonly keeper?: "vests" | "struck-due" | "lei" | null;
  readonly vessel: "standing" | "down";
  readonly current: boolean;
  readonly admitted: boolean | null;
  readonly offer: boolean;
  readonly lei: boolean | string | null;
  readonly sync?: Parameters<typeof syncPlan>[0];
}

/** The line a kukulu lei that answered no read says, wherever the verdict turns on it. */
const LEI_UNREAD = "reads unknown: the kukulu lei answered no reading (read it with `lares lei show --rite kukulu`)";

/**
 * WHETHER THE NEXT KŪKULU NEEDS A HAND (course pulama-unblur): one line, read off the facts a no-terminal rite reads and through
 * the same gates it walks (the light `owesLight` names, the admit gate, a spent lei's begin), so the reading and the rite never
 * disagree. `tools/lares-container.sh pulama status` prints the same line from the shim's own facts (one table welds the two).
 *   runs alone                            the rite raises with no route
 *   keeper vests under your successor the living fire passes to the successor the hand named ahead
 *   keeper vests under the standing lei   the kukulu lei licenses the keeper's commit and the fire passes with no route
 *   needs your hand: <why>                a no-terminal rite stops and names `lares rite kukulu` on a terminal
 *   reads unknown: <why>                  the rite stops before anything moves (`kukulu-pulama-unread`)
 */
export function kukuluHand(f: HandFacts): string {
  // THE SYNC READS FIRST, as the rite's fast-forward does: a stop ends the rite before any image; a fast-forward reads the upstream.
  const plan = f.sync === undefined ? null : syncPlan(f.sync);
  if (plan?.act === "stop" && f.sync !== undefined) {
    return `needs your hand: ${f.sync.branch === "HEAD" ? "the checkout stands detached" : f.sync.ahead > 0 ? `the checkout and ${f.sync.upstream ?? "its upstream"} diverged; the rite stops at the sync` : `the tree holds changes behind ${f.sync.upstream ?? "its upstream"}; the rite stops at the sync`}`;
  }
  const verdict = handVerdict(f);
  return plan?.act === "fast-forward" && f.sync?.upstream ? `${verdict} (after the fast-forward to ${f.sync.upstream})` : verdict;
}

function handVerdict(f: HandFacts): string {
  if (f.pulama === "off") return "runs alone";
  if (f.pulama === "unread" || (f.pulama !== "absent" && f.pulama !== "moved" && f.lit === null)) return "reads unknown: whether the pūlama stands lit, or what it runs (read it with `lares pulama status`)";
  const moved = f.pulama === "moved";
  const leiOk = f.lei === true;
  const leiUnread = f.lei === null;
  // The rite's leiGone: an absent lei, or one that stands not for a cause other than spent returns (a spent lei meets its begin).
  const leiGone = f.lei === false || (typeof f.lei === "string" && f.lei !== RETURNS_SPENT_REFUSAL);
  const byLei = moved && f.keeper === "lei" && f.lit === true && leiOk;
  const keeper = byLei ? "vests" : leiGone && f.keeper === "vests" ? null : f.keeper === "lei" ? null : f.keeper ?? null;
  const read: StandReading = { revision: "", image: "", how: "stood", vessel: f.vessel, current: f.current, pulama: f.pulama, keeper, lit: f.lit, admitted: f.admitted, offer: f.offer };
  if (owesLight(read)) {
    // A lei that answered no read decides the keeper lei's path where the pūlama offers one; elsewhere the light stays owed.
    if (moved && f.lit === true && f.keeper === "lei" && leiUnread && f.vessel === "standing") return LEI_UNREAD;
    const why = f.pulama === "absent" ? "no pūlama runs"
      : f.lit === false ? "the pūlama stands unlit"
      : keeper === "struck-due" ? "closure moved; struck due"
      : leiUnread && f.vessel === "down" ? "closure moved; no vessel stands to read the kukulu lei"
      : leiOk || leiUnread ? "closure moved; keeper lei path off"
      : "closure moved; no standing kukulu lei";
    return `needs your hand: ${why}`;
  }
  if (f.current && !moved) return "runs alone";
  // THE ADMIT GATE: a new vessel enters on an admission, a resting offer, or a begun rite (a kukulu lei's return spent).
  const begins = f.vessel === "standing" && leiOk;
  if (f.vessel === "standing" && f.lei === RETURNS_SPENT_REFUSAL) return "needs your hand: the kukulu lei's returns lie spent";
  if (!begins && f.admitted !== true && !f.offer) {
    if (f.vessel === "standing" && leiUnread) return LEI_UNREAD;
    return `needs your hand: ${f.vessel === "down" ? "no vessel stands to begin the rite" : "no standing kukulu lei"} (the pūlama's admit of the new image reads your route)`;
  }
  if (byLei) return "keeper vests under the standing lei";
  if (moved && keeper === "vests") return "keeper vests under your successor";
  return "runs alone";
}

/**
 * `face` names the face the begin's and the offer's sessions act as where several faces stand open; each row still gathers
 * every lent face, one lei and one vouch apiece. Naming none, the rows name none, and their sessions ride the face the operator
 * wears. `rollback` stands the image that ran before (`true`) or the image of an older revision, with no checkout move.
 */
export async function riteKukulu(ports: RitePorts, opts: { readonly branch?: string; readonly face?: number; readonly rollback?: true | string }): Promise<{ code: number; data: Record<string, unknown> }> {
  const out = await raiseHouse(ports, opts);
  // THE LAG AND THE WORKBENCH LAY ride only a raise that stood: a run that stopped, or one that waits on the hand before any raise, reads no lag.
  if (out.code !== 0 || out.data["awaits"] === "hand") return out;
  return lagAfterRaise(ports, out);
}

/** Whether a seed line's ratchet words read the floor moved (`ratchetWords`: `… · floor moved`). */
const floorMoved = (words: unknown): boolean => typeof words === "string" && /(?:^|· )floor moved(?: ·|$)/.test(words);

/**
 * AFTER THE RAISE, THE LAG (story U4, re-scoped under Mu, operator 2026-11-22). Every raise names how far the house stands behind
 * what it carries: the canon bag behind the canon source, each workbench behind the checkout's `wikis/<slug>`, and a newer sealed
 * floor the release carries. The raise never writes canon: canon fills through promote and the floor's sealed cut. Where the canon
 * source stands in a checkout and the owner holds this terminal, the rite previews the workbench lay (each title a workbench the
 * worn face mounts would take) and asks; the lay runs only on an explicit yes, and a no or a Ctrl+C leaves every layer as it stood.
 * A seat (no terminal, or an AI launcher) names the lag and never lays; so does a source in no checkout, and a vessel that waits on
 * its unlock.
 */
export async function lagAfterRaise(ports: RitePorts, out: { code: number; data: Record<string, unknown> }): Promise<{ code: number; data: Record<string, unknown> }> {
  if (!ports.houseLag) return out;
  // THE FLOOR the release carries, beside the floor the vessel serves: the seed line this run read, or a fresh read on a quiet day.
  let seedWords = (out.data["seed"] as { ratchets?: unknown } | undefined)?.ratchets;
  if (seedWords === undefined && out.data["rollback"] === undefined && ports.seedOffer && typeof out.data["head"] === "string") {
    const offer = await ports.seedOffer(out.data["head"]).catch(() => null);
    if (offer !== null) seedWords = ratchetWords(compareGenesisDigests(offer.record, offer.seed.digests));
  }
  const floor = floorMoved(seedWords);
  const card = floor && ports.floorCard ? await ports.floorCard().catch(() => null) : null;
  if (floor) ports.say(`kūkulu: the seed offer waits (the seed's floor moved); the raise stands no floor${card ? `; the card ${card.title} names each drift` : ""}: \`lares vessel floor status --grain seed\``);
  const read = await ports.houseLag().catch(() => null);
  if (read === null) {
    ports.say("kūkulu: the lag reads nowhere (the vessel answered no reading); `lares vessel lay --lag` reads it");
    return { ...out, data: { ...out.data, lag: { read: false, ...(floor ? { floor: "moved", ...(card ? { card: card.title } : {}) } : {}) } } };
  }
  const fresh = read.holdings.reduce((n, h) => n + h.new.length, 0), moved = read.holdings.reduce((n, h) => n + h.changed.length, 0);
  ports.say(read.lag === 0
    ? `kūkulu: canon stands level with ${read.source}`
    : `kūkulu: canon lags the canon source by ${read.lag} carrier(s) (${fresh} new, ${moved} changed) in ${read.source}; canon fills through promote and the floor's sealed cut, never from a raise: \`lares meme offer promote <cid>\`, then \`lares nexus release <manifest-file> --cut\``);
  const lagging = read.benches.filter((b) => b.planned.length > 0);
  if (read.wikis !== null) {
    ports.say(read.benchLag === 0
      ? `kūkulu: the checkout's workbenches stand level with ${read.wikis}`
      : `kūkulu: the workbenches lag the checkout's ${read.wikis} by ${read.benchLag} carrier(s): ${lagging.map((b) => `${b.slug} ${b.planned.length}`).join(", ")}`);
  }
  for (const b of lagging) {
    if (b.mounts === true) continue;
    ports.say(`kūkulu: workbench ${b.slug} does not mount under the worn face (${b.why ?? (b.mounts === null ? "its seat read nowhere" : "no writer's seat")}); nothing of it lays`);
  }
  const lag = { canon: read.lag, workbench: read.benchLag, checkout: read.checkout, source: read.source, ...(floor ? { floor: "moved", ...(card ? { card: card.title } : {}) } : {}) };
  const mounted = lagging.filter((b) => b.mounts === true);
  const offered = mounted.reduce((n, b) => n + b.planned.length, 0);
  if (offered === 0) return { ...out, data: { ...out.data, lag } };
  const tty = ports.tty ? ports.tty() : true, seat = ports.seat ? ports.seat() : false;
  const why = !read.checkout ? `${read.source} stands in no checkout, so the raise offers no lay`
    : out.data["awaits"] === "unlock" ? `the new vessel waits on its unlock, so nothing lays; once it opens: ${WORKBENCH_LAY_LINE}`
    : seat ? `an AI seat launched this rite, so nothing lays; your hand: ${HAND_ACT} on a terminal (or ${WORKBENCH_LAY_LINE})`
    : !tty ? `this seat holds no terminal, so nothing lays; your hand: ${HAND_ACT} on a terminal (or ${WORKBENCH_LAY_LINE})`
    : !ports.ask || !ports.layWorkbench ? `this rite carries no lay, so nothing lays; your hand: ${WORKBENCH_LAY_LINE}`
    : null;
  if (why !== null) {
    ports.say(`kūkulu: ${why}`);
    return { ...out, data: { ...out.data, lag, workbench: { offered, laid: false, ...(seat || !tty ? { seat: true } : {}) } } };
  }
  // THE PREVIEW, before the question: where the files go (each wiki's working layer, canon untouched), then every title.
  ports.say(`kūkulu: the workbench lay carries each file under ${read.wikis}/<slug> into that wiki's working layer; canon stays as it stands:`);
  for (const b of mounted) {
    ports.say(`  ${b.slug} -> ${b.toBag}: ${b.planned.length}`);
    for (const t of b.planned) ports.say(`    ${t}`);
  }
  if (!(await ports.ask!(`lay these ${offered} carrier(s) into the workbench now?`))) {
    ports.say(`kūkulu: nothing laid; the workbench stands as it stood: ${WORKBENCH_LAY_LINE} lays it later`);
    return { ...out, data: { ...out.data, lag, workbench: { offered, laid: false } } };
  }
  const code = await ports.layWorkbench!();
  if (code === INTERRUPTED) {
    ports.say(`kūkulu: something interrupted the workbench lay; the house stands, and the lay reads diff-gated, so ${WORKBENCH_LAY_LINE} picks it up`);
    return { code: 1, data: { ...out.data, lag, workbench: { offered, laid: false, interrupted: true }, refusal: "kukulu-workbench-lay-interrupted" } };
  }
  if (code !== 0) {
    // A PAR LANDING READS GREEN: the house already stands balanced, so the lay's refusal rides as a warning with its cure line,
    // never the rite's red; `refusal` stays for a rite that truly failed.
    ports.say(`kūkulu: the workbench lay answered ${code}; the house stands, the lines above name what the lay refused, and the lay reads diff-gated, so ${WORKBENCH_LAY_LINE} runs again safely`);
    const warnings = [...(Array.isArray(out.data["warnings"]) ? (out.data["warnings"] as unknown[]) : []), "workbench-lay-waits"];
    return { ...out, data: { ...out.data, lag, workbench: { offered, laid: false }, warnings } };
  }
  ports.say(`kūkulu: the workbench laid: ${offered} carrier(s) from ${read.wikis}`);
  return { ...out, data: { ...out.data, lag, workbench: { offered, laid: true } } };
}

async function raiseHouse(ports: RitePorts, opts: { readonly branch?: string; readonly face?: number; readonly rollback?: true | string }): Promise<{ code: number; data: Record<string, unknown> }> {
  const forward = opts.rollback === undefined;
  // THE LEI READS FIRST, before the fetch, the image step, the tag and the seed: where none stands the rite offers to string one
  // on the spot (as the unlock offers the keep lei), and a no names the plain line before anything slow runs.
  let absentSaid = false, leiGone = false, leiLicenses = false;
  if (ports.leiStands) {
    const line = opts.branch ?? (await ports.checkout()).branch;
    const stands = await ports.leiStands(line, opts.face).catch(() => null);
    // A LEI THAT STANDS WITH RETURNS LEFT licenses a successor with no route; a spent one waits for its refill and licenses none.
    leiLicenses = stands === true;
    if (stands === false || stands === "absent") {
      const offer = ports.refill ? await ports.refill({ rite: "kukulu", branch: line, absent: true, returns: KUKULU_LEI_RETURNS, ...(opts.face === undefined ? { all: true } : { face: opts.face }) }) : null;
      if (offer?.strung === true) ports.say(`kūkulu: a kukulu lei of ${KUKULU_LEI_RETURNS} returns per lent face stands on ${line}; the rite goes on`);
      else { absentSaid = true; leiGone = true; ports.say(`kūkulu: no kukulu lei stands on ${line}, so the restand goes on with no rite${offer ? `; string one by hand first: ${offer.remedy}` : ""}`); }
    } else if (typeof stands === "string" && stands !== RETURNS_SPENT_REFUSAL) {
      leiGone = true;
      // A LEI THAT STANDS NOT FOR ANOTHER CAUSE names its own clearing line and asks nothing: stringing over a fork or a ward
      // refusal would answer a question nobody asked. A spent lei waits for the begin's own refill prompt, so the person hears it once.
      ports.say(`kūkulu: the kukulu lei on ${line} stands not (${stands}); ${leiClearing(stands, line, opts.face)}`);
    }
  }
  if (forward && ports.sync) {
    const synced = await ports.sync();
    ports.say(`kūkulu: ${synced.line}`);
    if (!synced.ok) return { code: 1, data: { rite: RITE_KUKULU, begun: false, stopped: "checkout", refusal: "kukulu-checkout-stops" } };
  }
  const checkout = await ports.checkout();
  const branch = opts.branch ?? checkout.branch;
  // THE IMAGE THIS RITE REPLACES, read before the stage moves its tag; every answer that raises names it.
  const prior = ports.prior ? await ports.prior().catch(() => null) : null;
  const target: StageTarget = forward ? { at: checkout.head } : opts.rollback === true ? { prior: true } : { at: opts.rollback as string };
  const staged = await ports.stage(target);
  if (staged.code !== 0 || staged.reading === null) {
    ports.say(`kūkulu: the shim's image step answered ${staged.code}${staged.reading === null && staged.code === 0 ? " and named no reading" : ""}; the vessel still stands as it stood, and no lei spent a return`);
    return { code: 1, data: { rite: RITE_KUKULU, branch, begun: false, stopped: "image" } };
  }
  let r = staged.reading;
  const head = r.revision, short = head.slice(0, 12);
  const base = { rite: RITE_KUKULU, branch, head, ...(forward ? {} : { rollback: true }) };
  const asFace = opts.face === undefined ? {} : { face: opts.face };
  // THE IMAGE BINDS THE BEGIN: the begin names the digest the host made; each landing names the digest the raised vessel RUNS (the
  // tag may move between the stage and the raise), so a landing over another image reads no par.
  const asImage = r.image === "" ? {} : { image: r.image };
  let landImage = r.image;
  /** The image the raised vessel runs read nowhere (a failed inspect): nothing lands, never over the staged digest. */
  let ranUnread = false;
  /** After a raise: the image the vessel runs, as its container reports it; a tag that moved since the stage says so. */
  const readRan = async (): Promise<void> => {
    if (!ports.ranImage) return;
    const ran = await ports.ranImage().catch(() => null);
    if (ran === null || ran === "") { ranUnread = true; return; }
    if (ran === r.image) return;
    ports.say(`kūkulu: the vessel runs ${ran}, not the image the begin bound (${r.image === "" ? "no digest" : r.image}); the tag moved between the stage and the raise, so the landing names the image that runs`);
    landImage = ran;
  };
  const tty = ports.tty ? ports.tty() : true;
  const pulama = r.pulama !== "off";
  if (r.pulama === "unread" || (pulama && r.pulama !== "absent" && r.pulama !== "moved" && r.lit === null)) {
    ports.say("kūkulu: whether the pūlama stands lit, or what it runs, reads unknown; read it with `tools/lares-container.sh pulama status`; nothing spent, nothing moved");
    return { code: 1, data: { ...base, begun: false, stopped: "pulama", refusal: "kukulu-pulama-unread" } };
  }
  // THE KUKULU LEI LICENSES THE SUCCESSOR where no successor names the moved closure yet (no route): the commit then rests, and the
  // stand reads as a hand's commit would (`vests`); this rite's own begin spends the lei's return, and the vest names it. A refusal
  // names its guard and the light stays owed. With no kukulu lei holding returns, or no successor to stand, nothing licenses one.
  // AT A TERMINAL the hand stands present and the light asks its route, so the rite takes no licensed step (the step refuses a terminal).
  if (r.keeper === "lei" && r.pulama === "moved" && r.lit === true && !tty && leiLicenses && ports.keeperStand && ports.keeperLeiSpend) {
    const spent = await ports.keeperLeiSpend(head, branch).catch(() => false);
    if (spent) { ports.say(`kūkulu: the kukulu lei on ${branch} licenses a successor naming the closure of ${short}; the rite's return spends on it, and the living fire passes with no route`); r = { ...r, keeper: "vests" }; }
    else ports.say("kūkulu: the keeper rested no commit under the kukulu lei (the lines above name the guard that refused), so the moved closure owes the light");
  }
  // A KEEPER MOVE RIDES A LIVE RITE: with no lei to begin one, a moved closure relights struck, so the light stays owed.
  const light = owesLight(leiGone || !ports.keeperStand ? { ...r, keeper: r.keeper === "vests" ? null : r.keeper ?? null } : r);
  const awaitsHand = (why: string, extra: Record<string, unknown> = {}) => {
    ports.say(`kūkulu: ${why}; the house stands as it stood, the image waits built, and nothing spent; your hand: ${HAND_ACT} on a terminal`);
    return { code: 0, data: { ...base, ...extra, begun: false, awaits: "hand", hand: HAND_ACT } };
  };
  // THE HOʻĀLA LEI LICENSES THE LIGHT, a moved closure included: the raise spends its return where the keeper stands dark, and steps
  // back to the prior keeper closure where the new code fails its waking. No hand gets asked while a return stands.
  if (light && !tty && r.hoala === true) ports.say(`kūkulu: the keeper owes its light (${r.pulama === "moved" ? "its code closure moved" : r.pulama === "absent" ? "no pūlama runs" : "it stands unlit"}), and a hoʻāla lei holds a return: the raise wakes the keeper under the lei with no route; the prior keeper image stays tagged as the rollback (lares rite kukulu --rollback)`);
  else if (light && !tty) {
    const why = r.pulama === "moved" ? (r.keeper === "struck-due" ? "the pūlama's code closure moved and the keeper's handed run owes the struck fire" : "the pūlama's code closure moved") : r.pulama === "absent" ? "no pūlama runs" : "the pūlama stands unlit";
    // A MOVED CLOSURE NAMES THE HANDED FIRE TOO: a successor on a terminal lets the next run vest the successor with no route.
    const handed = r.pulama === "moved" && r.lit === true && r.keeper !== "struck-due" ? " (or name its successor ahead on a terminal: lares pulama name-successor, and the next run hands it the living fire with no route; a kukulu lei with returns left on the line licenses that commit itself)" : "";
    return awaitsHand(`${why}, and its light reads your route on a terminal, which this seat holds none of${handed}`);
  }
  const tesseraeOf = (faces: readonly StandingBegin[]) => faces.map((f) => ({ face: f.face, tessera: f.tessera }));
  const resumeLine = (faces: readonly StandingBegin[]): string =>
    `kūkulu: resuming the begin ${r.offer && r.offerAt ? `of ${r.offerAt}` : `at ${short}`}; no lei spent (${faces.map((f) => `${f.face} tessera ${f.tessera}`).join(", ")})`;
  /** The owed landing, by hand: it names the head and image each begun half names (a landing that names others refuses). */
  const landCallOf = (faces: readonly StandingBegin[]): string =>
    faces.map((f) => `lares rite land --tessera ${f.tessera} --head ${f.head}${f.image === undefined || f.image === "" ? "" : ` --image ${f.image}`}${f.ordinal === undefined ? "" : ` --face ${f.ordinal}`}`).join("; ");
  /** The debt this run reads: what it resumes, or the refusal that names what it cannot (and the one line that clears it). */
  const judge = (read: Extract<StandingAnswer, { ok: true }>, image: string = r.image): { resume: readonly StandingBegin[]; offerMatches: boolean; unread: boolean } | { refusal: string; stale: readonly PendingBegin[]; line: string } => {
    // A READ THAT NAMES NO RAW DEBT reads the debt as UNKNOWN, never as empty: a half whose face stands shut or was rehived may rest
    // where it never looked. The rite resumes what it sees and names the rest as unread.
    const legacy = read.pending === undefined;
    const pending: readonly PendingBegin[] = read.pending ?? read.begins.map((b) => ({ tessera: b.tessera, group: b.face, head: b.head, face: b.face, ...(b.image === undefined ? {} : { image: b.image }) }));
    const landable = new Map(read.begins.map((b) => [b.tessera, b]));
    const why = (p: PendingBegin): string | null =>
      p.head !== head ? `another head than this run raises, ${short}`
      : !landable.has(p.tessera) ? "its face stands shut or rehived, so no lent face lands it"
      : !legacy && (p.image ?? "") !== image ? `another image than this run raises, ${image === "" ? "no digest" : image}`
      : null;
    const off = pending.flatMap((p) => { const w = why(p); return w === null ? [] : [{ p, w }]; });
    if (off.length === 0) {
      const resume = pending.map((p) => landable.get(p.tessera)!);
      const vouches = read.offer ?? [];
      const offerMatches = !legacy && resume.length > 0 && pending.every((p) => vouches.some((v) => v.group === p.group && v.branch === branch && v.head === head && v.image === image));
      return { resume, offerMatches, unread: legacy };
    }
    const heads = [...new Set(off.map(({ p }) => p.head))];
    const allStale = off.every(({ p }) => p.head !== head);
    const halves = off.map(({ p, w }) => `${p.face ?? p.group} tessera ${p.tessera} (begun at ${p.head.slice(0, 12)}${p.image === undefined ? "" : ` over ${p.image}`}: ${w})`).join(", ");
    // THE CLEARING LINE: each half a lent face holds, set down by the hand's abandon (a kāpae over it: it spends nothing, records
    // no par over an image the vessel never ran, and conferre reads it abandoned); a half no lent face holds waits for its face.
    const abandonLine = (p: PendingBegin): string => {
      const ordinal = landable.get(p.tessera)?.ordinal ?? opts.face;
      return `lares rite land --abandon --tessera ${p.tessera}${ordinal === undefined ? "" : ` --face ${ordinal}`}`;
    };
    const held = off.filter(({ p }) => landable.has(p.tessera)), waiting = off.filter(({ p }) => !landable.has(p.tessera));
    const clear = [
      ...(held.length > 0 ? [`set each down by hand (it spends nothing and records no par; conferre reads it abandoned): ${held.map(({ p }) => abandonLine(p)).join("; ")}`] : []),
      ...(waiting.length > 0 ? [`${waiting.map(({ p }) => `${p.face ?? p.group} tessera ${p.tessera}`).join(", ")} waits for its face to stand again`] : []),
    ].join("; ");
    // ONE OTHER HEAD for EVERY pending half, each landable there: the rite rolled back to it lands them at their own head instead.
    const back = allStale && heads.length === 1 && pending.every((p) => p.head === heads[0] && landable.has(p.tessera)) ? `; or land it at its own head: lares rite kukulu --rollback ${heads[0]!.slice(0, 12)} --branch ${branch}` : "";
    return {
      refusal: allStale ? BEGUN_STALE : BEGUN_UNMATCHED,
      stale: off.map(({ p }) => p),
      line: `a kūkulu begun and never landed stands on ${branch}, and this run cannot resume it: ${halves}; it never stacks a second begin. clear it with: ${clear}${back}`,
    };
  };
  const refuseDebt = (j: { refusal: string; stale: readonly PendingBegin[]; line: string }, extra: Record<string, unknown> = {}) => {
    ports.say(`kūkulu: ${j.line}; nothing spent, nothing moved`);
    return { code: 1, data: { ...base, ...extra, begun: false, stopped: j.refusal === BEGUN_STALE ? "begun-stale" : "begun-unmatched", refusal: j.refusal, stale: j.stale.map((p) => ({ face: p.face ?? p.group, tessera: p.tessera, head: p.head })) } };
  };
  /** After a clean raise and landing, the keep the down left owed runs (the raise deferred it to here). */
  const kept = async <T extends { code: number; data: Record<string, unknown> }>(out: T): Promise<T> => {
    if (out.code === 0 && out.data["awaits"] === undefined && ports.keepOwed) await ports.keepOwed();
    return out;
  };
  /** Land each begun face in the vessel that stands now; the rite reads par only where every pair reads par. */
  const landAll = async (faces: readonly StandingBegin[], data: Record<string, unknown>): Promise<{ code: number; data: Record<string, unknown> }> => {
    if (ranUnread) {
      ports.say(`kūkulu: the image the raised vessel runs reads nowhere, so no landing names it: \`${HAND_ACT}\` lands the halves once it reads, and spends no lei`);
      return { code: 1, data: { ...data, begun: true, landed: false, refusal: "kukulu-ran-image-unread" } };
    }
    let par = true;
    const differs: string[] = [];
    for (const f of faces) {
      const landed = await ports.row("rite-land", { tessera: f.tessera, head, ...(landImage === "" ? {} : { image: landImage }), ...(f.ordinal === undefined ? {} : { face: f.ordinal }) });
      if (landed.ok) { par = landed.output["par"] === true && par; continue; }
      // THE BEGUN HALF NAMES WHAT LANDS: a vessel that runs another head or image than the half began at (a tag that moved between
      // the stage and the raise) lands nothing; the half stays red (landed-absent) and the rite reports it unlanded below.
      if (landed.code === "rite-land-differs") { differs.push(f.face); continue; }
      if (landed.code === "vessel-locked") {
        ports.say(`kūkulu: the new vessel stands locked, so the host halves wait. Open it with \`lares vault unlock\`, then land the rite: ${landCallOf(faces)}`);
        return { code: 0, data: { ...data, begun: true, landed: false, awaits: "unlock" } };
      }
      ports.say(`kūkulu: the landing of ${f.face} refused: ${landed.message}`);
      return { code: 1, data: { ...data, begun: true, landed: false, refusal: landed.code } };
    }
    if (differs.length > 0) {
      // NO RECORD COMES OUT FALSE: no host half rests over an image the vessel never ran, so the rite reads landed:false, red, with
      // the way back where it names one.
      ports.say(`kūkulu: the vessel runs another head or image (${landImage === "" ? "no digest" : landImage}) than the rite began at, so no host half rests for ${differs.join(", ")}; conferre reads the begun half red (landed-absent)`);
      const wayBack = prior === null ? undefined : wayBackCommand(prior);
      if (wayBack !== undefined) ports.say(`kūkulu: to raise the replaced image ${prior!.tag} again, run: ${wayBack}`);
      return { code: 1, data: { ...data, begun: true, landed: false, par: false, refusal: "rite-land-differs", ...(wayBack === undefined ? {} : { wayBack }) } };
    }
    ports.say(par ? "kūkulu: landed; conferre reads every face's tessera par" : "kūkulu: landed at another head or image than the rite began at; conferre reads a tessera red");
    if (par || prior === null) return kept({ code: par ? 0 : 1, data: { ...data, begun: true, landed: true, par } });
    // OFF PAR, the way back: the rite rolled back to the replaced image's revision (its kept tag, no rebuild).
    const wayBack = wayBackCommand(prior);
    ports.say(`kūkulu: to raise the replaced image ${prior.tag} again, run: ${wayBack}`);
    return { code: 1, data: { ...data, begun: true, landed: true, par, wayBack } };
  };
  /**
   * AFTER THE RAISE, where the debt read nowhere before it (a vessel down at the start, or one standing locked at the floor): the
   * vessel the raise stood reads it now. A matched debt lands; a debt that does not match exits non-zero by name.
   */
  const landWhatStands = async (data: Record<string, unknown>): Promise<{ code: number; data: Record<string, unknown> }> => {
    if (!ports.standing) return kept({ code: 0, data });
    const read = await ports.standing(branch, opts.face);
    if (!read.ok) {
      ports.say(`kūkulu: the new vessel reads no begun halves (${read.message}); once it opens, \`${HAND_ACT}\` lands any that rest and spends no lei`);
      return { code: 1, data: { ...data, refusal: read.code, ...(read.code === "vessel-locked" ? { awaits: "unlock" } : {}) } };
    }
    const j = judge(read, landImage);
    if ("refusal" in j) {
      ports.say(`kūkulu: ${j.line}`);
      return { code: 1, data: { ...data, refusal: j.refusal, stale: j.stale.map((p) => ({ face: p.face ?? p.group, tessera: p.tessera, head: p.head })) } };
    }
    if (j.resume.length === 0) return kept({ code: 0, data });
    ports.say(resumeLine(j.resume));
    return landAll(j.resume, { ...data, tesserae: tesseraeOf(j.resume), resumed: true });
  };
  // THE DEBT THAT STANDS, read before anything spends. A run that stopped after its begin (a Ctrl+C at the census, the light or
  // the admit; a restand that refused) left each lent face's guest half resting unlanded. A debt that matches this run (its head,
  // the image the host made, every half landable) RESUMES: no second return, no new tessera. Any other debt refuses by name with
  // the one line that clears it, and never stacks a second begin. A vessel standing LOCKED AT THE FLOOR on this image (a Ctrl+C at
  // the admit) reads nothing yet: the restand opens it (its re-admit), and the rite reads the debt after.
  let resume: readonly StandingBegin[] = [];
  let offerMatches = false;
  /** The resting offer's base as the standing read named it: the offer below overwrites only over it. */
  let offerBase: string | null | undefined;
  let debtUnread = false;
  let readAfter = r.vessel === "down";
  if (r.vessel === "standing" && ports.standing) {
    const read = await ports.standing(branch, opts.face);
    if (!read.ok && read.code === "vessel-locked" && r.current) {
      readAfter = true;
      ports.say("kūkulu: the standing vessel stands locked at the floor, so its begun halves read nowhere yet; the restand opens it (its admit where owed), and the rite lands what it reads then");
    } else if (!read.ok) {
      ports.say(`kūkulu: the standing vessel reads no begun halves (${read.message}); nothing spent, nothing moved`);
      return { code: 1, data: { ...base, begun: false, stopped: "standing", refusal: read.code } };
    } else {
      const j = judge(read);
      if ("refusal" in j) return refuseDebt(j);
      resume = j.resume;
      offerMatches = j.offerMatches;
      offerBase = read.offerBase;
      if (j.unread) {
        debtUnread = true;
        ports.say("kūkulu: this vessel reads no raw debt, so a half whose face stands shut or was rehived reads nowhere; the rite resumes what it reads, and the debt beyond it stays unread");
        // UNREAD DEBT NEVER AUTHORIZES A FRESH BEGIN: with nothing to resume, the rite raises and reads the debt in the new vessel.
        if (resume.length === 0) readAfter = true;
      }
    }
  }
  // A QUIET DAY: the vessel already runs the image under a pūlama that owes no light; nothing to raise, nothing to spend. A debt
  // matched at this head lands after the top-up: the vessel runs the image of the head it began at.
  if (r.current && !light) {
    ports.say(resume.length > 0 ? resumeLine(resume) : debtUnread ? "kūkulu: no begin spends a return while the debt reads unread; the raise stands the new vessel, and the rite reads the debt there" : readAfter ? `kūkulu: the vessel already runs the image of ${short}; the restand opens it` : `kūkulu: the vessel already runs the image of ${short}; no rite spends a return`);
    const code = await ports.raise(head);
    if (code !== 0) return { code: 1, data: { ...base, begun: false, quiet: true, stopped: "raise", ...(code === INTERRUPTED ? { interrupted: true } : {}) } };
    await readRan();
    if (readAfter) return landWhatStands({ ...base, begun: false, quiet: true });
    if (resume.length === 0) return kept({ code: 0, data: { ...base, begun: false, quiet: true } });
    return landAll(resume, { ...base, tesserae: tesseraeOf(resume), quiet: true, resumed: true });
  }
  const spent: Record<string, unknown> = debtUnread ? { debt: "unread" } : {};
  if (prior !== null) {
    spent["prior"] = prior;
    ports.say(`kūkulu: the replaced image keeps the tag ${prior.tag} (revision ${prior.revision})`);
  }
  // THE SEED THE IMAGE OFFERS, said before anything spends; it reads and moves nothing. A rollback's image carries another
  // checkout's genesis, so it names none.
  if (forward && ports.seedOffer) {
    const offer = await ports.seedOffer(head);
    if (offer === null) ports.say("kūkulu: the host reads no founding record beside the seed this image offers; the rite goes on, and moves no ratchet");
    else {
      ports.say(kukuluSeedLine(head, offer));
      spent["seed"] = { cid: offer.seed.cid, ratchets: ratchetWords(compareGenesisDigests(offer.record, offer.seed.digests)) };
    }
  }
  // THE RITE, where a vessel stands to begin it: a kukulu lei standing grants the restand with no prompt. A matched debt is
  // resumed instead: it spent its returns once, and spends none again.
  let begunFaces: readonly StandingBegin[] = [];
  if (resume.length > 0) {
    begunFaces = resume;
    spent["tesserae"] = tesseraeOf(resume);
    spent["resumed"] = true;
    ports.say(resumeLine(resume));
  } else if (r.vessel === "standing" && !readAfter) {
    let begun = await ports.row("rite-begin", { rite: RITE_KUKULU, branch, head, ...asImage, ...asFace });
    let remedy = "";
    if (!begun.ok && begun.code === RETURNS_SPENT && ports.refill) {
      // A SPENT LEI OFFERS ITS OWN REFILL on a terminal, then the rite goes on; elsewhere the refusal names the plain line.
      const again = await ports.refill({ rite: "kukulu", branch, ...(opts.face === undefined ? { all: true } : { face: opts.face }) });
      if (again.strung) begun = await ports.row("rite-begin", { rite: RITE_KUKULU, branch, head, ...asImage, ...asFace });
      else remedy = `; string more by hand: ${again.remedy}`;
    }
    if (!begun.ok && begun.code === LEI_ABSENT) { if (!absentSaid) ports.say(`kūkulu: no kukulu lei stands on ${branch}, so the restand goes on with no rite`); }
    else if (!begun.ok) {
      ports.say(`kūkulu: the rite begins nothing: ${begun.message}${remedy}`);
      return { code: 1, data: { ...base, ...spent, begun: false, refusal: begun.code } };
    } else {
      begunFaces = (Array.isArray(begun.output["faces"]) ? begun.output["faces"] as Array<Record<string, unknown>> : [])
        .map((f) => ({ face: String(f["face"]), ordinal: Number(f["ordinal"]), tessera: String(f["tessera"]), head, ...asImage }));
      const waits = Array.isArray(begun.output["waits"]) ? (begun.output["waits"] as unknown[]).map(String) : [];
      spent["tesserae"] = tesseraeOf(begunFaces);
      if (waits.length > 0) spent["waits"] = waits;
      ports.say(`kūkulu: begun; each lent face's lei returned and its guest half rests (${begunFaces.map((f) => `${f.face} tessera ${f.tessera}`).join(", ")})`);
      for (const face of waits) ports.say(`kūkulu: ${face} carries no kukulu lei on this line and waits; the other faces' rite goes on`);
    }
  } else if (r.vessel === "standing" && debtUnread) ports.say("kūkulu: no begin spends a return while the debt reads unread; the raise stands the new vessel, and the rite reads the debt there");
  else if (r.vessel === "standing") ports.say("kūkulu: the vessel stands locked, so no rite begins; the raise opens it, and the rite lands what it reads then");
  else ports.say("kūkulu: no vessel stands, so no rite begins; the raise reads the offer that rests, the admitted set, or your admit");
  const begun = begunFaces.length > 0;
  // THE ADMIT GATE: a new vessel under a pūlama enters on an admission, a kukulu offer, or the hand's admit (a route).
  const raisesNew = !r.current || r.pulama === "absent" || r.pulama === "moved";
  // A HOʻĀLA LEI WITH A RETURN LEFT LICENSES THE ADMIT TOO: the raise admits the image under it, and no hand gets asked.
  if (pulama && !light && raisesNew && !begun && r.admitted !== true && !r.offer && !tty && r.hoala !== true) {
    return awaitsHand(`the pūlama has not admitted the image of ${short}, no kukulu lei carries it, and its admit reads your route on a terminal (or string a lei first: lares lei kui --rite kukulu --branch ${branch} --returns <n> --all)`, spent);
  }
  const landCall = landCallOf(begunFaces);
  let offered = false;
  let keeperMove: { readonly to: string; readonly closure: string } | null = null;
  if (begun) {
    // BEFORE THE LOWERING, the standing vessel writes what the next one carries to the pūlama, over the image the host made. A
    // resumed begin reuses the resting offer only where its vouches match every pending half (group, line, head, image); any
    // other offer is written afresh over the image this begin binds, which spends nothing.
    if (offerMatches) {
      offered = true;
      ports.say(`kūkulu: the offer the begin rested still vouches for each pending face over ${r.image}; reused, none written`);
    } else if (r.image === "") ports.say("kūkulu: the host names no digest for the image, so no offer rests for a pūlama; the rite goes on, and a vessel standing by a pūlama will wake at the floor.");
    else {
      // THE KEEPER MOVE rides this rite's vouches: the successor stands now and offers its key, before the offer is signed.
      if (r.keeper === "vests" && r.lit === true && ports.keeperStand) {
        const stood = await ports.keeperStand().catch(() => null);
        if (stood === null) ports.say("kūkulu: no successor keeper stood beside the lit one, so this rite carries no keeper move and the raise relights the pūlama struck (your passphrase on a terminal)");
        else { keeperMove = stood; ports.say(`kūkulu: the successor keeper stands and offers its one-handoff key; the vouches name the move to closure ${stood.closure.slice(0, 19)}`); }
      }
      const offer = await ports.row("rite-offer", { branch, head, image: r.image, ...asFace, ...(keeperMove ? { keeperTo: keeperMove.to, keeperNext: keeperMove.closure } : {}), ...(typeof offerBase === "string" ? { base: offerBase } : {}) });
      if (!offer.ok) {
        ports.say(`kūkulu: the standing vessel wrote no offer (${offer.message}); it still stands, the lei's return stays spent, and the begun half reads red until a vessel at ${head} lands it (${landCall}); \`${HAND_ACT}\` resumes it and spends no lei.`);
        return { code: 1, data: { ...base, ...spent, begun: true, landed: false, stopped: "offer", refusal: offer.code } };
      }
      offered = true;
      const names = (key: string): string[] => (Array.isArray(offer.output[key]) ? (offer.output[key] as unknown[]).map(String) : []);
      const faces = names("faces"), waits = names("waits");
      ports.say(`kūkulu: the offer rests for the next vessel (${String(offer.output["lei"] ?? "?")} lei, a vouch for each of ${faces.length > 0 ? faces.join(", ") : "the lent faces"} over ${r.image})`);
      for (const face of waits) ports.say(`kūkulu: ${face} carries no lei on this line and waits at the pūlama by name; the other faces' lend stands`);
    }
  }
  if (restandStops(r)) ports.say(STOP_FLUSHES_LINE);
  const raised = await ports.raise(head, keeperMove ? { to: keeperMove.to } : undefined);
  if (raised !== 0) {
    // A CTRL+C at a prompt the restand asks (accept-loss, the light, the admit) ends the shim by the signal: the begun halves and
    // the offer rest where they stood, and the next run reads them and resumes.
    if (raised === INTERRUPTED) {
      ports.say(`kūkulu: interrupted during the restand; ${begun ? `the begun halves rest${offered ? " and the offer stands" : ""}, so \`${HAND_ACT}\` resumes them and spends no lei` : `\`${HAND_ACT}\` picks up from where the house stands`}.`);
      return { code: 1, data: { ...base, ...spent, begun, landed: false, stopped: "raise", interrupted: true } };
    }
    ports.say(`kūkulu: the shim's restand answered ${raised}; the lines above name where it stopped, and \`${HAND_ACT}\` picks up from where the house stands${begun ? `; the lei's return stays spent, and the begun half waits for its landing: the next run resumes it and spends no lei (or land it by hand at ${head}: ${landCall})` : ""}.`);
    return { code: 1, data: { ...base, ...spent, begun, landed: false, stopped: "raise" } };
  }
  await readRan();
  if (!begun) return readAfter ? landWhatStands({ ...base, ...spent, begun: false, raised: true }) : kept({ code: 0, data: { ...base, ...spent, begun: false, raised: true } });
  return landAll(begunFaces, { ...base, ...spent });
}
