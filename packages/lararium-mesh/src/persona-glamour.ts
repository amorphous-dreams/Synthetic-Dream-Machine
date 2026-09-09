/**
 * persona-glamour — the PUBLIC persona layer: a persona-index → its crossroads face (the ONE thing that
 * federates). The own side's public half, dual to persona-petname's private half.
 *
 * ZOOKO'S TRIANGLE, public side (canon: lar:///ha.ka.ba/lares/api/pono/persona-policy). A persona's GLOBAL
 * name stays its pubkey — the veiled-user key derived at its handle-index (persona-identity#deriveVeiledUserKey).
 * That key signs a `HandleCard` whose `glamour` is a chosen, memorable DISPLAY (never a legal identity); the
 * card certifies ITSELF (nym == the signing key), so a recogniser needs no registry (handle-card). The card
 * announces onto the per-Nexus WHO board through the crossroads plane (who-face), riding the transport the mesh already
 * runs. NO NEW MACHINERY — this THREADS the existing pieces: derive the veiled key → mint the card → hand it
 * to `announceToWhoFace`.
 *
 * ONE FACE TO THE MESH (persona-policy#one-face). A vessel WEARS one persona at a time; the public/carry shore
 * serves only the WORN persona. This module mints the worn persona's glamour — the human's own private pool
 * sees all N (persona-petname's multitude-view), but the mesh sees the one federated face.
 *
 * DISTINCT stores, three ways (persona-policy#two-layer):
 *   · this OwnPublicHandleStore — the vessel's local memory of ITS OWN published faces (index → nym/glamour/
 *     version), so a re-publish bumps monotone and links its own lineage (handle-card's anti-rollback).
 *   · the pet-name map (persona-petname) — the human's PRIVATE label for their own personas; fleet-syncs
 *     among their own vessels, never PUBLICLY federates.
 *   · the handle-book (handle-book) — the recogniser's labels for OTHERS' nyms.
 * The three never fuse: private-own ⊥ public-own ⊥ others.
 *
 * THE BINDING LAW. Only a publicly announced Handle binds a PersonaGroup to a public glamour — the card this
 * module mints and `announceToWhoFace` publishes IS that act. No other path may carry a persona's name onto a
 * federating surface: a pet-name string reaching a board would publish a face the human never announced.
 *
 * Meme: lar:///ha.ka.ba/lares/api/pono/persona-policy
 */

import type { DocHandle } from "@automerge/automerge-repo";
import { deriveVeiledUserKey } from "./persona-identity.js";
import { assertHandleIndex } from "./persona-vault.js";
import {
  signHandleCard, handleCardId, type HandleCard,
} from "./handle-card.js";
import { mintHandleInception, type HandleKelEvent } from "./handle-kel.js";
import { sealKeySetHash } from "./wax-stamp.js";
import type { DelegationEdge } from "./delegation-edge.js";
import { ed25519SignerFromSeed } from "./auth-wire.js";
import { hexToBytes } from "./crypto.js";
import { announceToWhoFace } from "./who-face.js";
import type { LarDoc } from "./base-doc.js";
import type { OwnPublicHandleView } from "./persona-petname.js";

/**
 * The context-index the public FACE derives at, WITHIN a persona's handle-Circle (persona-identity's
 * `m / handle' / context'` tree). The public glamour rides context 0 — the persona's presented face — leaving
 * the higher contexts for its per-vessel bindings. A caller MAY override it, but the roster keys by
 * handle-index, so one glamour stands per persona.
 */
export const PERSONA_GLAMOUR_CONTEXT = 0;


/** The default freshness lease a glamour card carries — 30 days, read against the recogniser's LOCAL clock
 *  (handle-card's expiry rides no global now; an unfed card goes stale on its own). Re-publish renews it. */
export const DEFAULT_GLAMOUR_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** The vessel's local memory of ONE of its own published faces — enough to renew the lease and advance the
 *  card's monotone lineage without re-reading the board. */
export interface PersonaPublicHandleRecord {
  /** The persona this face belongs to — the `handle'` it derives at. */
  readonly handleIndex: number;
  /** The context-index the veiled face derived at (default PERSONA_GLAMOUR_CONTEXT). */
  readonly contextIndex: number;
  /** The face's handle-KEL PREFIX — the card's `nym`, the STABLE self-certifying identifier (retired off the
   *  bare veiled key onto the founded chain). A re-mint reproduces it, so the lineage holds across renewals. */
  readonly nym: string;
  /** The current published display glamour. */
  readonly glamour: string;
  /** The highest card version this vessel has published — the next card bumps above it (anti-rollback). */
  readonly version: number;
  /** The last published card's content id — the next card's `prev` link (anti-equivocation). */
  readonly cardId: string;
}

/**
 * How a runtime persists the vessel's OWN published faces — keyed by handle-index, ONE record per persona.
 * DISTINCT from the pet-name map (private, fleet-only) and the handle-book (others' nyms). A platform
 * supplies the shore (node fs JSON / browser IDB), mirroring the vault's other stores.
 */
export interface OwnPublicHandleStore {
  /** Read a persona's published-face record, or null when the vessel has federated no glamour for it. */
  load(handleIndex: number): Promise<PersonaPublicHandleRecord | null>;
  /** Write a persona's published-face record — records the index into the roster on first publish. */
  save(record: PersonaPublicHandleRecord): Promise<void>;
  /** Every handle-index this vessel federates a glamour for, ascending (the roster's own explicit record). */
  list(): Promise<number[]>;
}

/** What `mintPersonaGlamour` yields — the signed card ready to announce, plus the record to persist. */
export interface MintedGlamour {
  readonly card: HandleCard;
  readonly record: PersonaPublicHandleRecord;
}

/**
 * mintPersonaGlamour — derive the persona's veiled-user key, sign a HandleCard carrying the display glamour,
 * and advance the monotone lineage over the vessel's own prior record. Pure over the store READ — it mints +
 * hands back the record to persist; it writes nothing and touches no board (the caller announces + persists).
 *
 * The `seed` is the human's persona master-seed (persona-identity); the veiled face derives at
 * `handle' / context'`. The card's `nym` IS that derived key, so the card certifies itself. A first publish
 * mints version 1 with a null prev; a re-publish bumps above the held version and links the held card.
 */
export async function mintPersonaGlamour(opts: {
  seed: Uint8Array;
  handleIndex: number;
  glamour: string;
  now: number;
  store: OwnPublicHandleStore;
  /** The owning persona's KEL prefix — the sole owner-set member of this 1-of-1 face. Its head op-key
   *  authorizes rotation/graft, so a lost handle key recovers THROUGH the persona. */
  ownerPersonaKelPrefix: string;
  contextIndex?: number;
  ttlMs?: number;
  standing?: string | null;
  /** The root-signed edge binding this face to its fleet, minted where the root lives. */
  fleetProof?: DelegationEdge | null;
}): Promise<MintedGlamour> {
  assertHandleIndex(opts.handleIndex);
  const glamour = opts.glamour.trim();
  if (glamour.length === 0) {
    throw new Error(`[persona-glamour] empty glamour for persona h${opts.handleIndex} — a face needs a display name`);
  }
  if (opts.ownerPersonaKelPrefix.length === 0) {
    throw new Error(`[persona-glamour] empty owner persona prefix for h${opts.handleIndex} — a face is owned by its persona, never itself`);
  }
  const contextIndex = opts.contextIndex ?? PERSONA_GLAMOUR_CONTEXT;
  const veiled = await deriveVeiledUserKey(opts.seed, opts.handleIndex, contextIndex);

  // FOUND the 1-of-1 handle-KEL PERSONA-ANCHORED: the veiled key is the Handle's presentation key, and the
  // OWNING PERSONA-KEL prefix is the sole owner-set member. The persona's head authorizes rotation, so a
  // lost presentation key recovers through the persona rather than orphaning the face. The prefix binds the
  // handle key + the (persona-owner) genesis digest + the recovery pre-commit, all stable inputs, so a
  // re-mint reproduces the SAME identifier — the card holds its name across lease renewals. A k-of-n
  // HandleGlamour supplies an owner SET here instead; that quorum founding rides its own path.
  const handleKeyDid    = `0x${veiled.verifyingKey}`;
  const recoverySetHash = sealKeySetHash([handleKeyDid], 1);
  const chain: HandleKelEvent[] = [mintHandleInception(handleKeyDid, opts.ownerPersonaKelPrefix, recoverySetHash)];
  const nym = chain[0]!.prefix;

  const prior = await opts.store.load(opts.handleIndex);
  // A re-publish for the SAME persona must advance its own lineage — a peer's HandleBook refuses a card that
  // rolls the version back or forks the `prev` chain (handle-card#acceptHandleUpdate). A prior record for a
  // DIFFERENT prefix (a re-derivation drift) never links across chains, so the lineage restarts from that face.
  const sameFace = prior !== null && prior.nym === nym;
  const version  = sameFace ? prior.version + 1 : 1;
  const prev     = sameFace ? prior.cardId : null;

  const card = await signHandleCard(
    {
      nym,
      chain,
      glamour,
      version,
      prev,
      expiry:   opts.now + (opts.ttlMs ?? DEFAULT_GLAMOUR_TTL_MS),
      standing: opts.standing ?? null,
      // Absent unless the caller minted an edge on the vessel holding the ROOT — an unbound face publishes
      // honestly and claims no fleet. Binding stays a deliberate act, exactly as announcing does.
      fleetProof: opts.fleetProof ?? null,
    },
    // The card is signed by the chain's HEAD Handle key — at inception, the veiled key itself.
    ed25519SignerFromSeed(hexToBytes(veiled.signingKey)),
  );

  const { sig: _sig, ...unsigned } = card;
  const record: PersonaPublicHandleRecord = {
    handleIndex:  opts.handleIndex,
    contextIndex,
    nym,
    glamour,
    version,
    cardId:       await handleCardId(unsigned),
  };
  return { card, record };
}

/**
 * publishPersonaGlamour — the full own-side wire: mint the worn persona's glamour card, persist the advanced
 * record, and announce it onto the resolved WHO board. THREADS the existing announce (`announceToWhoFace`) —
 * no new board machinery. The board syncs the card over the relay the mesh already runs; peers ingest it
 * through their own HandleBook (who-face-cap). Returns the announced card.
 */
export async function publishPersonaGlamour(opts: {
  board: DocHandle<LarDoc>;
  seed: Uint8Array;
  handleIndex: number;
  glamour: string;
  now: number;
  store: OwnPublicHandleStore;
  ownerPersonaKelPrefix: string;
  contextIndex?: number;
  ttlMs?: number;
  standing?: string | null;
}): Promise<HandleCard> {
  const { card, record } = await mintPersonaGlamour(opts);
  await opts.store.save(record);
  announceToWhoFace(opts.board, card);
  return card;
}

/**
 * publicHandleViewOf — adapt an OwnPublicHandleStore to the multitude-view's read shore (persona-petname).
 * Lets `personaMultitudeView` answer "does this persona federate a face, and what does it show?" over the
 * public store WITHOUT the private pet-name map ever importing it — the two stores stay distinct.
 */
export function publicHandleViewOf(store: OwnPublicHandleStore): OwnPublicHandleView {
  return {
    list: () => store.list(),
    glamour: async (handleIndex) => (await store.load(handleIndex))?.glamour ?? null,
  };
}
