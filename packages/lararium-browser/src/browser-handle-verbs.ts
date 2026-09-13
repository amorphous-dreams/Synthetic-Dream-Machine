/**
 * browser-handle-verbs — the browser/phone twins of node's own-face verbs (burn · attest). The ACT is one and
 * platform-blind (`burnOwnHandle` · `attestUnderHead`, @lararium/mesh); only the shores differ. Here they read
 * the ORIGIN's own IndexedDB — the persona vault for the seed, the browser public-handle store for the
 * announced nym — while the caller supplies the resolved WHO board its boot already holds (and, for an
 * owner-burn, the per-Nexus persona-KEL board). The mirror of `runHandleBurn`/`runHandleAttest`: the shores
 * sit at IndexedDB where node's sit at fs, and the mesh logic is shared.
 */
import type { DocHandle } from "@automerge/automerge-repo";
import {
  loadPersonaRootSeed, resolveOwnHandleChain, boardHeadCid, burnOwnHandle, signHandleCard,
  attestUnderHead, normalizeHandleClaim, headOpKey, personaKelChainForPrefix, PERSONA_KEL_PREFIX_TIDDLER,
  deriveVeiledUserKey, PERSONA_GLAMOUR_CONTEXT, ed25519SignerFromSeed, hexToBytes, hex,
  type LarDoc, type HandleCard, type HandleKelEvent, type HandleAttestation, type HandleClaim,
  type PersonaPublicHandleRecord,
} from "@lararium/mesh";
import * as ed25519 from "@noble/ed25519";
import { makeBrowserIdbPersonaVault, makeBrowserPublicHandleStore } from "./browser-vessel-identity.js";

interface OwnFaceBrowserContext {
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
 * Open the vessel's own published face for a persona from browser shores: load the persona seed + the
 * announced nym from the origin's IndexedDB, resolve the CURRENT chain off the supplied WHO board, and derive
 * the seated handle-key signer. The one boot the leased verbs (burn · attest) share; each supplies only its
 * own act over this context. The mirror of node's `openOwnFace`.
 */
async function openOwnFaceBrowser(
  verb: string, board: DocHandle<LarDoc>, handleIndex: number, idbName: string,
): Promise<OwnFaceBrowserContext> {
  const seed  = await loadPersonaRootSeed(await makeBrowserIdbPersonaVault(idbName), handleIndex);
  const store = await makeBrowserPublicHandleStore(idbName);
  const record = await store.load(handleIndex);
  if (!record) {
    throw new Error(`[browser handle ${verb}] no published face at persona h${handleIndex} — publish one first.`);
  }
  const chain = resolveOwnHandleChain(board.doc() as LarDoc, record.nym);
  if (!chain || chain.length === 0) {
    throw new Error(`[browser handle ${verb}] no chain on the WHO board for ${record.nym.slice(0, 16)}… — the face was never announced here.`);
  }
  const headCid = boardHeadCid(board.doc() as LarDoc, record.nym)!;
  const veiled  = await deriveVeiledUserKey(seed, handleIndex, PERSONA_GLAMOUR_CONTEXT);
  const veiledSigner = ed25519SignerFromSeed(hexToBytes(veiled.signingKey));
  return { board, handleIndex, seed, record, chain, headCid, veiledSigner };
}

/**
 * Resolve the OWNER-burn hand — the owning persona buries the face from above (a thief-of-the-face cannot
 * forge it). Pure over the resolved persona-KEL head: for a self-stood never-rotated persona the head op-key
 * IS the persona root DID (ceremony seats the founding op-key == root), so the root seed signs. FAILS CLOSED
 * on a ROTATED persona (the head advanced past the root), whose current op-key rides opt-in self-custody this
 * adapter does not yet reach — the caller falls back to a self-burn there. The browser twin of node's
 * `resolveOwnerBurnHand`, identical in shape.
 */
export async function resolveOwnerBurnHandBrowser(opts: {
  personaKelPrefix: string;
  headOpKeyDid:     string | null;
  rootSeed:         Uint8Array;
}): Promise<
  | { ok: true; ownerBurn: { ownerAuthMemberPrefix: string; ownerAuthKeyDid: string; sign: (b: Uint8Array) => Promise<string> } }
  | { ok: false; reason: string }
> {
  if (!opts.headOpKeyDid) {
    return { ok: false, reason: "the persona-KEL head is unreachable on this replica (fail-closed) — the owner cannot be proven; use a self-burn" };
  }
  const rootDid = `0x${hex(await ed25519.getPublicKeyAsync(opts.rootSeed))}`;
  if (opts.headOpKeyDid.toLowerCase() !== rootDid.toLowerCase()) {
    return { ok: false, reason: "owner-burn on a ROTATED persona wants the current op-key's custody (not wired) — use a self-burn" };
  }
  return {
    ok: true,
    ownerBurn: {
      ownerAuthMemberPrefix: opts.personaKelPrefix,
      ownerAuthKeyDid:       rootDid,
      sign:                  ed25519SignerFromSeed(opts.rootSeed),
    },
  };
}

/**
 * Burn a browser vessel's own published face. SELF-burn (default): the seated handle key closes its own name.
 * OWNER-burn (`fromPersona`): the owning persona buries it from above — resolve its verified head op-key off
 * the per-Nexus persona-KEL board (`kelBoard`), then the pure hand-resolver decides whether the root seed may
 * sign; a rotated persona's custody path is not reachable here, so it fails closed toward a self-burn (same as
 * node). A reader refuses a burned chain BEFORE ever checking the card's signature, so recognition ends
 * structurally at the burn. The board is a live DocHandle — the announce syncs; no flush is the browser's.
 */
export async function burnFaceBrowser(opts: {
  board:        DocHandle<LarDoc>;
  handleIndex:  number;
  idbName?:     string;
  now?:         number;
  /** Bury the face from ABOVE — the owning persona (its head op-key) signs, not the seated handle key. */
  fromPersona?: boolean;
  /** OWNER-burn only: the daemon doc carrying the persona-KEL prefix that owns the face. */
  daemonDoc?:   LarDoc;
  /** OWNER-burn only: the per-Nexus persona-KEL board twin, off which the owner head op-key resolves. */
  kelBoard?:    DocHandle<LarDoc>;
}): Promise<HandleCard> {
  const idbName = opts.idbName ?? "lares:vessel";
  const now     = opts.now ?? Date.now();
  const face    = await openOwnFaceBrowser("burn", opts.board, opts.handleIndex, idbName);

  // The card re-signs with the seated handle key regardless of hand — a reader refuses a burned chain BEFORE
  // checking the sig, so even an owner-burn of a lost key lands; a well-formed card just keeps the lineage clean.
  const buildCard = (_event: HandleKelEvent, newChain: HandleKelEvent[]): Promise<HandleCard> => signHandleCard(
    {
      nym: face.record.nym, chain: newChain, glamour: face.record.glamour,
      version: face.record.version + 1, prev: face.record.cardId,
      expiry: now + 86_400_000, standing: null, fleetProof: null,
    },
    face.veiledSigner,
  );

  let hand: Parameters<typeof burnOwnHandle>[0];
  if (opts.fromPersona) {
    // OWNER-burn: the owning persona buries the face from above. Resolve its verified head op-key off the
    // per-Nexus persona-KEL board, then the pure hand-resolver decides whether the root seed may sign.
    if (!opts.daemonDoc) {
      throw new Error("[browser handle burn --from-persona] the daemon doc is required to prove the owner; use a self-burn.");
    }
    if (!opts.kelBoard) {
      throw new Error("[browser handle burn --from-persona] the persona-KEL board is required to resolve the owner head; use a self-burn.");
    }
    const prefixEntry = (opts.daemonDoc as { tiddlers?: Record<string, unknown> }).tiddlers?.[PERSONA_KEL_PREFIX_TIDDLER] as { tiddler?: { text?: string } } | undefined;
    const personaKelPrefix = prefixEntry?.tiddler?.text ?? null;
    if (!personaKelPrefix) {
      throw new Error("[browser handle burn --from-persona] no persona-KEL prefix on the daemon doc — cannot prove the owner; use a self-burn.");
    }
    const personaChain = personaKelChainForPrefix(opts.kelBoard.doc() as LarDoc, personaKelPrefix);
    const headOpKeyDid = personaChain ? await headOpKey(personaChain, { verifyQuorums: true }) : null;
    const resolved     = await resolveOwnerBurnHandBrowser({ personaKelPrefix, headOpKeyDid, rootSeed: face.seed });
    if (!resolved.ok) throw new Error(`[browser handle burn --from-persona] ${resolved.reason}`);
    hand = { board: face.board, nym: face.record.nym, expectedHeadCid: face.headCid, ownerBurn: resolved.ownerBurn, buildCard };
  } else {
    // SELF-burn: the seated handle key closes its own name.
    hand = { board: face.board, nym: face.record.nym, expectedHeadCid: face.headCid, sign: face.veiledSigner, buildCard };
  }

  const result = await burnOwnHandle(hand);
  if (!result.ok) throw new Error(`[browser handle burn] ${result.reason}`);
  return result.card;
}

/**
 * Attest a claim under a browser vessel's own face — a signed statement carried ON the card, bound to the
 * current head event cid (a moved head stales it), verified reader-locally against the surface the claim names.
 * Not a chain event — it writes nothing to the board. The mirror of node's `runHandleAttest`.
 */
export async function attestFaceBrowser(opts: {
  board:       DocHandle<LarDoc>;
  handleIndex: number;
  /** The STRUCTURED edge — a named surface + the foreign subject it names. Prose reaches no adapter. */
  claim:       HandleClaim;
  idbName?:    string;
}): Promise<HandleAttestation> {
  if (!normalizeHandleClaim(opts.claim)) {
    throw new Error("[browser handle attest] the claim does not read as a structured edge — name a known surface and its subject.");
  }
  const face = await openOwnFaceBrowser("attest", opts.board, opts.handleIndex, opts.idbName ?? "lares:vessel");
  return attestUnderHead(face.chain, opts.claim, face.veiledSigner);
}
