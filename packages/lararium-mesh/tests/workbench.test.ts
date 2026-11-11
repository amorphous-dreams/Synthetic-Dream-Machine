/**
 * workbench — a shared wiki's working layer, kept by a private cabal of one human's faces (cabal-realm#/the-workbench).
 *
 * The floor half, no Keyhive: the address, the ledger rows, the refusals, the admit filter, the recipe's order, and the wire
 * guard's decider over two real automerge-repo replicas. The Keyhive half (found, stand, admit, remove) stands in
 * `packages/lararium-keyhive/tests/workbench-realm.test.ts`.
 *
 * W1 (red 4) the workbench address stays unmoved: the realm id and the slug alone derive it (NFC), no member reads in.
 * W2 (red 5) a daemon slug refuses a share: the shareable gate, the share row's title, and a hand-edited share file.
 * W3 (red 9) one wiki registered under two realms refuses: the note refuses, and a merged ledger holding two reads none.
 * W5 every wiki's recipe reads canon -> working (the realm workbench) -> personal -> draft -> temp; the working slot writes.
 * W6 (red 1) an outsider syncs zero bytes of the workbench; a member face's device syncs it.
 * W7 (red 2) offline edits from two member faces converge: two replicas materialize the one address, each writes apart, merge.
 * W8 (red 8) personal content never syncs to another member face: a face's personal document crosses to its own devices alone,
 *    while the workbench crosses to every member face.
 * W9 seat notes: the vessel's own hand notes each seat, drops it at a revoke, and a replay writes nothing new.
 * Red 6 (tree-clean) rides `tools/tree-clean-witness.sh`: nothing here names a path, so no write reaches the tracked tree.
 */
import { describe, test, expect } from "vitest";
import * as A from "@automerge/automerge";
import { Repo, interpretAsDocumentId, type AutomergeUrl, type PeerId } from "@automerge/automerge-repo";
import { MessageChannelNetworkAdapter } from "@automerge/automerge-repo-network-messagechannel";
import {
  isFacePrivateSlug, ledgerWorkbenchRealm, ledgerWorkbenches, noteWorkbench, realmWorkbenchDocUrl, noteWorkbenchSeat, dropWorkbenchSeat,
  workbenchSeats, workbenchSeatHolds, requireWorkbenchShareable, workbenchDecider, workbenchDocIds, WorkbenchRefusal,
} from "../src/workbench.js";
import { realmVouchBoardDocUrl, materializeSharedLarDoc, deterministicDocUrl } from "../src/deterministic-doc.js";
import { parseShareFile, shareRowOf, shareRowTitle, ShareConfigRefusal, serializeShareFile } from "../src/share-config.js";
import { defaultWritableSlot, expandRecipe, wikiSlotUri, wikiBagUri, ORACLE_BAG } from "../src/wiki-recipe.js";
import { protectedDocGuard } from "../src/protected-doc-guard.js";
import { shareConfigOf } from "../src/federation-gate.js";
import { storedLarRecord } from "../src/stored-record.js";
import { tiddlerText, type LarDoc } from "../src/base-doc.js";

const REALM = "a".repeat(64);
const OTHER = "b".repeat(64);
const blank = (): LarDoc => ({ tiddlers: {} }) as LarDoc;
/** The personal set as the TW5 operator spells it (`isPersonalTitle`): handed in, as the vessel hands it. */
const isPersonal = (t: string): boolean => t === "$:/StoryList" || t === "$:/palette" || t.startsWith("$:/state/folded/") || t.startsWith("$:/state/tab-");

describe("W1 — the workbench address never moves", () => {
  test("the realm id and the slug alone derive it, a sibling of the realm's vouch board", () => {
    const url = realmWorkbenchDocUrl(REALM, "notes");
    expect(url).toBe(realmWorkbenchDocUrl(REALM.toUpperCase(), "notes"));
    expect(url).not.toBe(realmWorkbenchDocUrl(OTHER, "notes"));
    expect(url).not.toBe(realmWorkbenchDocUrl(REALM, "notes-2"));
    expect(url).not.toBe(realmVouchBoardDocUrl(REALM));
    // NFC: a composed and a decomposed spelling of one slug name one workbench.
    expect(realmWorkbenchDocUrl(REALM, "café")).toBe(realmWorkbenchDocUrl(REALM, "café"));
  });
  test("the ledger's binding names the same address, so every reader derives one document", () => {
    const ledger = blank();
    noteWorkbench(ledger, REALM, "notes");
    expect(ledgerWorkbenches(ledger)).toEqual([{ slug: "notes", realmId: REALM, docUrl: realmWorkbenchDocUrl(REALM, "notes") }]);
    expect(workbenchDocIds(ledger).get(String(interpretAsDocumentId(realmWorkbenchDocUrl(REALM, "notes"))))).toBe(REALM);
  });
});

describe("W2 — the daemon wiki holds one face's memory and never shares", () => {
  test("the shareable gate refuses the daemon slug and each face's daemon folder by name", () => {
    for (const slug of ["daemon", "daemon-0b0e2c1a-1111-4222-8333-944445555666"]) {
      expect(isFacePrivateSlug(slug)).toBe(true);
      expect(() => requireWorkbenchShareable({ slug })).toThrow(WorkbenchRefusal);
      try { requireWorkbenchShareable({ slug }); } catch (e) { expect((e as WorkbenchRefusal).reason).toBe("workbench-face-private"); }
    }
    expect(() => requireWorkbenchShareable({ slug: "notes" })).not.toThrow();
  });
  test("the share row refuses at its title, reads as no row, and a hand-edited share file refuses it", () => {
    try { shareRowTitle("daemon"); expect.unreachable(); } catch (e) { expect((e as ShareConfigRefusal).reason).toBe("share-face-private"); }
    expect(shareRowOf({ title: "$:/config/lares/share/daemon", kind: "wiki", read: "*", write: "*" })).toBeNull();
    const file = "title: $:/config/lares/share/daemon\nkind: wiki\nread: *\nwrite: *\ntype: text/vnd.tiddlywiki\n\n";
    try { parseShareFile(file); expect.unreachable(); } catch (e) { expect((e as ShareConfigRefusal).reason).toBe("share-face-private"); }
  });
  test("a checkout-sourced slug refuses a private shared mirror; a workspace name round-trips through the file", () => {
    try { requireWorkbenchShareable({ slug: "sdm", checkoutSourced: true }); expect.unreachable(); } catch (e) { expect((e as WorkbenchRefusal).reason).toBe("workbench-checkout-sourced"); }
    const text = serializeShareFile([{ slug: "notes", kind: "wiki", read: "*", write: "*", workspace: "field-notes" }]);
    expect(parseShareFile(text)[0]!.workspace).toBe("field-notes");
    try { requireWorkbenchShareable({ slug: "notes", workspace: "../escape" }); expect.unreachable(); } catch (e) { expect((e as WorkbenchRefusal).reason).toBe("workbench-workspace-malformed"); }
  });
});

describe("W3 — one wiki, one realm", () => {
  test("a second realm for a noted slug refuses and writes nothing", () => {
    const ledger = blank();
    noteWorkbench(ledger, REALM, "notes");
    noteWorkbench(ledger, REALM, "notes");   // the same binding again writes nothing
    expect(() => noteWorkbench(ledger, OTHER, "notes")).toThrow(/workbench-two-realms/);
    expect(ledgerWorkbenches(ledger)).toHaveLength(1);
  });
  test("two replicas that each founded before they met hold two rows, and the slug then mounts no workbench", () => {
    const a = blank(), b = blank();
    noteWorkbench(a, REALM, "notes");
    noteWorkbench(b, OTHER, "notes");
    const merged = { tiddlers: { ...a.tiddlers, ...b.tiddlers } } as LarDoc;
    expect(() => ledgerWorkbenchRealm(merged, "notes")).toThrow(/workbench-two-realms/);
  });
  test("a malformed realm id refuses by name", () => {
    expect(() => noteWorkbench(blank(), "not-a-realm", "notes")).toThrow(/workbench-realm-malformed/);
  });

});

describe("W5 — one recipe for every wiki: the working slot holds the realm workbench", () => {
  test("canon -> working -> personal -> draft -> temp, the working slot the one default writable", () => {
    expect(expandRecipe({ wikiSlug: "notes" })).toEqual([
      wikiSlotUri("notes", "temp"), wikiSlotUri("notes", "draft"), wikiSlotUri("notes", "personal"),
      wikiSlotUri("notes", "working"), wikiBagUri("notes"), ORACLE_BAG,
    ]);
    expect(defaultWritableSlot("notes")).toBe(wikiSlotUri("notes", "working"));
  });
});

describe("W9 — the vessel's seat notes", () => {
  test("a seat notes once, a replay writes nothing, a revoke drops it", () => {
    const ledger = blank();
    noteWorkbench(ledger, REALM, "notes");
    noteWorkbenchSeat(ledger, REALM, "notes", "face-a", "0xagent-a");
    const before = JSON.stringify(ledger);
    noteWorkbenchSeat(ledger, REALM, "notes", "face-a", "0xagent-a");
    expect(JSON.stringify(ledger), "a replay lands nothing new").toBe(before);
    expect([...workbenchSeats(ledger, REALM, "notes")]).toEqual([["face-a", "0xagent-a"]]);
    expect(workbenchSeatHolds(ledger, REALM, "face-a")).toBe(true);
    dropWorkbenchSeat(ledger, REALM, "notes", "face-a");
    expect(workbenchSeatHolds(ledger, REALM, "face-a")).toBe(false);
    expect(ledgerWorkbenches(ledger), "the seat rows never read as workbench rows").toHaveLength(1);
  });
});

const settle = async <T,>(p: Promise<T>, ms: number): Promise<"ready" | "unavailable" | "timeout"> =>
  Promise.race([
    p.then(() => "ready" as const, () => "unavailable" as const),
    new Promise<"timeout">((r) => setTimeout(() => r("timeout"), ms)),
  ]);

/** The hearth holds the workbench; one peer (a device of `face`) asks for it through the one guard's `realm-workbench` class. */
async function peerReach(face: string | null, members: readonly string[]): Promise<{ reached: string; bytes: number }> {
  const ledger = blank();
  noteWorkbench(ledger, REALM, "notes");
  const ids = new Map<string, "realm-workbench">([...workbenchDocIds(ledger).keys()].map((id) => [id, "realm-workbench"]));
  const guard = protectedDocGuard({
    ids: () => ids,
    decide: {
      "realm-workbench": workbenchDecider({
        realmOfDoc: (id) => workbenchDocIds(ledger).get(id),
        faceOfPeer: () => face,
        holds: (_realm, f) => members.includes(f),
      }),
    },
  });
  const hearth = new Repo({
    network: [], peerId: "hearth" as PeerId,
    shareConfig: shareConfigOf(async (peerId, documentId) => documentId !== undefined && !(await guard.withholds(String(peerId), String(documentId)))),
  });
  const url = realmWorkbenchDocUrl(REALM, "notes");
  const bench = await materializeSharedLarDoc(hearth, url, "board:workbench");
  bench.change((d) => { d.tiddlers["Notes"] = storedLarRecord("Notes", { text: "shared among the faces" }, "workbench"); });
  const { port1, port2 } = new MessageChannel();
  hearth.networkSubsystem.addNetworkAdapter(new MessageChannelNetworkAdapter(port1));
  const other = new Repo({ network: [new MessageChannelNetworkAdapter(port2)], peerId: "device" as PeerId });
  try {
    await Promise.all([hearth.networkSubsystem.whenReady(), other.networkSubsystem.whenReady()]);
    const reached = await settle(other.find<LarDoc>(url as AutomergeUrl).then((h) => h.doc()), 3_000);
    let bytes = 0;
    if (reached === "ready") bytes = A.save((await other.find<LarDoc>(url as AutomergeUrl)).doc() as A.Doc<LarDoc>).byteLength;
    return { reached, bytes };
  } finally {
    port1.close(); port2.close();
    await Promise.allSettled([hearth.shutdown(), other.shutdown()]);
  }
}

describe("W6 — an outsider syncs zero bytes", () => {
  test("a device of a face outside the realm reaches nothing of the workbench", async () => {
    const r = await peerReach("face-stranger", ["face-a", "face-b"]);
    expect(r.reached).not.toBe("ready");
    expect(r.bytes).toBe(0);
  });
  test("a peer that proved no face reaches nothing", async () => {
    const r = await peerReach(null, ["face-a"]);
    expect(r.reached).not.toBe("ready");
  });
  test("CONTROL — a device of a member face syncs the workbench", async () => {
    const r = await peerReach("face-b", ["face-a", "face-b"]);
    expect(r.reached).toBe("ready");
    expect(r.bytes).toBeGreaterThan(0);
  });
});

describe("W7 — offline edits from two member faces converge", () => {
  test("two replicas materialize the one address, write apart, and merge to both edits", async () => {
    const url = realmWorkbenchDocUrl(REALM, "notes");
    const a = new Repo({ network: [], peerId: "face-a" as PeerId });
    const b = new Repo({ network: [], peerId: "face-b" as PeerId });
    try {
      const ha = await materializeSharedLarDoc(a, url, "board:workbench");
      const hb = await materializeSharedLarDoc(b, url, "board:workbench");
      ha.change((d) => { d.tiddlers["From A"] = storedLarRecord("From A", { text: "engineer" }, "workbench"); });
      hb.change((d) => { d.tiddlers["From B"] = storedLarRecord("From B", { text: "referee" }, "workbench"); });
      const merged = A.merge(A.clone(ha.doc() as A.Doc<LarDoc>), hb.doc() as A.Doc<LarDoc>);
      expect(Object.keys(merged.tiddlers).sort()).toEqual(["From A", "From B"]);
      // The other way round reads the same: the merge commutes.
      const back = A.merge(A.clone(hb.doc() as A.Doc<LarDoc>), ha.doc() as A.Doc<LarDoc>);
      expect(A.getHeads(back).sort()).toEqual(A.getHeads(merged).sort());
    } finally {
      await Promise.allSettled([a.shutdown(), b.shutdown()]);
    }
  });
});

describe("W8 — personal content never syncs to another member face", () => {
  test("the one guard: the workbench crosses to every member face's device, a face's personal document to its own alone", async () => {
    const ledger = blank();
    noteWorkbench(ledger, REALM, "notes");
    const bench = String(interpretAsDocumentId(realmWorkbenchDocUrl(REALM, "notes")));
    // Face A's personal document for the wiki: a vessel-private document its owning face alone reaches (lane `ralias`).
    const personalOfA = String(interpretAsDocumentId(deterministicDocUrl("personal-of-face-a")));
    const ownerOf = new Map([[personalOfA, "face-a"]]);
    const faceOfPeer = new Map([["device-of-a", "face-a"], ["device-of-b", "face-b"]]);
    const guard = protectedDocGuard({
      ids: () => new Map([[bench, "realm-workbench" as const], [personalOfA, "vessel-private" as const]]),
      decide: {
        "realm-workbench": workbenchDecider({ realmOfDoc: (id) => workbenchDocIds(ledger).get(id), faceOfPeer: (p) => faceOfPeer.get(p), holds: (_r, f) => f === "face-a" || f === "face-b" }),
        "vessel-private": (peerId, documentId) => ownerOf.get(documentId) === faceOfPeer.get(peerId),
      },
    });
    expect(await guard.withholds("device-of-b", bench), "the workbench reaches a member face").toBe(false);
    expect(await guard.withholds("device-of-b", personalOfA), "A's personal margin never reaches face B").toBe(true);
    expect(await guard.withholds("device-of-a", personalOfA), "A's own device carries A's personal").toBe(false);
    // The workbench's id map names the workbench alone: no personal document rides the realm's class.
    expect([...workbenchDocIds(ledger).keys()]).toEqual([bench]);
  });
});
