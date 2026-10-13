/**
 * content-key-fixture — vessels, a key group and a key shore for the content-key holder's suites.
 *
 * THE SHORE HERE MODELS WHAT THE SUBSTRATE PROBES MEASURED, and nothing more (`@lararium/keyhive`
 * `tests/lockbox-wrap.test.ts` runs the same laws over real Keyhive): a wrap mints a document that seats the
 * wrapper and the named readers it holds a card for; a seat never changes; a party outside the document opens
 * nothing; a reader opens only after it ingested the wrap's public operations. Synthetic names and keys.
 */
import { sha256 } from "@noble/hashes/sha2.js";
import { hex, utf8Bytes } from "../src/crypto.js";
import { ContentKeyHolder, type BagEvidence } from "../src/content-key-holder.js";
import { sessionSignatureImage } from "../src/face-proof-subjects.js";
import type { LockboxWrapShore, ReaderId } from "../src/lockbox-wrap.js";
import type { SealedAddress } from "../src/sealed-chunk.js";
import type { RecordSigner, WriterStanding } from "../src/sealed-records.js";
import { SealedStore, memorySealedStoreRest, type RestKind, type SealedStoreRest } from "../src/sealed-store-rest.js";
import { chain, signHex, type Chain } from "./face-proof-fixture.js";

export const NEXUS = "nexus-test-one";

/** The wrap documents every vessel's shore shares: the model of the key shore's replicated state. */
export interface World {
  readonly docs: Map<string, { readonly seats: ReadonlySet<string>; readonly payload: Uint8Array }>;
  /** The seats of the bag's key group, as every replica reads them. */
  readonly group: Set<string>;
  /** Parties some vessel's edge reading sets aside, per reading vessel. */
  readonly aside: Map<string, Set<string>>;
  /** Raises each vessel's ledger counts. */
  readonly raises: Map<string, Set<string>>;
  /** Admission acts each vessel verified. */
  readonly admissions: Map<string, Set<string>>;
  draws: number;
}
export function world(): World {
  return { docs: new Map(), group: new Set(), aside: new Map(), raises: new Map(), admissions: new Map(), draws: 0 };
}

/** A rest that counts its calls and lets a vector reach its values. */
export function spyRest(): SealedStoreRest & { readonly values: Map<string, Uint8Array>; readonly calls: string[]; failOn: ((kind: RestKind, name: string) => boolean) | null } {
  const inner = memorySealedStoreRest();
  const values = new Map<string, Uint8Array>();
  const calls: string[] = [];
  const spy = {
    values, calls, failOn: null as ((kind: RestKind, name: string) => boolean) | null,
    async put(kind: RestKind, name: string, bytes: Uint8Array): Promise<void> {
      calls.push(`put ${kind}`);
      if (spy.failOn?.(kind, name)) throw new Error("the rest refused the write");
      await inner.put(kind, name, bytes);
      values.set(`${kind}/${name}`, (await inner.get(kind, name))!);
    },
    async get(kind: RestKind, name: string): Promise<Uint8Array | null> { calls.push(`get ${kind}`); return inner.get(kind, name); },
    async list(kind: RestKind, prefix?: string): Promise<readonly string[]> { calls.push(`list ${kind}`); return inner.list(kind, prefix); },
  };
  return spy;
}

export interface Vessel {
  readonly id: ReaderId;
  readonly chain: Chain;
  readonly signer: RecordSigner;
  readonly rest: ReturnType<typeof spyRest>;
  readonly store: SealedStore;
  /** The sealed values this vessel holds, by address. */
  readonly values: Map<SealedAddress, Uint8Array>;
  /** The contact cards this vessel holds. */
  readonly cards: Set<string>;
  /** The wrap documents whose public operations this vessel ingested. */
  readonly ingested: Set<string>;
  readonly shore: LockboxWrapShore;
  shadowed: boolean;
  /** Does this vessel's document store cut a fresh base? True: it cuts one. False: it refuses. Null: none stands. */
  cutsBase: boolean | null;
  /** The versions a fresh base got cut under, in order, each with how many lockboxes rested at that moment. */
  readonly bases: { keyVersion: string; lockboxes: number }[];
  holder: ContentKeyHolder;
  /** Stand a fresh holder over the same rest: a restart. */
  restart(): ContentKeyHolder;
}

const opOf = (docId: string): Uint8Array => utf8Bytes(`op:${docId}`);

export async function vessel(w: World, name: string, over: { standing?: WriterStanding } = {}): Promise<Vessel> {
  const id = hex(sha256(utf8Bytes(`vessel ${name}`)));
  const c = await chain(name, NEXUS);
  const signer: RecordSigner = {
    certificate: c.sessionCertificate,
    sign: async (purpose, payload) => ({ signature: await signHex(sessionSignatureImage(purpose, c.scope, c.sessionCertificate.sessionKey, payload), c.session) }),
  };
  const rest = spyRest();
  const store = new SealedStore(rest);
  const values = new Map<SealedAddress, Uint8Array>();
  const cards = new Set<string>([id]);
  const ingested = new Set<string>();
  const shore: LockboxWrapShore = {
    async wrap({ readers, ref, payload }) {
      const docId = hex(sha256(new Uint8Array([...ref, ...utf8Bytes(id)])));
      const served = readers.filter((reader) => reader !== id && cards.has(reader));
      const unreached = readers.filter((reader) => reader !== id && !cards.has(reader));
      w.docs.set(docId, { seats: new Set([id, ...served]), payload: Uint8Array.from(payload) });
      ingested.add(docId);
      return { box: utf8Bytes(docId), served, unreached };
    },
    async unwrap(box) {
      const docId = new TextDecoder().decode(box);
      const doc = w.docs.get(docId);
      return doc && doc.seats.has(id) && ingested.has(docId) ? Uint8Array.from(doc.payload) : null;
    },
    async opsFor(reader) { return [...w.docs].filter(([, doc]) => doc.seats.has(reader)).map(([docId]) => opOf(docId)); },
    async ingest(ops) { for (const op of ops) ingested.add(new TextDecoder().decode(op).replace(/^op:/, "")); },
    async self() { return [id]; },
  };
  const v: Vessel = {
    id, chain: c, signer, rest, store, values, cards, ingested, shore, shadowed: false, cutsBase: true, bases: [],
    holder: undefined as unknown as ContentKeyHolder,
    restart() { v.holder = stand(); return v.holder; },
  };
  const evidenceOf = async (): Promise<BagEvidence> => ({
    raiseCounts: (act) => w.raises.get(id)?.has(act) === true,
    admissionVerifies: (act) => w.admissions.get(id)?.has(act) === true,
  });
  const stand = (): ContentKeyHolder => new ContentKeyHolder({
    store, shore,
    readersOf: async () => [...w.group].filter((reader) => w.aside.get(id)?.has(reader) !== true),
    standing: over.standing ?? { holdsWrite: () => true },
    evidenceOf,
    ownEdgeShadowed: async () => v.shadowed,
    ...(v.cutsBase === null ? {} : { freshBase: async ({ keyVersion }: { keyVersion: string }) => {
      v.bases.push({ keyVersion, lockboxes: [...rest.values.keys()].filter((k) => k.startsWith("lockbox/")).length });
      return v.cutsBase === true;
    } }),
    values: {
      read: async (address) => { const bytes = values.get(address); return bytes ? Uint8Array.from(bytes) : null; },
      write: async (address, sealed) => { values.set(address, Uint8Array.from(sealed)); },
    },
  });
  v.holder = stand();
  w.group.add(id);
  return v;
}

/** Every vessel learns every other's contact card. */
export function introduce(...vessels: Vessel[]): void {
  for (const a of vessels) for (const b of vessels) a.cards.add(b.id);
}
/** One vessel counts a raise in its own ledger. */
export function counts(w: World, v: Vessel, ...acts: string[]): void {
  const set = w.raises.get(v.id) ?? new Set<string>();
  for (const act of acts) set.add(act);
  w.raises.set(v.id, set);
}
export function verifies(w: World, v: Vessel, ...acts: string[]): void {
  const set = w.admissions.get(v.id) ?? new Set<string>();
  for (const act of acts) set.add(act);
  w.admissions.set(v.id, set);
}
export function setsAside(w: World, reading: Vessel, party: Vessel): void {
  const set = w.aside.get(reading.id) ?? new Set<string>();
  set.add(party.id);
  w.aside.set(reading.id, set);
}

/** Carry everything `from` holds for one bag to `to`: parcels over the member lane; manifests and sealed
 *  values as any carrier would carry them. */
export async function carry(from: Vessel, to: Vessel, bagId: string): Promise<void> {
  const parcels = await from.holder.parcelsFor({ bagId, reader: to.id });
  if (!Array.isArray(parcels)) throw new Error(`setup: parcelsFor refused ${(parcels as { refusal: string }).refusal}`);
  const records = [...await from.store.records("manifest"), ...await from.store.records("hand-over")];
  for (const [address, bytes] of from.values) to.values.set(address, Uint8Array.from(bytes));
  const took = await to.holder.receive({ parcels, records });
  if ("refusal" in took) throw new Error(`setup: receive refused ${took.refusal} ${took.cause ?? ""}`);
}

export const text = (bytes: Uint8Array): string => new TextDecoder().decode(bytes);
export const said = (result: object): string => ("refusal" in result ? `${(result as { refusal: string }).refusal}${(result as { cause?: string }).cause ? `:${(result as { cause?: string }).cause}` : ""}` : "OK");
