/**
 * workbench-realm — the private cabal of one human's faces over REAL Keyhive (cabal-realm#/the-workbench).
 *
 * Each face stands as its own provider, introduced to the owner by contact card (as the share door introduces a grantee).
 *
 * K1 (red 4) the workbench address stays unmoved across adding and removing a member face.
 * K2 (red 3) a removed member's later writes refuse `workbench-not-a-member`; a reader never writes.
 * K3 (red 1, the roster half) a face outside the realm holds no seat: no read, no write.
 * K4 (red 5) a daemon slug refuses before any Document mints.
 * K5 (red 7) no announce row for a private cabal: the landing writes the ledger's workbench rows and nothing else.
 * K6 (red 10) the face's working document lifts into the workbench exactly once; view state stays private (red 8).
 * K7 (red 9) a ledger that names the slug under two realms refuses the landing.
 * K8 (red 3) a row that stops naming a face revokes the seat the vessel noted for it; the address stands.
 */
import { describe, test, expect } from "vitest";
import { KeyhiveProvider, InMemoryEventStore } from "../src/index.js";
import {
  admitWorkbenchFace, foundWorkbench, landWorkbench, removeWorkbenchFace, requireWorkbenchWriter, workbenchFaceHolds,
  type LiftDoc,
} from "../src/workbench-realm.js";
import {
  noteWorkbench, realmWorkbenchDocUrl, storedLarRecord, tiddlerText, WorkbenchRefusal, EDGE_LEDGER_PREFIX,
  REALM_BAG_ANNOUNCE_PREFIX, type LarDoc,
} from "@lararium/mesh";

async function face(fill: number): Promise<KeyhiveProvider> {
  const p = new KeyhiveProvider();
  await p.init({ seed: new Uint8Array(32).fill(fill), eventStore: new InMemoryEventStore() });
  return p;
}
async function introduce(owner: KeyhiveProvider, other: KeyhiveProvider): Promise<string> {
  return (await owner.receiveContactCard(await other.contactCard())).id;
}
/** A plain in-memory document the lift and the ledger write through. */
function memDoc(seed: Record<string, string> = {}): LiftDoc & { readonly d: LarDoc } {
  const d = { tiddlers: {} } as LarDoc;
  for (const [title, text] of Object.entries(seed)) d.tiddlers[title] = storedLarRecord(title, { text }, "test") as never;
  return { d, doc: () => d, change: (fn) => fn(d) };
}
const isPersonal = (t: string): boolean => t === "$:/StoryList" || t.startsWith("$:/state/folded/");

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
    expect(owner.docIdOfBag("lar:///ha.ka.ba/wikis/daemon/workbench")).toBeNull();
  });
});

describe("K5/K6 — the landing: no announce, and one lift", () => {
  test("the ledger takes workbench rows alone; the owner's working content lifts once and view state stays private", async () => {
    const owner = await face(0x41), engineer = await face(0x42);
    const eng = await introduce(owner, engineer);
    const ledger = memDoc();
    const working = memDoc({ "Field note": "shared from the start", "$:/StoryList": "Field note", "$:/state/folded/Field note": "hide" });
    const benches = new Map<string, ReturnType<typeof memDoc>>();
    const ports = {
      provider: owner, ledger, ownerFace: "joshua-fontany", isPersonal,
      workbench: async (url: string) => { if (!benches.has(url)) benches.set(url, memDoc()); return benches.get(url)!; },
      ownerWorking: async () => working,
    };
    const first = await landWorkbench({ slug: "notes" }, [{ face: "joshua-fontany-engineer", agentHex: eng, access: "write" }], ports);
    expect(first.founded).toBe(true);
    expect(first.lifted).toBe(true);
    const bench = benches.get(first.docUrl)!;
    expect(Object.keys(bench.d.tiddlers)).toEqual(["Field note"]);
    expect(Object.keys(working.d.tiddlers).sort()).toEqual(["$:/StoryList", "$:/state/folded/Field note"]);

    // K6: a second landing finds the realm and the mark, founds nothing and lifts nothing, though the face wrote again.
    working.d.tiddlers["Later private"] = storedLarRecord("Later private", { text: "mine" }, "test") as never;
    const second = await landWorkbench({ slug: "notes" }, [{ face: "joshua-fontany-engineer", agentHex: eng, access: "write" }], ports);
    expect(second.founded).toBe(false);
    expect(second.lifted).toBe(false);
    expect(second.realmId).toBe(first.realmId);
    expect(Object.keys(bench.d.tiddlers)).toEqual(["Field note"]);
    expect(Object.keys(working.d.tiddlers)).toContain("Later private");

    // K5: every ledger row sits under the realm's workbench rows; no announce row, no realm-bag registration stands anywhere.
    const keys = Object.keys(ledger.d.tiddlers);
    expect(keys.every((k) => k.startsWith(`${EDGE_LEDGER_PREFIX}${first.realmId}/workbench`))).toBe(true);
    expect([...keys, ...Object.keys(bench.d.tiddlers)].some((k) => k.startsWith(REALM_BAG_ANNOUNCE_PREFIX))).toBe(false);
    expect(tiddlerText(ledger.d.tiddlers[`${EDGE_LEDGER_PREFIX}${first.realmId}/workbench/notes`] as never)).toBe("notes");
    // K8 (red 3, the share door's half): a landing whose row stops naming the engineer revokes the seat it noted.
    expect(await workbenchFaceHolds(owner, "notes", eng, "write")).toBe(true);
    const third = await landWorkbench({ slug: "notes" }, [], ports);
    expect(third.removed).toEqual(["joshua-fontany-engineer"]);
    expect(await workbenchFaceHolds(owner, "notes", eng, "read")).toBe(false);
    expect(third.docUrl).toBe(first.docUrl);
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
      provider: owner, ledger, ownerFace: "x", isPersonal, workbench: async () => memDoc(), ownerWorking: async () => null,
    })).rejects.toThrow(/workbench-two-realms/);
  });
});
