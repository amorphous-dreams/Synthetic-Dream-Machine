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
 */
import { describe, test, expect } from "vitest";
import { KeyhiveProvider, InMemoryEventStore } from "../src/index.js";
import {
  admitWorkbenchFace, foundWorkbench, landWorkbench, removeWorkbenchFace, requireWorkbenchWriter, standWorkbench, workbenchFaceHolds,
  type LedgerDoc,
} from "../src/workbench-realm.js";
import {
  noteWorkbench, realmWorkbenchDocUrl, tiddlerText, WorkbenchRefusal, EDGE_LEDGER_PREFIX, ledgerWorkbenches, workbenchSeats,
  wikiSlotUri, REALM_BAG_ANNOUNCE_PREFIX, type LarDoc,
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
    const wb = await foundWorkbench(owner, { slug: "notes" });
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
    await removeWorkbenchFace(owner, wb.realmId, eng);
    expect(await workbenchFaceHolds(owner, "notes", eng, "read")).toBe(false);
    await expect(requireWorkbenchWriter(owner, "notes", eng)).rejects.toBeInstanceOf(WorkbenchRefusal);
    // K1: no membership change moved the address.
    expect(realmWorkbenchDocUrl(wb.realmId, "notes")).toBe(before);
  });
});

describe("K4 — the daemon wiki never shares", () => {
  test("the founding refuses `workbench-face-private` before any Document mints", async () => {
    const owner = await face(0x31);
    await expect(foundWorkbench(owner, { slug: "daemon" })).rejects.toThrow(/workbench-face-private/);
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
    expect(owner.docIdOfBag(wikiSlotUri("notes", "working")), "the working bag rides the realm's Document").toBe(`0x${first.realmId}`);

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
