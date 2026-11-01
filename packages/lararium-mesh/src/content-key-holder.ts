/**
 * content-key-holder — the one place a vessel holds bare content keys, and every act that needs one.
 *
 * BARE KEYS LIVE HERE, IN MEMORY ALONE, AND ONLY WHILE THE VESSEL STANDS UNLOCKED. The holder lives where the
 * vessel's key-shore seat lives. A caller hands it a body and takes back a sealed value, or hands it a
 * reference and takes back the body. No method answers a key, no refusal names one, and nothing here writes
 * one to rest: a key rests only inside a lockbox.
 *
 * NOTHING PRIVATE RESTS FOR THE HOLDER. At its first ask it opens every lockbox its seat opens, reads each
 * payload, and counts each key version record under the key that payload delivered. Every bag id, locator
 * and lineage it holds comes from those lockboxes. `lock` overwrites every key and forgets every reading,
 * and every later ask refuses `holder-locked`.
 *
 * A KEY REACHES REST BEFORE ANY VALUE SEALS UNDER IT. A mint wraps and stores the lockbox, signs and verifies
 * the key version record, counts the version, then stores the record. A stop between leaves a lockbox no
 * record names: it delivers nothing. A sealed value reaches rest before the manifest that names it, and the
 * manifest before its index rows.
 *
 * A SESSION SIGNS, OR NOTHING MINTS. A founding, a roll, a join, a manifest and a hand-over each take the
 * signer of the session that acts. A caller that hands none meets `signer-unavailable`.
 *
 * ONE BAG MAY HOLD RIVAL FOUNDINGS. Each founding names a locator of its own and keeps a lineage of its own
 * here. Reads search every founding; a write goes under the founding this vessel wrote under; a removal rolls
 * each founding the vessel holds a head in.
 *
 * A READER COUNTS WHAT IT CAN CHECK. A version whose parents it holds no key for counts as a base (see
 * `content-key-lineage`), under a license the reader verifies itself: its own ledger's raise, an admission act
 * it verified, or a join proof under a parent it holds. No record another writer signed stands in for that
 * evidence: a hand-over record states who handed a span and to whom, and licenses nothing. The holder counts
 * afresh whenever a lockbox arrives, so a base lasts only while its parent stays unheld.
 *
 * TWO UNLIKE VERIFIED RECORDS UNDER ONE VERSION REFUSE BOTH, BEFORE ANY TRANSITION COUNTS. The holder compares
 * the facts of every record it verified under one id first. A record that fails this reader's evidence still
 * conflicts, so no reader's ledger and no arrival order picks one of the two.
 *
 * A VESSEL UNDER ITS OWN SHADOW PERFORMS NO KEY ACT: it founds nothing, mints nothing, joins nothing, hands
 * nothing over, hands no parcel on and serves no reader, so no wrap of its own ever seats it and no key leaves
 * by its hand. Three acts wrap no key and hand none on, and they run under the shadow: a seal under a head the
 * vessel already holds, the receipt of what another hand wrapped for it, and the choice of the head it writes
 * under (sealed-store#/the-store, a house reading).
 *
 * A LOCK ENDS AN ACT IN FLIGHT. Every write to rest passes one door that checks the lock first (`#rest`), and
 * every answer checks it again, so a locked holder rests nothing further and answers `holder-locked`.
 *
 * A BACKUP BUNDLE'S MEMORY SECTION LEAVES AND ENTERS HERE, SEALED. `cutMemory` seals the keys this holder counted
 * and holds, for the bags its caller names, to a public key the cut hands in, and answers ciphertext beside a
 * list that names no key. `importMemory` opens a section inside the holder, judges each entry apart, and lands
 * what passes as a lockbox for this vessel's own seat under a `memory-import` record. A cut hands keys beyond
 * the holder and an import wraps one for the vessel's own seat, so each refuses under the vessel's own shadow.
 * An import adds and never replaces (sealed-store#/the-store, the memory section and the import door).
 *
 * Platform-blind: it asks a store, a key shore and its vessel's readings through ports.
 * Canon: lar:///ha.ka.ba/lararium/mesh/sealed-store#/the-store
 */
import { sha256 } from "@noble/hashes/sha2.js";
import { hex, hexToBytes, utf8Bytes, type RandomProvider } from "./crypto.js";
import { openPrivateBody, sealPrivateBody, type SealedPrivateBody } from "./ciphertext-cas.js";
import {
  KeyLineage, LINEAGE_REFUSALS, factOfPlan, planAdmissionFromNow, planFounding, planJoin, planRemovalRolls, sameFact, versionsToHandOver, writeHead,
  type HistoryDeclaration, type KeyRollPlan, type KeyVersionFact, type RollerPorts, type RollOutcome,
} from "./content-key-lineage.js";
import type { KeysHeldApart } from "./face-proof-subjects.js";
import { openMemorySection, sealMemorySection, type MemoryEntry } from "./memory-section.js";
import { wrapLockbox, openLockbox, type KeyParcel, type LockboxWrapShore, type ReaderId } from "./lockbox-wrap.js";
import {
  isWellFormedText, keyVersionIdOf, mintContentKey, readContentKey, readKeyVersionId,
  type ContentKey, type KeyVersionId, type SealContext, type SealedAddress,
} from "./sealed-chunk.js";
import {
  authorizeFromManifest, bagLocatorOf, entryLocatorOf, factOfRecord, indexRowsOf, joinProofOf, joinProven, readBagLocator, readRecord,
  recordIdOf, signRecord,
  type BagLocator, type HandOverBody, type KeyVersionBody, type KeyVersionPrivate, type LockboxRecord, type ManifestBody,
  type RecordBodies, type RecordId, type RecordKind, type RecordPrivates, type RecordSigner, type SealedRecord, type VerifiedRecord,
  type WriterStanding,
} from "./sealed-records.js";
import type { SeatRoll } from "./seat-duties.js";
import type { SealedStore } from "./sealed-store-rest.js";

// ── Refusals ────────────────────────────────────────────────────────────────────────────────────
export const HOLDER_REFUSALS = [
  "holder-locked",            // the vessel locked: every key got overwritten
  "signer-unavailable",       // no session signer stands behind the act
  "bag-malformed",            // the bag id reads as no well-formed text
  "bag-unfounded",            // no founding of this bag stands here
  "founding-forked",          // rival foundings stand, and this vessel wrote under none: a person chooses
  "head-ambiguous",           // several heads held, none written under: a person chooses
  "join-across-spans",        // every head held, in unlike spans: that join opens on a fresh base
  "no-head-held",             // this vessel holds no head's key
  "own-edge-shadowed",        // a vessel under its own shadow performs no key act
  "wrap-failed",              // the key shore wrapped no lockbox
  "record-refused",           // the record did not sign, or did not read back
  "count-refused",            // the lineage refused the version this vessel minted
  "store-failed",             // a write to rest failed
  "seal-refused",             // the sealed value did not seal
  "reference-unknown",        // no manifest under a held version names the reference
  "value-absent",             // the manifest names an address this vessel holds no bytes for
  "open-refused",             // the value did not open (the cause names the opener's refusal)
  "version-unknown",          // the named version stands in no lineage this vessel counted
  "history-closed",           // the span's writers never declared its history shareable
  "opener-not-counted",       // this vessel never counted the span's opener, so it reads no declaration
  "reader-not-standing",      // the reader holds no seat in the bag's key group, or stands set aside
  "reader-unreached",         // this vessel holds no contact card for the reader
  "fresh-base-unavailable",   // a new span opens on a fresh base, and no hand here cuts one
  "seat-not-standing",        // this vessel's own seat stands in no key group of its face: an import wraps for nobody
  "memory-malformed",         // a memory section does not open, or opens to no whole entries
  "roll-owed",                // a counted raise still owes this bag its removal roll: nothing seals under a head that precedes it
  "chain-absent",             // no chain stands (no session asked, no dial composed): the holder reads no record
] as const;
export type HolderRefusalName = (typeof HOLDER_REFUSALS)[number];
/** A refusal names what stopped the act. `cause` carries another module's own refusal name, never a key. */
export interface HolderRefusal { readonly refusal: HolderRefusalName; readonly cause?: string }

// ── Ports ───────────────────────────────────────────────────────────────────────────────────────
/** This vessel's own evidence for one bag's key transitions. */
export interface BagEvidence {
  /** This vessel's own ledger counts the raise, on an edge of the bag's own scope. */
  raiseCounts(act: string): boolean;
  /** This vessel verified the admission act. */
  admissionVerifies(act: string): boolean;
}
export interface ContentKeyHolderPorts {
  /** Durable rest for lockboxes, records and index rows. It holds no secret. */
  readonly store: SealedStore;
  /** The key shore that wraps and opens lockboxes. */
  readonly shore: LockboxWrapShore;
  /** The readers the bag's key group holds NOW with standing, by this vessel's own reading: every seated
   *  identifier, less each party this vessel's edge reading sets aside. */
  readersOf(bagId: string): Promise<readonly ReaderId[]>;
  /** This vessel's own reading of who may write a bag. */
  readonly standing: WriterStanding;
  evidenceOf(bagId: string): Promise<BagEvidence>;
  /** Does this vessel read a shadow over its own edge in the bag's scope? */
  ownEdgeShadowed(bagId: string): Promise<boolean>;
  /** This vessel's own seat in its face's key group: its identifier on the key shore where that seat stands,
   *  null where it stands in none. An import names it in the record it signs. */
  ownSeat(): Promise<ReaderId | null>;
  /** The sealed values' own rest: bytes by address. */
  readonly values: {
    read(address: SealedAddress): Promise<Uint8Array | null>;
    write(address: SealedAddress, sealed: Uint8Array): Promise<void>;
  };
  /**
   * Cut the fresh base a new span opens on, under the version just drawn, BEFORE any lockbox for that version
   * wraps: the document store answers it. True: the base stands. Absent, or false: no span opens, and a
   * from-now admission refuses `fresh-base-unavailable`.
   */
  readonly freshBase?: (args: { readonly bagId: string; readonly founding: BagLocator; readonly keyVersion: KeyVersionId }) => Promise<boolean>;
  readonly apart?: KeysHeldApart;
  readonly random?: Pick<RandomProvider, "getRandomValues">;
}

// ── Readings a door may show ────────────────────────────────────────────────────────────────────
/** One founding of one bag, as this vessel reads it. Every field reads opaque: none names a key. */
export interface FoundingReading {
  readonly founding:  BagLocator;
  readonly heads:     readonly KeyVersionId[];
  readonly held:      readonly KeyVersionId[];
  readonly forked:    boolean;
  /** Does this vessel write under this founding? */
  readonly written:   boolean;
  /** The readers some counted version's mint could not serve. */
  readonly unserved:  readonly ReaderId[];
  /** Keys a lockbox delivered that no counted record names, with what stopped each record. */
  readonly uncounted: readonly { readonly keyVersion: KeyVersionId; readonly why: string }[];
}
export interface BagReading {
  readonly bagId:     string;
  readonly foundings: readonly FoundingReading[];
  /** More than one founding stands: rival foundings, shown at every door. */
  readonly rival:     boolean;
}
export interface MintOutcome { readonly keyVersion: KeyVersionId; readonly founding: BagLocator; readonly unserved: readonly ReaderId[] }

// ── The memory section ──────────────────────────────────────────────────────────────────────────
/** One version a memory section carries, as a cut names it for a person: no key. */
export interface MemoryHolding { readonly bagId: string; readonly founding: BagLocator; readonly keyVersion: KeyVersionId }
/** What the import door answers for one entry. Each entry draws exactly one. */
export const MEMORY_OUTCOMES = [
  "imported",               // the entry passed every check and landed: a record, then a lockbox for this seat
  "held",                   // this vessel already counts and holds that version: nothing changed
  "key-forged",             // the key does not recompute to the version id its entry names, under the bag it names
  "record-unverified",      // no key version record under that locator and id verifies under the key
  "version-conflicted",     // two unlike verified records stand under that id, or the lineage holds it conflicted
  "transition-uncounted",   // the record verifies, and the lineage does not count the version on this vessel's evidence
] as const;
export type MemoryOutcome = (typeof MEMORY_OUTCOMES)[number];
export interface MemoryImportResult {
  readonly bagId:      string;
  readonly keyVersion: string;
  readonly outcome:    MemoryOutcome;
  /** Another module's own refusal name, never a key: what stopped a record or a transition. */
  readonly cause?:     string;
}
export interface SealedBlob extends MintlessSeal { readonly founded?: MintOutcome; readonly joined?: MintOutcome }
interface MintlessSeal { readonly body: SealedPrivateBody; readonly manifest: RecordId; readonly founding: BagLocator }

// ── Internals ───────────────────────────────────────────────────────────────────────────────────
interface Line {
  readonly locator:  BagLocator;
  lineage:           KeyLineage;
  /** Every key a lockbox delivered for this founding, counted or not. */
  readonly keys:     Map<KeyVersionId, ContentKey>;
  /** The verified record of each counted version, and the bytes it travels as. */
  readonly records:  Map<KeyVersionId, VerifiedRecord<"key-version">>;
  readonly carried:  Map<KeyVersionId, SealedRecord<"key-version">>;
  readonly why:      Map<KeyVersionId, string>;
  readonly manifests: Map<RecordId, VerifiedRecord<"manifest">>;
  /** A removal version stands in this founding's rest, verified under its own key, whether or not this reader's
   *  evidence counted it: the seat rolled here once (`holdsRemoval`). */
  rolled?: boolean;
}
interface Bag { readonly bagId: string; readonly lines: Map<BagLocator, Line> }

/** The holder took no reading: its standing names no chain yet (no session asked). Nothing read, nothing settled. */
export class ChainAbsent extends Error {
  override readonly name = "ChainAbsent";
  constructor() { super("content-key holder: no chain stands yet (no session asked), so the holder reads no record and settles no roll"); }
}

const ascending = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
const refuse = (refusal: HolderRefusalName, cause?: string): HolderRefusal => (cause === undefined ? { refusal } : { refusal, cause });
const isRefusal = (value: object): value is HolderRefusal => "refusal" in value;
const bare = (reader: string): string => reader.trim().toLowerCase().replace(/^0x/, "");
const ownNote = (what: string, ...parts: readonly string[]): string => `${what}.${hex(sha256(utf8Bytes(parts.join("\n"))))}`;
const said = (err: unknown): string => (err instanceof Error ? err.message : String(err));
/** The vessel's own note for one bag and one reader whose seat a roll named. Its name and its bytes read opaque:
 *  a digest of the bag and the reader names it, and it holds a digest of each raise that roll answered. */
const leftNote = (bagId: string, reader: string): string => ownNote("left", bagId, reader);
const digestsOf = (note: Uint8Array | null): string[] => {
  if (note === null || note.length % 32 !== 0) return [];
  const out: string[] = [];
  for (let at = 0; at < note.length; at += 32) out.push(hex(note.subarray(at, at + 32)));
  return out;
};

/** The one content-key holder of an unlocked vessel. */
export class ContentKeyHolder {
  readonly #ports: ContentKeyHolderPorts;
  #bags: Map<string, Bag> | null = null;
  /** The chain the cached reading was taken under (`WriterStanding.chainOf`). */
  #bagsChain: string | null | undefined = undefined;
  #locked = false;
  #turn: Promise<unknown> = Promise.resolve();

  constructor(ports: ContentKeyHolderPorts) { this.#ports = ports; }

  get locked(): boolean { return this.#locked; }

  /** Overwrite every key, forget every reading, and refuse every later ask. */
  lock(): void {
    this.#locked = true;
    for (const bag of this.#bags?.values() ?? []) for (const line of bag.lines.values()) {
      for (const key of line.keys.values()) key.fill(0);
      line.keys.clear(); line.records.clear(); line.carried.clear(); line.manifests.clear(); line.why.clear();
    }
    this.#bags?.clear();
    this.#bags = null;
  }

  /** One act at a time: a mint, a seal and a reload never interleave. */
  #inTurn<T>(act: () => Promise<T | HolderRefusal>): Promise<T | HolderRefusal> {
    const run = this.#turn.then(async (): Promise<T | HolderRefusal> => {
      if (this.#locked) return refuse("holder-locked");
      try {
        const answer = await act();
        // A lock that landed while the act ran ends it: nothing it learned leaves.
        return this.#locked ? refuse("holder-locked") : answer;
      } catch (err) { return this.#locked ? refuse("holder-locked") : err instanceof ChainAbsent ? refuse("chain-absent") : refuse("store-failed", said(err)); }
    });
    this.#turn = run.catch(() => undefined);
    return run;
  }

  /** The one door to rest: a locked holder rests nothing further, at whichever write the lock lands before. */
  async #rest<T>(write: () => Promise<T>): Promise<T> {
    if (this.#locked) throw new Error("the holder locked before this write");
    return write();
  }

  // ── The reading: lockboxes, then records ──────────────────────────────────────────────────────
  async #loaded(): Promise<Map<string, Bag>> {
    // NO CHAIN, NO READING. Under a standing whose chain does not stand yet, every record reads as no writer's, so a
    // reading taken then would found rivals and settle rolls as unfounded. The holder refuses to read, and a reading
    // taken under one chain gives way when another stands.
    const chain = this.#ports.standing.chainOf?.();
    if (chain === null) throw new ChainAbsent();
    if (this.#bags !== null && this.#bagsChain === chain) return this.#bags;
    return this.#reload();
  }

  /** Does the standing read writers under a chain now? A holder whose standing names none takes no reading. */
  #chainStands(): boolean { return this.#ports.standing.chainOf?.() !== null; }

  /** Does any lockbox at rest open for this seat? It reads no record, so it needs no chain; each key it opens it
   *  overwrites at once. A seat that opens none holds no key under any chain. */
  async #opensAnyLockbox(): Promise<boolean> {
    const { store, shore } = this.#ports;
    for (const lockbox of await store.lockboxes()) {
      const opened = await openLockbox({ lockbox, shore });
      if ("payload" in opened) { opened.payload.key.fill(0); return true; }
    }
    return false;
  }

  /** Read rest afresh: open every lockbox this seat opens, then count every record under the key it delivered. */
  async #reload(): Promise<Map<string, Bag>> {
    const { store, shore } = this.#ports;
    // The chain this reading is taken under: a reading taken under none (a vessel ask before any session) gives way
    // at the first `#loaded` once a chain stands.
    const chain = this.#ports.standing.chainOf?.();
    const bags = new Map<string, Bag>();
    const forget = (): void => { for (const bag of bags.values()) for (const line of bag.lines.values()) for (const key of line.keys.values()) key.fill(0); };
    try {
      for (const lockbox of await store.lockboxes()) {
        const opened = await openLockbox({ lockbox, shore });
        if (!("payload" in opened)) continue;
        const { bagId, locator, keyVersion, key } = opened.payload;
        let bag = bags.get(bagId);
        if (!bag) { bag = { bagId, lines: new Map() }; bags.set(bagId, bag); }
        let line = bag.lines.get(locator);
        if (!line) { line = { locator, lineage: KeyLineage.empty(), keys: new Map(), records: new Map(), carried: new Map(), why: new Map(), manifests: new Map() }; bag.lines.set(locator, line); }
        if (line.keys.has(keyVersion)) key.fill(0); else line.keys.set(keyVersion, key);
      }
      const records = await store.records("key-version");
      for (const bag of bags.values()) {
        const evidence = await this.#ports.evidenceOf(bag.bagId);
        for (const line of bag.lines.values()) this.#count(bag, line, records, evidence);
      }
    } catch (err) { forget(); throw err; }
    if (this.#locked) { forget(); throw new Error("the holder locked while it read its lockboxes"); }
    // Keys the earlier reading held leave with it.
    for (const bag of this.#bags?.values() ?? []) for (const line of bag.lines.values()) for (const key of line.keys.values()) key.fill(0);
    this.#bags = bags;
    this.#bagsChain = chain;
    return bags;
  }

  /** Count one founding's records, parents before children, until a pass counts none. */
  #count(bag: Bag, line: Line, records: readonly SealedRecord<"key-version">[], evidence: BagEvidence): void {
    const reader = (key: ContentKey) => ({ bagId: bag.bagId, locator: line.locator, key, standing: this.#ports.standing, ...(this.#ports.apart ? { apart: this.#ports.apart } : {}) });
    // Verify each record once, under the key its own lockbox delivered.
    const pending: { carried: SealedRecord<"key-version">; verified: VerifiedRecord<"key-version"> }[] = [];
    for (const carried of records) {
      if (carried.body.bag !== line.locator) continue;
      const key = line.keys.get(carried.body.keyVersion);
      if (key === undefined) continue;
      const read = readRecord("key-version", carried, reader(key));
      if (!("record" in read)) { line.why.set(carried.body.keyVersion, read.cause ? `${read.refusal}:${read.cause}` : read.refusal); continue; }
      // A founding's locator must recompute from the founding key: no founding borrows another's name.
      if (read.record.private.cause.kind === "founding" && bagLocatorOf(key, bag.bagId) !== line.locator) { line.why.set(carried.body.keyVersion, "founding-locator-mismatch"); continue; }
      if (read.record.private.cause.kind === "removal") line.rolled = true;
      pending.push({ carried, verified: read.record });
    }
    // Two unlike verified facts under one id refuse both BEFORE any transition counts. A record that fails this
    // reader's evidence still conflicts: no ledger and no arrival order picks between the two.
    const stated = new Map<KeyVersionId, KeyVersionFact>();
    const unlike = new Set<KeyVersionId>();
    for (const { verified } of pending) {
      const fact = factOfRecord(verified);
      const first = stated.get(fact.keyVersion);
      if (first === undefined) stated.set(fact.keyVersion, fact);
      else if (!sameFact(first, fact)) unlike.add(fact.keyVersion);
    }
    // Neither record of such a pair reaches the count, so no version that cites the id finds it standing.
    for (let i = pending.length - 1; i >= 0; i--) if (unlike.has(pending[i]!.verified.body.keyVersion)) pending.splice(i, 1);
    let lineage = KeyLineage.empty();
    for (let moved = true; moved && pending.length > 0;) {
      moved = false;
      for (let i = 0; i < pending.length; i++) {
        const { carried, verified } = pending[i]!;
        const version = verified.body.keyVersion;
        const fact = factOfRecord(verified);
        const heldParents = new Map<KeyVersionId, ContentKey>();
        for (const parent of fact.parents) { const key = line.keys.get(parent); if (key !== undefined) heldParents.set(parent, key); }
        const unheld = fact.parents.filter((parent) => !heldParents.has(parent));
        // Each cause answers to this reader's OWN evidence. A join proves under each parent this reader holds,
        // and with none held it proves nothing: no record another writer signed stands in for a proof.
        const result = lineage.count(fact, {
          raiseCounts: (act) => evidence.raiseCounts(act),
          admissionVerifies: (act) => evidence.admissionVerifies(act),
          joinProven: () => joinProven(verified, heldParents),
        }, unheld);
        if ("lineage" in result) {
          lineage = result.lineage;
          line.records.set(version, verified); line.carried.set(version, carried); line.why.delete(version);
        } else {
          // No conflict reaches this count: every unlike pair left `pending` above.
          line.why.set(version, result.refusal);
          if (result.refusal === "parent-unknown") continue;   // a parent may count later in this pass
        }
        pending.splice(i, 1); i -= 1; moved = true;
      }
    }
    // The lineage holds each such id conflicted from here on, and the conflict shows at every door.
    for (const version of unlike) { lineage = lineage.conflict(version); line.why.set(version, "version-conflict"); }
    // A version that left the standing readings (a conflict in its past) leaves the records with it.
    for (const version of [...line.records.keys()]) if (!lineage.has(version)) { line.records.delete(version); line.carried.delete(version); line.why.set(version, "version-conflict"); }
    line.lineage = lineage;
  }

  /** The versions of one founding this vessel may seal or open under: counted, with the key in hand. */
  #usable(line: Line): Set<KeyVersionId> {
    return new Set([...line.keys.keys()].filter((version) => line.lineage.has(version)));
  }
  async #noteHead(line: Line, head: KeyVersionId): Promise<void> { await this.#ports.store.noteOwn(`write-head.${line.locator}`, hexToBytes(head)); }
  async #lastHead(line: Line): Promise<KeyVersionId | null> {
    const note = await this.#ports.store.own(`write-head.${line.locator}`);
    return note === null ? null : readKeyVersionId(hex(note));
  }
  /** The founding this vessel writes under: the only one, or the one it wrote under. */
  async #writeLine(bag: Bag | undefined): Promise<Line | HolderRefusal> {
    const lines = [...(bag?.lines.values() ?? [])].filter((line) => !line.lineage.unfounded);
    if (lines.length === 0) return refuse("bag-unfounded");
    if (lines.length === 1) return lines[0]!;
    const written: Line[] = [];
    for (const line of lines) if ((await this.#lastHead(line)) !== null) written.push(line);
    return written.length === 1 ? written[0]! : refuse("founding-forked");
  }

  // ── Mints ─────────────────────────────────────────────────────────────────────────────────────
  /** Mint one version: wrap, rest the lockbox, sign, verify, count, rest the record. `drawn` hands in a key
   *  the caller already drew (a founding derives its locator from it); the mint owns it from then on. */
  async #mint(bag: Bag, line: Line, plan: KeyRollPlan, signer: RecordSigner, leaveOut: readonly ReaderId[], drawn?: ContentKey): Promise<MintOutcome | HolderRefusal> {
    const { store, shore, random } = this.#ports;
    const key = drawn ?? mintContentKey(random);
    let kept = false;
    try {
      const keyVersion = keyVersionIdOf(key, bag.bagId);
      const fact = factOfPlan(plan, keyVersion);
      // A version that opens a span on a from-now admission takes a fresh base first: the admitting vessel
      // answers for that base before any lockbox for the version wraps.
      if (plan.cause.kind === "admission" && (this.#ports.freshBase === undefined || (await this.#ports.freshBase({ bagId: bag.bagId, founding: line.locator, keyVersion })) !== true)) {
        return refuse("fresh-base-unavailable");
      }
      const out = new Set(leaveOut.map(bare));
      const readers = (await this.#ports.readersOf(bag.bagId)).filter((reader) => !out.has(bare(reader)));
      if (this.#locked) return refuse("holder-locked");
      const wrapped = await wrapLockbox({ payload: { bagId: bag.bagId, locator: line.locator, keyVersion, key }, readers, shore, ...(random ? { random } : {}) });
      if (!("lockbox" in wrapped)) return refuse("wrap-failed", wrapped.cause ?? wrapped.refusal);
      await this.#rest(() => store.putLockbox(wrapped.lockbox));
      const body: KeyVersionBody = { bag: line.locator, keyVersion, parents: fact.parents, span: fact.span };
      const joinProofs = plan.cause.kind === "join" ? fact.parents.map((parent) => joinProofOf(line.keys.get(parent)!, keyVersion)) : [];
      const secret: KeyVersionPrivate = { cause: plan.cause, history: plan.history, joinProofs, unserved: [...new Set(wrapped.unreached.map(bare))].sort(ascending) };
      const signed = await this.#sign("key-version", body, secret, bag.bagId, line.locator, key, signer);
      if (isRefusal(signed)) return signed;
      const heldParents = new Map(fact.parents.map((parent) => [parent, line.keys.get(parent)!] as const));
      const evidence = await this.#ports.evidenceOf(bag.bagId);
      const counted = line.lineage.count(factOfRecord(signed.verified), {
        raiseCounts: (act) => evidence.raiseCounts(act), admissionVerifies: (act) => evidence.admissionVerifies(act),
        joinProven: () => joinProven(signed.verified, heldParents),
      });
      if (!("lineage" in counted)) return refuse("count-refused", counted.refusal);
      await this.#rest(() => store.putRecord(signed.carried));
      if (this.#locked) return refuse("holder-locked");
      line.lineage = counted.lineage;
      line.keys.set(keyVersion, key); kept = true;
      if (plan.cause.kind === "removal") line.rolled = true;
      line.records.set(keyVersion, signed.verified); line.carried.set(keyVersion, signed.carried);
      return { keyVersion, founding: line.locator, unserved: secret.unserved };
    } finally {
      if (!kept) key.fill(0);
    }
  }

  /** Sign one record and read it back as any reader would: a record its own writer cannot verify never rests. */
  async #sign<K extends RecordKind>(kind: K, body: RecordBodies[K], secret: RecordPrivates[K], bagId: string, locator: BagLocator, key: ContentKey, signer: RecordSigner):
    Promise<{ carried: SealedRecord<K>; verified: VerifiedRecord<K> } | HolderRefusal> {
    const signed = await signRecord({ kind, body, private: secret, bagId, key, signer, ...(this.#ports.random ? { random: this.#ports.random } : {}) });
    if (!("record" in signed)) return refuse("record-refused", signed.cause ? `${signed.refusal}:${signed.cause}` : signed.refusal);
    const read = readRecord(kind, signed.record, { bagId, locator, key, standing: this.#ports.standing, ...(this.#ports.apart ? { apart: this.#ports.apart } : {}) });
    if (!("record" in read)) return refuse("record-refused", read.cause ? `${read.refusal}:${read.cause}` : read.refusal);
    return { carried: signed.record, verified: read.record };
  }

  /** Found a bag: its first version, under a locator its own key derives. */
  async #found(bags: Map<string, Bag>, bagId: string, history: HistoryDeclaration, signer: RecordSigner): Promise<{ line: Line; minted: MintOutcome } | HolderRefusal> {
    const planned = planFounding(KeyLineage.empty(), history);
    if (!("plan" in planned)) return refuse("count-refused", planned.refusal);
    // A founding wraps a key for this vessel's own seat: a vessel under its own shadow founds nothing.
    if (await this.#ports.ownEdgeShadowed(bagId)) return refuse("own-edge-shadowed");
    const key = mintContentKey(this.#ports.random);
    const bag = bags.get(bagId) ?? { bagId, lines: new Map<BagLocator, Line>() };
    const line: Line = { locator: bagLocatorOf(key, bagId), lineage: KeyLineage.empty(), keys: new Map(), records: new Map(), carried: new Map(), why: new Map(), manifests: new Map() };
    const minted = await this.#mint(bag, line, planned.plan, signer, [], key);
    if (isRefusal(minted)) return minted;
    bag.lines.set(line.locator, line);
    bags.set(bagId, bag);
    return { line, minted };
  }

  /** The head this vessel seals under in one founding, joining sibling heads of one span where it holds them all. */
  async #head(bag: Bag, line: Line, signer: RecordSigner): Promise<{ head: KeyVersionId; joined?: MintOutcome } | HolderRefusal> {
    const usable = this.#usable(line);
    const last = await this.#lastHead(line);
    const choice = writeHead(line.lineage, usable, last ?? undefined);
    // A head already held: the seal draws no key and wraps for nobody, so it runs under the vessel's own
    // shadow. Each reader's own standing check judges the manifest it signs.
    if ("head" in choice) return { head: choice.head };
    if ("refusal" in choice) return refuse(choice.refusal);
    if ("ambiguous" in choice) return refuse("head-ambiguous");
    // Every head held: a capable writer joins them. Heads of unlike spans join onto a fresh base, which the
    // document store's own checkpoint supplies; here that join refuses by name.
    if (new Set(choice.joinOwed.map((head) => line.lineage.fact(head)!.span)).size > 1) return refuse("join-across-spans");
    if (await this.#ports.ownEdgeShadowed(bag.bagId)) return refuse("own-edge-shadowed");
    const planned = planJoin(line.lineage, { held: usable, historyForNewSpan: "closed", ownEdgeShadowed: false });
    if (!("plan" in planned)) return refuse("count-refused", planned.refusal);
    const joined = await this.#mint(bag, line, planned.plan, signer, []);
    return isRefusal(joined) ? joined : { head: joined.keyVersion, joined };
  }

  // ── Seal and open ─────────────────────────────────────────────────────────────────────────────
  /**
   * Seal one private body into its bag. A bag no key ever served gets founded first: `founding` declares the
   * span's history, and a founding with no declaration stands closed. The sealed value rests, then the
   * manifest that names it, then the index rows.
   */
  sealBlob(args: { readonly bagId: string; readonly plaintext: Uint8Array; readonly signer: RecordSigner | null; readonly founding?: { readonly history: HistoryDeclaration };
    /** The raises the vessel counted whose removal roll still owes this bag (sealed-store road, step 2: a removed
     *  device opens nothing a vessel seals after it counts the raise). The head this seal writes under must follow
     *  every one, or the seal refuses `roll-owed` and seals nothing. A founding takes no exemption: its first version
     *  follows no removal, so no bag founds while a raise in its scope stays owed. Read twice inside the holder's
     *  turn: before any key mints, and again at the commit point, after every signature and before the first byte
     *  rests, so a raise counted while the seal signed still refuses it. */
    readonly owedActs?: () => readonly string[] }): Promise<SealedBlob | HolderRefusal> {
    return this.#inTurn<SealedBlob>(async () => {
      if (!isWellFormedText(args.bagId)) return refuse("bag-malformed");
      if (args.signer === null) return refuse("signer-unavailable");
      const { store, random } = this.#ports;
      const bags = await this.#loaded();
      let founded: MintOutcome | undefined;
      let line = await this.#writeLine(bags.get(args.bagId));
      if (isRefusal(line)) {
        if (line.refusal !== "bag-unfounded") return line;
        // A founding follows no removal: while a raise in the bag's scope stays owed, no first version mints.
        if ((args.owedActs?.() ?? []).length > 0) return refuse("roll-owed");
        const made = await this.#found(bags, args.bagId, args.founding?.history ?? "closed", args.signer);
        if (isRefusal(made)) return made;
        line = made.line; founded = made.minted;
      }
      const bag = bags.get(args.bagId)!;
      const at = await this.#head(bag, line, args.signer);
      if (isRefusal(at)) return at;
      const owesRoll = (): boolean => (args.owedActs?.() ?? []).some((act) => !line.lineage.followsRemoval(at.head, act));
      if (owesRoll()) return refuse("roll-owed");
      const key = line.keys.get(at.head)!;
      const sealed = sealPrivateBody(args.plaintext, { bagId: args.bagId, key }, random);
      if (!("body" in sealed)) return refuse("seal-refused", sealed.refusal);
      const { body } = sealed;
      const context: SealContext = { bagId: args.bagId, keyVersion: at.head, role: "blob", logicalRef: hexToBytes(body.ref) };
      const earlier = await store.own(`manifest-head.${line.locator}.${at.head}`);
      const manifest: ManifestBody = {
        bag: line.locator, keyVersion: at.head, parents: earlier === null ? [] : [hex(earlier) as RecordId],
        entries: [{ role: "blob", address: body.cid, locator: entryLocatorOf(key, context), parents: [] }],
      };
      const signed = await this.#sign("manifest", manifest, {}, args.bagId, line.locator, key, args.signer);
      if (isRefusal(signed)) return signed;
      // THE COMMIT POINT. Every signature this seal waited on has landed; nothing of the value rests yet. A raise the
      // vessel counted meanwhile binds it here: the head must still follow every owed raise, or nothing rests.
      if (owesRoll()) return refuse("roll-owed");
      // A lock that landed while the manifest signed overwrote the key, so the record above never read back.
      await this.#rest(() => this.#ports.values.write(body.cid, body.ciphertext));
      const id = await this.#rest(() => store.putRecord(signed.carried));
      await this.#rest(() => store.putIndexRows(indexRowsOf(signed.verified)));
      await this.#rest(() => store.noteOwn(`manifest-head.${line.locator}.${at.head}`, hexToBytes(id)));
      await this.#rest(() => this.#noteHead(line, at.head));
      line.manifests.set(id, signed.verified);
      return { body, manifest: id, founding: line.locator, ...(founded ? { founded } : {}), ...(at.joined ? { joined: at.joined } : {}) };
    });
  }

  /** A manifest this vessel verified under one counted version's key, by its id. */
  async #manifest(bag: Bag, line: Line, key: ContentKey, id: RecordId): Promise<VerifiedRecord<"manifest"> | null> {
    const known = line.manifests.get(id);
    if (known) return known;
    for (const carried of await this.#ports.store.record("manifest", id)) {
      const read = readRecord("manifest", carried, { bagId: bag.bagId, locator: line.locator, key, standing: this.#ports.standing, ...(this.#ports.apart ? { apart: this.#ports.apart } : {}) });
      if ("record" in read) { line.manifests.set(id, read.record); return read.record; }
    }
    return null;
  }

  /**
   * Open one private body by the digest its pointer names. The holder derives the entry locator under each
   * version it may open, finds the row, verifies the manifest the row names, and opens the address that
   * manifest authorizes. Answers the whole body or one named refusal.
   */
  openBlob(args: { readonly bagId: string; readonly ref: string }): Promise<{ readonly plaintext: Uint8Array; readonly keyVersion: KeyVersionId } | HolderRefusal> {
    return this.#inTurn<{ readonly plaintext: Uint8Array; readonly keyVersion: KeyVersionId }>(async () => {
      if (!isWellFormedText(args.bagId)) return refuse("bag-malformed");
      if (typeof args.ref !== "string" || !/^[0-9a-f]{64}$/.test(args.ref)) return refuse("open-refused", "reference-malformed");
      const bag = (await this.#loaded()).get(args.bagId);
      // A bag stands founded here once some founding of it holds a version this vessel may open under.
      if (!bag || ![...bag.lines.values()].some((line) => this.#usable(line).size > 0)) return refuse("bag-unfounded");
      let met: HolderRefusal = refuse("reference-unknown");
      for (const line of bag.lines.values()) for (const keyVersion of this.#usable(line)) {
        const key = line.keys.get(keyVersion)!;
        const context: SealContext = { bagId: args.bagId, keyVersion, role: "blob", logicalRef: hexToBytes(args.ref) };
        for (const row of await this.#ports.store.rowsAt(line.locator, keyVersion, entryLocatorOf(key, context))) {
          const manifest = await this.#manifest(bag, line, key, row.manifest);
          const authorized = manifest === null ? null : authorizeFromManifest(manifest, key, context);
          if (authorized === null) continue;
          const ciphertext = await this.#ports.values.read(authorized.address);
          if (ciphertext === null) { met = refuse("value-absent"); continue; }
          const opened = openPrivateBody({ ciphertext, under: { bagId: args.bagId, key }, ref: args.ref, authorized });
          if ("plaintext" in opened) return { plaintext: opened.plaintext, keyVersion };
          met = refuse("open-refused", opened.refusal);
        }
      }
      return met;
    });
  }

  // ── The roll ──────────────────────────────────────────────────────────────────────────────────
  /**
   * The ports the content-key roll asks (`contentKeyRollSink`). The vessel supplies its own readings: the
   * bags a scope reaches, and the signer of the session whose act answered the raise.
   */
  rollerPorts(vessel: {
    bagsOf(scope: string): readonly string[] | Promise<readonly string[]>;
    signer(): RecordSigner | null;
    report?(outcome: RollOutcome): void;
  }): RollerPorts {
    return {
      bagsOf: (scope) => vessel.bagsOf(scope),
      lineagesOf: async (bagId) => {
        // No chain standing: the holder reads nothing, so the roll reads `unknown-bag` and comes again.
        if (this.#locked || !this.#chainStands()) return null;
        const bag = (await this.#inTurn(async () => (await this.#loaded()).get(bagId) ?? { bagId, lines: new Map<BagLocator, Line>() })) as Bag | HolderRefusal;
        if (isRefusal(bag)) return null;
        return [...bag.lines.values()].filter((line) => !line.lineage.unfounded).map((line) => ({ founding: line.locator, lineage: line.lineage, held: this.#usable(line) }));
      },
      ownEdgeShadowed: async (_scope, bagId) => this.#ports.ownEdgeShadowed(bagId),
      // A SEAT THAT LEFT STANDS OWED NO EARLIER KEY. The roll that names a seat rests one note for the bag and
      // that reader: a digest of each raise the roll answered. The note needs no version in hand, so a version
      // that arrives later still meets it (`#owedStill`).
      seatLeft: async (bagId, roll) => {
        const settled = await this.#inTurn<true>(async () => {
          for (const reader of seatOf(roll).map(bare)) {
            const name = leftNote(bagId, reader);
            const known = new Set(digestsOf(await this.#ports.store.own(name)));
            const before = known.size;
            for (const raise of roll.raiseCids) known.add(hex(sha256(utf8Bytes(raise))));
            if (known.size !== before) await this.#rest(() => this.#ports.store.noteOwn(name, hexToBytes([...known].sort(ascending).join(""))));
          }
          return true;
        });
        if (settled !== true) throw new Error("the note for a seat that left did not rest");
      },
      mint: async (bagId, founding, plan, roll) => {
        const minted = await this.#inTurn<KeyVersionFact>(async () => {
          const signer = vessel.signer();
          if (signer === null) return refuse("signer-unavailable");
          const bag = (await this.#loaded()).get(bagId);
          const line = bag?.lines.get(founding as BagLocator);
          if (!bag || !line) return refuse("bag-unfounded");
          if (await this.#ports.ownEdgeShadowed(bagId)) return refuse("own-edge-shadowed");
          // The lineage may have moved since the plan got cut: plan again, here, under the turn.
          const again = planRemovalRolls(line.lineage, { acts: plan.cause.kind === "removal" ? plan.cause.acts : [], held: this.#usable(line), ownEdgeShadowed: false });
          const same = "plans" in again ? again.plans.find((one) => one.span === plan.span) : undefined;
          if (!same) return refuse("count-refused", "refusal" in again ? again.refusal : "the span owes no roll");
          const out = await this.#mint(bag, line, same, signer, seatOf(roll));
          return isRefusal(out) ? out : line.lineage.fact(out.keyVersion)!;
        });
        return isRefusal(minted) ? null : minted;
      },
      report: (outcome) => { vessel.report?.(outcome); },
    };
  }

  // ── The from-now admission ────────────────────────────────────────────────────────────────────
  /**
   * Mint the version a from-now admission owes: a successor that opens a new span, wrapped for the readers the
   * key group holds now, the newcomer among them. `act` names the admission act this vessel verified; `history`
   * declares the new span. The newcomer receives this version alone. The span's fresh base belongs to the
   * document store, which cuts it before a document change seals under the new version.
   */
  admitFromNow(args: { readonly bagId: string; readonly act: string; readonly history: HistoryDeclaration; readonly signer: RecordSigner | null }): Promise<readonly MintOutcome[] | HolderRefusal> {
    return this.#inTurn<readonly MintOutcome[]>(async () => {
      if (!isWellFormedText(args.bagId)) return refuse("bag-malformed");
      if (args.signer === null) return refuse("signer-unavailable");
      const bag = (await this.#loaded()).get(args.bagId);
      const lines = [...(bag?.lines.values() ?? [])].filter((line) => !line.lineage.unfounded);
      if (!bag || lines.length === 0) return refuse("bag-unfounded");
      if (await this.#ports.ownEdgeShadowed(args.bagId)) return refuse("own-edge-shadowed");
      const minted: MintOutcome[] = [];
      let met: HolderRefusal = refuse("no-head-held");
      for (const line of lines) {
        const planned = planAdmissionFromNow(line.lineage, { act: args.act, held: this.#usable(line), history: args.history, ownEdgeShadowed: false });
        if (!("plan" in planned)) { met = refuse(planned.refusal === "no-head-held" ? "no-head-held" : "count-refused", planned.refusal); continue; }
        const out = await this.#mint(bag, line, planned.plan, args.signer, []);
        if (isRefusal(out)) return out;
        minted.push(out);
      }
      return minted.length > 0 ? minted : met;
    });
  }

  // ── The hand-over ─────────────────────────────────────────────────────────────────────────────
  /**
   * Hand one span's keys to one reader, by an explicit act. Wraps one lockbox for each version of the head's
   * span to that reader alone, signs a hand-over record under the head, and answers one parcel for each
   * version. `missing` names the versions of the span this vessel holds no key for.
   */
  handOver(args: { readonly bagId: string; readonly reader: ReaderId; readonly from?: KeyVersionId; readonly signer: RecordSigner | null }):
    Promise<{ readonly parcels: readonly KeyParcel[]; readonly record: SealedRecord<"hand-over">; readonly missing: readonly KeyVersionId[] } | HolderRefusal> {
    return this.#inTurn<{ readonly parcels: readonly KeyParcel[]; readonly record: SealedRecord<"hand-over">; readonly missing: readonly KeyVersionId[] }>(async () => {
      if (!isWellFormedText(args.bagId)) return refuse("bag-malformed");
      if (args.signer === null) return refuse("signer-unavailable");
      const { store, shore, random } = this.#ports;
      const bag = (await this.#loaded()).get(args.bagId);
      let line: Line | HolderRefusal;
      let from = args.from;
      if (from !== undefined) {
        line = [...(bag?.lines.values() ?? [])].find((one) => one.lineage.has(from!)) ?? refuse("version-unknown");
      } else {
        line = await this.#writeLine(bag);
        if (!isRefusal(line)) {
          const choice = writeHead(line.lineage, this.#usable(line), (await this.#lastHead(line)) ?? undefined);
          if (!("head" in choice)) return refuse("refusal" in choice ? choice.refusal : "head-ambiguous");
          from = choice.head;
        }
      }
      if (isRefusal(line)) return line;
      if (await this.#ports.ownEdgeShadowed(args.bagId)) return refuse("own-edge-shadowed");
      const usable = this.#usable(line);
      const span = line.lineage.fact(from!)!.span;
      // The opener alone states the declaration its span opened with.
      if (!line.lineage.has(span)) return refuse("opener-not-counted");
      const planned = versionsToHandOver(line.lineage, { from: from!, held: usable });
      if (!("versions" in planned)) return refuse(planned.refusal === "history-closed" ? "history-closed" : "no-head-held");
      const reader = bare(args.reader);
      if (!(await this.#ports.readersOf(args.bagId)).some((one) => bare(one) === reader)) return refuse("reader-not-standing");
      const handed = planned.versions.filter((version) => usable.has(version));
      const lockboxes: { version: KeyVersionId; lockbox: LockboxRecord }[] = [];
      for (const version of handed) {
        const wrapped = await wrapLockbox({ payload: { bagId: args.bagId, locator: line.locator, keyVersion: version, key: line.keys.get(version)! }, readers: [args.reader], shore, ...(random ? { random } : {}) });
        if (!("lockbox" in wrapped)) return refuse("wrap-failed", wrapped.cause ?? wrapped.refusal);
        // Nothing rests for a reader this vessel cannot seat: the first wrap says so, before any lockbox lands.
        if (wrapped.unreached.length > 0) return refuse("reader-unreached");
        lockboxes.push({ version, lockbox: wrapped.lockbox });
      }
      const body: HandOverBody = { bag: line.locator, keyVersion: from!, span, versions: [...handed].sort(ascending) };
      const signed = await this.#sign("hand-over", body, { reader }, args.bagId, line.locator, line.keys.get(from!)!, args.signer);
      if (isRefusal(signed)) return signed;
      for (const { lockbox } of lockboxes) await this.#rest(() => store.putLockbox(lockbox));
      await this.#rest(() => store.putRecord(signed.carried));
      const ops = await shore.opsFor(args.reader);
      const parcels = lockboxes.map(({ version, lockbox }): KeyParcel => ({ lockbox, record: line.carried.get(version)!, ops }));
      return { parcels, record: signed.carried, missing: planned.versions.filter((version) => !usable.has(version)) };
    });
  }

  /** The parcels one reader needs for every version of one bag this vessel counted: each lockbox it holds for
   *  that version, the version's record, and the key shore's public operations for that reader. A parcel carries
   *  a lockbox to a reader, so a vessel under its own shadow hands none on. */
  parcelsFor(args: { readonly bagId: string; readonly reader: ReaderId }): Promise<readonly KeyParcel[] | HolderRefusal> {
    return this.#inTurn<readonly KeyParcel[]>(async () => {
      const bag = (await this.#loaded()).get(args.bagId);
      if (!bag) return refuse("bag-unfounded");
      if (await this.#ports.ownEdgeShadowed(args.bagId)) return refuse("own-edge-shadowed");
      const ops = await this.#ports.shore.opsFor(args.reader);
      const parcels: KeyParcel[] = [];
      for (const line of bag.lines.values()) for (const [version, record] of line.carried) {
        for (const lockbox of await this.#ports.store.lockboxes(version)) if (lockbox.bag === line.locator) parcels.push({ lockbox, record, ops });
      }
      return parcels;
    });
  }

  /**
   * Take what the member lane delivered: parcels, and any records that travel beside them (a hand-over record,
   * manifests). Everything rests first; the holder then reads its lockboxes afresh and counts again, so a base
   * whose parent just arrived stands only where that parent now counts. A receipt wraps nothing and hands
   * nothing on, so it runs under the vessel's own shadow: the hand that wrapped answered for whom it served.
   */
  receive(args: { readonly parcels: readonly KeyParcel[]; readonly records?: readonly SealedRecord[] }): Promise<{ readonly bags: readonly BagReading[] } | HolderRefusal> {
    return this.#inTurn<{ readonly bags: readonly BagReading[] }>(async () => {
      const { store, shore } = this.#ports;
      await shore.ingest(args.parcels.flatMap((parcel) => [...parcel.ops]));
      for (const parcel of args.parcels) { await this.#rest(() => store.putLockbox(parcel.lockbox)); await this.#rest(() => store.putRecord(parcel.record)); }
      const arrived = new Set<RecordId>();
      for (const record of args.records ?? []) { const id = await this.#rest(() => store.putRecord(record)); if (record.kind === "manifest") arrived.add(id); }
      const before = new Set<KeyVersionId>();
      for (const bag of this.#bags?.values() ?? []) for (const line of bag.lines.values()) for (const version of this.#usable(line)) before.add(version);
      const bags = await this.#reload();
      // A manifest enters the index once this vessel verified it under a version it counted: each manifest that
      // just arrived, and each resting manifest of a version this reading counted for the first time.
      await this.#indexAfter(bags, before, arrived);
      return { bags: [...bags.values()].map((bag) => this.#reading(bag, null)) };
    });
  }

  // ── The memory section: the cut and the import door ───────────────────────────────────────────
  /**
   * Seal the memory section of a backup bundle: every key this vessel COUNTED AND HOLDS among `bags`, one entry
   * per bag and key version, sealed to `to` (the public half of the pair the bundle key derives). Answers the
   * ciphertext and a list that names bags and versions and no key. A cut hands keys beyond the holder, so it
   * refuses under the vessel's own shadow; it reads that shadow once, here, before it gathers anything.
   *
   * `shadowRead`: the caller read this vessel's own shadow at the entry of the act this cut belongs to, and read
   * none. The holder then reads none of its own: an act reads its shadow ONCE, so a raise the vessel counts
   * while the act runs binds its next act and never this one (custody#/the-cut).
   */
  cutMemory(args: { readonly bags: readonly string[]; readonly to: Uint8Array; readonly shadowRead?: boolean }): Promise<{ readonly section: Uint8Array; readonly holds: readonly MemoryHolding[] } | HolderRefusal> {
    return this.#inTurn<{ readonly section: Uint8Array; readonly holds: readonly MemoryHolding[] }>(async () => {
      const named = [...new Set(args.bags)].sort(ascending);
      if (!named.every((bagId) => isWellFormedText(bagId))) return refuse("bag-malformed");
      if (args.shadowRead !== true) for (const bagId of named) if (await this.#ports.ownEdgeShadowed(bagId)) return refuse("own-edge-shadowed");
      // A SEAT THAT OPENS NO LOCKBOX HOLDS NOTHING UNDER ANY CHAIN (a vessel that dials no hearth composes none):
      // its section carries no entry, and no reading caches. One that opens a lockbox counts under the chain alone.
      const bags = !this.#chainStands() && !(await this.#opensAnyLockbox()) ? new Map<string, Bag>() : await this.#loaded();
      const entries: MemoryEntry[] = [];
      const holds: MemoryHolding[] = [];
      for (const bagId of named) for (const line of [...(bags.get(bagId)?.lines.values() ?? [])].sort((a, b) => ascending(a.locator, b.locator))) {
        for (const keyVersion of [...this.#usable(line)].sort(ascending)) {
          // The entry borrows the holder's own key for the moment of the seal: the seal copies it into its image.
          entries.push({ bagId, locator: line.locator, keyVersion, key: line.keys.get(keyVersion)! });
          holds.push({ bagId, founding: line.locator, keyVersion });
        }
      }
      if (this.#locked) return refuse("holder-locked");
      let section: Uint8Array;
      try { section = sealMemorySection(entries, args.to); } catch (err) { return refuse("seal-refused", said(err)); }
      return { section, holds };
    });
  }

  /**
   * THE IMPORT DOOR. Open a memory section inside the holder (`secret`: the section pair's secret half) and land
   * what passes. The act refuses whole, before any entry lands: no session signer, no seat of this vessel's own,
   * its own shadow over a bag an entry names, a section that does not open. Each entry then draws one outcome
   * (`MEMORY_OUTCOMES`). An entry that passes rests a `memory-import` record signed under its version, then one
   * lockbox for this vessel's own seat alone. The holder then reads its lockboxes afresh and counts again.
   *
   * THE DOOR COUNTS BY THE LINEAGE'S OWN RULES: it counts the vessel's own keys beside the entries on a scratch
   * reading, against this vessel's own evidence, and lands only a version that reading counts. It asks for no
   * history declaration: one face on a new device reads as the same audience (sealed-store#/epochs).
   *
   * IT ADDS AND NEVER REPLACES: it writes no lockbox over another, removes no record and moves no head.
   */
  importMemory(args: { readonly section: Uint8Array; readonly secret: Uint8Array; readonly signer: RecordSigner | null }): Promise<{ readonly results: readonly MemoryImportResult[] } | HolderRefusal> {
    return this.#inTurn<{ readonly results: readonly MemoryImportResult[] }>(async () => {
      if (args.signer === null) return refuse("signer-unavailable");
      const seat = await this.#ports.ownSeat();
      if (seat === null) return refuse("seat-not-standing");
      const entries = openMemorySection(args.section, args.secret);
      if (entries === null) return refuse("memory-malformed");
      try {
        const { store, shore, random } = this.#ports;
        for (const bagId of [...new Set(entries.map((entry) => entry.bagId))].sort(ascending)) {
          if (await this.#ports.ownEdgeShadowed(bagId)) return refuse("own-edge-shadowed");
        }
        const bags = await this.#loaded();
        const results: (MemoryImportResult | null)[] = entries.map(() => null);
        const say = (at: number, outcome: MemoryOutcome, cause?: string): void => {
          const entry = entries[at]!;
          results[at] = { bagId: entry.bagId, keyVersion: entry.keyVersion, outcome, ...(cause === undefined ? {} : { cause }) };
        };
        // THE KEY FIRST, THEN WHAT THE VESSEL ALREADY HOLDS. Neither reading opens a record.
        const live = new Map<string, number[]>();   // `${bagId}\n${locator}` → the entries still to judge
        entries.forEach((entry, at) => {
          const key = readContentKey(entry.key);
          const version = readKeyVersionId(entry.keyVersion), locator = readBagLocator(entry.locator);
          if (key === null || version === null || locator === null || keyVersionIdOf(key, entry.bagId) !== version) { say(at, "key-forged"); return; }
          const line = bags.get(entry.bagId)?.lines.get(locator);
          if (line && line.keys.has(version) && line.lineage.has(version)) { say(at, "held"); return; }
          const name = `${entry.bagId}\n${locator}`;
          live.set(name, [...(live.get(name) ?? []), at]);
        });
        // A SCRATCH READING per founding: the keys this vessel holds beside the entries, counted as any reload
        // counts, against this vessel's own evidence. Nothing of it reaches the holder's own lines.
        const carried = live.size > 0 ? await store.records("key-version") : [];
        const landing: { at: number; bag: Bag; locator: BagLocator; version: KeyVersionId; key: ContentKey }[] = [];
        const lands = new Set<string>();
        for (const [name, indexes] of live) {
          const bagId = name.slice(0, name.indexOf("\n")), locator = name.slice(name.indexOf("\n") + 1) as BagLocator;
          const bag: Bag = bags.get(bagId) ?? { bagId, lines: new Map() };
          const standing = bag.lines.get(locator);
          const scratch: Line = { locator, lineage: KeyLineage.empty(), keys: new Map(standing?.keys ?? []), records: new Map(), carried: new Map(), why: new Map(), manifests: new Map() };
          for (const at of indexes) {
            const version = entries[at]!.keyVersion as KeyVersionId;
            if (!scratch.keys.has(version)) scratch.keys.set(version, entries[at]!.key as ContentKey);
          }
          this.#count(bag, scratch, carried, await this.#ports.evidenceOf(bagId));
          for (const at of indexes) {
            const version = entries[at]!.keyVersion as KeyVersionId;
            const why = scratch.why.get(version);
            // One version lands once, however many entries name it.
            if (scratch.lineage.has(version)) { if (lands.has(`${name}\n${version}`)) say(at, "held"); else { lands.add(`${name}\n${version}`); landing.push({ at, bag, locator, version, key: entries[at]!.key as ContentKey }); } }
            else if (scratch.lineage.conflicted(version) || why === "version-conflict") say(at, "version-conflicted");
            else if (why === undefined) say(at, "record-unverified");
            else if ((LINEAGE_REFUSALS as readonly string[]).includes(why)) say(at, "transition-uncounted", why);
            else say(at, "record-unverified", why);
          }
        }
        // WHAT PASSED LANDS: the record first, then the lockbox for this vessel's own seat alone.
        const reader = bare(seat);
        for (const { at, bag, locator, version, key } of landing) {
          if (this.#locked) return refuse("holder-locked");
          const signed = await this.#sign("memory-import", { bag: locator, keyVersion: version }, { seat: reader }, bag.bagId, locator, key, args.signer);
          if (isRefusal(signed)) return signed;
          const wrapped = await wrapLockbox({ payload: { bagId: bag.bagId, locator, keyVersion: version, key }, readers: [], shore, ...(random ? { random } : {}) });
          if (!("lockbox" in wrapped)) return refuse("wrap-failed", wrapped.cause ?? wrapped.refusal);
          await this.#rest(() => store.putRecord(signed.carried));
          await this.#rest(() => store.putLockbox(wrapped.lockbox));
          say(at, "imported");
        }
        if (landing.length > 0) {
          const before = new Set<KeyVersionId>();
          for (const bag of bags.values()) for (const line of bag.lines.values()) for (const version of this.#usable(line)) before.add(version);
          await this.#indexAfter(await this.#reload(), before, new Set());
        }
        return { results: results.map((one) => one!) };
      } finally {
        for (const entry of entries) entry.key.fill(0);
      }
    });
  }

  /** Index each resting manifest this vessel verifies under a version it counts: every manifest in `arrived`, and
   *  every manifest of a version outside `before` (a version this reading counted for the first time). */
  async #indexAfter(bags: Map<string, Bag>, before: ReadonlySet<KeyVersionId>, arrived: ReadonlySet<RecordId>): Promise<void> {
    const { store } = this.#ports;
    const resting = await store.records("manifest");
    for (const bag of bags.values()) for (const line of bag.lines.values()) {
      for (const carried of resting) {
        const version = carried.body.keyVersion;
        const key = carried.body.bag === line.locator && line.lineage.has(version) ? line.keys.get(version) : undefined;
        if (key === undefined) continue;
        const id = recordIdOf("manifest", carried.body);
        if (!arrived.has(id) && before.has(version)) continue;
        const manifest = await this.#manifest(bag, line, key, id);
        if (manifest !== null) await this.#rest(() => store.putIndexRows(indexRowsOf(manifest)));
      }
    }
  }

  /**
   * Serve the readers some counted version's mint could not reach, where this vessel now holds their card and
   * they still hold a seat and standing. Each gets that same key in a lockbox of its own. A reader served
   * once stays noted, so a repeat wraps nothing twice; a reader whose seat a roll named stands owed no version
   * minted before a successor for that roll's raises (`seatLeft`), so a seat that returns gets no earlier key.
   */
  serveUnserved(): Promise<{ readonly parcels: readonly KeyParcel[]; readonly owed: number } | HolderRefusal> {
    return this.#inTurn<{ readonly parcels: readonly KeyParcel[]; readonly owed: number }>(async () => {
      const { store, shore, random } = this.#ports;
      const parcels: KeyParcel[] = [];
      let owed = 0;
      for (const bag of (await this.#loaded()).values()) {
        // A vessel under its own shadow in this bag's scope wraps for nobody: the debt stays where it stood.
        if (await this.#ports.ownEdgeShadowed(bag.bagId)) continue;
        let standing: ReadonlySet<string> | null = null;
        for (const line of bag.lines.values()) for (const [version, record] of line.records) {
          for (const reader of record.private.unserved) {
            const note = ownNote("served", version, reader);
            if ((await store.own(note)) !== null) continue;
            standing ??= new Set((await this.#ports.readersOf(bag.bagId)).map(bare));
            if (!standing.has(reader)) continue;   // the reader left, or stands set aside: nothing owed to it now
            if (!(await this.#owedStill(bag, line, version, reader))) continue;   // its seat left after this version: a fresh seat takes no earlier key
            if (this.#locked) return refuse("holder-locked");
            const wrapped = await wrapLockbox({ payload: { bagId: bag.bagId, locator: line.locator, keyVersion: version, key: line.keys.get(version)! }, readers: [reader], shore, ...(random ? { random } : {}) });
            if (!("lockbox" in wrapped) || wrapped.unreached.length > 0) { owed += 1; continue; }
            await this.#rest(() => store.putLockbox(wrapped.lockbox));
            await this.#rest(() => store.noteOwn(note, new Uint8Array([1])));
            parcels.push({ lockbox: wrapped.lockbox, record: line.carried.get(version)!, ops: await shore.opsFor(reader) });
          }
        }
      }
      return { parcels, owed };
    });
  }

  /** Does this vessel still owe `reader` the key of `version`? Where a roll named the reader's seat, the debt
   *  stands only for a version that follows a removal successor for EVERY raise that roll answered: a version
   *  minted before the seat left, or beside it on a branch that never counted the raise, owes nothing. */
  async #owedStill(bag: Bag, line: Line, version: KeyVersionId, reader: string): Promise<boolean> {
    const left = digestsOf(await this.#ports.store.own(leftNote(bag.bagId, reader)));
    if (left.length === 0) return true;
    // The digest of every raise some removal in this version's causal past answered.
    const answered = new Set<string>();
    const seen = new Set<KeyVersionId>();
    for (const todo = [version]; todo.length > 0;) {
      const next = todo.pop()!;
      if (seen.has(next)) continue;
      seen.add(next);
      const fact = line.lineage.fact(next);
      if (fact === null) continue;
      if (fact.cause.kind === "removal") for (const act of fact.cause.acts) answered.add(hex(sha256(utf8Bytes(act))));
      todo.push(...fact.parents);
    }
    return left.every((raise) => answered.has(raise));
  }

  // ── Readings ──────────────────────────────────────────────────────────────────────────────────
  #reading(bag: Bag, written: BagLocator | null): BagReading {
    const foundings = [...bag.lines.values()].sort((a, b) => ascending(a.locator, b.locator)).map((line): FoundingReading => ({
      founding: line.locator, heads: line.lineage.heads(), held: [...this.#usable(line)].sort(ascending), forked: line.lineage.forked(),
      written: written === line.locator,
      unserved: [...new Set([...line.records.values()].flatMap((record) => [...record.private.unserved]))].sort(ascending),
      uncounted: [...line.why].filter(([version]) => !line.lineage.has(version)).map(([keyVersion, why]) => ({ keyVersion, why })).sort((a, b) => ascending(a.keyVersion, b.keyVersion)),
    }));
    return { bagId: bag.bagId, foundings, rival: foundings.filter((founding) => founding.heads.length > 0).length > 1 };
  }

  /**
   * Does any founding this seat holds keep a removal version in its rest, counted or not? A seat that rolled once
   * reads a removal's evidence from the vessel's fold; one that never rolled has none to read, as a joinee's seat.
   */
  holdsRemoval(): Promise<boolean | HolderRefusal> {
    return this.#inTurn<boolean>(async () => [...(await this.#loaded()).values()].some((bag) => [...bag.lines.values()].some((line) => line.rolled === true)));
  }

  /** What this vessel reads for one bag: each founding, its heads, what it holds, and what a door must show. */
  reading(bagId: string): Promise<BagReading | HolderRefusal> {
    return this.#inTurn<BagReading>(async () => {
      const bag = (await this.#loaded()).get(bagId) ?? { bagId, lines: new Map<BagLocator, Line>() };
      const line = await this.#writeLine(bag);
      return this.#reading(bag, isRefusal(line) ? null : line.locator);
    });
  }

  /** Choose the founding and the head this vessel writes under, where rival foundings or several heads left the
   *  choice to a person. The head must stand counted here, with its key in hand. The choice moves this vessel's
   *  own notes alone, so it runs under the vessel's own shadow. */
  chooseHead(args: { readonly bagId: string; readonly head: KeyVersionId }): Promise<{ readonly founding: BagLocator } | HolderRefusal> {
    return this.#inTurn<{ readonly founding: BagLocator }>(async () => {
      const bag = (await this.#loaded()).get(args.bagId);
      const line = [...(bag?.lines.values() ?? [])].find((one) => one.lineage.heads().includes(args.head) && this.#usable(one).has(args.head));
      if (!line) return refuse("no-head-held");
      // One founding carries this vessel's writes: the choice withdraws its note from every rival.
      for (const other of bag!.lines.values()) if (other !== line) await this.#rest(() => this.#ports.store.noteOwn(`write-head.${other.locator}`, new Uint8Array(0)));
      await this.#rest(() => this.#noteHead(line, args.head));
      return { founding: line.locator };
    });
  }
}

/** The seat a roll names, as the one reader its successor leaves out. */
function seatOf(roll: SeatRoll): readonly ReaderId[] { return roll.seat ? [roll.seat.member] : []; }
