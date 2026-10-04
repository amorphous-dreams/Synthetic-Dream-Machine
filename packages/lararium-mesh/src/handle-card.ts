/**
 * handle-card — a self-certifying published FACE, recognised by its own key, never by a registry.
 *
 * PUBLISH A FACE, NEVER A SELF. A human keeps many unlinkable handles in a private vault (persona-circle
 * #the-vault); a HANDLE-CARD is what ONE handle shows the world so others can recognise it again. It carries
 * the handle's public key, a display glamour, and pointers to where its standing lives — and NOTHING that
 * reaches the vault or the human's other faces. Publishing Guru-Josh's card reveals nothing about Telarus-KSC,
 * because they share no key and the collector that knows they are one human is never published.
 *
 * RECOGNITION IS SELF-CERTIFYING. The card is signed by the handle's OWN key, and that key rides IN the card
 * (`nym`). So a recogniser verifies the signature against the embedded key and needs no directory to trust —
 * the name contains the key (Mazières' self-certifying names; did:key; a Nostr npub). Zooko's triangle
 * resolves: the identifier is secure-and-decentralised because it IS the key, and memorable because each
 * recogniser keeps a LOCAL petname for it. There is no SIN, and no global registry to capture.
 *
 * CAUSAL, LEASED, SELF-CERTIFYING — a card carries a semantic act CID and canonical parent set. A local
 * recogniser folds those acts without a scalar currentness guess or wall-clock authority.
 *
 * Pure and isomorphic, like oracle-substrate: this module holds no I/O and no key. The vessel supplies the
 * signer; the caller carries the bytes; the read-open oracle plane serves the published blob.
 *
 * Design-of-record: lar:///ha.ka.ba/lares/api/pono/persona-circle#/the-vault (publication model).
 */
import { HANDLE_CARD_DOMAIN } from "./domains.js";
import { canonicalJsonBytes, hexToBytes, sha256Hex, defaultCryptoProvider } from "./crypto.js";
import {
  signDelegationEdge, verifyDelegationEdge, DELEGATION_DOMAIN, type DelegationEdge,
} from "./delegation-edge.js";
import {
  verifyHandleKel, verifyHandleKelFull, headHandleKey, isBurned,
  type HandleKelEvent, type OwnerHeadResolver,
} from "./handle-kel.js";
import * as ed25519 from "@noble/ed25519";

/** The stable identifier a card presents — a handle-KEL prefix (`handle-<64hex>`), fixed across every key
 *  rotation and graft. The nym RETIRED off a bare key onto this chain-anchored name (identity-classes#the-handle-chain). */
const HANDLE_PREFIX_RE = /^handle-[0-9a-f]{64}$/;

/** The domain a card signs over. A signature is meaningless without the domain it was made in. */
export { HANDLE_CARD_DOMAIN } from "./domains.js";
/**
 * The published face of one handle — PUBLIC data only. Nothing here may reach the vault or another face.
 *
 * `nym` carries the handle-KEL PREFIX — the stable identifier folded over
 * the inception (handle-kel#handlePrefixOf), fixed across every rotation, graft and burn. The signing
 * authority lives in `chain`: the card is signed by the CURRENT head Handle key, which the chain seats and a
 * rotation moves. So a Handle can BURN (recognition ends), ROTATE its key (the nym holds), and present as a
 * QUORUM (the owner-set grafts) — none of which a bare key could do (identity-classes#the-handle-chain,
 * #THE-MU). Recognition still self-certifies: a reader verifies the chain structurally and the card's sig
 * against the chain's head key, no registry consulted (Tier 1).
 */
export interface HandleCard {
  readonly kind:     typeof HANDLE_CARD_DOMAIN;
  /** The handle-KEL PREFIX (`handle-<64hex>`) — the stable identifier a recogniser's petname points at.
   *  MUST equal `chain[0].prefix`; recognition keys on this, not on the rotating head key. */
  readonly nym:      string;
  /** The handle's key-event-log — inception (+ any rotation/graft/burn), carried SELF-CONTAINED so a reader
   *  verifies the head key and the burn/rotation lineage without any board (Tier 1). The owner-head snapshot
   *  the strict tier walks rides beside it in the reader's resolver, never on the card. */
  readonly chain:    readonly HandleKelEvent[];
  /** The display glamour — a chosen name/mask, never a legal identity. Memorable, never authoritative. */
  readonly glamour:  string;
  /** Semantic publication act identity, derived with this field blank. */
  readonly actCid:   string;
  /** Canonical causal publication parents — unique, sorted semantic act IDs. */
  readonly parents:  readonly string[];
  /** OPTIONAL content-address of the handle's reputation thread (the signed vouches/annotations). */
  readonly standing: string | null;
  /**
   * OPTIONAL proof that this face speaks for a FLEET — a delegation edge the persona root signed over this
   * nym. Absent → the card certifies only itself, which stays a complete and honest card; a face that
   * claims no fleet claims nothing false. Present → a recogniser walks nym → root in one extra verify.
   */
  readonly fleetProof: DelegationEdge | null;
  /** ed25519 signature over the card's canonical content, by the key in `nym`. */
  readonly sig:      string;
}


/**
 * The card's IDENTITY content — everything that makes this face THIS face.
 *
 * The act identity excludes only the signature and is stable for the completed publication fields.
 */
export function handleCardIdBytes(card: Omit<HandleCard, "sig">): Uint8Array {
  return canonicalJsonBytes({
    kind:       card.kind,
    nym:        card.nym,
    chain:      card.chain,
    glamour:    card.glamour,
    actCid:     "",
    parents:    [...new Set(card.parents)].sort(),
    standing:   card.standing,
    fleetProof: card.fleetProof,
  });
}

/**
 * The content a card signs over — its completed semantic identity.
 */
export function handleCardBytes(card: Omit<HandleCard, "sig">): Uint8Array {
  return canonicalJsonBytes({
    kind: card.kind, nym: card.nym, chain: card.chain, glamour: card.glamour,
    actCid: card.actCid, parents: [...new Set(card.parents)].sort(),
    standing: card.standing, fleetProof: card.fleetProof,
  });
}

/** The card's semantic act identity. */
export function handleCardId(card: Omit<HandleCard, "sig">): Promise<string> {
  return Promise.resolve(card.actCid);
}

/**
 * Mint the delegation edge — run on the vessel holding the persona ROOT, never on the one publishing.
 * The root signs the nym; the nym then signs the card carrying that signature. No circle: the root covers
 * only the nym-and-epoch, so it may sign before the card exists.
/**
 * The subject a fleet-proof covers — the nym the root vouched for. Named once so the mint and the verify
 * can never disagree about what got signed.
 */
export function fleetProofSubject(nym: string): Record<string, string> {
  return { nym };
}

/** Mint the edge binding a face to its fleet — run where the persona ROOT lives, never where it publishes. */
export function signFleetProof(
  args: { readonly nym: string; readonly rootDid: string; readonly epochCid: string },
  sign: (bytes: Uint8Array) => Promise<string>,
): Promise<DelegationEdge> {
  return signDelegationEdge(
    DELEGATION_DOMAIN.fleetProof, fleetProofSubject(args.nym), args.rootDid, args.epochCid, sign);
}

/**
 * Does this card PROVE it speaks for the fleet it names? One Ed25519 verify beside the card's own.
 *
 * A card carrying NO proof reads false without reading dishonest: an unbound face claims no fleet, so it
 * fails no claim. A caller distinguishes unbound from refuted by checking `fleetProof` for absence.
 */
export function verifyFleetProof(
  card: HandleCard,
  verify: (bytes: Uint8Array, sigHex: string, signerDid: string) => Promise<boolean>,
): Promise<boolean> {
  return verifyDelegationEdge(
    DELEGATION_DOMAIN.fleetProof, fleetProofSubject(card.nym), card.fleetProof, verify);
}

/** Sign a handle-card. The caller supplies the handle's own signer; this module holds no key. */
export async function signHandleCard(
  parts: Omit<HandleCard, "kind" | "sig" | "actCid">,
  sign: (bytes: Uint8Array) => Promise<string>,
): Promise<HandleCard> {
  const base = { ...parts, kind: HANDLE_CARD_DOMAIN, parents: [...new Set(parts.parents)].sort() } as Omit<HandleCard, "sig" | "actCid">;
  const actCid = await sha256Hex(handleCardIdBytes({ ...base, actCid: "" } as Omit<HandleCard, "sig">), defaultCryptoProvider);
  const unsigned = { ...base, actCid } as Omit<HandleCard, "sig">;
  return { ...unsigned, sig: await sign(handleCardBytes(unsigned)) };
}

/** Why a card failed to verify — a recogniser learns exactly what is wrong rather than a bare "invalid". */
export type CardRejection =
  | "wrong-domain"       // not a handle-card
  | "malformed"          // a field is the wrong shape (nym not a handle-prefix, sig not hex, chain absent, etc.)
  | "chain-invalid"      // the carried handle-KEL fails structural verification — a broken lineage seats no head
  | "nym-mismatch"       // the presented nym is not the chain's own prefix — the name does not match its chain
  | "burned"             // the Handle's chain ends in a burn — recognition ENDS at the burn, forever
  | "bad-signature"      // the card was not signed by the chain's CURRENT head Handle key — it certifies nothing
  | "owner-head-refused" // TIER 2 only: a presentation rides a SUPERSEDED / non-member owner key (the strict walk refuses)
  | "wrong-nym"          // the card names a DIFFERENT handle than the one a recogniser tracks — not an update
  | "unavailable"         // a causal parent is absent from the local closure
  | "unsettled"           // contradictory admissible heads remain
  | "rejected";           // semantic, signature, KEL, or boundary evidence failed

/**
 * The recognition tier a PASS was earned at — the third axis, held apart from ok/reject so a Tier-1 pass can
 * NEVER masquerade as a Tier-2 one.
 *   · Tier 1 (SELF-CONTAINED) — the chain verified structurally, stands unburned, and the card's sig checks
 *     against its head key. No board, no resolver. The default a recogniser gets for free.
 *   · Tier 2 (OWNER-HEAD-CHECKED) — everything in Tier 1 PLUS the full walk: every rotation/graft/owner-burn
 *     presented under a member key that STILL stands as that member's head, per the injected resolver
 *     (against the persona board). A superseded presenter refuses here. Opt-in, by passing a resolver.
 */
export type CardTier = 1 | 2;

export interface CardVerdict {
  readonly ok:      boolean;
  readonly nym?:    string;         // the recognised STABLE prefix, on success — the thing a petname points at
  readonly headKey?: string;        // the CURRENT head Handle key the card is signed by, on success (the rotating key)
  readonly tier?:   CardTier;       // the tier this pass was earned at — 1 self-contained, 2 owner-head-checked
  readonly reject?: CardRejection;
}

/**
 * Verify a card certifies ITSELF against its carried handle-KEL — TWO tiers, held apart on the verdict.
 *
 * TIER 1 (SELF-CONTAINED, the default). The chain verifies structurally (`verifyHandleKel`), the presented
 * nym IS the chain's prefix, the Handle is not burned, and the card's signature checks against the chain's
 * CURRENT head key. This needs no registry — a card is trustworthy exactly insofar as its chain seats a live
 * head that signed it. Causal state has no wall-clock input.
 *
 * TIER 2 (OWNER-HEAD-CHECKED, opt-in). Pass an `ownerHeadResolver` and the verify additionally runs the full
 * walk (`verifyHandleKelFull`): every presentation event must ride a member key that STILL stands as that
 * member's head. A rotated/grafted head that presents under a CURRENT owner passes; one signed by a SUPERSEDED
 * member key refuses as `owner-head-refused`. The verdict's `tier` names which assurance the pass carries, so
 * a caller can never read a self-contained pass as a board-checked one.
 *
 * A rejection NAMES itself. A recogniser that only learns "invalid" cannot tell a forgery from a broken
 * causal closure or a buried name, and re-presents blind.
 */
export async function verifyHandleCard(
  card: HandleCard,
  ownerHeadResolver?: OwnerHeadResolver,
): Promise<CardVerdict> {
  const tier: CardTier = ownerHeadResolver ? 2 : 1;
  if (card.kind !== HANDLE_CARD_DOMAIN) return { ok: false, reject: "wrong-domain" };
  if (!HANDLE_PREFIX_RE.test(card.nym) || !/^[0-9a-f]{128}$/.test(card.sig) || !Array.isArray(card.chain) || card.chain.length === 0 || !/^[0-9a-f]{64}$/.test(card.actCid) || !Array.isArray(card.parents) || !card.parents.every((p) => /^[0-9a-f]{64}$/.test(p))) {
    return { ok: false, reject: "malformed" };
  }
  const parents = [...new Set(card.parents)].sort();
  if (parents.length !== card.parents.length || parents.some((p, i) => p !== card.parents[i])) return { ok: false, reject: "rejected" };
  const derived = await sha256Hex(handleCardIdBytes(card), defaultCryptoProvider);
  if (derived !== card.actCid) return { ok: false, reject: "rejected" };
  // The chain is the whole of the identity now — a broken lineage seats no trustworthy head, so it fails
  // BEFORE the signature (a sig over a broken chain proves nothing about a live Handle).
  if (!verifyHandleKel(card.chain))            return { ok: false, reject: "chain-invalid" };
  if (card.nym !== card.chain[0]!.prefix)      return { ok: false, reject: "nym-mismatch" };
  // A burned name refuses whatever its signature says — recognition ends at the burn, structurally.
  if (isBurned(card.chain))                    return { ok: false, reject: "burned" };
  const headKey = headHandleKey(card.chain);   // non-null: the chain verified and stands unburned
  if (headKey === null)                        return { ok: false, reject: "chain-invalid" };
  const { sig } = card;
  let ok = false;
  try {
    ok = await ed25519.verifyAsync(hexToBytes(sig), handleCardBytes(cardUnsigned(card)), hexToBytes(headKey.replace(/^0x/, "")));
  } catch {
    return { ok: false, reject: "malformed" };
  }
  if (!ok) return { ok: false, reject: "bad-signature" };
  // TIER 2 — the strict walk of presentation authority against the persona board (opt-in via the resolver).
  if (ownerHeadResolver) {
    const full = await verifyHandleKelFull(card.chain, ownerHeadResolver);
    if (!full.ok) return { ok: false, reject: "owner-head-refused" };
  }
  return { ok: true, nym: card.nym, headKey, tier };
}

/** The card minus its signature — the bytes `handleCardBytes` covers. Named once so the mint and the verify
 *  never disagree about which fields the head key signed. */
function cardUnsigned(card: HandleCard): Omit<HandleCard, "sig"> {
  const { sig: _sig, ...unsigned } = card;
  return unsigned;
}

/**
 * The petname check: is this card the handle I already know?
 *
 * Recognition is TWO steps, and conflating them is the classic error. First the card must certify itself
 * (verifyHandleCard) — a valid signature by the key it names. Then the recogniser asks whether that key is
 * the one their petname points at. A card can be perfectly self-certifying and STILL be a stranger; only the
 * local petname turns a valid key into "the mover who healed Neo-Thracia". The petname lives in the
 * recogniser's own book, never on any wire.
 */
export async function recognizeHandle(
  card: HandleCard,
  expectedNym: string,
): Promise<boolean> {
  const v = await verifyHandleCard(card);
  return v.ok && v.nym === expectedNym;
}

/**
 * The ANNOUNCE reader rule — accept a fresh card for a Handle already tracked, refuse a rollback or a fork.
 *
 * `verifyHandleCard` certifies ONE card in isolation. Recognising a handle OVER TIME needs more: announced
 * acts form a causal closure, and a recogniser must retain every verified ancestor while refusing a detached
 * copy or a forked lineage that equivocates. This rule carries the SAME discipline `oracle-substrate` proves
 * for its pointer, applied to the card's own causal fields.
 *
 * Pass what the recogniser remembers of this Handle:
 *   - `expectedNym`: the key the recogniser's petname points at — a card naming a different key is a stranger,
 *     never an update, however well it certifies itself (the hijack guard).
 *
 * First recognition (no card held yet) reduces to self-certification + the nym match. Never throws — an
 * announce arrives from the open network untrusted.
 */
export async function acceptHandleUpdate(
  card: HandleCard,
  opts: {
    readonly expectedNym:       string;
    readonly knownActCids?: readonly string[];
    readonly heldHeadActCids?: readonly string[];
  },
): Promise<CardVerdict> {
  const self = await verifyHandleCard(card);
  if (!self.ok) return self;
  if (card.nym !== opts.expectedNym) return { ok: false, reject: "wrong-nym" };

  if (opts.knownActCids && card.parents.some((p) => !opts.knownActCids!.includes(p))) return { ok: false, reject: "unavailable" };
  if (opts.heldHeadActCids && card.actCid !== undefined && card.parents.length > 0 && !card.parents.some((p) => opts.heldHeadActCids!.includes(p))) return { ok: false, reject: "unsettled" };
  return { ok: true, nym: card.nym };
}

export type HandleCardFold = "held" | "unsettled" | "unavailable" | "rejected";

export interface HandleCardFoldResult {
  readonly status: HandleCardFold;
  /** The verified causal closure. It is empty when any card is rejected or the closure is unavailable. */
  readonly cards: readonly HandleCard[];
  /** The unique verified projection, or null while unsettled/unavailable/rejected. */
  readonly card: HandleCard | null;
  /** The verified frontier, in stable CID order. */
  readonly heads: readonly string[];
}

/**
 * Fold a nym's locally observed publication acts without arrival-order choice.
 *
 * This is deliberately a fixed-point fold. A CRDT can hand us a descendant before its ancestors, and a
 * board can contain a forged sibling beside a valid chain. Neither arrival order nor a shape-only parent
 * filter is evidence. Every card is self-verified first; then the whole set must be one nym's closed causal
 * graph with exactly one head. A missing parent, cross-nym edge, self-parent, invalid signature, or invalid
 * semantic CID leaves the fold unrecognised.
 */
export async function foldHandleCardsDetailed(cards: readonly HandleCard[]): Promise<HandleCardFoldResult> {
  if (cards.length === 0) return { status: "unavailable", cards: [], card: null, heads: [] };

  const verified: HandleCard[] = [];
  let rejected = false;
  for (const card of cards) {
    const verdict = await verifyHandleCard(card);
    if (!verdict.ok) { rejected = true; continue; }
    verified.push(card);
  }
  if (rejected || verified.length !== cards.length) {
    return { status: "rejected", cards: [], card: null, heads: [] };
  }

  const nym = verified[0]!.nym;
  const byCid = new Map<string, HandleCard>();
  for (const card of verified) {
    if (card.nym !== nym || card.parents.includes(card.actCid)) {
      return { status: "rejected", cards: [], card: null, heads: [] };
    }
    // A semantic act may be re-signed, but two different payloads cannot share an act CID. The verifier
    // already binds every payload field; retaining one equivalent act keeps the closure set canonical.
    if (!byCid.has(card.actCid)) byCid.set(card.actCid, card);
  }

  const closure = [...byCid.values()];
  const known = new Set(byCid.keys());
  for (const card of closure) {
    for (const parent of card.parents) {
      if (!known.has(parent)) return { status: "unavailable", cards: [], card: null, heads: [] };
    }
  }
  const covered = new Set(closure.flatMap((card) => card.parents));
  const heads = closure.filter((card) => !covered.has(card.actCid)).map((card) => card.actCid).sort();
  if (heads.length !== 1) {
    return { status: heads.length > 1 ? "unsettled" : "unavailable", cards: closure, card: null, heads };
  }
  const projection = closure.find((candidate) => candidate.actCid === heads[0]) ?? null;
  return { status: "held", cards: closure, card: projection, heads };
}

/** Fold a nym's locally observed publication acts without arrival-order choice. */
export async function foldHandleCards(cards: readonly HandleCard[]): Promise<HandleCardFold> {
  return (await foldHandleCardsDetailed(cards)).status;
}
