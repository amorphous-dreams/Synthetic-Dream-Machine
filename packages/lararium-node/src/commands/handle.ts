/**
 * `lares handle publish` — the Node adapter for the publicly published "here I am" note (a Handle).
 *
 * A Handle is a persona's outward face: a self-certifying card carrying its glamour, put on the Nexus's WHO
 * board so the relay carries it to peers. The card anchors to its persona — the sealed anchor's persona-KEL
 * prefix (through `readFaceOwner`) seats as the face's owner, so a lost presentation key recovers THROUGH the persona rather than
 * orphaning the face. This adapter reads the store's one holder, loads the persona seed + prefix, resolves the WHO board,
 * and mints + announces.
 *
 * Only the disk/store shores belong here; the mint logic (the veiled key, the causal publication frontier, the announce)
 * is platform-blind in @lararium/mesh (publishPersonaGlamour), the very code a browser vessel runs.
 */
import type { DocHandle, Repo } from "@automerge/automerge-repo";
import {
  materializeSharedLarDoc, whoBoardDocUrl,
  publishHandleForFace, readFaceOwner,
  resolveOwnHandleChain, boardHeadCid, burnOwnHandle, rotateOwnHandle, signHandleCard,
  attestUnderHead, normalizeHandleClaim, personaKelBoardDocUrl, personaKelChainForPrefix,
  deriveVeiledUserKey, PERSONA_GLAMOUR_CONTEXT, ed25519SignerFromSeed, hexToBytes, hex,
  type LarDoc, type HandleCard, type HandleKelEvent, type HandleAttestation, type HandleClaim,
  type PersonaPublicHandleRecord, type FaceOwner, type PersonaKelEvent,
} from "@lararium/mesh";
import * as ed25519 from "@noble/ed25519";
import { loadIdentityAnchors } from "../identity-anchors.js";
import { loadFaceAnchorOfGroup } from "../face-anchor-store.js";
import {
  loadPersonaGroupRootSeed, loadVesselVerifyingKey, makeNodePublicHandleStore,
} from "../node-vessel-identity.js";
import { nodeNexusIsland } from "../nexus-standing.js";

import { resolveFace } from "../face-selector.js";
export interface HandlePublishOptions {
  /** The display name the world reads — "Guru-Josh", "The Dread Pirate Roberts". */
  readonly glamour: string;
  /** Which persona publishes; defaults to the worn persona, then 0. */
  readonly handleIndex?: number;
  /** The store's one holder: the standing vessel's own Repo, or the direct holder's (`ownedStore`). */
  readonly repo:         Repo;
}

/**
 * runHandlePublish — the disk adapter: resolve the WHO board and the selected face's sealed-anchor owner, load
 * the persona seed at the chosen index, and publish the Handle. The WHO board rides the deterministic per-Nexus
 * id (nexusPubkey = this vessel's verifying key), so the announce lands on the island board the relay syncs.
 */
export async function runHandlePublish(opts: HandlePublishOptions): Promise<HandleCard> {
  const repo        = opts.repo;
  const handleIndex = await resolveFace(opts.handleIndex);
  const nexusPubkey = await loadVesselVerifyingKey();
  const boardIsland = nodeNexusIsland({ ownVesselKey: nexusPubkey });
  // THE OWNER RIDES THE SEALED ANCHOR (the door): never the daemon tiddler.
  const owner       = await readHandleOwner(repo, handleIndex, boardIsland, "publish");
  const seed        = await loadPersonaGroupRootSeed(handleIndex);
  const board       = await materializeSharedLarDoc(repo, whoBoardDocUrl(boardIsland), "board:who-face");
  const store       = await makeNodePublicHandleStore();

  const card = await publishHandleForFace({ owner, board, seed, handleIndex, glamour: opts.glamour, store });
  await repo.flush();
  return card;
}

/**
 * The owner of the face `handleIndex` selects, from its SEALED anchor (the identity home's anchors row names the PersonaGroup, the
 * PersonaGroup names the face-anchor row) read against the verified persona-KEL chain beneath the anchor's prefix on the
 * per-Nexus board, through `readFaceOwner`. The daemon doc's `PERSONA_KEL_PREFIX_TIDDLER` names the founding face and a
 * document can move it, so no Handle act reads it. Refuses by name on a missing anchor, a missing or forked chain, or a chain
 * under another prefix.
 */
async function readHandleOwner(repo: Repo, handleIndex: number, boardIsland: ReturnType<typeof nodeNexusIsland>, verb: string): Promise<FaceOwner> {
  return readHandleOwnerOf(handleIndex, async (prefix) => {
    const kelBoard = await materializeSharedLarDoc(repo, personaKelBoardDocUrl(boardIsland), "board:persona-kel");
    return personaKelChainForPrefix(kelBoard.doc(), prefix);
  }, verb);
}

/** The owner read over the sealed rows alone; `chainFor` supplies the persona-KEL chain a prefix names (the per-Nexus board's). */
export async function readHandleOwnerOf(
  handleIndex: number, chainFor: (prefix: string) => Promise<PersonaKelEvent[] | null>, verb: string,
): Promise<FaceOwner> {
  const group  = (await loadIdentityAnchors(handleIndex))?.personaGroupId ?? null;
  const anchor = group ? await loadFaceAnchorOfGroup(group) : null;
  const chain  = anchor ? await chainFor(anchor.personaKelPrefix) : null;
  const read   = await readFaceOwner(chain, anchor);
  if (!read.ok) throw new Error(`[lares handle ${verb}] persona h${handleIndex}: ${read.reason}`);
  return read.owner;
}

interface OwnFaceContext {
  readonly repo:         Repo;
  readonly boardIsland:  ReturnType<typeof nodeNexusIsland>;
  readonly board:        DocHandle<LarDoc>;
  readonly handleIndex:  number;
  readonly seed:         Uint8Array;
  readonly record:       PersonaPublicHandleRecord;
  readonly chain:        HandleKelEvent[];
  readonly headCid:      string;
  /** The seated handle key's signer — the persona's veiled key at this index, the derivation `publish` uses. */
  readonly veiledSigner: (bytes: Uint8Array) => Promise<string>;
}

/**
 * Open the vessel's own published face for a persona: resolve the WHO board, load the persona
 * seed, find the announced nym + one settled verified chain off the board, and derive the seated handle-key signer.
 * The shared boot for burn and attest supplies only its own act over this context.
 */
async function openOwnFace(verb: string, repo: Repo, handleIndexOpt?: number): Promise<OwnFaceContext> {
  const handleIndex = await resolveFace(handleIndexOpt);
  const seed        = await loadPersonaGroupRootSeed(handleIndex);
  const nexusPubkey = await loadVesselVerifyingKey();
  const boardIsland = nodeNexusIsland({ ownVesselKey: nexusPubkey });
  const board       = await materializeSharedLarDoc(repo, whoBoardDocUrl(boardIsland), "board:who-face");
  const store       = await makeNodePublicHandleStore();

  const record = await store.load(handleIndex);
  if (!record) {
    throw new Error(`[lares handle ${verb}] no published face at persona h${handleIndex} — publish one first.`);
  }
  const chain = await resolveOwnHandleChain(board.doc() as LarDoc, record.nym);
  if (!chain || chain.length === 0) {
    throw new Error(`[lares handle ${verb}] no chain on the WHO board for ${record.nym.slice(0, 16)}… — the face was never announced here.`);
  }
  const headCid = await boardHeadCid(board.doc() as LarDoc, record.nym);
  if (!headCid) throw new Error(`[lares handle ${verb}] the WHO board has no settled publication head for ${record.nym.slice(0, 16)}… — fail closed.`);
  const veiled  = await deriveVeiledUserKey(seed, handleIndex, PERSONA_GLAMOUR_CONTEXT);
  const veiledSigner = ed25519SignerFromSeed(hexToBytes(veiled.signingKey));

  return { repo, boardIsland, board, handleIndex, seed, record, chain, headCid, veiledSigner };
}

/** The owning persona's authorizing hand — the member prefix, its head op-key, and a signer for that key. The
 *  shape owner-burn AND rotation share: both answer to the owning persona's CURRENT head op-key. */
export interface OwnerAuthHand {
  readonly ownerAuthMemberPrefix: string;
  readonly ownerAuthKeyDid:       string;
  readonly sign:                  (b: Uint8Array) => Promise<string>;
}

/**
 * Resolve the OWNING PERSONA's authorizing hand — the persona proves ownership from above (owner-burn: a
 * thief-of-the-face cannot forge it; rotation: a lost handle key recovers THROUGH the persona). Pure over the
 * resolved persona-KEL head:
 *   · a self-stood never-rotated persona seats head op-key == root DID (ceremony seats the founding op-key ==
 *     root), so the ROOT seed signs.
 *   · a ROTATED persona (head advanced past the root) needs its CURRENT op-key seed. When `opKeyCustody`
 *     yields a signer for the head op-key this replica holds, that key signs; otherwise FAILS CLOSED toward
 *     `--self` (the current op-key seed is genuinely unreachable here — never guess a signer).
 */
export async function resolveOwnerBurnHand(opts: {
  personaKelPrefix: string;
  headOpKeyDid:     string | null;
  rootSeed:         Uint8Array;
  /** Optional op-key custody — given the persona prefix + its CURRENT head op-key did, yields a signer for
   *  that key when this replica holds the seed (a rotated persona's current op-key), else null. */
  opKeyCustody?:    (personaKelPrefix: string, headOpKeyDid: string) => Promise<((b: Uint8Array) => Promise<string>) | null>;
}): Promise<{ ok: true; ownerBurn: OwnerAuthHand } | { ok: false; reason: string }> {
  if (!opts.headOpKeyDid) {
    return { ok: false, reason: "the persona-KEL head is unreachable on this replica (fail-closed) — the owner cannot be proven; use `--self`" };
  }
  const rootDid = `0x${hex(await ed25519.getPublicKeyAsync(opts.rootSeed))}`;
  if (opts.headOpKeyDid.toLowerCase() === rootDid.toLowerCase()) {
    return {
      ok: true,
      ownerBurn: { ownerAuthMemberPrefix: opts.personaKelPrefix, ownerAuthKeyDid: rootDid, sign: ed25519SignerFromSeed(opts.rootSeed) },
    };
  }
  // ROTATED — the head is not the root. Consult custody for the current op-key seed; sign only if it holds it.
  const custodied = opts.opKeyCustody ? await opts.opKeyCustody(opts.personaKelPrefix, opts.headOpKeyDid) : null;
  if (custodied) {
    return {
      ok: true,
      ownerBurn: { ownerAuthMemberPrefix: opts.personaKelPrefix, ownerAuthKeyDid: opts.headOpKeyDid, sign: custodied },
    };
  }
  return { ok: false, reason: "owner-burn on a ROTATED persona wants the current op-key's custody (unreachable on this replica) — use `lares handle burn --self`" };
}

export interface HandleBurnOptions {
  /** Which persona's face to bury; defaults to the worn persona, then 0. */
  readonly handleIndex?: number;
  /** The store's one holder: the standing vessel's own Repo, or the direct holder's (`ownedStore`). */
  readonly repo:         Repo;
  /** Bury the face from ABOVE — the owning persona (its head op-key) signs, not the seated handle key. */
  readonly fromPersona?: boolean;
}

/**
 * runHandleBurn — the disk adapter for `lares handle burn` (SELF-burn: the seated handle key closes its own
 * name). Resolve the vessel's own published nym for the chosen persona, resolve one settled verified chain from the WHO
 * board, mint a terminal burn conditioned on that head, and re-announce the burned card. A reader refuses the
 * burned chain before ever checking the card's signature, so recognition ends structurally at the burn. The
 * owner-burn hand (the persona buries the face from above, `--from-persona`) rides a later increment — it
 * wants the persona head op-key signer wired.
 */
export async function runHandleBurn(opts: HandleBurnOptions): Promise<HandleCard> {
  const face = await openOwnFace("burn", opts.repo, opts.handleIndex);

  // The card re-signs with the seated handle key regardless of hand — a reader refuses a burned chain BEFORE
  // checking the sig, so even an owner-burn of a lost key lands; a well-formed card just keeps the lineage clean.
  const buildCard = (_event: HandleKelEvent, newChain: HandleKelEvent[]): Promise<HandleCard> => signHandleCard(
    {
      nym: face.record.nym, chain: newChain, glamour: face.record.glamour,
      parents: face.record.heads, standing: null, fleetProof: null,
    },
    face.veiledSigner,
  );

  let hand: Parameters<typeof burnOwnHandle>[0];
  if (opts.fromPersona) {
    // OWNER-burn: the owning persona buries the face from above. Its prefix and verified head op-key come from the
    // sealed anchor through the door, then the pure hand-resolver decides whether the root seed may sign.
    const { personaKelPrefix, headOpKeyDid } = await readHandleOwner(face.repo, face.handleIndex, face.boardIsland, "burn --from-persona");
    const resolved     = await resolveOwnerBurnHand({ personaKelPrefix, headOpKeyDid, rootSeed: face.seed });
    if (!resolved.ok) throw new Error(`[lares handle burn --from-persona] ${resolved.reason}`);
    hand = { board: face.board, nym: face.record.nym, expectedHeadCid: face.headCid, ownerBurn: resolved.ownerBurn, buildCard };
  } else {
    // SELF-burn: the seated handle key closes its own name.
    hand = { board: face.board, nym: face.record.nym, expectedHeadCid: face.headCid, sign: face.veiledSigner, buildCard };
  }

  const result = await burnOwnHandle(hand);
  if (!result.ok) throw new Error(`[lares handle burn] ${result.reason}`);
  const store = await makeNodePublicHandleStore();
  await store.save({
    handleIndex: face.handleIndex, contextIndex: face.record.contextIndex, nym: face.record.nym,
    glamour: face.record.glamour, heads: [result.card.actCid],
  });
  await face.repo.flush();
  return result.card;
}

export interface HandleRotateOptions {
  /** Which persona's face to rotate; defaults to the worn persona, then 0. */
  readonly handleIndex?: number;
  /** The store's one holder: the standing vessel's own Repo, or the direct holder's (`ownedStore`). */
  readonly repo:         Repo;
}

/**
 * runHandleRotate — the disk adapter for `lares handle rotate` (Option A: the context-ladder). Seat a FRESH
 * presentation key under the same name, the OWNING PERSONA authorizing (a lost handle key recovers through the
 * persona). Resolve the owning persona's verified head op-key off the per-Nexus persona-KEL board, resolve the
 * authorizing hand (the root seed signs a never-rotated persona; a rotated one wants its current op-key custody,
 * unreachable here → fail-closed toward re-founding the face), then rotate over the board's settled verified chain
 * and re-announce the renewed card signed by the fresh head handle key. The advanced record keeps the
 * causal publication frontier a peer's HandleBook holds to.
 */
export async function runHandleRotate(opts: HandleRotateOptions): Promise<HandleCard> {
  const face = await openOwnFace("rotate", opts.repo, opts.handleIndex);

  // The OWNING PERSONA authorizes rotation. Resolve its verified head op-key off the per-Nexus persona-KEL board.
  const { personaKelPrefix, headOpKeyDid } = await readHandleOwner(face.repo, face.handleIndex, face.boardIsland, "rotate");
  const resolved     = await resolveOwnerBurnHand({ personaKelPrefix, headOpKeyDid, rootSeed: face.seed });
  if (!resolved.ok) throw new Error(`[lares handle rotate] ${resolved.reason}`);

  const store = await makeNodePublicHandleStore();
  const buildCard = async (_event: HandleKelEvent, newChain: HandleKelEvent[], freshSign: (b: Uint8Array) => Promise<string>): Promise<HandleCard> =>
    signHandleCard(
      {
        nym: face.record.nym, chain: newChain, glamour: face.record.glamour,
        parents: face.record.heads, standing: null, fleetProof: null,
      },
      freshSign,   // the FRESH head handle key certifies the renewed card
    );

  const result = await rotateOwnHandle({
    board: face.board, nym: face.record.nym, expectedHeadCid: face.headCid,
    seed: face.seed, handleIndex: face.handleIndex, contextBase: face.record.contextIndex,
    ownerAuthMemberPrefix: resolved.ownerBurn.ownerAuthMemberPrefix,
    ownerHeadOpKeyDid:     resolved.ownerBurn.ownerAuthKeyDid,
    sign:                  resolved.ownerBurn.sign,
    buildCard,
  });
  if (!result.ok) throw new Error(`[lares handle rotate] ${result.reason}`);

  // Advance the vessel's own publication frontier so the next act names this act as its parent.
  await store.save({
    handleIndex: face.handleIndex, contextIndex: face.record.contextIndex, nym: face.record.nym,
    glamour: face.record.glamour, heads: [result.card.actCid],
  });
  await face.repo.flush();
  return result.card;
}

export interface HandleAttestOptions {
  /** The STRUCTURED edge the face signs under its current head — a named surface + the foreign subject it
   *  names (+ optionally where the return leg lives). Prose reaches no adapter, so the type refuses it. */
  readonly claim: HandleClaim;
  readonly handleIndex?: number;
  /** The store's one holder: the standing vessel's own Repo, or the direct holder's (`ownedStore`). */
  readonly repo:         Repo;
}

/**
 * runHandleAttest — mint a signed claim carried ON the card, bound to the current head event cid (a moved head
 * stales it). A standalone statement the operator carries out-of-band and a reader verifies reader-locally
 * against the empire's own surface (DNS for a domain); this stack compiles no Handle→claim index (registry
 * filter). Not a chain event — it writes nothing to the board.
 *
 * The claim reads as a STRUCTURED causal-island edge (handle-card#the-chain): a foreign peer sharing none of
 * our context reads the surface, reaches the subject, and looks for the prefix coming back.
 */
export async function runHandleAttest(opts: HandleAttestOptions): Promise<HandleAttestation> {
  if (!normalizeHandleClaim(opts.claim)) {
    throw new Error("[lares handle attest] the claim does not read as a structured edge — name a known surface and its subject.");
  }
  const face = await openOwnFace("attest", opts.repo, opts.handleIndex);
  return attestUnderHead(face.chain, opts.claim, face.veiledSigner);
}
