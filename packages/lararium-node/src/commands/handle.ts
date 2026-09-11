/**
 * `lares handle publish` — the Node adapter for the publicly published "here I am" note (a Handle).
 *
 * A Handle is a persona's outward face: a self-certifying card carrying its glamour, put on the Nexus's WHO
 * board so the relay carries it to peers. The card anchors to its persona — the daemon doc's persona-KEL
 * prefix seats as the face's owner, so a lost presentation key recovers THROUGH the persona rather than
 * orphaning the face. This adapter opens the store, loads the persona seed + prefix, resolves the WHO board,
 * and mints + announces.
 *
 * Only the disk/store shores belong here; the mint logic (the veiled key, the monotone lineage, the announce)
 * is platform-blind in @lararium/mesh (publishPersonaGlamour), the very code a browser vessel runs.
 */
import { Repo } from "@automerge/automerge-repo";
import { NodeFSStorageAdapter } from "@automerge/automerge-repo-storage-nodefs";
import type { AutomergeUrl, DocHandle } from "@automerge/automerge-repo";
import { readFileSync, existsSync } from "node:fs";
import {
  DAEMON_BAG_ID, PERSONA_KEL_PREFIX_TIDDLER, materializeSharedLarDoc, whoBoardDocUrl,
  publishHandleFromDaemonDoc,
  resolveOwnHandleChain, boardHeadCid, burnOwnHandle, signHandleCard,
  attestUnderHead, headOpKey, personaKelBoardDocUrl, personaKelChainForPrefix,
  deriveVeiledUserKey, PERSONA_GLAMOUR_CONTEXT, ed25519SignerFromSeed, hexToBytes, hex,
  type LarDoc, type HandleCard, type HandleKelEvent, type HandleAttestation,
  type PersonaPublicHandleRecord,
} from "@lararium/mesh";
import * as ed25519 from "@noble/ed25519";
import { larDataDir, larBootstrapPath } from "../vessel-paths.js";
import {
  loadPersonaGroupRootSeed, loadVesselVerifyingKey, makeNodePublicHandleStore, loadActivePersonaIndex,
} from "../node-vessel-identity.js";

export interface HandlePublishOptions {
  /** The display name the world reads — "Guru-Josh", "The Dread Pirate Roberts". */
  readonly glamour: string;
  /** Which persona publishes; defaults to the worn persona, then 0. */
  readonly handleIndex?: number;
  readonly storageDir?: string;
  /** Injected clock for determinism in tests; defaults to now. */
  readonly now?: number;
}

/**
 * runHandlePublish — the disk adapter: resolve the daemon doc + WHO board from the vessel's own store, load
 * the persona seed at the chosen index, and publish the Handle. The WHO board rides the deterministic per-Nexus
 * id (nexusPubkey = this vessel's verifying key), so the announce lands on the island board the relay syncs.
 */
export async function runHandlePublish(opts: HandlePublishOptions): Promise<HandleCard> {
  const storageDir = opts.storageDir ?? larDataDir();
  const bootstrap  = larBootstrapPath();
  if (!existsSync(bootstrap)) {
    throw new Error(`[lares handle publish] ${bootstrap} not found — run \`lares vessel found\` first.`);
  }
  const tiddlers = (JSON.parse(
    (JSON.parse(readFileSync(bootstrap, "utf8")) as { text?: string }).text ?? "{}",
  ) as { tiddlers?: Record<string, { text?: string }> }).tiddlers ?? {};
  const daemonUrl = tiddlers[DAEMON_BAG_ID]?.text ?? null;
  if (!daemonUrl) {
    throw new Error("[lares handle publish] daemon doc URL missing from social-bootstrap.json — run `lares vessel found`.");
  }

  const repo     = new Repo({ storage: new NodeFSStorageAdapter(storageDir) });
  const progress = repo.findWithProgress(daemonUrl as AutomergeUrl);
  const daemonHandle = await Promise.race([
    progress.whenReady(),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("[lares handle publish] daemon doc not ready after 5s")), 5000),
    ),
  ]);
  const daemonDoc = daemonHandle.doc() as LarDoc;

  const handleIndex = opts.handleIndex ?? (await loadActivePersonaIndex(storageDir)) ?? 0;
  const seed        = await loadPersonaGroupRootSeed(storageDir, handleIndex);
  const nexusPubkey = await loadVesselVerifyingKey(storageDir);
  const board       = await materializeSharedLarDoc(repo, whoBoardDocUrl(nexusPubkey), "board:who-face");
  const store       = await makeNodePublicHandleStore();

  const card = await publishHandleFromDaemonDoc({
    daemonDoc, board, seed, handleIndex, glamour: opts.glamour, now: opts.now ?? Date.now(), store,
  });
  await repo.flush();
  return card;
}

interface OwnFaceContext {
  readonly repo:         Repo;
  readonly daemonDoc:    LarDoc;
  readonly board:        DocHandle<LarDoc>;
  readonly storageDir:   string;
  readonly handleIndex:  number;
  readonly seed:         Uint8Array;
  readonly record:       PersonaPublicHandleRecord;
  readonly chain:        HandleKelEvent[];
  readonly headCid:      string;
  /** The seated handle key's signer — the persona's veiled key at this index, the derivation `publish` uses. */
  readonly veiledSigner: (bytes: Uint8Array) => Promise<string>;
}

/**
 * Open the vessel's own published face for a persona: resolve the daemon doc + WHO board, load the persona
 * seed, find the announced nym + its CURRENT chain off the board, and derive the seated handle-key signer.
 * The one boot the leased verbs (burn · attest) share; each supplies only its own act over this context.
 */
async function openOwnFace(verb: string, storageDirOpt?: string, handleIndexOpt?: number): Promise<OwnFaceContext> {
  const storageDir = storageDirOpt ?? larDataDir();
  const bootstrap  = larBootstrapPath();
  if (!existsSync(bootstrap)) {
    throw new Error(`[lares handle ${verb}] ${bootstrap} not found — run \`lares vessel found\` first.`);
  }
  const tiddlers = (JSON.parse(
    (JSON.parse(readFileSync(bootstrap, "utf8")) as { text?: string }).text ?? "{}",
  ) as { tiddlers?: Record<string, { text?: string }> }).tiddlers ?? {};
  const daemonUrl = tiddlers[DAEMON_BAG_ID]?.text ?? null;
  if (!daemonUrl) {
    throw new Error(`[lares handle ${verb}] daemon doc URL missing from social-bootstrap.json — run \`lares vessel found\`.`);
  }
  const repo     = new Repo({ storage: new NodeFSStorageAdapter(storageDir) });
  const progress = repo.findWithProgress(daemonUrl as AutomergeUrl);
  const daemonHandle = await Promise.race([
    progress.whenReady(),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`[lares handle ${verb}] daemon doc not ready after 5s`)), 5000),
    ),
  ]);
  const daemonDoc = daemonHandle.doc() as LarDoc;

  const handleIndex = handleIndexOpt ?? (await loadActivePersonaIndex(storageDir)) ?? 0;
  const seed        = await loadPersonaGroupRootSeed(storageDir, handleIndex);
  const nexusPubkey = await loadVesselVerifyingKey(storageDir);
  const board       = await materializeSharedLarDoc(repo, whoBoardDocUrl(nexusPubkey), "board:who-face");
  const store       = await makeNodePublicHandleStore();

  const record = await store.load(handleIndex);
  if (!record) {
    throw new Error(`[lares handle ${verb}] no published face at persona h${handleIndex} — publish one first.`);
  }
  const chain = resolveOwnHandleChain(board.doc() as LarDoc, record.nym);
  if (!chain || chain.length === 0) {
    throw new Error(`[lares handle ${verb}] no chain on the WHO board for ${record.nym.slice(0, 16)}… — the face was never announced here.`);
  }
  const headCid = boardHeadCid(board.doc() as LarDoc, record.nym)!;
  const veiled  = await deriveVeiledUserKey(seed, handleIndex, PERSONA_GLAMOUR_CONTEXT);
  const veiledSigner = ed25519SignerFromSeed(hexToBytes(veiled.signingKey));

  return { repo, daemonDoc, board, storageDir, handleIndex, seed, record, chain, headCid, veiledSigner };
}

/**
 * Resolve the OWNER-burn hand — the owning persona buries the face from above (a thief-of-the-face cannot
 * forge it). Pure over the resolved persona-KEL head: for a self-stood never-rotated persona the head op-key
 * IS the persona root DID (ceremony seats the founding op-key == root), so the root seed signs. FAILS CLOSED
 * on a ROTATED persona (the head advanced past the root), whose current op-key rides opt-in self-custody this
 * adapter does not yet reach — the operator falls back to `--self` there.
 */
export async function resolveOwnerBurnHand(opts: {
  personaKelPrefix: string;
  headOpKeyDid:     string | null;
  rootSeed:         Uint8Array;
}): Promise<
  | { ok: true; ownerBurn: { ownerAuthMemberPrefix: string; ownerAuthKeyDid: string; sign: (b: Uint8Array) => Promise<string> } }
  | { ok: false; reason: string }
> {
  if (!opts.headOpKeyDid) {
    return { ok: false, reason: "the persona-KEL head is unreachable on this replica (fail-closed) — the owner cannot be proven; use `--self`" };
  }
  const rootDid = `0x${hex(await ed25519.getPublicKeyAsync(opts.rootSeed))}`;
  if (opts.headOpKeyDid.toLowerCase() !== rootDid.toLowerCase()) {
    return { ok: false, reason: "owner-burn on a ROTATED persona wants the current op-key's custody (not wired) — use `lares handle burn --self`" };
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

export interface HandleBurnOptions {
  /** Which persona's face to bury; defaults to the worn persona, then 0. */
  readonly handleIndex?: number;
  readonly storageDir?: string;
  readonly now?: number;
  /** Bury the face from ABOVE — the owning persona (its head op-key) signs, not the seated handle key. */
  readonly fromPersona?: boolean;
}

/**
 * runHandleBurn — the disk adapter for `lares handle burn` (SELF-burn: the seated handle key closes its own
 * name). Resolve the vessel's own published nym for the chosen persona, resolve the CURRENT chain off the WHO
 * board, mint a terminal burn over it under the lease, and re-announce the burned card. A reader refuses the
 * burned chain before ever checking the card's signature, so recognition ends structurally at the burn. The
 * owner-burn hand (the persona buries the face from above, `--from-persona`) rides a later increment — it
 * wants the persona head op-key signer wired.
 */
export async function runHandleBurn(opts: HandleBurnOptions): Promise<HandleCard> {
  const face = await openOwnFace("burn", opts.storageDir, opts.handleIndex);

  // The card re-signs with the seated handle key regardless of hand — a reader refuses a burned chain BEFORE
  // checking the sig, so even an owner-burn of a lost key lands; a well-formed card just keeps the lineage clean.
  const buildCard = (_event: HandleKelEvent, newChain: HandleKelEvent[]): Promise<HandleCard> => signHandleCard(
    {
      nym: face.record.nym, chain: newChain, glamour: face.record.glamour,
      version: face.record.version + 1, prev: face.record.cardId,
      expiry: (opts.now ?? Date.now()) + 86_400_000, standing: null, fleetProof: null,
    },
    face.veiledSigner,
  );

  let hand: Parameters<typeof burnOwnHandle>[0];
  if (opts.fromPersona) {
    // OWNER-burn: the owning persona buries the face from above. Resolve its verified head op-key off the
    // per-Nexus persona-KEL board, then the pure hand-resolver decides whether the root seed may sign.
    const prefixEntry = (face.daemonDoc as { tiddlers?: Record<string, unknown> }).tiddlers?.[PERSONA_KEL_PREFIX_TIDDLER] as { tiddler?: { text?: string } } | undefined;
    const personaKelPrefix = prefixEntry?.tiddler?.text ?? null;
    if (!personaKelPrefix) throw new Error("[lares handle burn] no persona-KEL prefix on the daemon doc — cannot prove the owner; use `--self`.");
    const nexusPubkey  = await loadVesselVerifyingKey(face.storageDir);
    const kelBoard     = await materializeSharedLarDoc(face.repo, personaKelBoardDocUrl(nexusPubkey), "board:persona-kel");
    const personaChain = personaKelChainForPrefix(kelBoard.doc(), personaKelPrefix);
    const headOpKeyDid = personaChain ? await headOpKey(personaChain, { verifyQuorums: true }) : null;
    const resolved     = await resolveOwnerBurnHand({ personaKelPrefix, headOpKeyDid, rootSeed: face.seed });
    if (!resolved.ok) throw new Error(`[lares handle burn --from-persona] ${resolved.reason}`);
    hand = { board: face.board, nym: face.record.nym, expectedHeadCid: face.headCid, ownerBurn: resolved.ownerBurn, buildCard };
  } else {
    // SELF-burn: the seated handle key closes its own name.
    hand = { board: face.board, nym: face.record.nym, expectedHeadCid: face.headCid, sign: face.veiledSigner, buildCard };
  }

  const result = await burnOwnHandle(hand);
  if (!result.ok) throw new Error(`[lares handle burn] ${result.reason}`);
  await face.repo.flush();
  return result.card;
}

export interface HandleAttestOptions {
  /** The claim the face signs under its current head — e.g. "controls example.net". */
  readonly claim: string;
  readonly handleIndex?: number;
  readonly storageDir?: string;
}

/**
 * runHandleAttest — mint a signed claim carried ON the card, bound to the current head event cid (a moved head
 * stales it). A standalone statement the operator carries out-of-band and a reader verifies reader-locally
 * against the empire's own surface (DNS for a domain); this stack compiles no Handle→claim index (registry
 * filter). Not a chain event — it writes nothing to the board.
 */
export async function runHandleAttest(opts: HandleAttestOptions): Promise<HandleAttestation> {
  const claim = opts.claim.trim();
  if (claim.length === 0) throw new Error("[lares handle attest] an empty claim attests nothing — pass the claim text.");
  const face = await openOwnFace("attest", opts.storageDir, opts.handleIndex);
  return attestUnderHead(face.chain, claim, face.veiledSigner);
}
