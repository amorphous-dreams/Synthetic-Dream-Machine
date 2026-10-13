/**
 * runCabalJoin — the applicant's half of the cabal contract. A vouch stakes; this crosses.
 *
 * Calls `admitOnLineage`, never `admitToRealm`: the latter takes a pre-folded DAG, which puts the
 * per-voucher cap in the caller's hands, and a choke the caller may forget chokes nothing.
 *
 * It admits nobody and bans nobody: a refused applicant anergizes, and Kapae stands as a separate signed act.
 * Its one write keeps the edge acts it counted in this vessel's own ledger and returns a kept act to a board
 * that lost it (kapae#/accretion).
 *
 * TWO BOARDS OF ONE REALM, ONE CROSSING. The realm's vouch board says who vouched; the realm's edge board says
 * which relations a hand set aside (kapae#/reach). Three shadows leave a vouch out of the crossing: one over
 * the vouch itself (its voucher withdrew it, or the seat quorum struck it), one over the VOUCHER's member edge
 * (a member set aside lends no stake), and one over the APPLICANT's member edge, which refuses the crossing
 * whatever vouches. What stood aside rides back in `setAside` and `memberSetAside`, so a person sees the
 * shadow (and a fork, where two hands disagree) instead of a bare refusal.
 *
 * Meme: lar:///ha.ka.ba/lares/api/pono/admission-on-a-lineage#/the-standing
 */

import { readFileSync } from "node:fs";
import type { Repo } from "@automerge/automerge-repo";
import {
  readLedgeredVouches, materializeSharedLarDoc,
  vouchEdgeId, realmEdgeBoardDocUrl, memberEdgeId, realmEdgeAuthority, type EdgeKapaeVerdict,
  leaseEpochPrefix, effectiveLeaseEpoch, DAEMON_BAG_ID,
  DEFAULT_JOIN_POLICY, alphaFromHalfLife,
  type CabalInvite, type CabalJoinPolicy, type AdmissionDials,
} from "@lararium/mesh";
import { tiddlerText, type LarDoc } from "@lararium/mesh";
import { admitOnLineage, type LineageAdmission } from "../realm-admission.js";
import { larBootstrapPath } from "../vessel-paths.js";
import { loadVesselVerifyingKey } from "../node-vessel-identity.js";
import { readVesselEdgeBoard, vesselEdgeCharter } from "../edge-board.js";
import { verifyEd25519, cabalInviteBytes } from "@lararium/mesh";

const NYM_RE = /^[0-9a-f]{64}$/;

export class CabalJoinError extends Error {}

/**
 * The realm's effective lease epoch, folded off the board doc — max over every per-writer slot.
 *
 * NO CLOCK, BY CONSTRUCTION. `epoch-lease` holds the epoch as a coordinator-free max-register in
 * per-writer slots: two concurrent rolls both land effective+1 in their own slot and the maximum
 * never decreases. Every replica that has seen the same board therefore reads the same fence, which
 * is the property a timestamp cannot give and the reason admission stopped taking an instant.
 *
 * An absent slot-set reads 0 — a realm that has rolled nothing yet, not an open gate: an invite bound
 * at 0 stands until the first roll, and one bound behind 0 cannot exist.
 */
/**
 * The daemon doc's URL, off the social bootstrap this vessel already holds.
 *
 * This is the board a realm's feed is read from, so a caller that never opens the doc reads a genesis
 * epoch for every realm forever. Absent or unreadable reads null, and the caller then prices against
 * genesis — the honest floor when this vessel cannot see the board at all.
 *
 * THE BOARD IS THIS VESSEL'S OWN, which is correct for a fence: an admission bound is an authority
 * this vessel holds alone, and a peer able to roll it could stale every outstanding invite.
 */
export function daemonDocUrlFromBootstrap(): string | null {
  try {
    const packed = JSON.parse(readFileSync(larBootstrapPath(), "utf8")) as { text?: string };
    const tiddlers = (JSON.parse(packed.text ?? "{}") as { tiddlers?: Record<string, { text?: string }> }).tiddlers ?? {};
    return tiddlers[DAEMON_BAG_ID]?.text ?? null;
  } catch { return null; }
}

/**
 * The epoch outstanding invites to a CABAL are bounded by — a max-register over its per-writer slots.
 *
 * THE CABAL'S, NOT THE REALM'S. A realm is a cabal's shared CRDT and resources; admission is a fact
 * about the collective, not about the stuff it holds. The two share a key only because a cabal carries
 * no identity of its own — it is named by its realm's doc, and `admitOnLineage` keys on that same hex.
 * The realm's OWN epoch is its maintenance feed, which lives in a separate space (`realmFeedPrefix`).
 */
export function cabalAdmissionEpoch(doc: unknown, realmDocIdHex: string): number {
  const tiddlers = (doc as LarDoc | null)?.tiddlers;
  if (!tiddlers) return 0;
  const prefix = leaseEpochPrefix(realmDocIdHex);
  const slots: string[] = [];
  for (const [title, rec] of Object.entries(tiddlers)) {
    if (!title.startsWith(prefix)) continue;
    // A LAR RECORD NESTS ITS TIDDLER. `rollLeaseEpochOnBoard` writes `mutableLarRecord`, which carries
    // `{ tiddler: { text }, meta }` — a reader reaching for `rec.text` finds undefined on every slot,
    // folds an empty set, and reads epoch 0 forever. The daemon's own lease read takes `.tiddler.text`.
    const text = tiddlerText(rec);
    if (typeof text === "string") slots.push(text);
  }
  return effectiveLeaseEpoch(slots);
}

/**
 * The fairness dials a crossing falls back to. ARRIVED AT, NEVER CHOSEN HERE — a realm that seats its
 * own carries them on its charter; these stand only so a realm that seats none still PRICES, because a
 * missing dial must never read as an open door.
 */
const FALLBACK_DIALS: AdmissionDials = {
  epsilon: 0.15,
  beta:    0.35,
  rho:     0.002,
  supply:  1_000_000,
  alpha:   alphaFromHalfLife(30),
};

export interface CabalJoinOptions {
  readonly realm:     string;
  /** Usually a face this vessel does not hold — the gate never assumes the applicant is local. */
  readonly applicant: string;
  /**
   * The realm's effective lease epoch to read against.
   *
   * A causal island holds no global now, so this is a FENCE rather than an instant: the max over the
   * realm's per-writer lease slots. Absent → read off the board itself, which is what a replica
   * converging on that board already agrees to.
   */
  readonly epoch?:    number;
  /** An invite carried out of band, for a joiner the realm's board has not reached. Same gate either way. */
  readonly invite?:   CabalInvite | null;
  /** The choke on one hand's out-degree. Absent → uncapped, a deliberate operator turn. */
  readonly maxVouchesPerVoucher?: number;
  readonly policy?:   CabalJoinPolicy;
  readonly dials?:    AdmissionDials;
  /** The charter DOC's authority home (the door supplies `larSealHome()`): the seats a quorum act answers to. */
  readonly sealHome:   string;
  /** The store's one holder: the standing vessel's own Repo, or the direct holder's (`ownedStore`). */
  readonly repo:       Repo;
}

/** One vouch the crossing left out because a kāpae stands over it or over its voucher. */
export interface SetAsideVouch {
  /** The shadowed relationship's id — the id `lares edge kapae` / `un-kapae` take. */
  readonly edgeId:            string;
  /** Which relation the shadow stands over: the vouch itself, or its voucher's own place in the realm. */
  readonly over:              "vouch" | "voucher";
  readonly voucherDid:        string;
  readonly joinerIdentityHex: string;
  /**
   * Why the shadow stands. `held` — a hand set it aside. `unsettled` — a raise and a lower stand with no
   * causal order between them: a FORK, which the same hand settles with a later act citing both. `unavailable`
   * / `rejected` — this replica cannot read the edge's whole ancestry, so no lift stands proven.
   */
  readonly verdict:           EdgeKapaeVerdict;
}

export interface CabalJoinResult extends LineageAdmission {
  /** Every vouch in this realm a standing shadow removed from the crossing — surfaced, never silently short. */
  readonly setAside: readonly SetAsideVouch[];
  /** Present when a shadow stands over the APPLICANT's own member edge: the crossing refuses whatever vouches. */
  readonly memberSetAside?: { readonly edgeId: string; readonly verdict: EdgeKapaeVerdict };
}

const verifyOffline = (bytes: Uint8Array, sigHex: string, voucherDid: string): Promise<boolean> =>
  Promise.resolve(verifyEd25519(sigHex, bytes, voucherDid));

export async function runCabalJoin(
  opts: CabalJoinOptions,
): Promise<CabalJoinResult> {
  const realm = opts.realm.trim().toLowerCase();
  const applicant = opts.applicant.trim().toLowerCase();

  // FAIL CLOSED BEFORE A BOARD IS TOUCHED. A malformed realm reads an empty board and comes back
  // "nobody vouched" — a wrong answer wearing a plausible shape, and the shape a caller believes.
  if (!NYM_RE.test(realm)) {
    throw new CabalJoinError(`--realm expects a 64-hex cabal-realm doc id, got "${opts.realm}"`);
  }
  if (!NYM_RE.test(applicant)) {
    throw new CabalJoinError(`the applicant reads as a 64-hex verifying key, got "${opts.applicant}"`);
  }

  const vesselKey = await loadVesselVerifyingKey();
  if (!vesselKey) {
    throw new CabalJoinError("this vessel surfaces no verifying key — no board to read the lineage from.");
  }

  let boardEpoch = 0;
  const repo = opts.repo;
  let issued: CabalInvite[];
  const setAside: SetAsideVouch[] = [];
  // WHAT THE APPLICANT PRESENTS, and whether it may COUNT. The structural gate reads `presented` and names
  // its own refusal (bad signature, wrong realm). The lineage fold and the shadow read take a carried invite
  // only once it verifies for THIS realm — the same bar the board's read sets — so a forged one lends no
  // mass under any policy and names no shadow.
  let carried = opts.invite ?? null;
  let carriedCounts = false;
  if (carried) {
    const { sig: _sig, ...unsigned } = carried;
    carriedCounts = carried.realmDocIdHex === realm
      && await verifyOffline(cabalInviteBytes(unsigned), carried.sig, carried.voucherDid).catch(() => false);
  }
  let memberSetAside: CabalJoinResult["memberSetAside"];
  try {
    // THE BOARDS KEY ON THE REALM, never on a Nexus: a vouch names its voucher in the clear and a removal names
    // a member, so both records stay among the parties to the realm (kapae#/four-edges).
    // THE VERIFYING READ, the only read that stands, taken through this vessel's own ledger: an unverified
    // board carries edges whose signatures never cleared, and a vouch a hand deleted from the board still
    // stands at a vessel that read it (kapae#/accretion).
    const onBoard = [...(await readLedgeredVouches({ repo, realm, vesselKey })).invites];
    // WHO HOLDS EACH EDGE reads off what this vessel itself holds: a vouch edge answers to its voucher and to
    // the seat quorum; a member edge answers to the seat quorum alone (kapae#/edge-hands). An act signed by any
    // other hand drops before the fold.
    const candidates = carried && carriedCounts ? [...onBoard, carried] : onBoard;
    const edges = await readVesselEdgeBoard({
      repo, scope: realm, kind: "realm", boardUrl: realmEdgeBoardDocUrl(realm), label: "board:edge-kapae", vesselKey,
      authorityFor: realmEdgeAuthority(candidates),
      charter: vesselEdgeCharter(realm, opts.sealHome),
    });
    // ONLY A CAUSAL LOWER LIFTS: a contested or unreadable edge stays aside.
    const shadowOver = (i: CabalInvite): SetAsideVouch | null => {
      const vouch = vouchEdgeId(i), voucher = memberEdgeId(realm, i.voucherDid);
      const at = edges.readings.get(vouch)?.stands ? { edgeId: vouch, over: "vouch" as const }
        : edges.readings.get(voucher)?.stands ? { edgeId: voucher, over: "voucher" as const } : null;
      return at && { ...at, voucherDid: i.voucherDid, joinerIdentityHex: i.joinerIdentityHex, verdict: edges.readings.get(at.edgeId)!.verdict };
    };
    const stands = (i: CabalInvite) => shadowOver(i) !== null;
    const seen = new Set<string>();
    for (const i of candidates) {
      const aside = shadowOver(i);
      const key = vouchEdgeId(i);
      if (!aside || seen.has(key)) continue;
      seen.add(key);
      setAside.push(aside);
    }
    issued = onBoard.filter((i) => !stands(i));
    // A vouch carried out of band meets the same shadow the board's copy would.
    if (carried && carriedCounts && stands(carried)) carried = null;
    // THE APPLICANT'S OWN PLACE IN THE REALM. A shadow over the member edge holds against every vouch, a fresh
    // one included: the crossing refuses below, whatever the lineage would price.
    const own = memberEdgeId(realm, applicant);
    const ownReading = edges.readings.get(own);
    if (ownReading?.stands) memberSetAside = { edgeId: own, verdict: ownReading.verdict };
    // THE FENCE LIVES ON THE DAEMON DOC, NOT THIS BOARD. `realm-feed` rolls a realm's per-writer lease
    // slot "over the sovereign daemon doc — one slot per writer under the daemon bag", so a reader
    // scanning the VOUCH board for that prefix matches nothing and folds epoch 0 forever. Measured: the
    // fence read this board, every invite compared against 0, and no vouch could ever lapse — a clock
    // that at least expired, replaced by a fence that never fired.
    // M16 — FAIL CLOSED, mirroring the vouch side (`cabal-vouch.ts`'s `resolveBoundEpoch`). An unreadable
    // daemon doc used to fall through to `boardEpoch = 0` (genesis) and price the crossing against a fence
    // the joiner never actually read — a vouch bound at N>0 then stood against a board this vessel could not
    // see. Council ruling 6: a replica missing the history reports an INCOMPLETE VIEW, never "expired" and
    // never "standing". An explicit `opts.epoch` still overrides (the caller stated its own fence by hand),
    // so this refusal fires only when NEITHER the board nor the caller supplied one.
    const daemonUrl = daemonDocUrlFromBootstrap();
    if (daemonUrl) {
      const dh = await materializeSharedLarDoc(repo, daemonUrl as never, "daemon");
      boardEpoch = cabalAdmissionEpoch(dh.doc(), realm);
    } else if (opts.epoch === undefined) {
      throw new CabalJoinError(
        "incomplete-view: this vessel cannot read the realm's lease fence (its daemon doc is unreadable), " +
        "so the crossing refuses rather than price against a guessed genesis epoch. Pass --epoch explicitly to override.",
      );
    }
  } finally {
    await repo.flush();
  }

  if (memberSetAside) return { admitted: false, refusal: "set-aside", capped: [], setAside, memberSetAside };

  const presented = carried ?? issued.find((i) => i.joinerIdentityHex.toLowerCase() === applicant) ?? null;
  // A CARRIED INVITE JOINS THE ISSUED SET, never replaces it. The lineage prices the realm's whole
  // vouch graph; an applicant holding their own copy must not shrink that graph to the one edge they
  // happen to be carrying.
  const forFold = carried && carriedCounts && !issued.some((i) => i.sig === carried!.sig)
    ? [...issued, carried]
    : issued;

  const verdict = await admitOnLineage({
    policy:            opts.policy ?? DEFAULT_JOIN_POLICY,
    realmDocIdHex:     realm,
    joinerIdentityHex: applicant,
    invite:            presented,
    // THE CABAL'S FENCE, read off the same board the vouches came from — a max-register over the
    // per-writer lease slots, so every replica that has seen this board reads the same number. The
    // fence belongs to the cabal that admits; an instant would belong to the machine being gated.
    effectiveEpoch:    opts.epoch ?? boardEpoch,
    verify:            verifyOffline,
    issued:            forFold,
    // The lineage seed — the root standing every rank folds down from. This vessel roots the realm it
    // serves the board for.
    seed:              vesselKey.toLowerCase(),
    applicant,
    dials:             opts.dials ?? FALLBACK_DIALS,
    ...(opts.maxVouchesPerVoucher !== undefined ? { maxVouchesPerVoucher: opts.maxVouchesPerVoucher } : {}),
  });
  // NAME THE SHADOW. An applicant whose only vouch stands aside holds no invite the gate will read; "no-invite"
  // would say nobody ever vouched, which a person cannot act on. The refusal names what stands in the way.
  const applicantSetAside = setAside.some((s) => s.joinerIdentityHex.toLowerCase() === applicant);
  if (!verdict.admitted && verdict.refusal === "no-invite" && applicantSetAside) {
    return { ...verdict, refusal: "set-aside", setAside };
  }
  return { ...verdict, setAside };
}
