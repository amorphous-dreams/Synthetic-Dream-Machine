/**
 * workbench-realm — the private cabal of one human's faces over REAL Keyhive (cabal-realm#/the-workbench).
 *
 * Each face stands as its own provider, introduced to the owner by contact card (as the share door introduces a grantee).
 *
 * K1 (red 4) the workbench address stays unmoved across adding and removing a member face.
 * K2 (red 3) a removed member's later writes refuse `workbench-not-a-member`; a reader never writes.
 * K3 (red 1, the roster half) a face outside the realm holds no seat: no read, no write.
 * K4 (red 5) a daemon slug refuses before any Document mints.
 * K5 (red 7) no announce row for a private cabal: standing and landing write the ledger's workbench rows and nothing else.
 * K6 the first stand founds a private cabal of one, the founder's seat noted; a replay founds nothing new.
 * K7 (red 9) a ledger that names the slug under two realms refuses the landing.
 * K8 (red 3) a row that stops naming a face revokes the seat the vessel noted for it; the address stands.
 * K9 (causal islands) two offline devices of one face stand the same wiki, then sync: one realm, one workbench, no tie.
 * K10 (one owner) device A revokes a face while device B's ledger still holds that face's seat row: once B's hive ingests A's
 *     revoke, the roster's projection drops the row and B's wire guard refuses the face.
 */
import { describe, test, expect } from "vitest";
import { KeyhiveProvider, InMemoryEventStore } from "../src/index.js";
import {
  admitWorkbenchFace, foundWorkbench, landWorkbench, removeWorkbenchFace, requireWorkbenchWriter, standWorkbench, workbenchFaceHolds,
  adoptWorkbench, projectWorkbenchRoster,
  type LedgerDoc,
} from "../src/workbench-realm.js";
import {
  noteWorkbench, realmWorkbenchDocUrl, tiddlerText, WorkbenchRefusal, EDGE_LEDGER_PREFIX, ledgerWorkbenches, workbenchSeats,
  wikiSlotUri, REALM_BAG_ANNOUNCE_PREFIX, privateCabalRealmId, ledgerWorkbenchRealm, noteWorkbenchSeat, workbenchSeatHolds,
  workbenchDecider, workbenchDocIds, type LarDoc,
} from "@lararium/mesh";

async function face(fill: number): Promise<KeyhiveProvider> {
  const p = new KeyhiveProvider();
  await p.init({ seed: new Uint8Array(32).fill(fill), eventStore: new InMemoryEventStore() });
  return p;
}
async function introduce(owner: KeyhiveProvider, other: KeyhiveProvider): Promise<string> {
  return (await owner.receiveContactCard(await other.contactCard())).id;
}
/** A plain in-memory ledger the stand and the landing write through. */
function memDoc(): LedgerDoc & { readonly d: LarDoc } {
  const d = { tiddlers: {} } as LarDoc;
  return { d, doc: () => d, change: (fn) => fn(d) };
}

describe("K1/K2/K3 — membership rides the realm's Document, and the address never moves", () => {
  test("add, remove: the address stands; the removed face's write refuses; a stranger holds nothing", async () => {
    const owner = await face(0x21), engineer = await face(0x22), referee = await face(0x23), stranger = await face(0x24);
    const eng = await introduce(owner, engineer), ref = await introduce(owner, referee), str = await introduce(owner, stranger);
    const wb = await foundWorkbench(owner, { slug: "notes", face: "joshua-fontany" });
    expect(wb.realmId).toMatch(/^[0-9a-f]{64}$/);
    expect(wb.docUrl).toBe(realmWorkbenchDocUrl(wb.realmId, "notes"));
    const before = wb.docUrl;

    await admitWorkbenchFace(owner, "notes", eng, "write");
    await admitWorkbenchFace(owner, "notes", ref, "read");
    expect(await workbenchFaceHolds(owner, "notes", eng, "write")).toBe(true);
    expect(await workbenchFaceHolds(owner, "notes", ref, "read")).toBe(true);
    await expect(requireWorkbenchWriter(owner, "notes", ref)).rejects.toThrow(/workbench-not-a-member/);   // a reader writes nothing
    await expect(requireWorkbenchWriter(owner, "notes", eng)).resolves.toBeUndefined();

    // K3: a face outside the realm holds no seat at all.
    expect(await workbenchFaceHolds(owner, "notes", str, "read")).toBe(false);

    // K2: removal by Keyhive's convergent revoke; the face's later write refuses by name.
    await removeWorkbenchFace(owner, wb.keyDoc, eng);
    expect(await workbenchFaceHolds(owner, "notes", eng, "read")).toBe(false);
    await expect(requireWorkbenchWriter(owner, "notes", eng)).rejects.toBeInstanceOf(WorkbenchRefusal);
    // K1: no membership change moved the address.
    expect(realmWorkbenchDocUrl(wb.realmId, "notes")).toBe(before);
  });
});

describe("K4 — the daemon wiki never shares", () => {
  test("the founding refuses `workbench-face-private` before any Document mints", async () => {
    const owner = await face(0x31);
    await expect(foundWorkbench(owner, { slug: "daemon", face: "joshua-fontany" })).rejects.toThrow(/workbench-face-private/);
    expect(owner.docIdOfBag(wikiSlotUri("daemon", "working"))).toBeNull();
  });
});

describe("K5/K6/K8 — stand, land, revoke: no announce, one founding", () => {
  test("the first stand founds a cabal of one; the landing seats and revokes; the ledger takes workbench rows alone", async () => {
    const owner = await face(0x41), engineer = await face(0x42);
    const eng = await introduce(owner, engineer);
    const ledger = memDoc();
    // K6: the wiki's first stand founds its private cabal of one, the founder's seat noted; a replay founds nothing new.
    const first = await standWorkbench(owner, ledger, "notes", "joshua-fontany");
    expect(first.founded).toBe(true);
    expect((await standWorkbench(owner, ledger, "notes", "joshua-fontany")).founded).toBe(false);
    expect(ledgerWorkbenches(ledger.d)).toHaveLength(1);
    expect([...workbenchSeats(ledger.d, first.realmId, "notes").keys()]).toEqual(["joshua-fontany"]);
    expect(owner.docIdOfBag(wikiSlotUri("notes", "working")), "the working bag rides this vessel's key Document").toBe(`0x${first.keyDoc}`);
    expect(first.realmId, "the realm's name derives from the face and the slug").toBe(privateCabalRealmId("joshua-fontany", "notes"));

    const ports = { provider: owner, ledger, ownerFace: "joshua-fontany" };
    const landed = await landWorkbench({ slug: "notes" }, [{ face: "joshua-fontany-engineer", agentHex: eng, access: "write" }], ports);
    expect(landed.founded, "the share seats faces in the realm the first stand founded").toBe(false);
    expect(landed.realmId).toBe(first.realmId);
    expect(await workbenchFaceHolds(owner, "notes", eng, "write")).toBe(true);
    // A replay lands nothing new.
    const before = JSON.stringify(ledger.d);
    await landWorkbench({ slug: "notes" }, [{ face: "joshua-fontany-engineer", agentHex: eng, access: "write" }], ports);
    expect(JSON.stringify(ledger.d)).toBe(before);

    // K5: every ledger row sits under the realm's workbench rows; no announce row, no realm-bag registration stands.
    const keys = Object.keys(ledger.d.tiddlers);
    expect(keys.every((k) => k.startsWith(`${EDGE_LEDGER_PREFIX}${first.realmId}/workbench`))).toBe(true);
    expect(keys.some((k) => k.startsWith(REALM_BAG_ANNOUNCE_PREFIX))).toBe(false);
    expect(tiddlerText(ledger.d.tiddlers[`${EDGE_LEDGER_PREFIX}${first.realmId}/workbench/notes`] as never)).toBe("notes");

    // K8: a landing whose row stops naming the engineer revokes the seat it noted; the address stands.
    const third = await landWorkbench({ slug: "notes" }, [], ports);
    expect(third.removed).toEqual(["joshua-fontany-engineer"]);
    expect(await workbenchFaceHolds(owner, "notes", eng, "read")).toBe(false);
    expect(third.docUrl).toBe(landed.docUrl);
  });
});

describe("K7 — one wiki under two realms refuses", () => {
  test("a ledger naming the slug under two realms refuses the landing by name", async () => {
    const owner = await face(0x51);
    const ledger = memDoc();
    noteWorkbench(ledger.d, "c".repeat(64), "notes");
    const other = { tiddlers: {} } as LarDoc;
    noteWorkbench(other, "d".repeat(64), "notes");
    Object.assign(ledger.d.tiddlers, other.tiddlers);   // two replicas met
    await expect(landWorkbench({ slug: "notes" }, [], {
      provider: owner, ledger, ownerFace: "x",
    })).rejects.toThrow(/workbench-two-realms/);
  });
});

describe("K9 — two offline devices of one face converge on one realm", () => {
  test("each device stands the wiki alone, under its own key Document; their ledgers merge on one realm and one address", async () => {
    const deviceA = await face(0x71), deviceB = await face(0x72);
    const ledgerA = memDoc(), ledgerB = memDoc();
    // OFFLINE: neither device hears the other.
    const a = await standWorkbench(deviceA, ledgerA, "notes", "joshua-fontany");
    const b = await standWorkbench(deviceB, ledgerB, "notes", "joshua-fontany");
    expect(a.realmId).toBe(b.realmId);
    expect(a.keyDoc, "Keyhive mints each vessel's key Document fresh: no input derives its identity").not.toBe(b.keyDoc);
    // SYNC: the rows merge (a CRDT map's union), and the slug reads one realm, never two.
    const merged = { tiddlers: { ...ledgerA.d.tiddlers, ...ledgerB.d.tiddlers } } as LarDoc;
    expect(ledgerWorkbenchRealm(merged, "notes")).toBe(a.realmId);
    expect(ledgerWorkbenches(merged)).toEqual([{ slug: "notes", realmId: a.realmId, docUrl: realmWorkbenchDocUrl(a.realmId, "notes") }]);
    // A stand over the merged ledger founds nothing new: the realm and this vessel's key both stand.
    const again = await standWorkbench(deviceA, { doc: () => merged, change: (fn) => fn(merged) }, "notes", "joshua-fontany");
    expect(again.founded).toBe(false);
    expect(again.realmId).toBe(a.realmId);
  });
});

describe("K10 — the seat rows project the roster: one owner", () => {
  test("A revokes; B's stale row drops once B's hive ingests the revoke, and B's guard refuses the face", async () => {
    const deviceA = await face(0x81), deviceB = await face(0x82), engineer = await face(0x83);
    const ledgerA = memDoc();
    const stood = await standWorkbench(deviceA, ledgerA, "notes", "joshua-fontany");
    const engOnA = await introduce(deviceA, engineer);
    const bOnA = await introduce(deviceA, deviceB);
    await admitWorkbenchFace(deviceA, "notes", engOnA, "read");
    await admitWorkbenchFace(deviceA, "notes", bOnA, "write");
    // Device B replicates A's key Document: it knows the engineer's agent (a card it holds; an agent B cannot name reads no seat,
    // so the projection withholds it), ingests A's events, and adopts the slot onto that Document.
    await deviceB.receiveContactCard(await engineer.contactCard());
    await deviceB.ingestPeerEvents(await deviceA.eventsForPeer(bOnA));
    adoptWorkbench(deviceB, "notes", stood.keyDoc);
    const ledgerB = memDoc();
    noteWorkbench(ledgerB.d, stood.realmId, "notes");
    expect(await projectWorkbenchRoster(deviceB, ledgerB, stood.realmId, "notes", new Map([["joshua-fontany-engineer", engOnA]]))).toContain("joshua-fontany-engineer");
    const guardB = workbenchDecider({
      realmOfDoc: (id) => workbenchDocIds(ledgerB.d).get(id), faceOfPeer: () => "joshua-fontany-engineer",
      holds: (realm, f) => workbenchSeatHolds(ledgerB.d, realm, f),
    });
    const docId = [...workbenchDocIds(ledgerB.d).keys()][0]!;
    expect(await guardB("peer-of-engineer", docId), "CONTROL: the seated face crosses").toBe(true);

    // A REVOKES while B's ledger still holds the engineer's row.
    await removeWorkbenchFace(deviceA, stood.keyDoc, engOnA);
    expect(workbenchSeatHolds(ledgerB.d, stood.realmId, "joshua-fontany-engineer"), "B's row stands stale").toBe(true);
    // B's hive hears the revoke; B's next roster read re-projects, and the row leaves with it.
    await deviceB.ingestPeerEvents(await deviceA.eventsForPeer(bOnA));
    expect(await workbenchFaceHolds(deviceB, "notes", engOnA, "read"), "B's replica of the roster drops the face").toBe(false);
    await projectWorkbenchRoster(deviceB, ledgerB, stood.realmId, "notes");
    expect(await guardB("peer-of-engineer", docId), "B's guard refuses the revoked face").toBe(false);
    // A row written outside the projection reads only until the next projection: the roster wins.
    ledgerB.change((d) => noteWorkbenchSeat(d, stood.realmId, "notes", "joshua-fontany-engineer", engOnA));
    await projectWorkbenchRoster(deviceB, ledgerB, stood.realmId, "notes");
    expect(await guardB("peer-of-engineer", docId)).toBe(false);
  });
});
