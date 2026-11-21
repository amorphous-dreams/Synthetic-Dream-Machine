/**
 * rite-kukulu — the kūkulu rite's order: the ONE human verb that raises the house again around its hearth, with a tessera
 * kept across the gap wherever a kukulu lei stands.
 *
 * It reads where the house stands on every run and walks only what remains, so a run that stopped picks up wherever the
 * house stands; no file remembers a half-done run. The rite runs on the host, behind its ports, in one order:
 *
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
 *                   code moved, up, its admit attached where owed, the vessel's unlock and the face last worn
 *   8. rite-land    IN THE NEW VESSEL: each face's host half (`rite-landed`); the rite reads par only where every pair reads par
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
import { compareGenesisDigests, ratchetWords, ratchetsDiffer, type GenesisDigests } from "@lararium/mesh";

export type RiteVerbAnswer =
  | { readonly ok: true; readonly output: Record<string, unknown> }
  | { readonly ok: false; readonly code: string; readonly message: string };

/** The refusal a rite stops on where its lei spent every return. */
export const RETURNS_SPENT = "swarm-lei-returns-spent";
/** The refusal a begin answers where no kukulu lei stands on the line: the restand goes on with no rite. */
export const LEI_ABSENT = "swarm-lei-absent";

/** A spent line's refill: the rite, the branch, the face (or every open face), and the returns the spent lei carried where known. */
export interface RefillReq { readonly rite: "keep" | "kukulu"; readonly branch: string; readonly face?: number; readonly all?: boolean; readonly returns?: number }
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
export interface StandingBegin { readonly face: string; readonly ordinal?: number; readonly tessera: string; readonly head: string }
/** The standing read: every begin resting unlanded on the line, or the vessel's refusal. */
export type StandingAnswer = { readonly ok: true; readonly begins: readonly StandingBegin[] } | { readonly ok: false; readonly code: string; readonly message: string };

/** The refusal a run answers where a begin stands unlanded at another head than the one it raises. */
export const BEGUN_STALE = "kukulu-begun-stale";
/** The exit a shim answers when a Ctrl+C ended it (128 + SIGINT). */
export const INTERRUPTED = 130;

export interface RitePorts {
  /** The checkout's head and the branch it rides. */
  checkout(): Promise<{ readonly head: string; readonly branch: string }>;
  /** Fetch and fast-forward the checkout (forward only); absent, the checkout stands as it stands. */
  sync?(): Promise<SyncAnswer>;
  /** The shim's image step and its reading of the house (`rebuild --image`); the answer carries its exit code. */
  stage(target: StageTarget): Promise<{ readonly code: number; readonly reading: StandReading | null }>;
  /** The shim's restand onto the image of the revision (`rebuild --at <rev>`); the answer carries its exit code. */
  raise(revision: string): Promise<number>;
  /** A terminal on both ends, where a route can be typed; absent, the rite reads one. */
  tty?(): boolean;
  /** One store row, answered by the vessel that stands. */
  row(verb: "rite-begin" | "rite-land" | "rite-offer", args: Record<string, unknown>): Promise<RiteVerbAnswer>;
  /**
   * Every kūkulu begin resting unlanded on the branch's line, read by the vessel that stands (`rite receipts --rite kukulu`).
   * Absent, the rite reads none and begins as it did.
   */
  standing?(branch: string): Promise<StandingAnswer>;
  /** Where a spent kūkulu lei is offered its refill inline; absent, the rite refuses as it did. */
  refill?: RefillPort;
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
}

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
    ? `kūkulu: the image at ${head} offers seed ${offer.seed.cid} beside the founding record: a newer seed waits: ${ratchetWords(ratchets)}; the founding record keeps serving, and the kūkulu moves no ratchet`
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

/** Whether the day owes the pūlama a light: none runs, its code moved, or it stands unlit. */
export const owesLight = (r: StandReading): boolean => r.pulama === "absent" || r.pulama === "moved" || r.lit === false;

/**
 * `face` names the face the begin's and the offer's sessions act as where several faces stand open; each row still gathers
 * every lent face, one lei and one vouch apiece. Naming none, the rows name none, and their sessions ride the face the operator
 * wears. `rollback` stands the image that ran before (`true`) or the image of an older revision, with no checkout move.
 */
export async function riteKukulu(ports: RitePorts, opts: { readonly branch?: string; readonly face?: number; readonly rollback?: true | string }): Promise<{ code: number; data: Record<string, unknown> }> {
  const forward = opts.rollback === undefined;
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
  const r = staged.reading, head = r.revision, short = head.slice(0, 12);
  const base = { rite: RITE_KUKULU, branch, head, ...(forward ? {} : { rollback: true }) };
  const asFace = opts.face === undefined ? {} : { face: opts.face };
  const tty = ports.tty ? ports.tty() : true;
  const pulama = r.pulama !== "off";
  if (r.pulama === "unread" || (pulama && r.pulama !== "absent" && r.pulama !== "moved" && r.lit === null)) {
    ports.say("kūkulu: whether the pūlama stands lit, or what it runs, reads unknown; read it with `tools/lares-container.sh pulama status`; nothing spent, nothing moved");
    return { code: 1, data: { ...base, begun: false, stopped: "pulama", refusal: "kukulu-pulama-unread" } };
  }
  const light = owesLight(r);
  const awaitsHand = (why: string, extra: Record<string, unknown> = {}) => {
    ports.say(`kūkulu: ${why}; the house stands as it stood, the image waits built, and nothing spent; your hand: ${HAND_ACT} on a terminal`);
    return { code: 0, data: { ...base, ...extra, begun: false, awaits: "hand", hand: HAND_ACT } };
  };
  if (light && !tty) {
    const why = r.pulama === "moved" ? "the pūlama's code closure moved" : r.pulama === "absent" ? "no pūlama runs" : "the pūlama stands unlit";
    return awaitsHand(`${why}, and its light reads your route on a terminal, which this seat holds none of`);
  }
  // THE BEGIN THAT STANDS, read before anything spends. A run that stopped after its begin (a Ctrl+C at the census, the light or
  // the admit; a restand that refused) left each lent face's guest half resting unlanded. At this head the rite RESUMES it: no
  // second return, no new tessera. At another head (the operator pulled meanwhile) it refuses by name with the one line that
  // clears it, and never stacks a second begin.
  let resume: readonly StandingBegin[] = [];
  if (r.vessel === "standing" && ports.standing) {
    const read = await ports.standing(branch);
    if (!read.ok) {
      ports.say(`kūkulu: the standing vessel reads no begun halves (${read.message}); nothing spent, nothing moved`);
      return { code: 1, data: { ...base, begun: false, stopped: "standing", refusal: read.code } };
    }
    const stale = read.begins.filter((b) => b.head !== head);
    if (stale.length > 0) {
      ports.say(`kūkulu: ${staleLine(stale, short)}; nothing spent, nothing moved`);
      return { code: 1, data: { ...base, begun: false, stopped: "begun-stale", refusal: BEGUN_STALE, stale: stale.map((b) => ({ face: b.face, tessera: b.tessera, head: b.head })) } };
    }
    resume = read.begins;
  }
  const tesseraeOf = (faces: readonly StandingBegin[]) => faces.map((f) => ({ face: f.face, tessera: f.tessera }));
  const resumeLine = (faces: readonly StandingBegin[]): string =>
    `kūkulu: resuming the begin ${r.offer && r.offerAt ? `of ${r.offerAt}` : `at ${short}`}; no lei spent (${faces.map((f) => `${f.face} tessera ${f.tessera}`).join(", ")})`;
  const landCallOf = (faces: readonly StandingBegin[]): string =>
    faces.map((f) => `lares rite land --tessera ${f.tessera} --head ${head}${f.ordinal === undefined ? "" : ` --face ${f.ordinal}`}`).join("; ");
  /** Land each begun face in the vessel that stands now; the rite reads par only where every pair reads par. */
  const landAll = async (faces: readonly StandingBegin[], data: Record<string, unknown>): Promise<{ code: number; data: Record<string, unknown> }> => {
    let par = true;
    for (const f of faces) {
      const landed = await ports.row("rite-land", { tessera: f.tessera, head, ...(f.ordinal === undefined ? {} : { face: f.ordinal }) });
      if (landed.ok) { par = landed.output["par"] === true && par; continue; }
      if (landed.code === "vessel-locked") {
        ports.say(`kūkulu: the new vessel stands locked, so the host halves wait. Open it with \`lares vault unlock\`, then land the rite: ${landCallOf(faces)}`);
        return { code: 0, data: { ...data, begun: true, landed: false, awaits: "unlock" } };
      }
      ports.say(`kūkulu: the landing of ${f.face} refused: ${landed.message}`);
      return { code: 1, data: { ...data, begun: true, landed: false, refusal: landed.code } };
    }
    ports.say(par ? "kūkulu: landed; conferre reads every face's tessera par" : "kūkulu: landed at another head than the rite began at; conferre reads a tessera red");
    if (par || prior === null) return { code: par ? 0 : 1, data: { ...data, begun: true, landed: true, par } };
    // OFF PAR, the way back: the rite rolled back to the replaced image's revision (its kept tag, no rebuild).
    const wayBack = wayBackCommand(prior);
    ports.say(`kūkulu: to raise the replaced image ${prior.tag} again, run: ${wayBack}`);
    return { code: 1, data: { ...data, begun: true, landed: true, par, wayBack } };
  };
  // A QUIET DAY: the vessel already runs the image under a pūlama that owes no light; nothing to raise, nothing to spend. A begin
  // standing at this head lands after the top-up: the vessel runs the image of the head it began at.
  if (r.current && !light) {
    ports.say(resume.length > 0 ? resumeLine(resume) : `kūkulu: the vessel already runs the image of ${short}; no rite spends a return`);
    const code = await ports.raise(head);
    if (code !== 0 || resume.length === 0) return { code: code === 0 ? 0 : 1, data: { ...base, begun: false, quiet: true, ...(code === 0 ? {} : { stopped: "raise", ...(code === INTERRUPTED ? { interrupted: true } : {}) }) } };
    return landAll(resume, { ...base, tesserae: tesseraeOf(resume), quiet: true, resumed: true });
  }
  const spent: Record<string, unknown> = {};
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
  // THE RITE, where a vessel stands to begin it: a kukulu lei standing grants the restand with no prompt. A begin already
  // standing at this head is resumed instead: it spent its returns once, and spends none again.
  let begunFaces: readonly StandingBegin[] = [];
  if (resume.length > 0) {
    begunFaces = resume;
    spent["tesserae"] = tesseraeOf(resume);
    spent["resumed"] = true;
    ports.say(resumeLine(resume));
  } else if (r.vessel === "standing") {
    let begun = await ports.row("rite-begin", { rite: RITE_KUKULU, branch, head, ...asFace });
    let remedy = "";
    if (!begun.ok && begun.code === RETURNS_SPENT && ports.refill) {
      // A SPENT LEI OFFERS ITS OWN REFILL on a terminal, then the rite goes on; elsewhere the refusal names the plain line.
      const again = await ports.refill({ rite: "kukulu", branch, ...(opts.face === undefined ? { all: true } : { face: opts.face }) });
      if (again.strung) begun = await ports.row("rite-begin", { rite: RITE_KUKULU, branch, head, ...asFace });
      else remedy = `; string more by hand: ${again.remedy}`;
    }
    if (!begun.ok && begun.code === LEI_ABSENT) ports.say(`kūkulu: no kukulu lei stands on ${branch}, so the restand goes on with no rite`);
    else if (!begun.ok) {
      ports.say(`kūkulu: the rite begins nothing: ${begun.message}${remedy}`);
      return { code: 1, data: { ...base, ...spent, begun: false, refusal: begun.code } };
    } else {
      begunFaces = (Array.isArray(begun.output["faces"]) ? begun.output["faces"] as Array<Record<string, unknown>> : [])
        .map((f) => ({ face: String(f["face"]), ordinal: Number(f["ordinal"]), tessera: String(f["tessera"]), head }));
      const waits = Array.isArray(begun.output["waits"]) ? (begun.output["waits"] as unknown[]).map(String) : [];
      spent["tesserae"] = tesseraeOf(begunFaces);
      if (waits.length > 0) spent["waits"] = waits;
      ports.say(`kūkulu: begun; each lent face's lei returned and its guest half rests (${begunFaces.map((f) => `${f.face} tessera ${f.tessera}`).join(", ")})`);
      for (const face of waits) ports.say(`kūkulu: ${face} carries no kukulu lei on this line and waits; the other faces' rite goes on`);
    }
  } else ports.say("kūkulu: no vessel stands, so no rite begins; the raise reads the offer that rests, the admitted set, or your admit");
  const begun = begunFaces.length > 0;
  // THE ADMIT GATE: a new vessel under a pūlama enters on an admission, a kukulu offer, or the hand's admit (a route).
  const raisesNew = !r.current || r.pulama === "absent" || r.pulama === "moved";
  if (pulama && !light && raisesNew && !begun && r.admitted !== true && !r.offer && !tty) {
    return awaitsHand(`the pūlama has not admitted the image of ${short}, no kukulu lei carries it, and its admit reads your route on a terminal (or string a lei first: lares lei kui --rite kukulu --branch ${branch} --returns <n> --all)`, spent);
  }
  const landCall = landCallOf(begunFaces);
  let offered = false;
  if (begun) {
    // BEFORE THE LOWERING, the standing vessel writes what the next one carries to the pūlama, over the image the host made. A
    // resumed begin whose offer still rests for this image reuses it: the offer carries signed lei and vouches, and writing it
    // again spends nothing but would read the line anew.
    if (spent["resumed"] === true && r.offer) {
      offered = true;
      ports.say(`kūkulu: the offer the begin rested still stands for the next vessel over ${r.image}; reused, none written`);
    } else if (r.image === "") ports.say("kūkulu: the host names no digest for the image, so no offer rests for a pūlama; the rite goes on, and a vessel standing by a pūlama will wake at the floor.");
    else {
      const offer = await ports.row("rite-offer", { branch, head, image: r.image, ...asFace });
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
  const raised = await ports.raise(head);
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
  if (!begun) {
    // A VESSEL THAT STOOD DOWN at the start (a Ctrl+C at the light left it so) held its begun halves out of reach; the vessel the
    // raise stood reads them now, and the rite lands each one that began at this head.
    if (r.vessel === "down" && ports.standing) {
      const read = await ports.standing(branch);
      if (!read.ok) {
        ports.say(`kūkulu: the new vessel reads no begun halves (${read.message}); once it opens, \`${HAND_ACT}\` lands any that rest and spends no lei`);
        return { code: 0, data: { ...base, ...spent, begun: false, raised: true, ...(read.code === "vessel-locked" ? { awaits: "unlock" } : {}) } };
      }
      const here = read.begins.filter((b) => b.head === head), stale = read.begins.filter((b) => b.head !== head);
      if (stale.length > 0) ports.say(`kūkulu: ${staleLine(stale, short)}`);
      if (here.length > 0) {
        ports.say(resumeLine(here));
        return landAll(here, { ...base, ...spent, tesserae: tesseraeOf(here), resumed: true });
      }
    }
    return { code: 0, data: { ...base, ...spent, begun: false, raised: true } };
  }
  return landAll(begunFaces, { ...base, ...spent });
}

/**
 * A begin standing at another head than the run raises: it names the halves and the one line that clears it (the rite rolled
 * back to that head resumes and lands it there, spending no lei), and the rite stacks no second begin.
 */
function staleLine(stale: readonly StandingBegin[], short: string): string {
  const heads = [...new Set(stale.map((b) => b.head.slice(0, 12)))];
  return `a kūkulu begun at ${heads.join(", ")} stands unlanded (${stale.map((b) => `${b.face} tessera ${b.tessera}`).join(", ")}), and this run raises ${short}; it never stacks a second begin. clear it with: ${heads.map((h) => `lares rite kukulu --rollback ${h}`).join("; then ")} (it lands that begin at its own head and spends no lei), then run ${HAND_ACT} again`;
}
