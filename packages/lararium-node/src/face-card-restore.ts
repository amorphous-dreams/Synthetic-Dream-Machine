/**
 * face-card-restore — THE ROOT-CARD READER: the split-root cards re-land one face's lineage and root, and open no memory.
 *
 * ── WHAT THE CARDS HOLD ─────────────────────────────────────────────────────────────────────────
 * `lares persona new --split-root` splits the face's persona root 2-of-3 {device, recorded-code, escrow-peer}. The
 * person carries the recorded code and the escrow carrier off the device; the device share seals into the lost
 * vessel's home and dies with it. A guardian-card split names its three cards the same way (mine → device,
 * guardian-A → guardian, guardian-B → escrow-peer). A code spells only the share's point and its checksum: it names
 * no custodian, no epoch and no root. So the reader asks the person for the custodian each card came from, and for
 * the face the cards should rebuild.
 *
 * ── WHAT THIS READER DOES ───────────────────────────────────────────────────────────────────────
 * It reads each card on its checksum, gathers a quorum (two distinct custodians), and rebuilds the root seed in
 * this process for the length of one build. Then it asks one question the cards cannot answer for themselves: does
 * the rebuilt root name the face the person presented? Shamir carries no validity check, so shares of two different
 * roots rebuild a seed nobody holds; only the root's own public key, or the prefix it derives, separates that
 * seed from the face. A mismatch refuses `cards-another-root` before anything reads the board.
 *
 * It then BUILDS the body `restoreFaceBody` lands: the root and its verifying key, a roster line at the target
 * index, the anchors the root derives (the signer's name, and the prefix of the inception the root derives), the
 * inception alone as the carried key history, no names, no proof keys, no handle-book records, no guardian set. The
 * board supplies any later key event, and the restore's head check folds both: a rotation away from the root
 * refuses `root-superseded`.
 *
 * ── PAPER RESTORES A ROOT, NEVER MEMORY ─────────────────────────────────────────────────────────
 * The memory section of the built body holds no entry, sealed to a public key whose secret half this reader never
 * keeps. Content keys stay random and wrap under the vessel key or a bundle's own key; no key the root derives opens
 * memory. A person recovers memory through a bundle (`lares vault restore <file> --memory`).
 *
 * Node-main only: a worker never imports this module. The door `lares vault restore --cards` reads each card on a
 * terminal by the custody prompt's law, builds the body in the person's own process, and hands it to the vessel
 * sealed under a fresh key, through the same `bundle.restore` act a bundle rides.
 * Canon: lar:///ha.ka.ba/lararium/mesh/custody#/the-restore
 */
import { createPrivateKey, createPublicKey } from "node:crypto";
import type { Repo } from "@automerge/automerge-repo";
import {
  assembleQuorum, bundleMemoryKeypair, decodeShareBytes, deriveSelfRecoveryKey, mintBundleKey, mintPersonaInception,
  reconstructFromQuorum, sealKeySetHash, sealMemorySection,
  type CustodianTag, type FaceBundleBody, type RecoveryShare,
} from "@lararium/mesh";
import { restoreFaceBody, type FaceBundleRestored } from "./face-bundle-restore.js";

/** The names the reader refuses under, beside the restore's own (`RESTORE_REFUSALS`), which pass through untouched. */
export const CARD_REFUSALS = [
  "cards-too-few", "cards-one-custodian", "card-malformed", "cards-repeat", "face-unnamed", "cards-another-root",
] as const;
export type CardRefusal = (typeof CARD_REFUSALS)[number];

/** A reader that refuses before any row moves. */
export class CardRestoreRefused extends Error {
  override readonly name = "CardRestoreRefused";
  constructor(readonly reason: CardRefusal, message: string) { super(message); }
}
const refuse = (reason: CardRefusal, message: string): never => { throw new CardRestoreRefused(reason, message); };

/** One card the person presents: its printed code, and the custodian it came from. */
export interface PresentedCard { readonly code: string; readonly custodian: CustodianTag }

/** The face the cards should rebuild, as the person names it: its root's public key, its prefix, or both. */
export interface FaceNamed { readonly verifyingKey?: string; readonly prefix?: string }

const CUSTODIANS: readonly CustodianTag[] = ["device", "recorded-code", "guardian", "escrow-peer"];
/** The threshold every founding split carries. */
const QUORUM = 2;
/** A card of the first split reads as epoch 1; a code spells no epoch, and a stale share meets the root check. */
const CARD_EPOCH = 1;
const SEED_BYTES = 32;

const PKCS8_ED25519 = Buffer.from("302e020100300506032b657004220420", "hex");
function publicOfSeed(seed: Uint8Array): string {
  const key = createPrivateKey({ key: Buffer.concat([PKCS8_ED25519, Buffer.from(seed)]), format: "der", type: "pkcs8" });
  return Buffer.from((createPublicKey(key).export({ format: "jwk" }) as { x: string }).x, "base64url").toString("hex");
}
const bare = (s: string): string => s.trim().toLowerCase().replace(/^0x/, "");

/** Read each card on its checksum and its custodian, or refuse by name. Distinct points, one custodian each. */
function sharesOf(cards: readonly PresentedCard[]): RecoveryShare[] {
  const shares = cards.map((card, i): RecoveryShare => {
    if (!CUSTODIANS.includes(card.custodian)) refuse("card-malformed", `card ${i + 1} names a custodian no split holds (${String(card.custodian)}). Nothing moved.`);
    try {
      const bytes = decodeShareBytes(typeof card.code === "string" ? card.code.trim().toLowerCase() : "");
      if (bytes.ys.length !== SEED_BYTES || bytes.x < 1) throw new Error("a card of a root split carries a thirty-two-byte share");
      return { bytes, custodian: card.custodian, recoveryEpoch: CARD_EPOCH };
    } catch (err) {
      return refuse("card-malformed", `card ${i + 1} reads as no root card (${(err as Error).message}). Nothing moved.`);
    }
  });
  if (shares.length < QUORUM) refuse("cards-too-few", `${shares.length} card(s) presented, and a root takes ${QUORUM} cards from distinct custodians. Nothing moved.`);
  if (new Set(shares.map((s) => s.bytes.x)).size !== shares.length) refuse("cards-repeat", "one card stands twice in what was presented. Nothing moved.");
  if (new Set(shares.map((s) => s.custodian)).size < QUORUM) refuse("cards-one-custodian", "the cards come from one custodian, and a root takes cards from two distinct custodians. Nothing moved.");
  return shares;
}

/** A memory section with no entry, sealed to a public key whose secret half falls away at once: it opens for nobody. */
function emptyMemorySection(): string {
  const key = mintBundleKey();
  const pair = bundleMemoryKeypair(key);
  try { return Buffer.from(sealMemorySection([], pair.public)).toString("base64"); }
  finally { key.fill(0); pair.secret.fill(0); }
}

/**
 * Build the body the restore lands from the presented cards, at `as`. Refuses by name before it builds: too few
 * cards, one custodian, a malformed or repeated card, no face named, and a rebuilt root that names another face.
 * The seed the cards rebuild rests in the returned body (the restore lands it as the face's root); the caller hands
 * the body to `restoreFaceBody` and drops it.
 */
export async function buildCardBody(args: { readonly cards: readonly PresentedCard[]; readonly face: FaceNamed; readonly as: number }): Promise<FaceBundleBody> {
  if (!Number.isSafeInteger(args.as) || args.as < 0) refuse("face-unnamed", "the target index reads as no handle-index. Nothing moved.");
  const wantKey = args.face.verifyingKey === undefined ? null : bare(args.face.verifyingKey);
  const wantPrefix = args.face.prefix === undefined ? null : args.face.prefix.trim();
  if (wantKey === null && wantPrefix === null) {
    refuse("face-unnamed", "name the face the cards should rebuild, by its root's public key or by its prefix: a code carries no root, and shares of two roots rebuild a seed nobody holds. Nothing moved.");
  }
  const shares = sharesOf(args.cards);
  const seed = reconstructFromQuorum(assembleQuorum(shares, QUORUM));
  try {
    if (seed.length !== SEED_BYTES) refuse("card-malformed", "the cards rebuild no thirty-two-byte root. Nothing moved.");
    const verifyingKey = publicOfSeed(seed);
    const signerDid = `0x${verifyingKey}`;
    const recoveryCommit = sealKeySetHash([(await deriveSelfRecoveryKey(seed)).verifyingKey], 1);
    const inception = mintPersonaInception(signerDid, recoveryCommit);
    if ((wantKey !== null && wantKey !== verifyingKey) || (wantPrefix !== null && wantPrefix !== inception.prefix)) {
      refuse("cards-another-root", "the cards rebuild a root other than the face named: they come from two different splits, from a split that re-rolled, or from another face. Nothing moved.");
    }
    return {
      root: { signingKey: Buffer.from(seed).toString("hex"), verifyingKey },
      rosterLine: { handleIndex: args.as, verifyingKey },
      anchors: { signerDid, personaKelPrefix: inception.prefix },
      kel: [inception],
      names: {}, faceProofKeys: [], handleBook: { records: [] }, guardianSet: null,
      memory: { section: emptyMemorySection(), holds: [] },
    };
  } finally { seed.fill(0); }
}

/**
 * Restore one face from its root cards. The reader builds the body and hands it to the one restore, which runs every
 * check a bundle's body passes, commits one pending row and lands the root, its roster line and the re-admit under
 * this vessel's own veil, at a new seat. The restore's own refusals pass through (`RestoreRefused`), a rotation
 * away from the root on the board among them (`root-superseded`).
 */
export async function restoreFaceFromCards(args: {
  readonly cards:    readonly PresentedCard[];
  readonly face:     FaceNamed;
  /** The free handle-index the face lands at here. */
  readonly as:       number;
  readonly withRepo: <T>(act: (repo: Repo) => Promise<T>) => Promise<T>;
}): Promise<FaceBundleRestored> {
  const body = await buildCardBody({ cards: args.cards, face: args.face, as: args.as });
  return restoreFaceBody({ body, as: args.as, withRepo: args.withRepo });
}
