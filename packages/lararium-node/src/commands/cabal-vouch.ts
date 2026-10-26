/**
 * runCabalVouch — the JOIN axis's WRITE side: one voucher stakes their own standing on one joiner.
 *
 * THE CONTRAST WITH CARRIAGE, AND WHY IT NEEDS NO QUORUM. `nexus-contract` writes a CONTRACT and therefore
 * needs the kahu quorum plus the joiner's own consent — a Nexus cannot conscript a vessel into carrying, and
 * no single kahu may seat one alone. A vouch inverts that shape: ONE hand stakes ITS OWN standing,
 * attributable by construction, and it grants nothing by itself. So it takes no quorum and asks no steward.
 * The cost lands on the voucher automatically — their score SPLITS across everyone they vouch for, so the act
 * of vouching dilutes them, which carries the whole payment and needs no ledger to collect.
 *
 * WHAT IT DOES NOT DO. It admits nobody. A vouch rides as signal-2 on the lineage; the crossing itself runs through
 * `admitOnLineage`, which folds this board and prices the applicant. Minting a vouch for someone who never
 * crosses costs the voucher their dilution and buys them nothing — the intended asymmetry.
 *
 * WHOSE HAND VOUCHES. The worn face's key at the Nexus the realm stands under, picked by the steward door
 * (`wornStewardSigner`), never a persona root: a vouch names its voucher in the clear on a board that crosses to
 * the realm's members, so a root there would name the human's device group (cabal-realm#/the-steward-signer).
 * The realm stands under the Nexus the vessel's own ledger names for it, or, at the vessel's first act there,
 * the one the call names (default the primary charter's), and the ledger keeps that word (kapae#/edge-hands).
 *
 * FAIL CLOSED: a vessel that wears no face, a malformed joiner nym, a realm under another Nexus, or a signature
 * that does not read back off the board REFUSES before anything lands. Never write a vouch the fold would drop.
 *
 * Meme: lar:///ha.ka.ba/lares/api/pono/admission-on-a-lineage#/the-standing
 */

import type { Repo } from "@automerge/automerge-repo";
import {
  signCabalInvite, writeVouch, verifiedVouchesFromBoard, vouchDagFromInvites, vouchEdgeId,
  realmVouchBoardDocUrl, realmEdgeBoardDocUrl, materializeSharedLarDoc,
  type CabalInvite,
} from "@lararium/mesh";
import { loadWornFaceAtomKey } from "../face-atom-store.js";
import { daemonDocUrlFromBootstrap, cabalAdmissionEpoch } from "./cabal-join.js";
import { actingRealmNexus, noteVesselRealm } from "../edge-board.js";
import { leaseLineageOfNexus } from "../lease-charter.js";
import { registerRealmFrontier } from "../realm-frontier-door.js";
import type { HandLineage } from "@lararium/mesh";
import { nodeStewardVault, wornStewardSigner, StewardRefused, type StewardVault } from "../realm-steward.js";
import { wornNexusLeaf } from "../nexus-leaf.js";
import { verifyEd25519 } from "@lararium/mesh";

/** A nym reads valid only at the exact ed25519 verifying-key shape — a stray value never becomes an edge. */
const NYM_RE = /^[0-9a-f]{64}$/;

export class CabalVouchError extends Error {}

export interface CabalVouchOptions {
  /** The joiner this vouch names. A vouch never rides bearer — it binds to one identity. */
  readonly joiner:      string;
  /** The cabal-realm this vouch crosses INTO. A vouch never grants a general pass. */
  readonly realm:       string;
  /** The realm lease epoch to bind to. Absent → read the verified charter lease on the daemon board. */
  readonly boundEpoch?: number;
  /** The Nexus the realm stands under, for this vessel's first act there. Absent → the primary charter's. */
  readonly nexusAid?:   string;
  /** The charter DOC's authority home (the door supplies `larSealHome()`). */
  readonly sealHome:    string;
  /** What the steward door reads of this vessel's keys; a test hands a fake. Absent → the node vault. */
  readonly vault?:      StewardVault;
  /** The store's one holder: the standing vessel's own Repo, or the direct holder's (`ownedStore`). */
  readonly repo:       Repo;
}

export interface CabalVouchResult {
  /** The worn face's key at the realm's Nexus: the key that signed. */
  readonly voucherDid:  string;
  /** The Nexus the realm stands under at this vessel. */
  readonly nexusAid:    string;
  readonly joiner:      string;
  readonly realm:       string;
  readonly boundEpoch:  string;
  readonly boardUrl:    string;
  /** The relationship id this vouch presents to the kāpae plane — what `lares edge kapae` takes to set it aside. */
  readonly edgeId:      string;
  /**
   * The FLOOR on this voucher's out-degree — how many edges THIS REPLICA can see, never how many exist. A sibling
   * replica may hold edges this one has not synced, so the dilution a voucher actually carries reads at
   * or above this number. Reported so a human sees what they just spent, never as a total (vouch-board's
   * no-completeness invariant: a count presented as total makes a withheld tie legible as a withheld tie).
   */
  readonly outDegreeFloor: number;
  /** True when this vouch replaced the voucher's own prior vouch for the SAME joiner (one edge, not two). */
  readonly reMinted:    boolean;
}

/**
 * Resolve the realm's effective lease epoch to bind a fresh vouch to, off this vessel's own daemon doc —
 * the SAME read `cabal-join` folds against when it prices a lineage. Mirrors `cabal-join`'s board exactly so
 * a vouch and the crossing it feeds price against one fence.
 *
 * FAIL-CLOSED ON UNREADABLE, NEVER A SILENT GENESIS: `cabalAdmissionEpoch` answers `0` for a realm that
 * genuinely has never rolled (a real, read answer) — but a vessel that cannot even OPEN its daemon doc gets
 * no fence to read at all, and minting at a guessed `0` there would let a vouch bind BEHIND a roll this
 * vessel never saw, lapsing the moment its view catches up. So an unreadable daemon doc refuses the mint by
 * name instead of guessing.
 */
async function resolveBoundEpoch(realm: string, repo: Repo, lineage: HandLineage | null): Promise<number> {
  if (!lineage) throw new CabalVouchError("lease-fence-unreadable: this vessel holds no verified charter lineage for the realm");
  const daemonUrl = daemonDocUrlFromBootstrap();
  if (!daemonUrl) {
    throw new CabalVouchError(
      "this vessel's daemon doc is unreadable — the realm's lease epoch cannot be resolved, so the mint " +
      "refuses rather than bind behind a roll it never saw. Pass boundEpoch explicitly to override.",
    );
  }
  try {
    const dh = await materializeSharedLarDoc(repo, daemonUrl as never, "daemon");
    return cabalAdmissionEpoch(dh.doc(), realm, lineage);
  } catch (err) {
    throw new CabalVouchError(
      `the realm's lease epoch could not be read off the daemon doc — refusing to mint at a guessed epoch ` +
      `(${err instanceof Error ? err.message : String(err)}).`,
    );
  }
}

/**
 * Mint one vouch and land it on the realm's own vouch board.
 *
 * Takes no `now`: a causal island holds no global now, and nothing here ever decided on the wall clock —
 * the fence that actually gates is `boundEpoch`, the realm's own lease epoch (evergreen sweep, G3).
 */
export async function runCabalVouch(opts: CabalVouchOptions): Promise<CabalVouchResult> {
  const joiner     = opts.joiner.trim().toLowerCase();
  const realm      = opts.realm.trim().toLowerCase();

  if (!NYM_RE.test(joiner)) {
    throw new CabalVouchError(`"${opts.joiner}" is not a valid joiner nym — expected a 64-hex ed25519 verifying key.`);
  }
  if (!NYM_RE.test(realm)) {
    throw new CabalVouchError(`"${opts.realm}" is not a valid realm — expected a 64-hex cabal-realm doc id.`);
  }

  // THE REALM'S NEXUS, and the ledger that keeps it: a vouch stands the vessel in the realm under one Nexus.
  const vesselKey = await loadWornFaceAtomKey();
  if (!vesselKey) throw new CabalVouchError("this vessel surfaces no verifying key — it keeps no ledger to note the realm in.");
  const nexusAid = await actingRealmNexus({
    repo: opts.repo, vesselKey, realm, sealHome: opts.sealHome,
    ...(opts.nexusAid !== undefined ? { named: opts.nexusAid } : {}), refuse: (m) => new CabalVouchError(m),
  });
  // THE FENCE binds through this realm's own Nexus charter; an unreadable lineage mints no guessed epoch.
  const boundEpoch = String(opts.boundEpoch ?? await resolveBoundEpoch(realm, opts.repo, leaseLineageOfNexus(opts.sealHome, nexusAid)));

  // A FACE NEVER VOUCHES FOR ITSELF, and the refusal mints nothing: the key the worn face already holds there
  // answers it, and a key minted below stands fresh, so no joiner named before it can name it.
  const standing = await wornNexusLeaf(nexusAid);
  if (standing && standing.verifyingKey.toLowerCase() === joiner) {
    throw new CabalVouchError("a face cannot vouch for itself — self-boosting is unrepresentable on a lineage.");
  }

  // WHICH FACE VOUCHES: the worn one, by the key it presents at that Nexus. The steward door mints it where none
  // stands (a vouch presents the face there) and passes it through the guard; no option names a persona index.
  let signer;
  try { signer = await wornStewardSigner(nexusAid, opts.vault ?? nodeStewardVault); }
  catch (err) {
    if (err instanceof StewardRefused) throw new CabalVouchError(err.message.replace(/^realm-bag: /, ""));
    throw err;
  }
  const voucherDid = signer.signer.toLowerCase();
  if (voucherDid === joiner) {
    throw new CabalVouchError("a face cannot vouch for itself — self-boosting is unrepresentable on a lineage.");
  }

  const invite = await signCabalInvite(
    { realmDocIdHex: realm, joinerIdentityHex: joiner, voucherDid, boundEpoch },
    signer.sign,
  );

  // THE BOARD KEYS ON THE REALM, never on a Nexus: a vouch names its voucher in the clear, so its record
  // stays among the parties to the realm it crosses (kapae#/four-edges).
  const boardUrl    = realmVouchBoardDocUrl(realm);
  const repo        = opts.repo;
  const verify      = (bytes: Uint8Array, sigHex: string, did: string) =>
    Promise.resolve(verifyEd25519(sigHex, bytes, did));
  try {
    const handle = await materializeSharedLarDoc(repo, boardUrl, "board:vouch-registry");

    const before   = await verifiedVouchesFromBoard(handle.doc(), realm, verify);
    const reMinted = before.some((i) => i.voucherDid === voucherDid && i.joinerIdentityHex === joiner);

    handle.change((d) => writeVouch(d, invite));
    await registerRealmFrontier({ repo, vesselKey, sealHome: opts.sealHome, realm, nexus: nexusAid,
      handle: await materializeSharedLarDoc(repo, realmEdgeBoardDocUrl(realm), "board:edge-kapae"), counted: [] });
    // This vessel reads this realm's boards from here on, under the Nexus the vouch named: its gates consult
    // every shadow raised there, and the realm's quorum reads off that Nexus's charter.
    await noteVesselRealm(repo, vesselKey, realm, nexusAid);
    await repo.flush();

    // NEVER leave a vouch the fold would drop. Read it BACK through the verifying read — the only read that
    // stands — so a vouch that cannot survive extraction refuses loudly here instead of silently vouching for
    // nobody. The same discipline `nexus-contract` runs before it writes a dead admit.
    const after = await verifiedVouchesFromBoard(handle.doc(), realm, verify);
    const landed = after.some((i: CabalInvite) =>
      i.voucherDid === voucherDid && i.joinerIdentityHex === joiner && i.sig === invite.sig);
    if (!landed) {
      throw new CabalVouchError("refusing silently: the vouch did not read back off the board through the verifying read.");
    }

    const outDegreeFloor = vouchDagFromInvites(after).edges.filter((e) => e.voucher === voucherDid).length;
    return { voucherDid, nexusAid, joiner, realm, boundEpoch, boardUrl, edgeId: vouchEdgeId(invite), outDegreeFloor, reMinted };
  } finally {
    await repo.flush().catch(() => { /* best-effort final flush */ });
  }
}
