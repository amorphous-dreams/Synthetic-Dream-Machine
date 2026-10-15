/**
 * runNexusKapae / runNexusKapaeList — the RAISE side of the Kapae immune antigen (#65): the founding kahu
 * WRITES a quorum-signed ban (`kapae`) or lift (`un_kapae`) onto the always-carried antigen BOARD, and reads
 * the currently-Kapae'd set back. The READER (`antigen-board`) + the ENFORCE shore (`antigen-ring`,
 * `carryContractShareDecision`) already stand; this is the writer they were missing.
 *
 * Node-specific shores (only these belong here):
 *   - the store's one holder (`repo`): the standing vessel's own Repo, or the direct holder's (`ownedStore`)
 *   - readNexusDoc off `bags/nexus` (the roster's authority home) → foundingRoster
 *   - the held-quorum selector (`held-quorum`): the seats of the roster whose own keys this vessel holds
 *   - loadVesselVerifyingKey (the node's own gate key — the board's per-island deterministic address seed)
 *
 * The signing, the quorum SHAPE, the fold/verify, and the board tiddler shape stay in @lararium/mesh
 * (platform-blind). This adapter carries no crypto and no ban policy — it composes the mesh primitives.
 *
 * FAIL CLOSED, at every shore:
 *   - an unseated / quorum-short charter → REFUSE (nothing to root a quorum on); no board write.
 *   - fewer than `threshold` HELD seat keys that sit IN the seated roster → REFUSE; no sub-quorum entry.
 *   - an entry that does not verify against the seated roster → REFUSE; never write an unverifiable ban.
 *   - a malformed nym (not a 64-hex ed25519 verifying key) → REFUSE.
 *
 * The a-multitude-of-one ceremony: one operator holds all three founding seats' keys, so a 2-of-3 quorum
 * signs with 2 of their OWN held seat keys.
 *
 * TWO VAULTS, ONE ACT (kapae#/edge-hands). A Nexus whose seats rest in two vaults (a two-founder Nexus) signs no
 * kapae or lift whole in either. `runNexusKapaeOpen` signs with every seat of the head roster this vessel holds and
 * hands back a PARTIAL (`nexus-partial`) that carries the whole act and writes no board; the other vault's
 * `runNexusKapaePartial` judges it against its own charter head and antigen board, cosigns with the seats it holds
 * only where the judge reads `ready`, and lands the act once it reads `complete`, judging again right before the
 * write (`partial-landing`). The first vault lands the completed partial the same way. A stale head, a moved line,
 * a missing parent, a replay or a foreign Nexus writes no signature and no board act. `aid` names a charter this
 * vessel carries (a joint Nexus files under its own AID beside the seed); absent, the primary.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/carry-contract#/kapae-the-antigen
 */

import type { Repo } from "@automerge/automerge-repo";
import {
  antigenEntriesFromBoard, antigenActCid, writeAntigenEntry, signAntigenEntry,
  makeMultiSigQuorumVerifier, foldAntigenSet, isKapaed, foundingRoster, nexusAidOf,
  kapaeAntigenDocUrl, materializeSharedLarDoc,
  judgeNexusActPartial, cosignNexusActPartial, nexusActPartial, readNexusActPartial, NexusPartialRefusal,
  type NexusActPartial, type NexusPartialReader, type PartialVerdict,
  type KapaeAction, type KapaeAntigenEntry, type KahuQuorumSeats,
} from "@lararium/mesh";
import { readNexusDoc } from "../nexus-doc.js";
import { loadVesselVerifyingKey } from "../node-vessel-identity.js";
import { heldSeatSigners, selectHeldQuorumSigners } from "../held-quorum.js";
import { nodeNexusIsland } from "../nexus-standing.js";
import { charterHomeFor } from "../carried-set.js";
import { judgeStillBeforeWrite } from "../partial-landing.js";

/** A ban target reads clean only at the exact ed25519 verifying-key length — a stray value never bans. */
const NYM_RE = /^[0-9a-f]{64}$/;

/** A REFUSAL the CLI renders as a clean fail-closed message (never a stack, never a partial write). */
export class NexusKapaeError extends Error {}

export interface NexusKapaeOptions {
  readonly action:     KapaeAction;
  readonly nym:        string;
  readonly reason?:    string;
  /** The charter DOC's authority home (the CLI supplies `larSealHome()`). */
  readonly sealHome:    string;
  /** The store's one holder: the standing vessel's own Repo, or the direct holder's (`ownedStore`). */
  readonly repo:       Repo;
  /** The Nexus the act lands under, where this vessel carries its charter beside the primary; absent names the primary. */
  readonly aid?:       string;
}

export interface NexusKapaeResult {
  readonly action:          KapaeAction;
  readonly nym:             string;
  readonly actCid:          string;
  readonly parents:         readonly string[];
  readonly sealEpochCid: string;
  readonly threshold:       number;
  /** The verifying keys that signed the entry (the held seat keys that met the quorum). */
  readonly signers:         readonly string[];
  readonly boardUrl:        string;
  /** Whether the nym stands Kapae'd AFTER this write folds against the seated roster. */
  readonly kapaedNow:       boolean;
}

export interface NexusKapaeListResult {
  readonly sealEpochCid: string;
  readonly threshold:       number;
  readonly seatedKeys:      number;
  /** The currently-Kapae'd nym set (folded + quorum-verified against the seated roster). */
  readonly kapaed:          readonly string[];
  /** Every well-formed board entry (pre-verify shape read) — surfaces the raw antigen for the operator. */
  readonly entries:         ReadonlyArray<{ nym: string; action: KapaeAction; actCid: string; parents: readonly string[]; signers: number }>;
}

/** Read the seated roster off disk, FAILING CLOSED when no live quorum stands to root a ban on. */
function seatedRosterOrRefuse(sealHome: string): KahuQuorumSeats {
  const roster = foundingRoster(readNexusDoc(sealHome));
  if (roster.sealEpochCid.length === 0 || roster.keys.length < roster.threshold) {
    throw new NexusKapaeError(
      "no seated founding-kahu quorum to root a ban on — run `lares nexus seal seat` first (the antigen stays inert until a quorum stands).",
    );
  }
  return roster;
}

/** The antigen door's sub-quorum refusal — it names the act a short quorum would have minted. */
const subQuorum = (held: number, k: number): NexusKapaeError => new NexusKapaeError(
  `sub-quorum REFUSED (fail-closed): the vessel holds ${held} seat key(s) of the seated roster, but a valid antigen act carries ${k} distinct founding-kahu signatures. ` +
  `Where the other seats rest in another vault, the act crosses as a partial: \`lares nexus kapae <nym> --nexus <aid> --out <file>\` here, then \`--from <file>\` there.`,
);

/** The charter home an act reads: the carried charter `aid` names, else the primary. Refuses an AID this vessel never carried. */
function charterHomeOrRefuse(sealHome: string, aid: string | undefined): string {
  if (aid === undefined) return sealHome;
  const home = charterHomeFor(sealHome, aid.trim().toLowerCase());
  if (home === null) throw new NexusKapaeError(`this vessel holds no charter for ${aid.slice(0, 18)}… — import or found it first.`);
  return home;
}

const nymOrRefuse = (raw: string): string => {
  const nym = raw.trim().toLowerCase();
  if (!NYM_RE.test(nym)) throw new NexusKapaeError(`"${raw}" is not a valid presenter nym — expected a 64-hex ed25519 verifying key.`);
  return nym;
};

/**
 * The antigen board one charter's island names on this vessel. The PRIMARY charter's board resolves exactly as the
 * boot resolves the island it hands the antigen ring (the vessel's own seal home), so a ban the door lands is the
 * ban the ring folds. A CARRIED charter (`carried` names its home) keys on that charter's own home, the way the
 * contract door keys its carriage board.
 */
async function antigenBoardFor(repo: Repo, carried?: string): Promise<{ boardUrl: string; handle: Awaited<ReturnType<typeof materializeSharedLarDoc>> }> {
  const ownVesselKey = await loadVesselVerifyingKey();
  const boardIsland = carried === undefined ? nodeNexusIsland({ ownVesselKey }) : nodeNexusIsland({ ownVesselKey, sealHome: carried });
  const boardUrl = kapaeAntigenDocUrl(boardIsland);
  return { boardUrl, handle: await materializeSharedLarDoc(repo, boardUrl, "board:kapae-antigen") };
}

/** The home a carried charter reads from, or undefined for the primary (whose board the boot resolves). */
const carriedHome = (sealHome: string, home: string): string | undefined => (home === sealHome ? undefined : home);

/**
 * The observed local causal frontier for one nym's antigen line. Raw board records are untrusted input: a tampered
 * semantic CID, wrong-charter quorum, or missing parent must never become a parent of this act.
 */
async function antigenFrontier(entries: readonly KapaeAntigenEntry[], nym: string, roster: KahuQuorumSeats): Promise<string[]> {
  const verifier = makeMultiSigQuorumVerifier();
  const verified = (await Promise.all(entries.filter((e) => e.nym === nym).map(async (e) => {
    if (e.actCid !== antigenActCid(e)) return null;
    if (!(await verifier.verifyQuorum(e, roster))) return null;
    return e;
  }))).filter((e): e is NonNullable<typeof e> => e !== null);
  // Causal closure is iterative: a locally present parent may itself name an absent grandparent.
  // Remove that branch until no unavailable ancestry remains; one pass would poison the next frontier.
  let admissible = verified;
  for (;;) {
    const ids = new Set(admissible.map((e) => e.actCid));
    const closed = admissible.filter((e) => e.parents.every((p) => ids.has(p)));
    if (closed.length === admissible.length) break;
    admissible = closed;
  }
  const covered = new Set(admissible.flatMap((e) => e.parents));
  return admissible.filter((e) => !covered.has(e.actCid)).map((e) => e.actCid).sort();
}

/**
 * Land one signed entry on the antigen board. NEVER write an entry that will not verify — the fold would ignore
 * it, so a written-but-dead ban would read as enforced while enforcing nothing. `beforeWrite` runs the last check
 * against the board as it stands at the write; the write follows it with no await between. Re-folds the board to
 * report the ACTUAL enforced state (not the intent) — the loop the ring reads.
 */
async function landAntigenEntry(repo: Repo, handle: Awaited<ReturnType<typeof materializeSharedLarDoc>>, boardUrl: string,
  roster: KahuQuorumSeats, entry: KapaeAntigenEntry, signers: readonly string[], beforeWrite?: () => Promise<void>): Promise<NexusKapaeResult> {
  const verifier = makeMultiSigQuorumVerifier();
  if (!(await verifier.verifyQuorum(entry, roster))) {
    throw new NexusKapaeError("refusing to write: the signed entry does not verify against the seated roster (fail-closed).");
  }
  if (beforeWrite) await beforeWrite();
  handle.change((d) => writeAntigenEntry(d, entry));
  await repo.flush();
  const folded = await foldAntigenSet(antigenEntriesFromBoard(handle.doc()), roster, verifier);
  return {
    action: entry.action, nym: entry.nym, actCid: entry.actCid, parents: entry.parents,
    sealEpochCid: roster.sealEpochCid, threshold: roster.threshold, signers, boardUrl, kapaedNow: isKapaed(entry.nym, folded),
  };
}

/**
 * Raise a ban (`kapae`) or mint a lift (`un_kapae`) on `nym` — sign a causal antigen entry with ≥ threshold
 * held founding seat keys and LAND it on the always-carried board. The command observes the local causal
 * frontier and cites every admissible head as a parent; no scalar next-version is minted or accepted. FAILS CLOSED
 * before any write: unseated charter, sub-quorum, malformed
 * nym, or a self-verify miss all REFUSE with nothing written.
 */
export async function runNexusKapae(opts: NexusKapaeOptions): Promise<NexusKapaeResult> {
  const nym      = nymOrRefuse(opts.nym);
  const home     = charterHomeOrRefuse(opts.sealHome, opts.aid);
  const roster   = seatedRosterOrRefuse(home);
  const selected = await selectHeldQuorumSigners(roster, subQuorum);
  const repo     = opts.repo;
  try {
    const { boardUrl, handle } = await antigenBoardFor(repo, carriedHome(opts.sealHome, home));
    const parents = await antigenFrontier(antigenEntriesFromBoard(handle.doc()), nym, roster);
    // Sign with the held seats' own keys: each hand opens its one cold row for its one signature (mesh holds
    // no key). A vessel that holds no seat row never reaches this branch.
    const entry: KapaeAntigenEntry = await signAntigenEntry(
      { nym, action: opts.action, parents, sealEpochCid: roster.sealEpochCid },
      selected.map((s) => ({ signer: s.verifyingKey, sign: s.sign })),
    );
    return await landAntigenEntry(repo, handle, boardUrl, roster, entry, selected.map((s) => s.verifyingKey));
  } finally {
    await repo.flush().catch(() => { /* best-effort final flush on the finally path */ });
  }
}

/** What a partial step answers: the partial as it stands, the judge's verdict over it here, and the act it landed. */
export interface NexusKapaePartialResult {
  readonly partial: NexusActPartial;
  readonly verdict: PartialVerdict;
  /** The seats of the head roster whose signature the partial carries, sorted. */
  readonly signed:  readonly string[];
  /** The landed act, once the partial read `complete` here and its entry verified; null short of the threshold. */
  readonly landed:  NexusKapaeResult | null;
}

/** The reader one vessel judges a kapae partial with: its charter's AID and head roster, and its own antigen board. */
const kapaeReader = (aid: string, roster: KahuQuorumSeats, handle: Awaited<ReturnType<typeof materializeSharedLarDoc>>): NexusPartialReader =>
  ({ aid, head: roster, board: { carriage: [], anchors: [], antigen: antigenEntriesFromBoard(handle.doc()) } });

/**
 * OPEN a two-vault kapae or lift: every seat of the head roster this vessel holds signs it, and the act leaves as a
 * PARTIAL for the vault that holds the other seats. Nothing lands on any board here. The partial this vessel signed
 * must still read `ready` on its own board after the signatures, or nothing crosses. A vessel that holds the whole
 * quorum lands the act through `runNexusKapae` instead.
 */
export async function runNexusKapaeOpen(opts: NexusKapaeOptions): Promise<NexusKapaePartialResult> {
  const nym    = nymOrRefuse(opts.nym);
  const home   = charterHomeOrRefuse(opts.sealHome, opts.aid);
  const roster = seatedRosterOrRefuse(home);
  const held   = heldSeatSigners(roster);
  if (held.length === 0) throw new NexusKapaeError("this vessel holds no seat of the head roster, so it opens no act for it.");
  if (held.length >= roster.threshold) {
    throw new NexusKapaeError("this vessel holds the whole quorum: the act lands here whole (`nexus kapae`), and no partial crosses.");
  }
  const aid  = nexusAidOf(readNexusDoc(home));
  if (!aid) throw new NexusKapaeError("no seated charter to name the Nexus by, so no partial can say where it lands.");
  const repo = opts.repo;
  try {
    const { handle } = await antigenBoardFor(repo, carriedHome(opts.sealHome, home));
    const parents = await antigenFrontier(antigenEntriesFromBoard(handle.doc()), nym, roster);
    const entry = await signAntigenEntry({ nym, action: opts.action, parents, sealEpochCid: roster.sealEpochCid },
      held.map((s) => ({ signer: s.verifyingKey, sign: s.sign })));
    const partial = nexusActPartial(aid, { family: "kapae", entry });
    const judged = await judgeNexusActPartial(partial, kapaeReader(aid, seatedRosterOrRefuse(home), handle));
    if (judged.verdict !== "ready") throw new NexusKapaeError(`the partial this vessel signed reads ${judged.verdict} here${judged.why ? `: ${judged.why}` : ""}; nothing crosses.`);
    return { partial, verdict: judged.verdict, signed: judged.signed, landed: null };
  } finally {
    await repo.flush().catch(() => { /* best-effort final flush */ });
  }
}

/**
 * Take a kapae partial another vault opened or cosigned. The judge runs against this vessel's own charter head and
 * antigen board BEFORE any signature: a partial that reads `ready` takes the signature of every seat this vessel
 * holds that has not signed it; one that reads `complete` (here, or after those signatures) lands on this vessel's
 * board once a fresh judgement against the head and the board as they stand at the write still reads `complete`.
 * Any other verdict refuses by name, and nothing signs or lands.
 */
export async function runNexusKapaePartial(opts: {
  readonly partial: unknown; readonly sealHome: string; readonly repo: Repo;
  /** The act the person named (`kapae --from` or `un_kapae --from`): a file that carries the other act refuses before any judge. */
  readonly action?: KapaeAction;
}): Promise<NexusKapaePartialResult> {
  const read = readNexusActPartial(opts.partial);
  if (!read || read.act.family !== "kapae") throw new NexusKapaeError("the file reads as no kapae partial");
  if (opts.action !== undefined && read.act.entry.action !== opts.action) {
    throw new NexusKapaeError(`the file carries a ${read.act.entry.action}, and you named a ${opts.action}; nothing signs or lands.`);
  }
  const home   = charterHomeOrRefuse(opts.sealHome, read.aid);
  const roster = seatedRosterOrRefuse(home);
  const repo   = opts.repo;
  try {
    const { boardUrl, handle } = await antigenBoardFor(repo, carriedHome(opts.sealHome, home));
    let partial: NexusActPartial = read;
    let judged = await judgeNexusActPartial(partial, kapaeReader(read.aid, roster, handle));
    if (judged.verdict === "ready") {
      const hands = heldSeatSigners(roster, new Set(judged.signed));
      if (hands.length === 0) throw new NexusKapaeError("the partial waits on a seat this vessel does not hold; carry it to the vault that holds one.");
      try { partial = await cosignNexusActPartial(partial, kapaeReader(read.aid, roster, handle), hands.map((h) => ({ signer: h.verifyingKey, sign: h.sign }))); }
      catch (err) { if (err instanceof NexusPartialRefusal) throw new NexusKapaeError(`the partial refuses a cosign here: ${err.message}`); throw err; }
      judged = await judgeNexusActPartial(partial, kapaeReader(read.aid, roster, handle));
    }
    if (judged.verdict === "ready") return { partial, verdict: judged.verdict, signed: judged.signed, landed: null };
    if (judged.verdict !== "complete") {
      throw new NexusKapaeError(`the partial reads ${judged.verdict} on this vessel${judged.why ? `: ${judged.why}` : ""}; nothing signs or lands.`);
    }
    const entry = (partial.act as Extract<NexusActPartial["act"], { family: "kapae" }>).entry;
    const landed = await landAntigenEntry(repo, handle, boardUrl, seatedRosterOrRefuse(home), entry, judged.signed, () => judgeStillBeforeWrite({
      mark: () => `${seatedRosterOrRefuse(home).sealEpochCid}|${antigenEntriesFromBoard(handle.doc()).map((e) => e.actCid).sort().join(",")}`,
      judge: () => judgeNexusActPartial(partial, kapaeReader(read.aid, seatedRosterOrRefuse(home), handle)),
      refuse: (message) => new NexusKapaeError(message),
    }));
    return { partial, verdict: judged.verdict, signed: judged.signed, landed };
  } finally {
    await repo.flush().catch(() => { /* best-effort final flush */ });
  }
}

/** Read the currently-Kapae'd set + the raw board entries (the `--list` fold). Read-only; materializes a blank
 *  board on a cold first boot (denies nobody). FAILS CLOSED to the empty set on an unseated charter. */
export async function runNexusKapaeList(opts: { readonly sealHome: string; readonly repo: Repo; readonly aid?: string }): Promise<NexusKapaeListResult> {
  const home       = charterHomeOrRefuse(opts.sealHome, opts.aid);
  const roster     = foundingRoster(readNexusDoc(home));

  const repo        = opts.repo;
  try {
    // The same board the raise wrote: one island resolution, over the same charter home.
    const { handle } = await antigenBoardFor(repo, carriedHome(opts.sealHome, home));
    const entries = antigenEntriesFromBoard(handle.doc());
    const folded  = await foldAntigenSet(entries, roster, makeMultiSigQuorumVerifier());
    return {
      sealEpochCid: roster.sealEpochCid,
      threshold:       roster.threshold,
      seatedKeys:      roster.keys.length,
      kapaed:          [...folded].map((k) => k.toLowerCase()).sort(),
      entries:         entries
        .map((e) => ({ nym: e.nym, action: e.action, actCid: e.actCid, parents: e.parents, signers: e.signatures.length }))
        .sort((a, b) => (a.nym === b.nym ? a.actCid.localeCompare(b.actCid) : a.nym.localeCompare(b.nym))),
    };
  } finally {
    await repo.flush().catch(() => { /* best-effort */ });
  }
}
