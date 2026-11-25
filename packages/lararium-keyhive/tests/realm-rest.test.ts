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
 * A2 writer standing follows the realm's seat, keyed to the key-version lineage:
 *   S1 a certificate stands over a realm bag under any chain the realm seats as a writer; a reader's seat or no seat signs
 *      nothing; a bag no realm keeps reads the face's own chain alone.
 *   S3 the owner's holder counts the engineer's manifest, and a reading taken before the engineer's seat gives way after it.
 *   S4 (u2) a revoke never orphans the revoked writer's earlier writes: after the removal's roll lands, the owner still opens
 *      the engineer's pre-removal change, and refuses a manifest the engineer's session signs under the new version.
 *
 * A4 shareable history by default, chained boxes, and the late seat:
 *   H1 a face seated after three writes across a roll opens all three, from ONE chained box the owner's holder hands it.
 *   H2 a bag no realm keeps, founded by the same holder, stays closed: a late reader is handed nothing.
 *   H3 the declaration reads on the founding (`reading().foundings[].history`).
 *   U3 a landing that would seat a face while no holder of the key stands lit refuses `seat-needs-keyholder`, names the cure,
 *      and seats nobody.
 *
 * A5 a roll derives from state, and a revoke rolls now:
 *   Y1 a revoke the roster's projection reads notes ONE removal, and `rollNow` mints a successor at once: the owner seals and
 *      opens under it, the revoked face opens nothing new and keeps what it held, and its earlier writes still open (u2).
 *   Y2 the order: while the revoke stands unprojected nothing rolls; once projected, the very next seal rolls first and never
 *      seals under the head the revoked face holds.
 *   Y3 a revoke and a seat in one landing converge: the successor serves the newcomer, never the revoked face.
 *   Y4 idempotence: a second projection notes no second removal, and a second `rollNow` mints nothing.
 *   Y5 own shadow: the revoked face's holder founds, rolls and mints nothing.
 *   Y6 a projection on a seated face's replica, one that never ingested a later seat, notes no removal: only the owner's
 *      replica (the hand that revokes) reads a seat gone as revoked.
 *
 * A9 a workbench founded closed before its realm bound it admits from now (research meme
 *    `lar:///ha.ka.ba/kahua/memory/research/lares-workbench-never-founds`):
 *   C1 the owner founds the working bag `closed` while no realm binds it; the realm binds and seats a second face; the share
 *      lands again under the owner's hand: the owner's holder admits from now (a `shareable` span on a fresh base of the current
 *      document, wrapped for the roster), the seated face opens and saves, the owner opens its save, and the closed span stays
 *      closed to it. The same landing entered again mints nothing more.
 *   C2 a seated member whose hand-over refuses reads on the landing by name with its cause, never as landed.
 *   C3 a write-seated member's own admission under the realm's prefix counts on no seat: only the owner's signer, a shareable
 *      history and the act its closed parents derive open a span.
 *   C4 a stop between the admission's record and its fresh base strands nothing: the next landing cuts the base.
 *   C5 each hand-over refusal names its own cure.
 *   C6 a write-seated member's own roll under the realm's state-roll prefix counts on no seat but its own: the owner alone rolls.
 *   C7 the `sealed-admit` door opens no realm-derived act; a member's cure names its handle; `no-head-held` names its own cure.
 *   C8 the realm's owner reads as the lit face whose PersonaGroup derives the realm, never by the ledger's one seat row per face.
 *
 * A6 the rest seals for the roster:
 *   G3 a face seated `admin` in another face's realm mounts it and writes `working`; a face seated `read` mounts it, reads it,
 *      and writes `personal`.
 *
 * Canon: lar:///ha.ka.ba/lares/api/pono/cabal-realm#/the-workbench · lar:///ha.ka.ba/lararium/mesh/sealed-store#/the-store
 */
import { describe, expect, test } from "vitest";
import * as A from "@automerge/automerge";
import { REALM_ADMISSION_ACT, REALM_STATE_ROLL_ACT, type DocumentValue } from "@lararium/mesh/content-key-holder";
import { SealedStore, memorySealedStoreRest, type SealedStoreRest } from "@lararium/mesh/sealed-store-rest";
import { noteWorkbenchSeat, workbenchRemovals, workbenchKeyDocs } from "@lararium/mesh/workbench";
import { contentKeyRollSink } from "@lararium/mesh/content-key-lineage";
import { freshBasePort } from "@lararium/mesh/sealed-doc-store";
import { sha256HexBytesSync, utf8Bytes } from "@lararium/mesh/crypto";
import { wikiSlotUri } from "@lararium/mesh/wiki-recipe";
import { type LarDoc } from "@lararium/mesh/base-doc";
import { type RecordSigner, type WriterStanding } from "@lararium/mesh/sealed-records";
import { type SealedAddress } from "@lararium/mesh/sealed-chunk-door";
import { type SessionOwnChain } from "@lararium/mesh/island-protocol";
import { KeyhiveProvider, InMemoryEventStore, RealmWriterBook, faceStanding, realmRestPort, seatContentKeys, type ContentKeySeat, type ContentKeySeatInput, type RealmFace, type RealmWriters } from "../src/index.js";
import { adoptWorkbench, faceWorkbenchRealm, handOverCure, landWorkbench, sealedAdmitRefusal, landsUnderAHand, projectWorkbenchRoster, removeWorkbenchFace, workbenchFaceHolds, workbenchWriterSeat, type LedgerDoc } from "../src/workbench-realm.js";
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
  readonly events: InMemoryEventStore;
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
  const events = new InMemoryEventStore();
  const hive = new KeyhiveProvider();
  await hive.init({ seed: new Uint8Array(32).fill(fill), eventStore: events });
  const c = await chain(`${name}-${fill}`, NEXUS);
  return { name, hive, events, id: await hive.vesselIdentifierHex(), signer: signerOf(c), own: { scope: { faceKey: c.scope.faceKey, nexus: c.scope.nexus }, vesselFaceKey: c.sessionCertificate.vesselFaceKey } };
}

/** One change of the working document, as the document store hands a write batch to the holder. */
export function change(body: string): DocumentValue {
  return { role: "change", ref: sha256HexBytesSync(utf8Bytes(`change ${body}`)), parents: [], plaintext: utf8Bytes(body) };
}

/**
 * THE REALM COMPOSITION: each face's seat reads a realm workbench bag through the realm port (readers follow the roster,
 * founding stays owner-only), and hands a wrap's operations to the sibling hives on this vessel. `standing` stands in for the
 * writer standing until slice A2 composes the realm's.
 */
export function seatRealm(v: Vessel, f: Omit<Face, "seat">, standing: WriterStanding, siblings: readonly Omit<Face, "seat">[] = [], served?: string[][], counted: () => ReadonlySet<string> = () => new Set(), extra: Partial<ContentKeySeatInput> = {}): ContentKeySeat {
  return seatContentKeys({
    countedRaises: counted,
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
    ...extra,
  });
}
const EVERY_WRITER: WriterStanding = { holdsWrite: () => true };

/** Stand a vessel where face A owns the workbench and face B holds a writer's seat by a share. */
async function sharedWorkbench(fills: readonly [number, number]): Promise<{ v: Vessel; a: Omit<Face, "seat">; b: Omit<Face, "seat">; realmId: string; bOnA: string }> {
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
  return { v, a, b, realmId, bOnA };
}

describe("RT1 — the two-face round trip over one vessel's rest", () => {
  test("A0 -> A3: A saves, B (seated by share) saves, both stand again over the same rest, and A opens B's change from ONE founding", async () => {
    const { v, a, b } = await sharedWorkbench([0xa1, 0xa2]);
    // THE ISLAND'S COMPOSITION: the realm's writer book, read off the roster at the mount; each face's seat reads the realm
    // port and the realm-aware standing (each face mounts the wiki, so each registers the working slot).
    const book = new RealmWriterBook();
    const faces = [{ agent: a.id, group: `group-${a.name}`, chain: () => a.own }, { agent: b.id, group: `group-${b.name}`, chain: () => b.own }];
    const stand = async (): Promise<[ContentKeySeat, ContentKeySeat]> => {
      await book.read(WORKING, [a.hive, b.hive], v.ledger.d, faces);
      const standing = (f: Omit<Face, "seat">) => faceStanding({ own: () => f.own, bags: () => [WORKING], realmWriters: (bagId) => book.writers(bagId), realmMark: () => book.mark() });
      return [seatRealm(v, a, standing(a), [b]), seatRealm(v, b, standing(b), [a])];
    };
    let [seatA, seatB] = await stand();
    const first = change("the steward's first line"), second = change("the engineer's reply");

    expect(said(await seatA.sealValues({ bagId: WORKING, values: [first], signer: a.signer })), "the owner seals its change").toBe("OK");
    expect(said(await seatB.sealValues({ bagId: WORKING, values: [second], signer: b.signer })), "the seated writer seals its change").toBe("OK");

    // THE RELOAD: both seats stand again over the vessel's one rest.
    seatA.lock(); seatB.lock();
    [seatA, seatB] = await stand();

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

/** A realm writer set one test moves by hand, named by its content (`realmMark`), as the island's book of the roster does. */
function writerBook(initial: RealmWriters) {
  let writers = initial;
  return {
    set(next: RealmWriters) { writers = next; },
    standing(f: Omit<Face, "seat">, registers: readonly string[] = []): WriterStanding {
      return faceStanding({
        own: () => f.own, bags: () => registers,
        realmWriters: (bagId) => (bagId === WORKING ? writers : null),
        realmMark: () => JSON.stringify(writers),
      });
    },
  };
}

describe("A2 — writer standing follows the realm's seat, keyed to the lineage", () => {
  test("S1: any seated writer's chain stands over the realm bag; a reader, a stranger and another bag stand nowhere", async () => {
    const a = await face("steward", 0xc1), b = await face("engineer", 0xc2), r = await face("referee", 0xc3);
    const book = writerBook({ seated: [a.own, b.own], former: [] });
    const standing = book.standing(a, [WORKING]);
    expect(standing.holdsWrite({ certificate: b.signer.certificate, bagId: WORKING }), "a writer's seat stands").toBe(true);
    expect(standing.holdsWrite({ certificate: r.signer.certificate, bagId: WORKING }), "a reader's seat (never in the writer set) signs nothing").toBe(false);
    expect(standing.holdsWrite({ certificate: b.signer.certificate, bagId: wikiSlotUri("garden", "working") }), "another bag reads the face's own chain alone").toBe(false);
    expect(standing.holdsWrite({ certificate: a.signer.certificate, bagId: WORKING }), "the owner's own chain stands as before").toBe(true);
    book.set({ seated: [a.own], former: [] });
    expect(standing.holdsWrite({ certificate: b.signer.certificate, bagId: WORKING }), "an unseated face stands nowhere").toBe(false);
  });

  test("S3: the owner's holder counts the engineer's manifest; a reading taken before the seat gives way after it", async () => {
    const { v, a, b } = await sharedWorkbench([0xc4, 0xc5]);
    const book = writerBook({ seated: [a.own], former: [] });
    const seatA = seatRealm(v, a, book.standing(a, [WORKING]), [b]);
    const bWrites = writerBook({ seated: [a.own, b.own], former: [] });
    const seatB = seatRealm(v, b, bWrites.standing(b), [a]);
    expect(said(await seatA.sealValues({ bagId: WORKING, values: [change("one")], signer: a.signer }))).toBe("OK");
    const reply = change("the engineer's reply");
    expect(said(await seatB.sealValues({ bagId: WORKING, values: [reply], signer: b.signer }))).toBe("OK");
    expect(said(await seatA.holder.openValue({ bagId: WORKING, role: "change", ref: reply.ref })), "before A's book seats B: no writer stands behind the manifest").toBe("reference-unknown");
    book.set({ seated: [a.own, b.own], former: [] });
    expect(said(await seatA.holder.openValue({ bagId: WORKING, role: "change", ref: reply.ref })), "the seat landed: the reading gives way and counts B's manifest").toBe("OK");
  });

  test("S4 (u2): after the revoke's roll, the owner still opens the engineer's earlier change and refuses its session under the new version", async () => {
    const { v, a, b, realmId, bOnA } = await sharedWorkbench([0xc6, 0xc7]);
    const ACT = "workbench-removal-act-one";
    const book = writerBook({ seated: [a.own, b.own], former: [] });
    let seatA = seatRealm(v, a, book.standing(a, [WORKING]), [b], undefined, () => new Set([ACT]));
    let seatB = seatRealm(v, b, book.standing(b), [a], undefined, () => new Set([ACT]));
    const first = change("before the revoke: the steward"), reply = change("before the revoke: the engineer");
    expect(said(await seatA.sealValues({ bagId: WORKING, values: [first], signer: a.signer }))).toBe("OK");
    const before = await seatB.sealValues({ bagId: WORKING, values: [reply], signer: b.signer });
    expect(said(before)).toBe("OK");

    // THE REVOKE: the owner's hive revokes the engineer's seat; the roster's projection reads it; the roll lands.
    await removeWorkbenchFace(a.hive, workbenchKeyDocs(v.ledger.d, realmId, SLUG)[0]!, bOnA);
    await projectWorkbenchRoster(a.hive, v.ledger, realmId, SLUG, new Map(), { notesRemovals: true });
    book.set({ seated: [a.own], former: [{ chain: b.own, removedBy: [ACT] }] });
    const roll = contentKeyRollSink(seatA.holder.rollerPorts({ bagsOf: () => [WORKING], signer: () => a.signer }));
    await roll({ kind: "seat-roll", scope: "realm", edgeId: "realm-roster", raiseCids: [ACT], how: "revoked" });

    seatA.lock(); seatB.lock();
    seatA = seatRealm(v, a, book.standing(a, [WORKING]), [b], undefined, () => new Set([ACT]));
    seatB = seatRealm(v, b, book.standing(b), [a], undefined, () => new Set([ACT]));
    const kept = await seatA.holder.openValue({ bagId: WORKING, role: "change", ref: reply.ref });
    expect(said(kept), "the revoked writer's earlier change still opens for the owner").toBe("OK");
    expect(text((kept as { plaintext: Uint8Array }).plaintext)).toBe("before the revoke: the engineer");

    const after = change("after the revoke");
    const sealed = await seatA.sealValues({ bagId: WORKING, values: [after], signer: a.signer });
    expect(said(sealed), "the owner seals under the successor").toBe("OK");
    expect((sealed as { keyVersion: string }).keyVersion, "a new version").not.toBe((before as { keyVersion: string }).keyVersion);
    expect(said(await seatA.sealValues({ bagId: WORKING, values: [change("forged")], signer: b.signer })), "the revoked writer's session stands under no version after its removal").toMatch(/^record-refused:writer-not-capable/);

    expect(said(await seatB.holder.openValue({ bagId: WORKING, role: "change", ref: after.ref })), "the revoked face opens nothing sealed after its removal").not.toBe("OK");
    expect(said(await seatB.holder.openValue({ bagId: WORKING, role: "change", ref: first.ref })), "and keeps what it held").toBe("OK");
  });
});

describe("A4 — shareable history by default; chained boxes; the late seat", () => {
  test("H1/H3: a face seated after three writes across a roll opens all three from ONE chained box", async () => {
    const { v, a, b, realmId, bOnA } = await sharedWorkbench([0xd1, 0xd2]);
    const c = await face("referee", 0xd3);
    const cOnA = (await a.hive.receiveContactCard(await c.hive.contactCard())).id;
    await c.hive.receiveContactCard(await a.hive.contactCard());
    const ACT = "workbench-removal-act-h1";
    const book = writerBook({ seated: [a.own, b.own], former: [] });
    const seatA = seatRealm(v, a, book.standing(a, [WORKING]), [b, c], undefined, () => new Set([ACT]));
    const seatB = seatRealm(v, b, book.standing(b), [a], undefined, () => new Set([ACT]));
    const w1 = change("one: the steward"), w2 = change("two: the engineer"), w3 = change("three: after the roll");
    expect(said(await seatA.sealValues({ bagId: WORKING, values: [w1], signer: a.signer }))).toBe("OK");
    expect(said(await seatB.sealValues({ bagId: WORKING, values: [w2], signer: b.signer }))).toBe("OK");
    await removeWorkbenchFace(a.hive, workbenchKeyDocs(v.ledger.d, realmId, SLUG)[0]!, bOnA);
    await projectWorkbenchRoster(a.hive, v.ledger, realmId, SLUG, new Map(), { notesRemovals: true });
    book.set({ seated: [a.own], former: [{ chain: b.own, removedBy: [ACT] }] });
    await contentKeyRollSink(seatA.holder.rollerPorts({ bagsOf: () => [WORKING], signer: () => a.signer }))({ kind: "seat-roll", scope: "realm", edgeId: "realm-roster", raiseCids: [ACT], how: "revoked" });
    expect(said(await seatA.sealValues({ bagId: WORKING, values: [w3], signer: a.signer }))).toBe("OK");
    const reading = await seatA.holder.reading(WORKING);
    expect("foundings" in reading && reading.foundings.map((f) => f.history), "H3: the founding declared its history shareable").toEqual(["shareable"]);

    // THE LATE SEAT: the landing seats the referee, and the owner's holder hands it the head's one chained box.
    const handed: number[] = [];
    await landWorkbench({ slug: SLUG }, [{ face: "group-referee", agentHex: cOnA, access: "write" }], {
      provider: a.hive, ledger: v.ledger, ownerFace: "group-steward",
      keyholder: async () => ({
        handOver: async (agentHex: string) => {
          const out = await seatA.holder.handOver({ bagId: WORKING, reader: agentHex, signer: a.signer, chained: true });
          if ("refusal" in out) throw new Error(said(out));
          handed.push(out.parcels.length);
        },
      }),
    });
    expect(handed, "ONE box for the span's two versions").toEqual([1]);
    await c.hive.ingestPeerEvents(await a.hive.eventsForPeer(cOnA));
    book.set({ seated: [a.own, c.own], former: [{ chain: b.own, removedBy: [ACT] }] });
    const seatC = seatRealm(v, c, book.standing(c), [a], undefined, () => new Set([ACT]));
    for (const [w, body] of [[w1, "one: the steward"], [w2, "two: the engineer"], [w3, "three: after the roll"]] as const) {
      const opened = await seatC.holder.openValue({ bagId: WORKING, role: "change", ref: w.ref });
      expect(said(opened), `the late seat opens "${body}"`).toBe("OK");
      expect(text((opened as { plaintext: Uint8Array }).plaintext)).toBe(body);
    }
  });

  test("H2: a bag no realm keeps stays closed, and a late reader is handed nothing", async () => {
    const { v, a, b } = await sharedWorkbench([0xd4, 0xd5]);
    const seatA = seatRealm(v, a, writerBook({ seated: [a.own], former: [] }).standing(a, [wikiSlotUri(SLUG, "personal")]), [b]);
    const personal = wikiSlotUri(SLUG, "personal");
    expect(said(await seatA.sealValues({ bagId: personal, values: [change("mine alone")], signer: a.signer }))).toBe("OK");
    const reading = await seatA.holder.reading(personal);
    expect("foundings" in reading && reading.foundings.map((f) => f.history), "closed by default").toEqual(["closed"]);
    expect(said(await seatA.holder.handOver({ bagId: personal, reader: b.id, signer: a.signer, chained: true }))).toBe("history-closed");
  });

  test("U3: a landing that would seat a face while no key holder stands lit refuses by name and seats nobody", async () => {
    const { v, a } = await sharedWorkbench([0xd6, 0xd7]);
    const c = await face("referee", 0xd8);
    const cOnA = (await a.hive.receiveContactCard(await c.hive.contactCard())).id;
    const cure = "wear the realm's owner face (`lares vault unlock --face 1`, then `lares wear 1`) and land the share again (`lares wiki share notes`)";
    await expect(landWorkbench({ slug: SLUG }, [{ face: "group-referee", agentHex: cOnA, access: "write" }], {
      provider: a.hive, ledger: v.ledger, ownerFace: "group-steward", keyholder: async () => ({ cure }),
    })).rejects.toThrow(/seat-needs-keyholder: .*`lares vault unlock --face 1`/);
    expect(await workbenchFaceHolds(a.hive, SLUG, cOnA, "read"), "no seat moved").toBe(false);
  });
});

/** THE ISLAND'S COMPOSITION over any faces of the vessel: the writer book reads the roster (and the ledger's removals), and each
 *  face's seat reads the realm port and the realm-aware standing. `stand` re-reads the book and seats every face afresh. */
function islandOf(v: Vessel, all: readonly Omit<Face, "seat">[]) {
  const book = new RealmWriterBook();
  const faces = all.map((f) => ({ agent: f.id, group: `group-${f.name}`, chain: () => f.own }));
  const seats = new Map<string, ContentKeySeat>();
  return {
    book,
    async stand(): Promise<Map<string, ContentKeySeat>> {
      for (const seat of seats.values()) seat.lock();
      await book.read(WORKING, all.map((f) => f.hive), v.ledger.d, faces);
      for (const f of all) {
        const standing = faceStanding({ own: () => f.own, bags: () => [WORKING], realmWriters: (bagId) => book.writers(bagId), realmMark: () => book.mark() });
        seats.set(f.name, seatRealm(v, f, standing, all.filter((o) => o !== f)));
      }
      return seats;
    },
  };
}
const keyOf = (r: object): string => (r as { keyVersion: string }).keyVersion;

describe("A5 — a roll derives from state; a revoke rolls now", () => {
  test("Y1: a projected revoke notes one removal; rollNow mints at once; the revoked face keeps the past and opens nothing new", async () => {
    const { v, a, b, realmId, bOnA } = await sharedWorkbench([0xe1, 0xe2]);
    const island = islandOf(v, [a, b]);
    let seats = await island.stand();
    const w1 = change("y1 one"), w2 = change("y1 two by the engineer");
    const s1 = await seats.get("steward")!.sealValues({ bagId: WORKING, values: [w1], signer: a.signer });
    expect(said(await seats.get("engineer")!.sealValues({ bagId: WORKING, values: [w2], signer: b.signer }))).toBe("OK");

    await removeWorkbenchFace(a.hive, workbenchKeyDocs(v.ledger.d, realmId, SLUG)[0]!, bOnA);
    await projectWorkbenchRoster(a.hive, v.ledger, realmId, SLUG, new Map(), { notesRemovals: true });
    expect(workbenchRemovals(v.ledger.d, realmId, SLUG).map((r) => r.face), "ONE removal noted").toEqual(["group-engineer"]);
    await b.hive.ingestPeerEvents(await a.hive.eventsForPeer(bOnA));
    seats = await island.stand();
    const now = await seats.get("steward")!.rollNow(WORKING, a.signer);
    expect("rolled" in now && now.rolled !== null, `roll-now mints a successor (${said(now)})`).toBe(true);

    const w3 = change("y1 three after the revoke");
    const s3 = await seats.get("steward")!.sealValues({ bagId: WORKING, values: [w3], signer: a.signer });
    expect(said(s3)).toBe("OK");
    expect(keyOf(s3), "sealed under the successor").not.toBe(keyOf(s1));
    seats = await island.stand();
    expect(said(await seats.get("steward")!.holder.openValue({ bagId: WORKING, role: "change", ref: w2.ref })), "u2: the engineer's earlier write still opens").toBe("OK");
    expect(said(await seats.get("engineer")!.holder.openValue({ bagId: WORKING, role: "change", ref: w3.ref })), "the revoked face opens nothing new").not.toBe("OK");
    expect(said(await seats.get("engineer")!.holder.openValue({ bagId: WORKING, role: "change", ref: w1.ref })), "and keeps what it held").toBe("OK");
  });

  test("Y2: a revoke no projection ever noted still rolls: the next seal reads the boxes and rolls first", async () => {
    const { v, a, b, realmId, bOnA } = await sharedWorkbench([0xe3, 0xe4]);
    const island = islandOf(v, [a, b]);
    let seats = await island.stand();
    const s1 = await seats.get("steward")!.sealValues({ bagId: WORKING, values: [change("y2 one")], signer: a.signer });
    await removeWorkbenchFace(a.hive, workbenchKeyDocs(v.ledger.d, realmId, SLUG)[0]!, bOnA);
    const s2 = await seats.get("steward")!.sealValues({ bagId: WORKING, values: [change("y2 two")], signer: a.signer });
    expect(said(s2)).toBe("OK");
    expect(keyOf(s2), "no removal row noted, yet the head's boxes served a reader the roster no longer seats: the seal rolled first").not.toBe(keyOf(s1));
    await projectWorkbenchRoster(a.hive, v.ledger, realmId, SLUG, new Map(), { notesRemovals: true });
    seats = await island.stand();
    const s3 = await seats.get("steward")!.sealValues({ bagId: WORKING, values: [change("y2 three")], signer: a.signer });
    expect(keyOf(s3), "the noted removal owes nothing more: the same successor").toBe(keyOf(s2));
    const records = await new SealedStore(v.rest).records("key-version");
    expect(records.length, "the founding and ONE successor").toBe(2);
    void b;
  });

  test("Y2b (F1): a revoke whose removal row a non-noting projection dropped still rolls before the next seal", async () => {
    const { v, a, b, realmId, bOnA } = await sharedWorkbench([0xe3, 0xf4]);
    const island = islandOf(v, [a, b]);
    const seats = await island.stand();
    const s1 = await seats.get("steward")!.sealValues({ bagId: WORKING, values: [change("y2b one")], signer: a.signer });
    await removeWorkbenchFace(a.hive, workbenchKeyDocs(v.ledger.d, realmId, SLUG)[0]!, bOnA);
    // The mount's projection (no removals noted) drops the seat row; the later noting projection finds nothing to note.
    await projectWorkbenchRoster(a.hive, v.ledger, realmId, SLUG, new Map(), {});
    await projectWorkbenchRoster(a.hive, v.ledger, realmId, SLUG, new Map(), { notesRemovals: true });
    expect(workbenchRemovals(v.ledger.d, realmId, SLUG), "the row never landed").toEqual([]);
    const fresh = await island.stand();
    const s2 = await fresh.get("steward")!.sealValues({ bagId: WORKING, values: [change("y2b two")], signer: a.signer });
    expect(said(s2)).toBe("OK");
    expect(keyOf(s2), "never sealed under the head the revoked face holds").not.toBe(keyOf(s1));
  });

  test("Y3: a revoke and a seat in one landing converge: the successor serves the newcomer, never the revoked face", async () => {
    const { v, a, b } = await sharedWorkbench([0xe5, 0xe6]);
    const c = await face("referee", 0xe7);
    const cOnA = (await a.hive.receiveContactCard(await c.hive.contactCard())).id;
    await c.hive.receiveContactCard(await a.hive.contactCard());
    const island = islandOf(v, [a, b, c]);
    let seats = await island.stand();
    const w1 = change("y3 one");
    expect(said(await seats.get("steward")!.sealValues({ bagId: WORKING, values: [w1], signer: a.signer }))).toBe("OK");
    // ONE LANDING: the row stops naming the engineer and names the referee.
    const landed = await landWorkbench({ slug: SLUG }, [{ face: "group-referee", agentHex: cOnA, access: "write" }], {
      provider: a.hive, ledger: v.ledger, ownerFace: "group-steward",
      keyholder: async () => ({ handOver: async (agentHex: string) => { const out = await seats.get("steward")!.holder.handOver({ bagId: WORKING, reader: agentHex, signer: a.signer, chained: true }); if ("refusal" in out) throw new Error(said(out)); } }),
    });
    expect(landed.removed).toEqual(["group-engineer"]);
    // THE NEWCOMER TAKES THE OWNER'S WHOLE LOG: after a revoke on the key Document, the events Keyhive hands one peer
    // (`eventsForPeer`) leave the newcomer's own replica reading no seat (measured here; a course item for the share door).
    await a.hive.settleEvents();
    await c.hive.ingestPeerEvents((await a.events.list()).map((r) => r.bytes));
    adoptWorkbench(c.hive, SLUG, workbenchKeyDocs(v.ledger.d, landed.realmId, SLUG)[0]!);
    seats = await island.stand();
    expect(said(await seats.get("steward")!.rollNow(WORKING, a.signer))).toBe("OK");
    const w2 = change("y3 two after the landing");
    expect(said(await seats.get("steward")!.sealValues({ bagId: WORKING, values: [w2], signer: a.signer }))).toBe("OK");
    seats = await island.stand();
    expect(said(await seats.get("referee")!.holder.openValue({ bagId: WORKING, role: "change", ref: w2.ref })), "the newcomer opens the successor").toBe("OK");
    expect(said(await seats.get("referee")!.holder.openValue({ bagId: WORKING, role: "change", ref: w1.ref })), "and the past it was handed").toBe("OK");
    expect(said(await seats.get("engineer")!.holder.openValue({ bagId: WORKING, role: "change", ref: w2.ref })), "the revoked face opens nothing new").not.toBe("OK");
  });

  test("Y4/Y5: a second projection and a second roll-now move nothing; the revoked face's holder performs no key act", async () => {
    const { v, a, b, realmId, bOnA } = await sharedWorkbench([0xe8, 0xe9]);
    const island = islandOf(v, [a, b]);
    let seats = await island.stand();
    expect(said(await seats.get("steward")!.sealValues({ bagId: WORKING, values: [change("y4 one")], signer: a.signer }))).toBe("OK");
    await removeWorkbenchFace(a.hive, workbenchKeyDocs(v.ledger.d, realmId, SLUG)[0]!, bOnA);
    await projectWorkbenchRoster(a.hive, v.ledger, realmId, SLUG, new Map(), { notesRemovals: true });
    await projectWorkbenchRoster(a.hive, v.ledger, realmId, SLUG, new Map(), { notesRemovals: true });
    expect(workbenchRemovals(v.ledger.d, realmId, SLUG).length, "Y4: one removal, however often the roster projects").toBe(1);
    seats = await island.stand();
    expect(said(await seats.get("steward")!.rollNow(WORKING, a.signer))).toBe("OK");
    const again = await seats.get("steward")!.rollNow(WORKING, a.signer);
    expect("rolled" in again && again.rolled, "Y4: a second roll-now mints nothing").toBe(null);
    const versions = (await new SealedStore(v.rest).records("key-version")).length;

    // Y5: the engineer's hive hears its revoke; its holder performs no key act in the workbench.
    await b.hive.ingestPeerEvents(await a.hive.eventsForPeer(bOnA));
    seats = await island.stand();
    const refused = await seats.get("engineer")!.sealValues({ bagId: WORKING, values: [change("after my revoke")], signer: b.signer });
    expect(said(refused), "the revoked face seals nothing, and names its cure").toMatch(/^own-edge-shadowed:.*`lares wiki share/);
    const rolled = await seats.get("engineer")!.rollNow(WORKING, b.signer);
    expect("rolled" in rolled ? rolled.rolled : rolled, "and rolls nothing").toBe(null);
    expect((await new SealedStore(v.rest).records("key-version")).length, "no version minted by the revoked face").toBe(versions);
  });
});

describe("A7 — a refused hand-over leaves no seat lockbox-less for good", () => {
  test("F2: a landing whose hand-over refused hands over again when the share lands again", async () => {
    const { v, a } = await sharedWorkbench([0xf5, 0xf6]);
    const c = await face("referee", 0xf7);
    const cOnA = (await a.hive.receiveContactCard(await c.hive.contactCard())).id;
    await c.hive.receiveContactCard(await a.hive.contactCard());
    const seats = await islandOf(v, [a, c]).stand();
    expect(said(await seats.get("steward")!.sealValues({ bagId: WORKING, values: [change("f2 one")], signer: a.signer }))).toBe("OK");
    const members = [{ face: "group-referee", agentHex: cOnA, access: "write" as const }];
    let refuse = true;
    const handed: string[] = [];
    const ports = {
      provider: a.hive, ledger: v.ledger, ownerFace: "group-steward",
      keyholder: async () => ({ handOver: async (agentHex: string) => { if (refuse) throw new Error("hand-over refused"); handed.push(agentHex); } }),
    };
    await expect(landWorkbench({ slug: SLUG }, members, ports)).rejects.toThrow(/hand-over refused/);
    refuse = false;
    await landWorkbench({ slug: SLUG }, members, ports);
    expect(handed, "the seat the refused landing moved takes its box at the next landing").toEqual([cOnA]);
  });
});

describe("A5 — Y6: only the owner's replica notes a removal", () => {
  test("Y6: a seated face's mount projects from a replica that never saw the newest seat, and notes no removal", async () => {
    const { v, a, b, realmId } = await sharedWorkbench([0xea, 0xeb]);
    const r = await face("referee", 0xec);
    const rOnA = (await a.hive.receiveContactCard(await r.hive.contactCard())).id;
    await landWorkbench({ slug: SLUG }, [{ face: "group-engineer", agentHex: (await a.hive.receiveContactCard(await b.hive.contactCard())).id, access: "write" }, { face: "group-referee", agentHex: rOnA, access: "read" }], { provider: a.hive, ledger: v.ledger, ownerFace: "group-steward" });
    // The engineer's hive never ingested the referee's seat: its mount projects the roster from that replica.
    expect(await faceWorkbenchRealm(b.hive, v.ledger, SLUG, "group-engineer", true)).toBe(realmId);
    expect(workbenchRemovals(v.ledger.d, realmId, SLUG), "no removal: the referee was never revoked").toEqual([]);
  });
});

describe("A6 — the rest gate retires", () => {
  test("G3: an admin seat in another face's realm mounts it and writes working; a read seat mounts, reads, and writes personal", async () => {
    const { v, a, b, realmId } = await sharedWorkbench([0xf1, 0xf2]);
    const r = await face("referee", 0xf3);
    const rOnA = (await a.hive.receiveContactCard(await r.hive.contactCard())).id;
    await landWorkbench({ slug: SLUG }, [{ face: "group-engineer", agentHex: (await a.hive.receiveContactCard(await b.hive.contactCard())).id, access: "write" }, { face: "group-referee", agentHex: rOnA, access: "read" }], { provider: a.hive, ledger: v.ledger, ownerFace: "group-steward" });
    await r.hive.ingestPeerEvents(await a.hive.eventsForPeer(rOnA));
    expect(await faceWorkbenchRealm(b.hive, v.ledger, SLUG, "group-engineer", true), "the engineer mounts the steward's realm").toBe(realmId);
    expect(await workbenchWriterSeat(b.hive, v.ledger.d, SLUG), "and writes working").toBe(true);
    expect(await faceWorkbenchRealm(r.hive, v.ledger, SLUG, "group-referee", true), "the referee mounts it too").toBe(realmId);
    expect(await workbenchWriterSeat(r.hive, v.ledger.d, SLUG), "and writes personal").toBe(false);
    // The referee reads the steward's change through its own holder (readers follow the roster).
    const island2 = islandOf(v, [a, b, r]);
    const seats = await island2.stand();
    const line = change("g3 for every seat");
    expect(said(await seats.get("steward")!.sealValues({ bagId: WORKING, values: [line], signer: a.signer }))).toBe("OK");
    expect(said(await seats.get("referee")!.holder.openValue({ bagId: WORKING, role: "change", ref: line.ref })), "a read seat opens the workbench").toBe("OK");
  });
});

describe("A8 — a landing signs under a person's hand alone", () => {
  test("W2: a seat, a tab, a watcher and an ask no door read leave the hand-over's cure to the person; the CLI's own hand lands", () => {
    for (const asker of ["seat", "tab", "watcher", undefined]) expect(landsUnderAHand({ ...(asker !== undefined ? { asker } : {}) }), String(asker)).toBe(false);
    expect(landsUnderAHand({ asker: "cli" })).toBe(true);
  });
});

describe("A9 — a workbench founded closed before its realm bound it admits from now", () => {
  /** The document store's live working document, as the owner's island holds it: its current values alone. */
  const live = A.save(A.from({ tiddlers: { "the current page": { text: "what the workbench reads now" } } }));
  const freshBase = freshBasePort((bagId) => (bagId === WORKING ? live : null));

  /**
   * THE BUG'S SHAPE: the owner founds the working bag while no realm binds it (`closed`), then the realm binds and an earlier
   * share seats the engineer with no key holder lit. Each face's seat reads the island's writer book (the realm's roster and
   * its owner) through the realm-aware standing, and its values rest through `values`, which a test may stop once.
   */
  async function closedThenSeated(fills: readonly [number, number]) {
    const v: Vessel = { rest: memorySealedStoreRest(), values: new Map(), ledger: memDoc() };
    const a = await face("steward", fills[0]), b = await face("engineer", fills[1]);
    const bOnA = (await a.hive.receiveContactCard(await b.hive.contactCard())).id;
    await b.hive.receiveContactCard(await a.hive.contactCard());
    const early = seatRealm(v, a, EVERY_WRITER, [b], undefined, undefined, { freshBase });
    const w0 = change(`zero ${fills[0]}: before the realm bound`);
    expect(said(await early.sealValues({ bagId: WORKING, values: [w0], signer: a.signer }))).toBe("OK");
    const before = await early.holder.reading(WORKING);
    expect("foundings" in before && before.foundings.map((f) => f.history), "founded closed: no realm bound it").toEqual(["closed"]);
    early.lock();
    const realmId = (await faceWorkbenchRealm(a.hive, v.ledger, SLUG, "group-steward", true))!;
    const members = [{ face: "group-engineer", agentHex: bOnA, access: "write" as const }];
    await landWorkbench({ slug: SLUG }, members, { provider: a.hive, ledger: v.ledger, ownerFace: "group-steward" });
    await b.hive.ingestPeerEvents(await a.hive.eventsForPeer(bOnA));
    adoptWorkbench(b.hive, SLUG, workbenchKeyDocs(v.ledger.d, realmId, SLUG)[0]!);
    const book = new RealmWriterBook();
    // THE ISLAND'S FACES carry their PersonaGroup: the owner reads as the lit face whose group derives the realm.
    const readBook = () => book.read(WORKING, [a.hive, b.hive], v.ledger.d, [{ agent: a.id, group: "group-steward", chain: () => a.own }, { agent: b.id, group: "group-engineer", chain: () => b.own }]);
    await readBook();
    const standing = (f: Omit<Face, "seat">) => faceStanding({ own: () => f.own, bags: () => [WORKING], realmWriters: (bagId) => book.writers(bagId), realmMark: () => book.mark() });
    const stop = { next: false };
    const values = {
      read: async (address: SealedAddress) => v.values.get(address) ?? null,
      write: async (address: SealedAddress, bytes: Uint8Array) => { if (stop.next) { stop.next = false; throw new Error("the island stopped"); } v.values.set(address, Uint8Array.from(bytes)); },
    };
    const seat = (f: Omit<Face, "seat">, sibling: Omit<Face, "seat">, extra: Partial<ContentKeySeatInput> = {}) =>
      seatRealm(v, f, standing(f), [sibling], undefined, undefined, { freshBase, values, ...extra });
    const keyholder = (owner: ContentKeySeat) => async () => ({
      handOver: async (agentHex: string) => {
        const out = await owner.handOverRealm(WORKING, agentHex, a.signer);
        if ("refusal" in out) throw new Error(said(out));
      },
    });
    const landAgain = (owner: ContentKeySeat) => landWorkbench({ slug: SLUG }, members, { provider: a.hive, ledger: v.ledger, ownerFace: "group-steward", keyholder: keyholder(owner) });
    const versions = async () => (await new SealedStore(v.rest).records("key-version")).length;
    return { v, a, b, bOnA, w0, seat, landAgain, stop, versions, realmId, readBook, book };
  }

  test("C1: founded closed, then bound and shared: the owner admits from now; the seated face opens and saves; the closed past stays closed", async () => {
    const { a, b, bOnA, w0, seat, landAgain, versions } = await closedThenSeated([0xc1, 0xc2]);
    const seatA = seat(a, b);
    // THE SHARE LANDS AGAIN UNDER THE OWNER'S HAND: the seated engineer takes its lockbox.
    const landed = await landAgain(seatA);
    expect(landed.unhanded, "the seated engineer took its lockbox").toEqual([]);
    const after = await seatA.holder.reading(WORKING);
    expect("foundings" in after && after.foundings.map((f) => f.history), "the head's span now reads shareable").toEqual(["shareable"]);
    const minted = await versions();

    const seatB = seat(b, a);
    const w1 = change("c1 one: the steward after the admission"), w2 = change("c1 two: the engineer saves");
    expect(said(await seatA.sealValues({ bagId: WORKING, values: [w1], signer: a.signer })), "the owner seals under the admitted span").toBe("OK");
    expect(said(await seatB.sealValues({ bagId: WORKING, values: [w2], signer: b.signer })), "the seated face saves: no bag-unfounded").toBe("OK");
    expect(said(await seatB.holder.openValue({ bagId: WORKING, role: "change", ref: w1.ref })), "the seated face opens the owner's save").toBe("OK");
    expect(said(await seatA.holder.openValue({ bagId: WORKING, role: "change", ref: w2.ref })), "the owner opens the seated face's save").toBe("OK");
    expect(said(await seatB.holder.openValue({ bagId: WORKING, role: "change", ref: w0.ref })), "the closed span stays closed to the newcomer").not.toBe("OK");
    expect(said(await seatA.holder.openValue({ bagId: WORKING, role: "change", ref: w0.ref })), "and still opens for its owner").toBe("OK");

    // THE SAME LANDING ENTERED AGAIN mints nothing more: the admitted span hands its box as any shareable span does.
    expect(said(await seatA.handOverRealm(WORKING, bOnA, a.signer))).toBe("OK");
    expect(await seatB.admitRealmFromNow(WORKING, b.signer), "a seated face that owns no realm admits nothing").toBe(null);
    expect(await versions(), "no second admission, by the owner or the seated face").toBe(minted);
  });

  test("C3 (F1): a write-seated member's own from-now admission under the realm's prefix counts nowhere: the owner alone opens a span", async () => {
    const { a, b, landAgain, seat, versions } = await closedThenSeated([0xc5, 0xc6]);
    expect((await landAgain(seat(a, b))).unhanded).toEqual([]);
    // THE MEMBER FORGES THE OWNER'S ACT: the realm's prefix over its own heads, history shareable, under its own signer. Its own
    // seat is told the act verified, so the version mints and rests where every seat reads it.
    const probe = seat(b, a);
    const reading = await probe.holder.reading(WORKING);
    const heads = "foundings" in reading ? [...reading.foundings[0]!.heads].sort() : [];
    probe.lock();
    const act = `${REALM_ADMISSION_ACT}${sha256HexBytesSync(utf8Bytes(heads.join("\n")))}`;
    const forger = seat(b, a, { verifiedAdmissions: () => new Set([act]) });
    const before = await versions();
    expect(said(await forger.holder.admitFromNow({ bagId: WORKING, act, history: "shareable", signer: b.signer }) as object), "the forged version mints on the forger's own seat").toBe("OK");
    expect(await versions(), "and rests where the owner reads").toBe(before + 1);
    const owner = seat(a, b);
    const read = await owner.holder.reading(WORKING);
    expect("foundings" in read && [...read.foundings[0]!.heads].sort(), "the owner counts no span the member opened").toEqual(heads);
    expect("foundings" in read && read.foundings[0]!.uncounted.map((u) => u.why), "it reads unverified").toContain("cause-unverified");
  });

  test("C4 (F2): a stop between the admission's record and its fresh base strands no span: the next landing cuts the base", async () => {
    const { a, b, landAgain, seat, stop, versions } = await closedThenSeated([0xc7, 0xc8]);
    const seatA = seat(a, b);
    stop.next = true;   // THE ISLAND STOPS while the admission rests its fresh base's value.
    const stopped = await landAgain(seatA);
    expect(stopped.unhanded.map((u) => u.face), "the stopped landing names the seat it could not hand").toEqual(["group-engineer"]);
    const reading = await seatA.holder.reading(WORKING);
    expect("foundings" in reading && reading.foundings.map((f) => f.history), "the admission's record rested before the stop").toEqual(["shareable"]);
    expect(said(await seatA.sealValues({ bagId: WORKING, values: [change("c4 stranded")], signer: a.signer })), "the span stands on no base yet").toBe("fresh-base-unavailable");
    const minted = await versions();
    expect((await landAgain(seatA)).unhanded, "the next landing repairs the base and hands the box").toEqual([]);
    expect(await versions(), "the repair mints no second admission").toBe(minted);
    const w = change("c4 after the repair");
    expect(said(await seatA.sealValues({ bagId: WORKING, values: [w], signer: a.signer }))).toBe("OK");
    expect(said(await seat(b, a).holder.openValue({ bagId: WORKING, role: "change", ref: w.ref })), "the seated face opens it").toBe("OK");
  });

  test("C5 (F4): each hand-over refusal names its own cure; any other reads the owner's", () => {
    const owner = "wear the realm's owner face (`lares vault unlock --face 0`, then `lares wear 0`) and land the share again (`lares wiki share lares`)";
    expect(handOverCure("lares", "fresh-base-unavailable", owner)).toMatch(/live working document stands \(`lares wiki switch lares`\).*`lares wiki share lares`/);
    for (const refusal of ["wrap-failed", "reader-unreached"]) expect(handOverCure("lares", refusal, owner), refusal).toMatch(/light the member face \(`lares vault unlock --face N`\)/);
    expect(handOverCure("lares", "seal-refused", owner)).toBe(owner);
  });

  test("C6: a write-seated member's own roll under the realm's state-roll prefix counts nowhere: the owner alone rolls the key", async () => {
    const { a, b, landAgain, seat, versions } = await closedThenSeated([0xd9, 0xda]);
    expect((await landAgain(seat(a, b))).unhanded).toEqual([]);
    const ownerBefore = await seat(a, b).holder.reading(WORKING);
    const heads = "foundings" in ownerBefore ? [...ownerBefore.foundings[0]!.heads].sort() : [];
    // THE MEMBER FORGES A ROLL: a removal version under the realm's state-roll prefix, counted on its own seat alone.
    const ACT = `${REALM_STATE_ROLL_ACT}forged-by-the-member`;
    const forger = seat(b, a, { countedRaises: () => new Set([ACT]) });
    const before = await versions();
    // THE PREFIX READS FIRST on the forger's own seat too: its counted raises admit no roll its owner never signed, so it mints none.
    await expect(contentKeyRollSink(forger.holder.rollerPorts({ bagsOf: () => [WORKING], signer: () => b.signer }))({ kind: "seat-roll", scope: "realm", edgeId: "realm-roster", raiseCids: [ACT], how: "revoked" }))
      .rejects.toThrow(/mint-failed/);
    expect(await versions(), "the forged roll mints nowhere").toBe(before);
    const read = await seat(a, b).holder.reading(WORKING);
    expect("foundings" in read && [...read.foundings[0]!.heads].sort(), "the owner's heads stand").toEqual(heads);
  });

  test("C6b: the owner's gate covers every count path: a roll-prefixed act planted in a reader's counted raises still counts nowhere unsigned by the owner", async () => {
    const { a, b, landAgain, seat, versions } = await closedThenSeated([0xdd, 0xde]);
    expect((await landAgain(seat(a, b))).unhanded).toEqual([]);
    const ownerBefore = await seat(a, b).holder.reading(WORKING);
    const heads = "foundings" in ownerBefore ? [...ownerBefore.foundings[0]!.heads].sort() : [];
    const ACT = `${REALM_STATE_ROLL_ACT}planted-in-the-count`;
    // A FORGER WHOSE OWN STANDING LIES (it names itself the owner) mints the roll and rests it where the owner reads.
    const liar: WriterStanding = { holdsWrite: () => true, signedByRealmOwner: () => true };
    const before = await versions();
    await contentKeyRollSink(seat(b, a, { session: { signer: () => null, standing: liar } }).holder.rollerPorts({ bagsOf: () => [WORKING], signer: () => b.signer }))({ kind: "seat-roll", scope: "realm", edgeId: "realm-roster", raiseCids: [ACT], how: "revoked" });
    expect(await versions(), "the forged roll rests where the owner reads").toBe(before + 1);
    // THE OWNER'S OWN SEAT carries the act among its counted raises (a projection noted it): the prefix still asks the owner's hand.
    const read = await seat(a, b, { countedRaises: () => new Set([ACT]) }).holder.reading(WORKING);
    expect("foundings" in read && [...read.foundings[0]!.heads].sort(), "a planted roll counts nowhere without the owner's signature").toEqual(heads);
    expect("foundings" in read && read.foundings[0]!.uncounted.map((u) => u.why), "it reads unverified").toContain("cause-unverified");
  });

  test("C7: the sealed-admit door opens no realm-derived act; a member's cure names its handle; no-head-held names its own cure", () => {
    for (const act of [`${REALM_ADMISSION_ACT}abc`, `${REALM_STATE_ROLL_ACT}abc`]) expect(sealedAdmitRefusal(act)?.refusal, act).toBe("realm-act-reserved");
    expect(sealedAdmitRefusal("an-operator-admission-act"), "CONTROL: any other act passes to the holder").toBe(null);
    const owner = "wear the realm's owner face (`lares vault unlock --face 0`, then `lares wear 0`) and land the share again (`lares wiki share lares`)";
    expect(handOverCure("lares", "wrap-failed", owner, 2)).toMatch(/`lares vault unlock --face 2`/);
    expect(handOverCure("lares", "no-head-held", owner)).not.toBe(owner);
    expect(handOverCure("lares", "no-head-held", owner)).toMatch(/holds no key of the workbench's head.*`lares wiki share lares`/);
  });

  test("C8: the realm's owner reads as the lit face whose group derives the realm, whatever agent the ledger's seat row names", async () => {
    const { v, a, b, landAgain, seat, realmId, readBook, book } = await closedThenSeated([0xdb, 0xdc]);
    // ANOTHER DEVICE OF THE OWNER FACE overwrote the face's one seat row with its own agent.
    noteWorkbenchSeat(v.ledger.d, realmId, SLUG, "group-steward", "ab".repeat(32));
    await readBook();
    expect((await landAgain(seat(a, b))).unhanded, "the owner's admission still counts under its own chain").toEqual([]);
    expect(book.writers(WORKING)?.owner, "the owner reads as the steward's own chain").toEqual(a.own);
  });

  test("C9: the book never reads its owner off the ledger's seat row: a face that names no group owns nothing", async () => {
    const { v, a, b, book } = await closedThenSeated([0xdf, 0xe0]);
    // THE ALPHA LINE carries no ledger-row fallback: a caller outside the contract hands faces without their groups.
    const groupless = [{ agent: a.id, chain: () => a.own }, { agent: b.id, chain: () => b.own }] as unknown as RealmFace[];
    await book.read(WORKING, [a.hive, b.hive], v.ledger.d, groupless);
    expect(book.writers(WORKING)?.owner, "no group, no owner").toBe(null);
  });

  test("C2: a seated member's refused hand-over reads on the landing by name, never as landed", async () => {
    const { v, a, bOnA } = await sharedWorkbench([0xc3, 0xc4]);
    const landed = await landWorkbench({ slug: SLUG }, [{ face: "group-engineer", agentHex: bOnA, access: "write" }], {
      provider: a.hive, ledger: v.ledger, ownerFace: "group-steward",
      keyholder: async () => ({ handOver: async () => { throw new Error("seat-needs-keyholder: the owner's holder handed the new seat no lockbox (history-closed); wear the owner"); } }),
    });
    expect(landed.unhanded).toEqual([{ face: "group-engineer", cause: "seat-needs-keyholder: the owner's holder handed the new seat no lockbox (history-closed); wear the owner" }]);
  });
});
