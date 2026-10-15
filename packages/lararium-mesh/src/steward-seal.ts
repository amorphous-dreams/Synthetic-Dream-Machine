/**
 * steward-seal — WHO a steward reads as on a realm record, and the seal each class sets on it.
 *
 * THE RULING. A scoped face signs acts that belong to one person; a transparent quorum Handle signs acts the
 * collective owns; the root never appears publicly. A realm record travels: the realm doc crosses to every
 * member, and the `@crossroads` announce names `keptBy` in public. So whatever key a record names gets
 * published, and a steward's NAME reads one of two classes and nothing else:
 *
 *   · a FACE name — the ed25519 verifying key the steward's worn face presents at the Nexus the realm stands
 *     under. Its seal: that key's signature over the record's own bytes.
 *   · a HANDLE name — a Handle's stable prefix (`handle-kel#handlePrefixOf`). Its seal: the Handle's HEAD key
 *     signs an image that binds the prefix, the chain's head event and the record's digest, under a domain of
 *     its own; the seal CARRIES the chain, as a card carries it, so a reader verifies it with no board.
 *
 * WHAT A HANDLE SEAL PROVES. The head key the carried chain seats signed this record under that chain state.
 * A reader that holds no owner heads trusts a chain that holds its inception alone (`headWithoutResolver`). A
 * reader that holds its own chain for the Handle (`heldChain`: its handle book) reads the seal against it: a
 * seal under a head the reader's chain moved past reads stale, and a seal under a name the reader saw burned
 * reads burned. A reader that holds neither learns of a later rotation or burn from a fresh seal alone.
 *
 * WHAT THIS MODULE NEVER DECIDES. It holds no key and reads no board. It never says which key a vessel may
 * seal with (the vessel's own steward door reads that against its own keys), and never says which acts a
 * collective Handle may seal or under what threshold: that belongs to the charter's classes. The head key's
 * signature alone stands on a Handle seal.
 *
 * Meme: lar:///ha.ka.ba/lares/api/pono/cabal-realm#/the-steward-signer
 */
import { canonicalJsonBytes, sha256HexBytesSync } from "./crypto.js";
import { STEWARD_SEAL_DOMAIN } from "./domains.js";
import { verifyEd25519 } from "./ed25519-door.js";
import {
  headWithoutResolver, isBurned, resolvedHeadHandleKey, verifyHandleKel,
  type HandleKelEvent, type OwnerHeadResolver,
} from "./handle-kel.js";

/** The two classes a steward's name reads. */
export type StewardClass = "face" | "handle";

/** The most events a carried chain may hold. A longer one reads as no seal: a shared doc never buys unbounded work. */
export const STEWARD_CHAIN_MAX = 256;

/** The class a name reads, or null for anything else: a `0x` prefix, upper case, a wrong length, a blank. */
export function stewardClassOf(name: unknown): StewardClass | null {
  if (typeof name !== "string") return null;
  if (/^[0-9a-f]{64}$/.test(name)) return "face";
  if (/^handle-[0-9a-f]{64}$/.test(name)) return "handle";
  return null;
}

/** What a hand seals with. `chain` rides a Handle signer alone: the Handle's own chain, inception first. */
export interface StewardSigner {
  /** The steward's name. */
  readonly signer: string;
  /** Sign bytes under the name's key: a face key, or the Handle's head key. Answers a hex ed25519 signature. */
  readonly sign:   (bytes: Uint8Array) => Promise<string>;
  readonly chain?: readonly HandleKelEvent[];
}

/** One steward's seal on a record. `chain` rides a Handle seal alone. */
export interface StewardSeal {
  readonly signer: string;
  readonly sig:    string;
  readonly chain?: readonly HandleKelEvent[];
}

/** The image a Handle's head key signs: its own domain, the prefix, the chain state and the record's digest. */
export function handleStewardSealBytes(prefix: string, headEventCid: string, recordBytes: Uint8Array): Uint8Array {
  return canonicalJsonBytes({ domain: STEWARD_SEAL_DOMAIN, prefix, headEventCid, record: sha256HexBytesSync(recordBytes) });
}

function refused(message: string): Error {
  return new Error(`steward seal refused: ${message}`);
}

/**
 * Seal `recordBytes` as this steward. THROWS when the name reads neither class, a face signer carries a chain,
 * or a Handle signer carries no chain, an over-long chain, a chain that opens on another prefix, a chain that
 * fails its own structure, or a burned chain.
 */
export async function sealAsSteward(signer: StewardSigner, recordBytes: Uint8Array): Promise<StewardSeal> {
  const kind = stewardClassOf(signer.signer);
  if (kind === null) throw refused("steward-name-unreadable");
  if (kind === "face") {
    if (signer.chain !== undefined) throw refused("face-seal-carries-a-chain");
    return { signer: signer.signer, sig: await signer.sign(recordBytes) };
  }
  const chain = signer.chain;
  if (!chain || chain.length === 0) throw refused("handle-seal-carries-no-chain");
  if (chain.length > STEWARD_CHAIN_MAX) throw refused("chain-too-long");
  if (chain[0]!.prefix !== signer.signer) throw refused("chain-names-another-handle");
  if (!verifyHandleKel(chain)) throw refused("chain-invalid");
  if (isBurned(chain)) throw refused("burned");
  const headEvent = chain[chain.length - 1]!;
  return { signer: signer.signer, sig: await signer.sign(handleStewardSealBytes(signer.signer, headEvent.eventCid, recordBytes)), chain };
}

export type StewardSealVerdict = { readonly ok: true } | { readonly ok: false; readonly reason: string };

/** What a reader may bring to a seal beyond the record: its own knowledge of the Handle that sealed. */
export interface StewardSealReading {
  /** The owners' heads, for a chain that carries a step past its inception. Absent, such a chain reads
   *  `handle-rotation-unverified`. */
  readonly ownerHeads?: OwnerHeadResolver;
  /** The chain THIS reader holds for a Handle (its own handle book), or null where it holds none. One chain
   *  per call, for the one prefix a seal names: no reading here takes a collection of Handles. A lookup that
   *  throws reads the seal `chain-invalid`: a book that will not open never falls back to the carried chain. */
  readonly heldChain?:  (prefix: string) => readonly HandleKelEvent[] | null | Promise<readonly HandleKelEvent[] | null>;
}

/** How a carried chain stands beside the chain a reader holds: the same events in order, or one past the other. */
function chainsRelate(carried: readonly HandleKelEvent[], held: readonly HandleKelEvent[]): "same" | "carried-extends" | "held-extends" | "forked" {
  const shared = Math.min(carried.length, held.length);
  for (let i = 0; i < shared; i++) if (carried[i]!.eventCid !== held[i]!.eventCid) return "forked";
  if (carried.length === held.length) return "same";
  return carried.length > held.length ? "carried-extends" : "held-extends";
}

/**
 * Does this seal hold for the steward `name` over `recordBytes`? Never throws; every fault reads a named reason:
 * `steward-name-unreadable` · `seal-names-another-steward` · `face-seal-carries-a-chain` · `signature-mismatch`
 * · `handle-seal-carries-no-chain` · `chain-too-long` · `chain-names-another-handle` · `chain-invalid` · `burned`
 * · `stale-seal` (the reader's own chain moved past the head this seal bound) · `chain-forked` (the reader's own
 * chain and the carried one part ways) · `handle-rotation-unverified` · `owner-head-refused`.
 */
export async function verifyStewardSeal(
  seal: StewardSeal, name: string, recordBytes: Uint8Array, reading?: StewardSealReading,
): Promise<StewardSealVerdict> {
  try {
    const kind = stewardClassOf(name);
    if (kind === null) return { ok: false, reason: "steward-name-unreadable" };
    if (seal.signer !== name) return { ok: false, reason: "seal-names-another-steward" };
    if (kind === "face") {
      if (seal.chain !== undefined) return { ok: false, reason: "face-seal-carries-a-chain" };
      return verifyEd25519(seal.sig, recordBytes, name)
        ? { ok: true } : { ok: false, reason: "signature-mismatch" };
    }
    const chain = seal.chain;
    if (!chain || chain.length === 0) return { ok: false, reason: "handle-seal-carries-no-chain" };
    if (chain.length > STEWARD_CHAIN_MAX) return { ok: false, reason: "chain-too-long" };
    if (chain[0]!.prefix !== name) return { ok: false, reason: "chain-names-another-handle" };
    if (!verifyHandleKel(chain)) return { ok: false, reason: "chain-invalid" };
    if (isBurned(chain)) return { ok: false, reason: "burned" };
    // THE READER'S OWN CHAIN outranks the carried one: a seal never counts under a head the reader saw retired.
    const held = (await reading?.heldChain?.(name)) ?? null;
    if (held !== null) {
      // An empty answer reads as a broken lookup, never as "holds none": `null` alone says that.
      if (held.length === 0 || held[0]!.prefix !== name || !verifyHandleKel(held)) return { ok: false, reason: "chain-invalid" };
      const relation = chainsRelate(chain, held);
      if (relation === "forked") return { ok: false, reason: "chain-forked" };
      if (relation === "held-extends") return { ok: false, reason: isBurned(held) ? "burned" : "stale-seal" };
    }
    const head = reading?.ownerHeads ? await resolvedHeadHandleKey(chain, reading.ownerHeads) : headWithoutResolver(chain);
    if (!head.ok) return { ok: false, reason: head.refusal };
    const bytes = handleStewardSealBytes(name, chain[chain.length - 1]!.eventCid, recordBytes);
    return verifyEd25519(seal.sig, bytes, head.key.replace(/^0x/, ""))
      ? { ok: true } : { ok: false, reason: "signature-mismatch" };
  } catch {
    return { ok: false, reason: "chain-invalid" };
  }
}

/**
 * Read one stored seal back at its exact floor shape, or null: `signer` and `sig` strings; `chain`, when present,
 * an array of at most `STEWARD_CHAIN_MAX` plain objects, kept as given (`verifyStewardSeal` decides trust).
 * Extra fields drop.
 */
export function coerceStewardSeal(raw: unknown): StewardSeal | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;
  const signer = value["signer"], sig = value["sig"], chain = value["chain"];
  if (typeof signer !== "string" || typeof sig !== "string") return null;
  if (chain !== undefined && (!Array.isArray(chain) || chain.length > STEWARD_CHAIN_MAX || chain.some((event) =>
    typeof event !== "object" || event === null || Array.isArray(event) || Object.getPrototypeOf(event) !== Object.prototype))) return null;
  return { signer, sig, ...(chain === undefined ? {} : { chain: chain as HandleKelEvent[] }) };
}
