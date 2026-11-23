/**
 * realm-rest — A WORKBENCH'S REST SEALS FOR ITS REALM'S ROSTER (cabal-realm#/the-workbench; research meme
 * `lar:///ha.ka.ba/kahua/memory/research/workbench-rest-gate`).
 *
 * One vessel, two faces over REAL Keyhive: face A owns the private cabal of one that stands the wiki's workbench, and face B
 * holds a writer's seat there by a share (`landWorkbench`). Each face stands its own content-key seat over its own hive, and
 * both seats rest into the vessel's ONE sealed store, as the island composes them (one holder per lit face).
 *
 * RT1 (A0 → A3) the two-face round trip: A saves, B saves, both seats stand again over the same rest (a reload), and A opens
 *     B's change: no `reference-unknown`, no `founding-forked`, and the rest holds ONE founding of the working bag.
 *
 * A1 readers follow the roster, and founding stays owner-only:
 *   R1 the owner's mint wraps for every hive the realm seats (the engineer's among them), never the face's PersonaGroup.
 *   R2 the seated face's holder, holding no lockbox yet, refuses `founding-owned-elsewhere` (naming its cure) and rests no
 *      rival founding.
 *   R3 once the owner wraps, the seated face's holder opens the owner's value from the shared rest.
 *   R4 a bag no realm binds keeps the face's own readers and founds under any seat, byte for byte as before.
 *
 * Canon: lar:///ha.ka.ba/lares/api/pono/cabal-realm#/the-workbench · lar:///ha.ka.ba/lararium/mesh/sealed-store#/the-store
 */
import { describe, expect, test } from "vitest";
import {
  SealedStore, memorySealedStoreRest, sha256HexBytesSync, utf8Bytes, wikiSlotUri, workbenchKeyDocs,
  type DocumentValue, type LarDoc, type RecordSigner, type SealedAddress, type SealedStoreRest, type SessionOwnChain, type WriterStanding,
} from "@lararium/mesh";
import { KeyhiveProvider, InMemoryEventStore, ownChainStanding, realmRestPort, seatContentKeys, type ContentKeySeat } from "../src/index.js";
import { adoptWorkbench, faceWorkbenchRealm, landWorkbench, type LedgerDoc } from "../src/workbench-realm.js";
import { signerOf } from "./content-key-fleet.js";
import { chain } from "../../lararium-mesh/tests/face-proof-fixture.js";

const SLUG = "notes";
const WORKING = wikiSlotUri(SLUG, "working");
const NEXUS = "nexus-test-one";
const text = (b: Uint8Array) => new TextDecoder().decode(b);
const bare = (id: string) => id.trim().toLowerCase().replace(/^0x/, "");
const said = (r: object): string => ("refusal" in r ? `${(r as { refusal: string }).refusal}${(r as { cause?: string }).cause ? `:${(r as { cause?: string }).cause}` : ""}` : "OK");

/** One vessel's ledger, as every face of it reads the one document. */
function memDoc(): LedgerDoc & { readonly d: LarDoc } {
  const d = { tiddlers: {} } as LarDoc;
  return { d, doc: () => d, change: (fn) => fn(d) };
}

/** One face of the vessel: its own hive, its own chain and session signer, and the PersonaGroup name the ledger seats it by. */
export interface Face {
  readonly name: string;
  readonly hive: KeyhiveProvider;
  readonly id: string;
  readonly signer: RecordSigner;
  readonly own: SessionOwnChain;
  seat: ContentKeySeat;
}

/** The vessel both faces stand on: one sealed store, one value rest, one ledger. */
export interface Vessel {
  readonly rest: SealedStoreRest;
  readonly values: Map<SealedAddress, Uint8Array>;
  readonly ledger: LedgerDoc & { readonly d: LarDoc };
}

export async function face(name: string, fill: number): Promise<Omit<Face, "seat">> {
  const hive = new KeyhiveProvider();
  await hive.init({ seed: new Uint8Array(32).fill(fill), eventStore: new InMemoryEventStore() });
  const c = await chain(`${name}-${fill}`, NEXUS);
  return { name, hive, id: await hive.vesselIdentifierHex(), signer: signerOf(c), own: { scope: { faceKey: c.scope.faceKey, nexus: c.scope.nexus }, vesselFaceKey: c.sessionCertificate.vesselFaceKey } };
}

/** One change of the working document, as the document store hands a write batch to the holder. */
export function change(body: string): DocumentValue {
  return { role: "change", ref: sha256HexBytesSync(utf8Bytes(`change ${body}`)), parents: [], plaintext: utf8Bytes(body) };
}

/**
 * TODAY'S COMPOSITION (the island before the rest gate retires): each face's seat wraps for its own face alone, and its
 * standing reads its own chain over the bags it registers. A face that MOUNTS the wiki registers the working slot
 * (`wornFaceWikiBags`), so a seated face that mounts it reads the slot as its own.
 */
function seatToday(v: Vessel, f: Omit<Face, "seat">, registers: readonly string[]): ContentKeySeat {
  const standing: WriterStanding = ownChainStanding(() => f.own, () => registers);
  return seatContentKeys({
    providers: [f.hive], rest: v.rest,
    values: { read: async (a) => v.values.get(a) ?? null, write: async (a, b) => { v.values.set(a, Uint8Array.from(b)); } },
    restArchive: async () => {}, group: null, bags: () => [],
    session: { signer: () => null, standing },
    subscribe: () => () => {},
  });
}

/**
 * THE REALM COMPOSITION: each face's seat reads a realm workbench bag through the realm port (readers follow the roster,
 * founding stays owner-only), and hands a wrap's operations to the sibling hives on this vessel. `standing` stands in for the
 * writer standing until slice A2 composes the realm's.
 */
export function seatRealm(v: Vessel, f: Omit<Face, "seat">, standing: WriterStanding, siblings: readonly Omit<Face, "seat">[] = [], served?: string[][]): ContentKeySeat {
  return seatContentKeys({
    providers: [f.hive], rest: v.rest,
    values: { read: async (a) => v.values.get(a) ?? null, write: async (a, b) => { v.values.set(a, Uint8Array.from(b)); } },
    restArchive: async () => {}, group: null, bags: () => [],
    session: { signer: () => null, standing },
    subscribe: () => () => {},
    realm: realmRestPort({ provider: () => f.hive, ledger: async () => v.ledger.d, face: `group-${f.name}` }),
    handOn: async (readers, wrapper) => {
      served?.push([...readers]);
      for (const s of siblings) if (readers.map(bare).includes(bare(s.id))) await s.hive.ingestPeerEvents(await wrapper.eventsForPeer(`0x${bare(s.id)}`));
    },
  });
}
const EVERY_WRITER: WriterStanding = { holdsWrite: () => true };

/** Stand a vessel where face A owns the workbench and face B holds a writer's seat by a share. */
async function sharedWorkbench(fills: readonly [number, number]): Promise<{ v: Vessel; a: Omit<Face, "seat">; b: Omit<Face, "seat">; realmId: string }> {
  const v: Vessel = { rest: memorySealedStoreRest(), values: new Map(), ledger: memDoc() };
  const a = await face("steward", fills[0]), b = await face("engineer", fills[1]);
  const realmId = (await faceWorkbenchRealm(a.hive, v.ledger, SLUG, "group-steward", true))!;
  // THE SHARE DOOR: each hive holds the other's card (a lit sibling's card reaches the worn hive at light), the owner seats
  // the engineer, and the engineer's hive ingests the seat and rides the realm's key Document.
  const bOnA = (await a.hive.receiveContactCard(await b.hive.contactCard())).id;
  await b.hive.receiveContactCard(await a.hive.contactCard());
  await landWorkbench({ slug: SLUG }, [{ face: "group-engineer", agentHex: bOnA, access: "write" }], { provider: a.hive, ledger: v.ledger, ownerFace: "group-steward" });
  await b.hive.ingestPeerEvents(await a.hive.eventsForPeer(bOnA));
  adoptWorkbench(b.hive, SLUG, workbenchKeyDocs(v.ledger.d, realmId, SLUG)[0]!);
  return { v, a, b, realmId };
}

describe("RT1 — the two-face round trip over one vessel's rest", () => {
  test("RED A0: A saves, B (seated by share) saves, both stand again over the same rest, and A opens B's change from ONE founding", async () => {
    const { v, a, b } = await sharedWorkbench([0xa1, 0xa2]);
    let seatA = seatToday(v, a, [WORKING]);
    let seatB = seatToday(v, b, [WORKING]);
    const first = change("the steward's first line"), second = change("the engineer's reply");

    expect(said(await seatA.sealValues({ bagId: WORKING, values: [first], signer: a.signer })), "the owner seals its change").toBe("OK");
    expect(said(await seatB.sealValues({ bagId: WORKING, values: [second], signer: b.signer })), "the seated writer seals its change").toBe("OK");

    // THE RELOAD: both seats stand again over the vessel's one rest.
    seatA.lock(); seatB.lock();
    seatA = seatToday(v, a, [WORKING]); seatB = seatToday(v, b, [WORKING]);

    const opened = await seatA.holder.openValue({ bagId: WORKING, role: "change", ref: second.ref });
    expect(said(opened), "A opens the engineer's change: no reference-unknown").toBe("OK");
    expect(text((opened as { plaintext: Uint8Array }).plaintext)).toBe("the engineer's reply");
    const own = await seatB.holder.openValue({ bagId: WORKING, role: "change", ref: first.ref });
    expect(said(own), "B opens the steward's change").toBe("OK");

    const foundings = new Set((await new SealedStore(v.rest).records("key-version")).map((r) => r.body.bag));
    expect(foundings.size, "ONE founding of the working bag rests: no rival").toBe(1);
  });
});

describe("A1 — readers follow the roster; founding stays owner-only", () => {
  test("R1/R3: the owner's mint wraps for the engineer's hive, and the engineer opens the owner's value", async () => {
    const { v, a, b } = await sharedWorkbench([0xb1, 0xb2]);
    const served: string[][] = [];
    const seatA = seatRealm(v, a, EVERY_WRITER, [b], served);
    const seatB = seatRealm(v, b, EVERY_WRITER, [a]);
    const first = change("the steward's first line");
    expect(said(await seatA.sealValues({ bagId: WORKING, values: [first], signer: a.signer }))).toBe("OK");
    expect(served.flat().map(bare), "the founding's lockbox seats the engineer's hive").toContain(bare(b.id));
    const opened = await seatB.holder.openValue({ bagId: WORKING, role: "change", ref: first.ref });
    expect(said(opened), "the engineer opens the owner's change").toBe("OK");
    expect(text((opened as { plaintext: Uint8Array }).plaintext)).toBe("the steward's first line");
  });

  test("R2: the seated face's holder, holding no lockbox, refuses `founding-owned-elsewhere` and rests no rival founding", async () => {
    const { v, a, b } = await sharedWorkbench([0xb3, 0xb4]);
    const seatB = seatRealm(v, b, EVERY_WRITER, [a]);
    const refused = await seatB.sealValues({ bagId: WORKING, values: [change("too early")], signer: b.signer });
    expect(said(refused)).toMatch(/^founding-owned-elsewhere:.*`lares vault unlock --face/);
    expect(await new SealedStore(v.rest).records("key-version"), "no founding rests").toEqual([]);
    expect(await new SealedStore(v.rest).lockboxes(), "no lockbox rests").toEqual([]);
  });

  test("R4: a bag no realm binds keeps the face's own readers and founds under any seat", async () => {
    const { v, a, b } = await sharedWorkbench([0xb5, 0xb6]);
    const served: string[][] = [];
    const seatB = seatRealm(v, b, EVERY_WRITER, [a], served);
    const personal = wikiSlotUri(SLUG, "personal");
    expect(said(await seatB.sealValues({ bagId: personal, values: [change("my own layer")], signer: b.signer })), "the engineer's personal layer founds under its own seat").toBe("OK");
    expect(served.flat(), "its lockbox seats no other hive: a face with no key group wraps for itself").toEqual([]);
  });
});
