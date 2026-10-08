/**
 * socket-sorter — the ONE sorter a vessel's gates arm with: every proven socket is classed before any verdict.
 *
 *   · same-operator — the keyholder worker vouched it (cap=admin@daemon, or a KEL-pinned device edge);
 *   · contracted    — it presented an admit, and `leafStandingFor` reads that admit HELD against a Nexus this
 *                     vessel carries (its leaf proof over this socket, its charter lineage, the deny board, the
 *                     antigen); or it is a faceless PLACE whose vessel key this vessel's own board counts a
 *                     carrier contract for (`carrier`) — a place proves by its wire key, the only nym it has;
 *   · walker        — it presented THIS hearth's hosting grant for a Nexus the hearth carries and hosts in, its
 *                     tag verifying at the current or previous epoch (a previous-epoch grant is renewed and the
 *                     renewal pushed after the verdict); or it redeemed an invite token here: the token verifies
 *                     at a live epoch under its own class, its nonce burns in that epoch's spent-set (fsynced
 *                     BEFORE the verdict, bound to the leaf that proved; the same claim under the same leaf is a
 *                     retry and earns the identical grant, and under any other leaf it is silence), and the new
 *                     grant is pushed after the verdict. Either way the presenting leaf proves over this
 *                     socket and reads clear of the Nexus's antigen;
 *   · stranger      — everything else. A gate answers strangers only if SOME Nexus it stands in reads OPEN —
 *                     its own primary charter or any it carries (`gateAnswersStrangers`); otherwise a stranger
 *                     is SILENCE, exactly like a failed proof.
 *
 * The fold itself is mesh's pure `classifySocket`; this module gathers its inputs off the vessel's own carried
 * readings, as of its last sync. A gate's posture is the true multi-Nexus rule: per-shrine silence over every
 * Nexus one gate key serves, which reduces exactly to per-Nexus posture once each Nexus carries its own wire key.
 *
 * Meme: lar:///ha.ka.ba/lararium/node/socket-sorter
 */

import {
  classifySocket, answersStrangers, verifyLeafProof, presentedSigner, foldAntigenVerdicts, makeMultiSigQuorumVerifier,
  grantVerifiesAt, renewGrant, tokenVerifiesAt, issueGrant, lineageOf, claimDigest, carryRecordKey, HOSTING_GRANT_SESSION_KIND, HOSTING_NOTICE_SESSION_KIND,
  federationPostureFromDoc,
  type FederationPosture, type PeerClass, type PresentedGrantArm, type PresentedTokenArm, type HostingGrant, type NexusDoc,
} from "@lararium/mesh";
import type { SocketSorter, SortInput, SortVerdict } from "./daemon-auth-gate.js";
import { leafStandingFor, type CarriedNexusReading, type SocketBinding } from "./nexus-carriage.js";
import { readHostingState, liveEpochs, spendToken, redeemedCount } from "./hosting-store.js";
import { noteContact } from "./hosting-carry.js";

/** What the walker arms read: the hearth's hosting store and its own per-Nexus leaf. */
export interface HostingSorterDeps {
  /** The vessel store the hosting state lives under. */
  readonly storageDir:  string;
  /** The hearth's own per-Nexus leaf seed for N — the seed its hosting keys derive from — or null (no face). */
  readonly leafSeedFor: (nexusAid: string) => Promise<Uint8Array | null>;
  /** The operator's count event: a token redeemed in N, and how many this epoch. A count, never a row. */
  readonly onRedeemed?: (nexusAid: string, count: number) => void;
}

export interface SocketSorterDeps {
  /** The carried Nexuses' readings as of this vessel's last sync — what an admit is held against, and whose
   *  postures decide whether strangers are answered. */
  readonly readings: () => Promise<readonly CarriedNexusReading[]>;
  /** Does this vessel's own board count a carrier contract for this wire key (a faceless PLACE)? */
  readonly carrier:  (vesselKey: string) => boolean;
  /** The vessel's own place posture, read fresh (`ownPlacePosture`). */
  readonly primaryPosture: () => FederationPosture;
  /** The hosting store and leaf the walker arms read. Absent → no socket stands as a walker here. */
  readonly hosting?:       HostingSorterDeps;
}

/** The kind of place a vessel stands as: a hearth (a lararium, with a face) or a crossroads (a herm). */
export type PlaceClass = "lararium" | "herm";

/**
 * ONE READER for a vessel's OWN place posture — the posture its gates fold beside every Nexus it carries.
 *
 *   · A LARARIUM reads its charter: OPEN only where the charter says so; an absent or torn charter reads PRIVATE,
 *     because for a hearth an absent charter is a fault and a fault fails closed.
 *   · A HERM holds no charter by CLASS — a waystone, never a broken lararium — so its absent charter is no fault to
 *     fail closed on. A crossroads answers any proven peer that KNOCKED: the knock path derives from its gate key,
 *     and only a peer handed that key can knock at all (a bare route draws no upgrade). Its SILENT/WAYMARK rung
 *     governs the HTTP descriptor alone, never this.
 */
export function ownPlacePosture(placeClass: PlaceClass, charter: NexusDoc | null): FederationPosture {
  return placeClass === "herm" ? "open" : federationPostureFromDoc(charter);
}

/** Is `leaf` held or unsettled on N's antigen? Either reads it out of the walker class. */
async function antigenHolds(reading: CarriedNexusReading, leaf: string): Promise<boolean> {
  const verdicts = await foldAntigenVerdicts(reading.antigen, reading.antigenRoster, makeMultiSigQuorumVerifier());
  for (const [nym, verdict] of verdicts) if (nym.toLowerCase() === leaf && verdict !== "withdrawn") return true;
  return false;
}

/**
 * The walker standing a grant or token arm earns at this hearth, and the session frames that follow its verdict,
 * or null. Every read that can refuse runs BEFORE the one write (the token's burn), so a refused socket destroys
 * nothing.
 */
async function walkerStanding(
  presented: PresentedGrantArm | PresentedTokenArm, input: SortInput, readings: readonly CarriedNexusReading[], hosting: HostingSorterDeps,
): Promise<{ readonly standing: { nym: string; aid: string }; readonly grant: HostingGrant; readonly push?: SortVerdict["push"] } | null> {
  const aid = (presented.kind === "grant" ? presented.grant.nexusAid : presented.nexusAid).trim().toLowerCase();
  const reading = readings.find((r) => r.aid.toLowerCase() === aid);
  if (!reading) return null;                                                     // a Nexus this hearth does not carry
  if (!(await verifyLeafProof({ presented, nonce: input.challenge.nonce, gatePubKey: input.challenge.gatePubKey, vesselKey: input.vesselKey }))) return null;
  const leaf = presentedSigner(presented);
  if (await antigenHolds(reading, leaf)) return null;
  const state = readHostingState(hosting.storageDir, aid);
  if (!state) return null;                                                       // this hearth hosts nobody in N
  const seed = await hosting.leafSeedFor(aid);
  const live = seed ? liveEpochs(state, seed) : null;
  if (!live) return null;
  const standing = { nym: leaf, aid };
  const push = (grant: HostingGrant): SortVerdict["push"] => [{ kind: HOSTING_GRANT_SESSION_KIND, body: { grant } }];
  // EVERY DIAL ON THE LEAF IS A CONTACT. It folds the guest's own rhythm into the carriage its PROVEN leaf keys,
  // whichever arm it rode and whichever lineage it stands on; a carriage marked pending under pressure hears the
  // notice on this contact, and a later epoch's contact clears it. Called only once the arm has stood.
  const contact = (): SortVerdict["push"] => noteContact(hosting.storageDir, aid, carryRecordKey(seed!, aid, leaf), state.depth).notice
    ? [{ kind: HOSTING_NOTICE_SESSION_KIND, body: { pending: true } }] : [];

  if (presented.kind === "grant") {
    const grant = presented.grant;
    const current = grantVerifiesAt(live.current, grant) ? grant
      : live.previous && grantVerifiesAt(live.previous, grant) ? renewGrant(live.current, grant) : null;
    if (!current) return null;                                                   // two rolls back, or never this hearth's
    const frames = [...(current === grant ? [] : push(current) ?? []), ...(contact() ?? [])];
    return { standing, grant: current, ...(frames.length > 0 ? { push: frames } : {}) };
  }

  const token = presented.token;
  const at = tokenVerifiesAt(live.current, token) ? live.current
    : live.previous && tokenVerifiesAt(live.previous, token) ? live.previous : null;
  if (!at) return null;
  const outcome = await spendToken({ storageDir: hosting.storageDir, nexusAid: aid, epochCid: at.cid, n: token.n, claimDigest: claimDigest(presented.claim, leaf) });
  if (outcome === "spent-other") return null;
  if (outcome === "fresh") hosting.onRedeemed?.(aid, redeemedCount(hosting.storageDir, aid, at.cid));
  const grant = issueGrant(live.current, {
    leaf, lineage: lineageOf(token.n, presented.claim), survived: 0,
    from: token.purpose === "host-invite" ? "host" : "walker",
  });
  return { standing, grant, push: [...(push(grant) ?? []), ...(contact() ?? [])] };
}

/**
 * Does a gate answer strangers? Iff its own primary charter or any Nexus it carries reads OPEN — the
 * multi-Nexus fold (`answersStrangers`) over every Nexus one gate key serves.
 */
export function gateAnswersStrangers(primary: FederationPosture, readings: readonly CarriedNexusReading[]): boolean {
  return answersStrangers([primary, ...readings.map((r) => r.posture)]);
}

/** Stand the vessel's sorter over its carried readings. */
export function makeSocketSorter(deps: SocketSorterDeps): SocketSorter {
  return async (input) => {
    if (input.sameOperator) return { class: "same-operator" };
    const readings = await deps.readings();
    let standing: SortVerdict["standing"];
    const presented = input.presented;
    let walker: Awaited<ReturnType<typeof walkerStanding>> = null;
    if ((presented?.kind === "grant" || presented?.kind === "token") && deps.hosting) {
      walker = await walkerStanding(presented, input, readings, deps.hosting);
    }
    if (presented?.kind === "admit") {
      const binding: SocketBinding = {
        presentedAdmit: presented, nonce: input.challenge.nonce,
        gatePubKey: input.challenge.gatePubKey, vesselKey: input.vesselKey,
      };
      const held = await leafStandingFor(binding, readings);
      if (held) standing = { nym: held.nym, aid: held.aid };
    }
    const cls = classifySocket({
      sameOperator: false,
      contracted: standing !== undefined || (presented === undefined && deps.carrier(input.vesselKey)),
      walker: walker !== null,
      answersStrangers: gateAnswersStrangers(deps.primaryPosture(), readings),
    });
    if (cls === null) return null;
    if (cls === "walker" && walker) return { class: cls, standing: walker.standing, grant: walker.grant, ...(walker.push ? { push: walker.push } : {}) };
    return cls === "contracted" && standing ? { class: cls, standing } : { class: cls };
  };
}

/**
 * The admitted sockets a refold no longer holds: a contracted socket whose admit the membership no longer
 * reads held, and any stranger (or classless) socket, once no carried Nexus answers strangers. Same-operator
 * and walker sockets are never dropped here — a walker's standing re-reads at its own next dial. Pure; the
 * caller drops each one silently.
 */
export function socketsNoLongerHeld<S>(
  admitted: Iterable<{ readonly peerId: string; readonly socket: S; readonly cls: PeerClass | undefined }>,
  now: { readonly holds: (peerId: string) => boolean; readonly answersStrangers: boolean },
): S[] {
  if (now.answersStrangers) return [];
  const out: S[] = [];
  for (const { peerId, socket, cls } of admitted) {
    if (cls === "same-operator" || cls === "walker") continue;
    if (cls === "contracted" && now.holds(peerId)) continue;
    out.push(socket);
  }
  return out;
}
