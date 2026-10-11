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
 * FAIL CLOSED: an unknown persona root, a malformed joiner nym, an expiry already past, or a signature that
 * does not read back off the board REFUSES before anything lands. Never write a vouch the fold would drop.
 *
 * Meme: lar:///ha.ka.ba/lares/api/pono/admission-on-a-lineage#/the-standing
 */

import type { Repo } from "@automerge/automerge-repo";
import * as ed from "@noble/ed25519";
import {
  signCabalInvite, writeVouch, verifiedVouchesFromBoard, vouchDagFromInvites,
  vouchBoardDocUrl, materializeSharedLarDoc, ed25519SignerFromSeed, hexToBytes,
  type CabalInvite,
} from "@lararium/mesh";
import {
  listPersonaRoots, loadPersonaGroupRootSeed, loadPersonaGroupRootVerifyingKey, loadVesselVerifyingKey,
} from "../node-vessel-identity.js";
import { nodeNexusIsland } from "../nexus-standing.js";
import { daemonDocUrlFromBootstrap, cabalAdmissionEpoch } from "./cabal-join.js";

/** A nym reads valid only at the exact ed25519 verifying-key shape — a stray value never becomes an edge. */
const NYM_RE = /^[0-9a-f]{64}$/;

export class CabalVouchError extends Error {}

export interface CabalVouchOptions {
  /** The joiner this vouch names. A vouch never rides bearer — it binds to one identity. */
  readonly joiner:      string;
  /** The cabal-realm this vouch crosses INTO. A vouch never grants a general pass. */
  readonly realm:       string;
  /** ISO-8601. Absent → 30 days out. A HINT the voucher's tools render; it gates no admission. */
  readonly expiresAt?:  string;
  /** The realm lease epoch to bind to — the fence that actually gates. Absent → 0 (genesis). */
  readonly boundEpoch?: number;
  /** WHICH held persona root vouches — the human's own face. Absent → the first held root. */
  readonly handleIndex?: number;
  /** The store's one holder: the standing vessel's own Repo, or the direct holder's (`ownedStore`). */
  readonly repo:       Repo;
}

export interface CabalVouchResult {
  readonly voucherDid:  string;
  readonly joiner:      string;
  readonly realm:       string;
  readonly expiresAt:   string;
  readonly boundEpoch:  string;
  readonly boardUrl:    string;
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

/** Thirty days out — long enough to carry out-of-band, short enough that a stale vouch dies on its own. */
function defaultExpiry(now: number): string {
  return new Date(now + 30 * 24 * 60 * 60 * 1000).toISOString();
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
async function resolveBoundEpoch(realm: string, repo: Repo): Promise<number> {
  const daemonUrl = daemonDocUrlFromBootstrap();
  if (!daemonUrl) {
    throw new CabalVouchError(
      "this vessel's daemon doc is unreadable — the realm's lease epoch cannot be resolved, so the mint " +
      "refuses rather than bind behind a roll it never saw. Pass boundEpoch explicitly to override.",
    );
  }
  try {
    const dh = await materializeSharedLarDoc(repo, daemonUrl as never, "daemon");
    return cabalAdmissionEpoch(dh.doc(), realm);
  } catch (err) {
    throw new CabalVouchError(
      `the realm's lease epoch could not be read off the daemon doc — refusing to mint at a guessed epoch ` +
      `(${err instanceof Error ? err.message : String(err)}).`,
    );
  }
}

/**
 * Mint one vouch and land it on the Nexus's vouch board.
 *
 * `now` rides as a parameter rather than a read of the wall clock, because a causal island holds no global
 * now and a test must stand at a chosen instant. It decides NOTHING about whether the mint runs — only the
 * default `expiresAt` HINT below reads it, and that hint gates no admission.
 */
export async function runCabalVouch(opts: CabalVouchOptions, now = Date.now()): Promise<CabalVouchResult> {
  const joiner     = opts.joiner.trim().toLowerCase();
  const realm      = opts.realm.trim().toLowerCase();

  if (!NYM_RE.test(joiner)) {
    throw new CabalVouchError(`"${opts.joiner}" is not a valid joiner nym — expected a 64-hex ed25519 verifying key.`);
  }
  if (!NYM_RE.test(realm)) {
    throw new CabalVouchError(`"${opts.realm}" is not a valid realm — expected a 64-hex cabal-realm doc id.`);
  }

  const expiresAt = opts.expiresAt ?? defaultExpiry(now);
  // THE FENCE THE VOUCH IS BOUND TO. A vouch minted now binds to the realm's epoch as this vessel reads
  // it: roll the realm past that number and every vouch bound behind it lapses at once, on every
  // replica, with no clock consulted. `expiresAt` above rides along as ADVISORY DISPLAY ONLY for the
  // voucher's own tools — no verdict anywhere reads it, and a past-dated expiry mints exactly as well as
  // a future one; only the fence below decides whether a vouch stands.
  const boundEpoch = String(opts.boundEpoch ?? await resolveBoundEpoch(realm, opts.repo));

  // WHICH FACE VOUCHES. A human holds a multitude; the vouch stakes ONE of them, named here rather than
  // guessed, because the standing it dilutes belongs to that face alone.
  const held = await listPersonaRoots();
  if (held.length === 0) {
    throw new CabalVouchError("no persona root held on this vessel — a vouch stakes a face, and this vessel holds none.");
  }
  const handleIndex = opts.handleIndex ?? held[0]!;
  if (!held.includes(handleIndex)) {
    throw new CabalVouchError(`persona root ${handleIndex} is not held here (held: ${held.join(", ")}).`);
  }

  // The vault may hold a root it cannot surface a key for (a torn or half-written slot). Refuse rather than
  // vouch under a face nobody can verify — an unverifiable voucher yields a vouch the board's read drops.
  const voucherDid = await loadPersonaGroupRootVerifyingKey(handleIndex);
  if (!voucherDid || !NYM_RE.test(voucherDid.toLowerCase())) {
    throw new CabalVouchError(`persona root ${handleIndex} surfaces no usable verifying key — nothing to stake.`);
  }
  if (voucherDid.toLowerCase() === joiner) {
    throw new CabalVouchError("a face cannot vouch for itself — self-boosting is unrepresentable on a lineage.");
  }

  const seed   = await loadPersonaGroupRootSeed(handleIndex);
  const invite = await signCabalInvite(
    { realmDocIdHex: realm, joinerIdentityHex: joiner, voucherDid, expiresAt, boundEpoch },
    ed25519SignerFromSeed(seed),
  );

  const nexusPubkey = await loadVesselVerifyingKey();
  const boardIsland = nodeNexusIsland({ ownVesselKey: nexusPubkey });
  const boardUrl    = vouchBoardDocUrl(boardIsland);
  const repo        = opts.repo;
  const verify      = (bytes: Uint8Array, sigHex: string, did: string) =>
    ed.verifyAsync(hexToBytes(sigHex), bytes, hexToBytes(did)).catch(() => false);
  try {
    const handle = await materializeSharedLarDoc(repo, boardUrl, "board:vouch-registry");

    const before   = await verifiedVouchesFromBoard(handle.doc(), realm, verify);
    const reMinted = before.some((i) => i.voucherDid === voucherDid && i.joinerIdentityHex === joiner);

    handle.change((d) => writeVouch(d, invite));
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
    return { voucherDid, joiner, realm, expiresAt, boundEpoch, boardUrl, outDegreeFloor, reMinted };
  } finally {
    await repo.flush().catch(() => { /* best-effort final flush */ });
  }
}
