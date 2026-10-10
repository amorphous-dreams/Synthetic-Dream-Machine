/**
 * raise-sign — the RECOGNISER's half of the raise ceremony, and the only half that runs off-vessel.
 *
 * ── WHY THIS HALF NEEDS NO DAEMON AT ALL ────────────────────────────────────────────────────────
 * The vessel being raised emits a challenge naming a Nexus by its AID; a recognised operator signs it on
 * THEIR OWN machine and hands the grant back. Nothing about that touches the asking vessel — the caps that
 * arrive ride the recogniser's key, and no key of theirs ever rests on the vessel they raise.
 *
 * ── IT SIGNS WITH THE LEAF, AND CARRIES THE LEAF'S ADMIT ────────────────────────────────────────
 * The signing key is the held persona's per-Nexus LEAF for the challenge's Nexus (`heldNexusLeaves`),
 * never the persona root: a root's signature names a key no admit names, and the asking vessel refuses it.
 * The grant carries that leaf's admit, read off THIS vessel's own replica of the Nexus's carriage board
 * (`presentationFromBoardDoc`: the counted admit head, its closed, tight lineage, and the roll anchors that
 * carry an admit minted before a roll to the head) — the same derivation a dial presents. The board is the one `runNexusContract` writes to, resolved through `nodeNexusIsland`
 * over the home that holds the Nexus's charter. No admit on the replica → nothing to present → refuse.
 *
 * It opens the board read-only and writes nothing anywhere.
 *
 * ── IT REFUSES A CHALLENGE IT CANNOT READ, RATHER THAN SIGNING A SHAPE ──────────────────────────
 * The challenge crosses from another machine as text, so it arrives untrusted. A signer that accepted a
 * partial shape would put a recogniser's signature on fields they never saw — and the signature is the
 * whole consent. Every field must be present and well-typed, or this refuses and signs nothing.
 *
 * Canon: lar:///ha.ka.ba/lares/api/pono/waking-floor
 */

import type { Repo } from "@automerge/automerge-repo";
import {
  signRaiseGrant, ed25519SignerFromSeed, foundingRoster, carriageDocUrl,
  materializeSharedLarDoc, presentationFromBoardDoc, presentationFindingLine,
  type RaiseChallenge, type RaiseGrant, type PresentationFinding,
} from "@lararium/mesh";

import { loadVesselVerifyingKey } from "../node-vessel-identity.js";
import { larSealHome } from "../vessel-paths.js";
import { charterHomeFor } from "../carried-set.js";
import { readNexusDoc } from "../nexus-doc.js";
import { nodeNexusIsland } from "../nexus-standing.js";
import { heldNexusLeaves } from "../nexus-leaf.js";

export class RaiseSignError extends Error {}

/**
 * Read a challenge from untrusted text. Returns `null` on ANY departure from the exact shape — a signer
 * that guessed at a missing field would sign a claim its holder never made.
 */
export function readRaiseChallenge(text: string): RaiseChallenge | null {
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { return null; }
  if (typeof parsed !== "object" || parsed === null) return null;
  const p = parsed as Record<string, unknown>;
  if (typeof p["vesselId"] !== "string" || p["vesselId"].length === 0) return null;
  if (typeof p["nexus"]    !== "string" || p["nexus"].length    === 0) return null;
  if (typeof p["nonce"]    !== "string" || p["nonce"].length    === 0) return null;
  if (typeof p["epoch"]    !== "number" || !Number.isInteger(p["epoch"]) || p["epoch"] < 0) return null;
  return {
    vesselId: p["vesselId"], nexus: p["nexus"], epoch: p["epoch"], nonce: p["nonce"],
  };
}

/** A signed grant, and what the presenter noticed deriving the admit it carries (informational, never a refusal). */
export interface RaiseSignResult {
  readonly grant:    RaiseGrant;
  readonly findings: readonly PresentationFinding[];
}

/**
 * Sign a challenge as persona `handleIndex`'s LEAF for the challenge's Nexus, and attach that leaf's admit.
 *
 * `handleIndex` names WHICH compartment answers. A human holds several, and the one that signs is the one
 * whose leaf that Nexus admitted — so the choice belongs to the operator, never to a default this code
 * picks for them.
 *
 * REFUSES, signing nothing, when this vessel holds no charter for the challenge's Nexus, no persona at
 * `handleIndex`, or no counted admit for that persona's leaf on its own replica of the Nexus's board.
 * The presenter's findings ride the result beside the grant, and never inside it: the grant carries signed
 * bytes, and a finding is a note for the operator who signs.
 */
export async function runRaiseSign(opts: {
  challengeText: string;
  handleIndex:   number;
  /** The store's one holder: the standing vessel's own Repo, or the direct holder's (`ownedStore`). Its replica holds the Nexus's carriage board. */
  repo:          Repo;
  /** The seal home holding the Nexus's charter. Defaults to `larSealHome()`. */
  sealHome?:     string;
}): Promise<RaiseSignResult> {
  const challenge = readRaiseChallenge(opts.challengeText);
  if (!challenge) {
    throw new RaiseSignError(
      "that challenge does not read as one — a raise challenge carries vesselId, nexus, epoch and nonce, " +
      "and this signs nothing it cannot read whole.",
    );
  }
  const sealHome = opts.sealHome ?? larSealHome();
  const aid      = challenge.nexus;
  const home     = charterHomeFor(sealHome, aid);
  if (!home) {
    throw new RaiseSignError(`this vessel holds no charter for the Nexus the challenge names (${aid.slice(0, 18)}…) — import it first.`);
  }
  const roster = foundingRoster(readNexusDoc(home));
  if (roster.sealEpochCid.length === 0) {
    // An UNSEALED charter names no AID, so it never answers `charterHomeFor`; a charter reached here carries a
    // genesis and still yields no head — its lineage or its seated keys do not verify.
    throw new RaiseSignError("the charter held for that Nexus carries no verified seal head — its lineage does not verify against the seated keys, so no admit can root on it.");
  }
  const leaf = (await heldNexusLeaves(aid)).find((l) => l.handleIndex === opts.handleIndex);
  if (!leaf) throw new RaiseSignError(`this vessel holds no persona at h${opts.handleIndex}.`);

  const island = nodeNexusIsland({ ownVesselKey: await loadVesselVerifyingKey(), sealHome: home });
  const repo   = opts.repo;
  let read;
  try {
    const handle = await materializeSharedLarDoc(repo, carriageDocUrl(island), "board:carriage-contracts");
    read = await presentationFromBoardDoc(handle.doc(), leaf.verifyingKey, roster);
  } finally {
    await repo.flush().catch(() => { /* read-only: nothing owed */ });
  }
  const presented = read.presentation;
  if (!presented) {
    throw new RaiseSignError(
      `no counted admit for persona h${opts.handleIndex}'s leaf stands on this replica of that Nexus's board — ` +
      "a raise presents an admit, and there is none to present." +
      read.findings.map((f) => `\n  the presenter noticed: ${presentationFindingLine(f)}`).join(""),
    );
  }
  const grant = await signRaiseGrant({
    challenge,
    byNym:          leaf.verifyingKey,
    presentedAdmit: presented,
    sign:           ed25519SignerFromSeed(leaf.seed),
  });
  return { grant, findings: read.findings };
}
