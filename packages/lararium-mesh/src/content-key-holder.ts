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
 * A VESSEL UNDER ITS OWN SHADOW PERFORMS NO KEY ACT: it founds nothing, mints nothing, hands nothing over and
 * serves no reader, so no wrap of its own ever seats it.
 *
 * A LOCK ENDS AN ACT IN FLIGHT. Every act checks the lock again before each write to rest and before it
 * answers, so a locked holder rests nothing further and answers `holder-locked`.
 *
 * Platform-blind: it asks a store, a key shore and its vessel's readings through ports.
 * Canon: lar:///ha.ka.ba/lararium/mesh/sealed-store#/the-store
 */
import { sha256 } from "@noble/hashes/sha2.js";
import { hex, hexToBytes, utf8Bytes, type RandomProvider } from "./crypto.js";
import { openPrivateBody, sealPrivateBody, type SealedPrivateBody } from "./ciphertext-cas.js";
import {
  KeyLineage, factOfPlan, planAdmissionFromNow, planFounding, planJoin, planRemovalRolls, versionsToHandOver, writeHead,
  type HistoryDeclaration, type KeyRollPlan, type KeyVersionFact, type RollerPorts, type RollOutcome,
} from "./content-key-lineage.js";
import type { KeysHeldApart } from "./face-proof-subjects.js";
import { wrapLockbox, openLockbox, type KeyParcel, type LockboxWrapShore, type ReaderId } from "./lockbox-wrap.js";
import {
  isWellFormedText, keyVersionIdOf, mintContentKey, readKeyVersionId,
  type ContentKey, type KeyVersionId, type SealContext, type SealedAddress,
} from "./sealed-chunk.js";
import {
  authorizeFromManifest, bagLocatorOf, entryLocatorOf, factOfRecord, indexRowsOf, joinProofOf, joinProven, readRecord,
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
}
interface Bag { readonly bagId: string; readonly lines: Map<BagLocator, Line> }

const ascending = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
const refuse = (refusal: HolderRefusalName, cause?: string): HolderRefusal => (cause === undefined ? { refusal } : { refusal, cause });
const isRefusal = (value: object): value is HolderRefusal => "refusal" in value;
const bare = (reader: string): string => reader.trim().toLowerCase().replace(/^0x/, "");
const ownNote = (what: string, ...parts: readonly string[]): string => `${what}.${hex(sha256(utf8Bytes(parts.join("\n"))))}`;
const said = (err: unknown): string => (err instanceof Error ? err.message : String(err));

/** The one content-key holder of an unlocked vessel. */
export class ContentKeyHolder {
  readonly #ports: ContentKeyHolderPorts;
  #bags: Map<string, Bag> | null = null;
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
      } catch (err) { return this.#locked ? refuse("holder-locked") : refuse("store-failed", said(err)); }
    });
    this.#turn = run.catch(() => undefined);
    return run;
  }

  // ── The reading: lockboxes, then records ──────────────────────────────────────────────────────
  async #loaded(): Promise<Map<string, Bag>> {
    if (this.#bags !== null) return this.#bags;
    return this.#reload();
  }

  /** Read rest afresh: open every lockbox this seat opens, then count every record under the key it delivered. */
  async #reload(): Promise<Map<string, Bag>> {
    const { store, shore } = this.#ports;
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
      pending.push({ carried, verified: read.record });
    }
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
        } else if (result.refusal === "version-conflict") {
          lineage = result.conflicted;
          line.records.delete(version); line.carried.delete(version); line.why.set(version, "version-conflict");
        } else {
          line.why.set(version, result.refusal);
          if (result.refusal === "parent-unknown") continue;   // a parent may count later in this pass
        }
        pending.splice(i, 1); i -= 1; moved = true;
      }
    }
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
      if (this.#locked) return refuse("holder-locked");
      await store.putLockbox(wrapped.lockbox);
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
      if (this.#locked) return refuse("holder-locked");
      await store.putRecord(signed.carried);
      if (this.#locked) return refuse("holder-locked");
      line.lineage = counted.lineage;
      line.keys.set(keyVersion, key); kept = true;
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
  sealBlob(args: { readonly bagId: string; readonly plaintext: Uint8Array; readonly signer: RecordSigner | null; readonly founding?: { readonly history: HistoryDeclaration } }): Promise<SealedBlob | HolderRefusal> {
    return this.#inTurn<SealedBlob>(async () => {
      if (!isWellFormedText(args.bagId)) return refuse("bag-malformed");
      if (args.signer === null) return refuse("signer-unavailable");
      const { store, random } = this.#ports;
      const bags = await this.#loaded();
      let founded: MintOutcome | undefined;
      let line = await this.#writeLine(bags.get(args.bagId));
      if (isRefusal(line)) {
        if (line.refusal !== "bag-unfounded") return line;
        const made = await this.#found(bags, args.bagId, args.founding?.history ?? "closed", args.signer);
        if (isRefusal(made)) return made;
        line = made.line; founded = made.minted;
      }
      const bag = bags.get(args.bagId)!;
      const at = await this.#head(bag, line, args.signer);
      if (isRefusal(at)) return at;
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
      // A lock that landed while the manifest signed overwrote the key, so the record above never read back.
      await this.#ports.values.write(body.cid, body.ciphertext);
      if (this.#locked) return refuse("holder-locked");
      const id = await store.putRecord(signed.carried);
      await store.putIndexRows(indexRowsOf(signed.verified));
      await store.noteOwn(`manifest-head.${line.locator}.${at.head}`, hexToBytes(id));
      await this.#noteHead(line, at.head);
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
        if (this.#locked) return null;
        const bag = (await this.#inTurn(async () => (await this.#loaded()).get(bagId) ?? { bagId, lines: new Map<BagLocator, Line>() })) as Bag | HolderRefusal;
        if (isRefusal(bag)) return null;
        return [...bag.lines.values()].filter((line) => !line.lineage.unfounded).map((line) => ({ founding: line.locator, lineage: line.lineage, held: this.#usable(line) }));
      },
      ownEdgeShadowed: async (_scope, bagId) => this.#ports.ownEdgeShadowed(bagId),
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
      for (const { lockbox } of lockboxes) await store.putLockbox(lockbox);
      await store.putRecord(signed.carried);
      const ops = await shore.opsFor(args.reader);
      const parcels = lockboxes.map(({ version, lockbox }): KeyParcel => ({ lockbox, record: line.carried.get(version)!, ops }));
      return { parcels, record: signed.carried, missing: planned.versions.filter((version) => !usable.has(version)) };
    });
  }

  /** The parcels one reader needs for every version of one bag this vessel counted: each lockbox it holds for
   *  that version, the version's record, and the key shore's public operations for that reader. */
  parcelsFor(args: { readonly bagId: string; readonly reader: ReaderId }): Promise<readonly KeyParcel[] | HolderRefusal> {
    return this.#inTurn<readonly KeyParcel[]>(async () => {
      const bag = (await this.#loaded()).get(args.bagId);
      if (!bag) return refuse("bag-unfounded");
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
   * whose parent just arrived stands only where that parent now counts.
   */
  receive(args: { readonly parcels: readonly KeyParcel[]; readonly records?: readonly SealedRecord[] }): Promise<{ readonly bags: readonly BagReading[] } | HolderRefusal> {
    return this.#inTurn<{ readonly bags: readonly BagReading[] }>(async () => {
      const { store, shore } = this.#ports;
      await shore.ingest(args.parcels.flatMap((parcel) => [...parcel.ops]));
      for (const parcel of args.parcels) { await store.putLockbox(parcel.lockbox); await store.putRecord(parcel.record); }
      const arrived = new Set<RecordId>();
      for (const record of args.records ?? []) { const id = await store.putRecord(record); if (record.kind === "manifest") arrived.add(id); }
      const before = new Set<KeyVersionId>();
      for (const bag of this.#bags?.values() ?? []) for (const line of bag.lines.values()) for (const version of this.#usable(line)) before.add(version);
      const bags = await this.#reload();
      // A manifest enters the index once this vessel verified it under a version it counted: each manifest that
      // just arrived, and each resting manifest of a version this reading counted for the first time.
      const resting = await store.records("manifest");
      for (const bag of bags.values()) for (const line of bag.lines.values()) {
        for (const carried of resting) {
          const version = carried.body.keyVersion;
          const key = carried.body.bag === line.locator && line.lineage.has(version) ? line.keys.get(version) : undefined;
          if (key === undefined) continue;
          const id = recordIdOf("manifest", carried.body);
          if (!arrived.has(id) && before.has(version)) continue;
          const manifest = await this.#manifest(bag, line, key, id);
          if (manifest !== null) await store.putIndexRows(indexRowsOf(manifest));
        }
      }
      return { bags: [...bags.values()].map((bag) => this.#reading(bag, null)) };
    });
  }

  /**
   * Serve the readers some counted version's mint could not reach, where this vessel now holds their card and
   * they still hold a seat and standing. Each gets that same key in a lockbox of its own. A reader served
   * once stays noted, so a repeat wraps nothing twice.
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
            if (this.#locked) return refuse("holder-locked");
            const wrapped = await wrapLockbox({ payload: { bagId: bag.bagId, locator: line.locator, keyVersion: version, key: line.keys.get(version)! }, readers: [reader], shore, ...(random ? { random } : {}) });
            if (!("lockbox" in wrapped) || wrapped.unreached.length > 0) { owed += 1; continue; }
            if (this.#locked) return refuse("holder-locked");
            await store.putLockbox(wrapped.lockbox);
            await store.noteOwn(note, new Uint8Array([1]));
            parcels.push({ lockbox: wrapped.lockbox, record: line.carried.get(version)!, ops: await shore.opsFor(reader) });
          }
        }
      }
      return { parcels, owed };
    });
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

  /** What this vessel reads for one bag: each founding, its heads, what it holds, and what a door must show. */
  reading(bagId: string): Promise<BagReading | HolderRefusal> {
    return this.#inTurn<BagReading>(async () => {
      const bag = (await this.#loaded()).get(bagId) ?? { bagId, lines: new Map<BagLocator, Line>() };
      const line = await this.#writeLine(bag);
      return this.#reading(bag, isRefusal(line) ? null : line.locator);
    });
  }

  /** Choose the founding and the head this vessel writes under, where rival foundings or several heads left the
   *  choice to a person. The head must stand counted here, with its key in hand. */
  chooseHead(args: { readonly bagId: string; readonly head: KeyVersionId }): Promise<{ readonly founding: BagLocator } | HolderRefusal> {
    return this.#inTurn<{ readonly founding: BagLocator }>(async () => {
      const bag = (await this.#loaded()).get(args.bagId);
      const line = [...(bag?.lines.values() ?? [])].find((one) => one.lineage.heads().includes(args.head) && this.#usable(one).has(args.head));
      if (!line) return refuse("no-head-held");
      // One founding carries this vessel's writes: the choice withdraws its note from every rival.
      for (const other of bag!.lines.values()) if (other !== line) await this.#ports.store.noteOwn(`write-head.${other.locator}`, new Uint8Array(0));
      await this.#noteHead(line, args.head);
      return { founding: line.locator };
    });
  }
}

/** The seat a roll names, as the one reader its successor leaves out. */
function seatOf(roll: SeatRoll): readonly ReaderId[] { return roll.seat ? [roll.seat.member] : []; }
